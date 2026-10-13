import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';
import { validateProgramCompatibility, normalizeStream } from '../education/education.service.js';
import { evaluateGoalEligibility } from '../goals/goal.engine.js';

export async function getProfile(userId) {
  if (!userId) return null;
  const result = await pool.query(
    `SELECT up.id, up.education, up.experience, up.interests, up.preferred_locations,
            up.career_goal, up.current_goal, up.career_id, up.constraints, up.profile_status,
            COALESCE(up.full_name, u.full_name) AS full_name,
            up.created_at, up.updated_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', s.name, 'level', us.level, 'years_experience', us.years_experience,
              'verified', us.verified
            ) ORDER BY s.name) FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = up.user_id), '[]'::jsonb) AS skills
     FROM user_profiles up
     LEFT JOIN users u ON u.id = up.user_id
     WHERE up.user_id = $1`, [userId]
  );
  if (result.rows[0]) return result.rows[0];

  // Auto-provision a draft profile row if user exists but has no profile row yet
  try {
    const userCheck = await pool.query('SELECT id, full_name FROM users WHERE id = $1', [userId]);
    if (!userCheck.rows[0]) return null;

    const inserted = await pool.query(
      `INSERT INTO user_profiles (user_id, profile_status, full_name)
       VALUES ($1, 'draft', $2)
       ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
       RETURNING id, education, experience, interests, preferred_locations, career_goal, current_goal, career_id, constraints, profile_status, full_name, created_at, updated_at`,
      [userId, userCheck.rows[0].full_name || null]
    );
    return {
      ...inserted.rows[0],
      education: inserted.rows[0].education || [],
      experience: inserted.rows[0].experience || [],
      interests: inserted.rows[0].interests || [],
      preferred_locations: inserted.rows[0].preferred_locations || [],
      skills: []
    };
  } catch {
    const retry = await pool.query(
      `SELECT up.id, up.education, up.experience, up.interests, up.preferred_locations,
              up.career_goal, up.current_goal, up.career_id, up.constraints, up.profile_status,
              COALESCE(up.full_name, u.full_name) AS full_name,
              up.created_at, up.updated_at,
              '[]'::jsonb AS skills
       FROM user_profiles up
       LEFT JOIN users u ON u.id = up.user_id
       WHERE up.user_id = $1`, [userId]
    );
    return retry.rows[0] ?? null;
  }
}

export async function updateProfile(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id, profile_status, education FROM user_profiles WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!existing.rows[0]) {
      const error = new Error('Profile not found.'); error.statusCode = 404; error.code = 'PROFILE_NOT_FOUND'; throw error;
    }
    const existingRow = existing.rows[0];
    const isLocked = existingRow.profile_status === 'complete' && Array.isArray(existingRow.education) && existingRow.education.length > 0;

    const fields = [];
    const values = [];
    const add = (column, value) => { fields.push(`${column} = $${values.length + 1}`); values.push(value); };
    if (input.education !== undefined) {
      if (isLocked) {
        const error = new Error('Education details are set during onboarding and cannot be modified.');
        error.statusCode = 403;
        error.code = 'EDUCATION_LOCKED';
        throw error;
      }

      for (const edu of input.education) {
        if (edu.school_12_stream) edu.school_12_stream = normalizeStream(edu.school_12_stream);
        if (edu.stream) edu.stream = normalizeStream(edu.stream);

        if ((edu.education_stage === 'HIGHER_EDUCATION' || edu.level === 'Undergraduate') && edu.level !== 'Postgraduate') {
           const stream = edu.school_12_stream || edu.stream;
           const program = edu.current_program || edu.degree;
           if (stream && program) {
             if (!validateProgramCompatibility(stream, program)) {
                const error = new Error(`${program} is not compatible with the selected 12th stream.`);
                error.statusCode = 422;
                error.code = 'INVALID_EDUCATION_COMBINATION';
                throw error;
             }
           }
        }
      }
      add('education', JSON.stringify(input.education));
    }
    if (input.experience !== undefined) add('experience', JSON.stringify(input.experience));
    if (input.interests !== undefined) add('interests', JSON.stringify(input.interests));
    if (input.preferred_locations !== undefined) add('preferred_locations', JSON.stringify(input.preferred_locations));
    if (input.career_goal !== undefined) {
      add('career_goal', input.career_goal);
      
      const profileData = await getProfileWithClient(client, userId);
      const evalResult = input.career_goal ? evaluateGoalEligibility(profileData, { title: input.career_goal }) : null;
      
      const currentGoalObj = input.career_goal ? {
        entity_type: 'Career',
        title: input.career_goal,
        status: 'Active',
        timestamp: new Date().toISOString(),
        eligibility: evalResult ? {
          state: evalResult.status,
          decision: evalResult.decision,
          action: evalResult.action
        } : null
      } : null;
      
      add('current_goal', currentGoalObj ? JSON.stringify(currentGoalObj) : null);
    }
    const fullNameValue = input.full_name !== undefined ? input.full_name : input.name;
    if (fullNameValue !== undefined) {
      const cleanName = fullNameValue ? fullNameValue.trim() : null;
      add('full_name', cleanName);
      await client.query('UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2', [cleanName, userId]);
    }
    if (input.career_id !== undefined) add('career_id', input.career_id);
    if (input.constraints !== undefined) add('constraints', JSON.stringify(input.constraints));
    if (fields.length) {
      values.push(userId);
      await client.query(`UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = $${values.length}`, values);
    }

    if (input.skills !== undefined) {
      const resolvedSkillIds = [];
      for (const item of input.skills) {
        if (!item.name || typeof item.name !== 'string') continue;
        const normName = item.name.trim().replace(/\s+/g, ' ');
        if (!normName) continue;

        let skillId;
        const exist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [normName]);
        if (exist.rows.length > 0) {
          skillId = exist.rows[0].id;
        } else {
          try {
            const skillResult = await client.query(
              `INSERT INTO skills (name, record_status) VALUES ($1, 'draft') RETURNING id`, [normName]
            );
            skillId = skillResult.rows[0].id;
          } catch (err) {
            if (err.code === '23505') { // unique violation
              const reExist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [normName]);
              skillId = reExist.rows[0].id;
            } else {
              throw err;
            }
          }
        }

        resolvedSkillIds.push(skillId);

        await client.query(
          `INSERT INTO user_skills (user_id, skill_id, level, years_experience)
           VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, skill_id) DO UPDATE SET level = EXCLUDED.level, years_experience = EXCLUDED.years_experience`, [userId, skillId, item.level, item.years_experience ?? null]
        );
      }

      if (resolvedSkillIds.length > 0) {
        await client.query(
          `DELETE FROM user_skills WHERE user_id = $1 AND skill_id != ALL($2::uuid[])`,
          [userId, resolvedSkillIds]
        );
      } else {
        await client.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
      }
    }

    const profile = await getProfileWithClient(client, userId);
    const complete = existingRow.profile_status === 'complete' || Boolean(
      profile.education?.length && profile.skills?.length &&
      profile.preferred_locations?.length && profile.career_goal
    );
    await client.query('UPDATE user_profiles SET profile_status = $1 WHERE user_id = $2', [complete ? 'complete' : 'draft', userId]);
    profile.profile_status = complete ? 'complete' : 'draft';
    await client.query('COMMIT');
    return profile;
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}

async function getProfileWithClient(client, userId) {
  const result = await client.query(
    `SELECT up.id, up.education, up.experience, up.interests, up.preferred_locations,
            up.career_goal, up.current_goal, up.career_id, up.constraints, up.profile_status,
            COALESCE(up.full_name, u.full_name) AS full_name,
            up.created_at, up.updated_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'level', us.level, 'years_experience', us.years_experience, 'verified', us.verified) ORDER BY s.name)
              FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = up.user_id), '[]'::jsonb) AS skills
     FROM user_profiles up
     LEFT JOIN users u ON u.id = up.user_id
     WHERE up.user_id = $1`, [userId]
  );
  return result.rows[0] ?? null;
}

export function calculateCompleteness(profile) {
  const checks = [
    ['education', Array.isArray(profile.education) && profile.education.length > 0],
    ['skills', Array.isArray(profile.skills) && profile.skills.length > 0],
    ['experience', Array.isArray(profile.experience) && profile.experience.length > 0],
    ['interests', Array.isArray(profile.interests) && profile.interests.length > 0],
    ['preferred_locations', Array.isArray(profile.preferred_locations) && profile.preferred_locations.length > 0],
    ['career_goal', Boolean(profile.career_goal)]
  ];
  const completed = checks.filter(([, ok]) => ok).length;
  return { completed_fields: completed, total_fields: checks.length, percentage: Math.round((completed / checks.length) * 100), missing_fields: checks.filter(([, ok]) => !ok).map(([name]) => name) };
}
