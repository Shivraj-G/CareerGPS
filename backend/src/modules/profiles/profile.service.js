import { pool } from '../../config/database.js';

export async function getProfile(userId) {
  const result = await pool.query(
    `SELECT up.id, up.education, up.experience, up.interests, up.preferred_locations,
            up.career_goal, up.constraints, up.profile_status, up.created_at, up.updated_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'name', s.name, 'level', us.level, 'years_experience', us.years_experience,
              'verified', us.verified
            ) ORDER BY s.name) FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = up.user_id), '[]'::jsonb) AS skills
     FROM user_profiles up WHERE up.user_id = $1`, [userId]
  );
  return result.rows[0] ?? null;
}

export async function updateProfile(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query('SELECT id FROM user_profiles WHERE user_id = $1 FOR UPDATE', [userId]);
    if (!existing.rows[0]) {
      const error = new Error('Profile not found.'); error.statusCode = 404; error.code = 'PROFILE_NOT_FOUND'; throw error;
    }

    const fields = [];
    const values = [];
    const add = (column, value) => { fields.push(`${column} = $${values.length + 1}`); values.push(value); };
    if (input.education !== undefined) add('education', JSON.stringify(input.education));
    if (input.experience !== undefined) add('experience', JSON.stringify(input.experience));
    if (input.interests !== undefined) add('interests', JSON.stringify(input.interests));
    if (input.preferred_locations !== undefined) add('preferred_locations', JSON.stringify(input.preferred_locations));
    if (input.career_goal !== undefined) add('career_goal', input.career_goal);
    if (input.constraints !== undefined) add('constraints', JSON.stringify(input.constraints));
    if (fields.length) {
      values.push(userId);
      await client.query(`UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = $${values.length}`, values);
    }

    if (input.skills !== undefined) {
      await client.query('DELETE FROM user_skills WHERE user_id = $1', [userId]);
      for (const item of input.skills) {
        const skillResult = await client.query(
          `INSERT INTO skills (name, record_status) VALUES ($1, 'draft')
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`, [item.name]
        );
        await client.query(
          `INSERT INTO user_skills (user_id, skill_id, level, years_experience)
           VALUES ($1, $2, $3, $4)`, [userId, skillResult.rows[0].id, item.level, item.years_experience ?? null]
        );
      }
    }

    const profile = await getProfileWithClient(client, userId);
    const complete = Boolean(
      profile.education?.length && profile.skills?.length && profile.experience?.length &&
      profile.interests?.length && profile.preferred_locations?.length && profile.career_goal
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
            up.career_goal, up.constraints, up.profile_status, up.created_at, up.updated_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'level', us.level, 'years_experience', us.years_experience, 'verified', us.verified) ORDER BY s.name)
              FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = up.user_id), '[]'::jsonb) AS skills
     FROM user_profiles up WHERE up.user_id = $1`, [userId]
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
