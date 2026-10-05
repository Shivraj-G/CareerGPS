import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

export async function listUserPathways(userId) {
  const result = await pool.query(
    `SELECT up.id, up.pathway_id, up.title, up.status, up.created_at, up.updated_at,
            p.career_id, c.title AS career_title
     FROM user_pathways up
     JOIN pathways p ON p.id = up.pathway_id
     LEFT JOIN careers c ON c.id = p.career_id
     WHERE up.user_id = $1 AND up.status IN ('active', 'completed')
     ORDER BY up.updated_at DESC`, [userId]
  );
  return result.rows;
}

async function callAi(path, payload, timeoutMs = 8000) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    const response = await fetch(`${env.AI_SERVICE_URL}${path}`, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally { clearTimeout(timeout); }
}

export async function listPathways({ page, limit, search, careerId }) {
  const offset = (page - 1) * limit;
  const values = [search, careerId ?? ''];
  const where = `WHERE p.record_status = 'published' AND p.pathway_type = 'template'
    AND ($1 = '' OR p.title ILIKE '%' || $1 || '%' OR p.description ILIKE '%' || $1 || '%')
    AND ($2 = '' OR p.career_id = NULLIF($2, '')::uuid)`;
  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM pathways p ${where}`, values);
  values.push(limit, offset);
  const result = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.verification_status, p.source_url, p.source_document_url, p.verified_at
     FROM pathways p JOIN careers c ON c.id = p.career_id
     ${where} ORDER BY p.title LIMIT $3 OFFSET $4`, values
  );
  const total = count.rows[0].total;
  return { data: result.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } };
}

export async function getPathway(pathwayId, userId = null) {
  const result = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.pathway_type, p.record_status, p.verification_status, p.source_url,
            p.source_document_url, p.source_last_checked_at, p.verified_at,
            COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'id', ps.id, 'step_order', ps.step_order, 'title', ps.title,
              'description', ps.description, 'step_type', ps.step_type, 'metadata', ps.metadata
            ) ORDER BY ps.step_order) FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb) AS steps
     FROM pathways p JOIN careers c ON c.id = p.career_id
     WHERE p.id = $1 AND p.record_status = 'published' AND p.pathway_type = 'template'`, [pathwayId]
  );
  if (!result.rows[0]) return null;
  const data = result.rows[0];
  if (userId) {
    const saved = await pool.query(
      `SELECT id FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND item_id = $2`, [userId, pathwayId]
    );
    data.saved = Boolean(saved.rows[0]);
  }
  return data;
}

export async function generatePathway(userId, input) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    if (!input.career_id) {
       const error = new Error('career_id is required.');
       error.statusCode = 400; error.code = 'VALIDATION_ERROR'; throw error;
    }

    const careerRes = await client.query('SELECT id, title, description, qualifications, entry_routes, responsibilities FROM careers WHERE id = $1', [input.career_id]);
    const careerRow = careerRes.rows[0];
    if (!careerRow) {
      const error = new Error('Career not found.');
      error.statusCode = 404; error.code = 'CAREER_NOT_FOUND'; throw error;
    }

    const profileRes = await client.query(
      `SELECT education, experience, interests, preferred_locations, career_goal, constraints
       FROM user_profiles WHERE user_id = $1`, [userId]
    );
    const profile = profileRes.rows[0] ?? {};

    const userSkillsRes = await client.query(
      `SELECT s.name FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1`, [userId]
    );
    const userSkills = userSkillsRes.rows.map(r => r.name);

    const careerSkillsRes = await client.query(
      `SELECT s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1`, [input.career_id]
    );
    const requiredSkills = careerSkillsRes.rows;

    const matched = [];
    const missingRequired = [];
    const missingUseful = [];
    
    const userSet = new Set(userSkills.map(s => s.toLowerCase()));
    for (const sk of requiredSkills) {
      if (userSet.has(sk.name.toLowerCase())) {
        matched.push(sk.name);
      } else if (sk.importance === 'required' || sk.importance === 'important') {
        missingRequired.push(sk.name);
      } else {
        missingUseful.push(sk.name);
      }
    }

    const aiRes = await callAi('/internal/v1/pathways/generate_two', {
      career_context: careerRow,
      user_context: profile,
      skill_gap: { matched, missing_required: missingRequired, missing_useful: missingUseful }
    }, 45000);

    if (!aiRes || aiRes.status !== 'ai_generated' || !aiRes.pathways || aiRes.pathways.length !== 2) {
      const error = new Error('Failed to generate pathways.');
      error.statusCode = 500; error.code = 'AI_GENERATION_FAILED'; throw error;
    }

    const generatedUserPathways = [];
    const context = {
      generated_at: new Date().toISOString(),
      goal: input.goal ?? profile.career_goal ?? null,
      preferences: input.preferences ?? {}
    };

    for (const pw of aiRes.pathways) {
      const pRes = await client.query(
        `INSERT INTO pathways (career_id, title, description, pathway_type, record_status, verification_status, origin)
         VALUES ($1, $2, $3, 'generated', 'published', 'unverified', 'ai_generated')
         RETURNING id, career_id, title, description, verification_status, origin`,
        [input.career_id, pw.title, pw.summary]
      );
      const template = pRes.rows[0];
      template.steps = [];
      
      for (const step of pw.steps || []) {
        const sRes = await client.query(
          `INSERT INTO pathway_steps (pathway_id, step_order, title, description, step_type, verification_status, origin)
           VALUES ($1, $2, $3, $4, $5, 'unverified', 'ai_generated')
           RETURNING id, step_order, title, description, step_type, metadata`,
          [template.id, step.order, step.title, step.description, step.step_type]
        );
        template.steps.push(sRes.rows[0]);
      }

      const upContext = { ...context, strategy: pw.strategy, estimated_duration: pw.estimated_duration };
      const userPathway = await client.query(
        `INSERT INTO user_pathways (user_id, pathway_id, title, generated_context, status)
         VALUES ($1, $2, $3, $4, 'generated') RETURNING id, user_id, pathway_id, title, status, generated_context, created_at, updated_at`,
        [userId, template.id, pw.title, JSON.stringify(upContext)]
      );
      
      for (const step of template.steps) {
        await client.query(
          `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id) VALUES ($1, $2)`,
          [userPathway.rows[0].id, step.id]
        );
      }
      generatedUserPathways.push({ ...userPathway.rows[0], steps: template.steps.map((step) => ({ ...step, status: 'not_started' })) });
    }

    await client.query('COMMIT');
    return generatedUserPathways;
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
}

export async function selectPathway(userId, userPathwayId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(`SELECT id, status, generated_context FROM user_pathways WHERE id = $1 AND user_id = $2 FOR UPDATE`, [userPathwayId, userId]);
    if (res.rows.length === 0) throw new Error('Not found');
    const row = res.rows[0];
    if (row.status !== 'generated') {
       await client.query('COMMIT');
       return row;
    }
    
    // Find the other generated pathway from the same batch
    if (row.generated_context && row.generated_context.generated_at) {
       await client.query(`UPDATE user_pathways SET status = 'archived' WHERE user_id = $1 AND status = 'generated' AND generated_context->>'generated_at' = $2 AND id != $3`, [userId, row.generated_context.generated_at, userPathwayId]);
    }

    const updated = await client.query(`UPDATE user_pathways SET status = 'active' WHERE id = $1 RETURNING *`, [userPathwayId]);
    await client.query('COMMIT');
    return await getUserPathway(userId, userPathwayId);
  } catch (err) {
    await client.query('ROLLBACK');
    return null;
  } finally {
    client.release();
  }
}

export async function getUserPathway(userId, userPathwayId) {
  const result = await pool.query(
    `SELECT up.id, up.user_id, up.pathway_id, up.title, up.status, up.generated_context,
            up.created_at, up.updated_at, p.career_id, c.title AS career_title,
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', ups.id, 'pathway_step_id', ups.pathway_step_id, 'step_order', ps.step_order,
              'title', ps.title, 'description', ps.description, 'step_type', ps.step_type,
              'status', ups.status, 'started_at', ups.started_at, 'completed_at', ups.completed_at, 'notes', ups.notes
            ) ORDER BY ps.step_order) FILTER (WHERE ups.id IS NOT NULL), '[]'::jsonb) AS steps
     FROM user_pathways up JOIN pathways p ON p.id = up.pathway_id
     JOIN careers c ON c.id = p.career_id
     LEFT JOIN user_pathway_steps ups ON ups.user_pathway_id = up.id
     LEFT JOIN pathway_steps ps ON ps.id = ups.pathway_step_id
     WHERE up.user_id = $2 AND (up.id = $1 OR up.pathway_id = $1)
     GROUP BY up.id, p.id, c.id ORDER BY up.updated_at DESC LIMIT 1`, [userPathwayId, userId]
  );
  return result.rows[0] ?? null;
}

export async function selectTemplatePathway(userId, pathwayId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Check if user already has an active pathway for this career. If so, archive it?
    // The user's requirements: "If the existing database pathway is also selectable, preserve that ability. The selected pathway should be represented using the existing user_pathways mechanism."
    
    const pRes = await client.query(
      `SELECT id, career_id, title FROM pathways WHERE id = $1 AND pathway_type = 'template' AND record_status = 'published'`,
      [pathwayId]
    );
    if (!pRes.rows[0]) throw new Error('Template pathway not found');
    const template = pRes.rows[0];

    // Archive existing active pathways for this career? No, let's just make this one active.
    
    const upRes = await client.query(
      `INSERT INTO user_pathways (user_id, pathway_id, title, status)
       VALUES ($1, $2, $3, 'active') RETURNING id`,
      [userId, template.id, template.title]
    );
    const userPathwayId = upRes.rows[0].id;

    // Insert steps
    const stepsRes = await client.query(
      `SELECT id FROM pathway_steps WHERE pathway_id = $1 ORDER BY step_order`,
      [template.id]
    );
    
    for (const step of stepsRes.rows) {
      await client.query(
        `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id) VALUES ($1, $2)`,
        [userPathwayId, step.id]
      );
    }
    
    await client.query('COMMIT');
    return await getUserPathway(userId, userPathwayId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCareerPathways(userId, careerId) {
  // 1. Get existing database reference pathways
  const dbPathwaysRes = await pool.query(
    `SELECT p.id, p.career_id, c.title AS career_title, p.title, p.description,
            p.verification_status, p.source_url, p.source_document_url, p.verified_at,
            (SELECT COALESCE(json_agg(row_to_json(ps.*)), '[]'::json) FROM (SELECT * FROM pathway_steps ps2 WHERE ps2.pathway_id = p.id ORDER BY step_order) ps) as steps
     FROM pathways p JOIN careers c ON c.id = p.career_id
     WHERE p.career_id = $1 AND p.record_status = 'published' AND p.pathway_type = 'template'
     ORDER BY p.title`,
    [careerId]
  );
  
  // 2. Get user pathways for this career (both AI-generated and selected DB pathways)
  const userPathwaysRes = await pool.query(
    `SELECT up.id, up.user_id, up.pathway_id, up.title, up.status, up.generated_context,
            up.created_at, up.updated_at, p.career_id, c.title AS career_title, p.origin, p.pathway_type,
            (
               SELECT COALESCE(jsonb_agg(jsonb_build_object(
                 'id', ups.id, 'pathway_step_id', ups.pathway_step_id, 'step_order', ps.step_order,
                 'title', ps.title, 'description', ps.description, 'step_type', ps.step_type,
                 'status', ups.status, 'started_at', ups.started_at, 'completed_at', ups.completed_at, 'notes', ups.notes
               ) ORDER BY ps.step_order), '[]'::jsonb)
               FROM user_pathway_steps ups 
               JOIN pathway_steps ps ON ps.id = ups.pathway_step_id
               WHERE ups.user_pathway_id = up.id
            ) AS steps
     FROM user_pathways up JOIN pathways p ON p.id = up.pathway_id
     JOIN careers c ON c.id = p.career_id
     WHERE up.user_id = $1 AND p.career_id = $2 AND up.status != 'archived'
     ORDER BY up.updated_at DESC`,
    [userId, careerId]
  );

  let selected = null;
  const aiGenerated = [];

  for (const row of userPathwaysRes.rows) {
    if (row.status === 'active' || row.status === 'completed') {
       if (!selected) selected = row; // Keep the most recently updated one
    } else if (row.status === 'generated' && row.pathway_type === 'generated' && row.origin === 'ai_generated') {
       aiGenerated.push(row);
    }
  }

  return {
    existing: dbPathwaysRes.rows,
    aiGenerated: aiGenerated,
    selected: selected
  };
}

export async function updateProgress(userId, userPathwayId, steps) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owner = await client.query('SELECT id FROM user_pathways WHERE user_id = $2 AND (id = $1 OR pathway_id = $1) ORDER BY updated_at DESC LIMIT 1 FOR UPDATE', [userPathwayId, userId]);
    if (!owner.rows[0]) {
      const error = new Error('Personalized pathway not found.'); error.statusCode = 404; error.code = 'USER_PATHWAY_NOT_FOUND'; throw error;
    }
    const actualUserPathwayId = owner.rows[0].id;
    for (const item of steps) {
      const exists = await client.query(
        'SELECT id FROM user_pathway_steps WHERE user_pathway_id = $1 AND pathway_step_id = $2', [actualUserPathwayId, item.pathway_step_id]
      );
      if (!exists.rows[0]) {
        const error = new Error('One or more pathway steps do not belong to this personalized pathway.'); error.statusCode = 400; error.code = 'INVALID_PATHWAY_STEP'; throw error;
      }
      // Build timestamps safely without string interpolation into SQL
      let startedAtSql, completedAtSql;
      if (item.status === 'completed') {
        startedAtSql = 'COALESCE(started_at, NOW())';
        completedAtSql = 'NOW()';
      } else if (item.status === 'in_progress') {
        startedAtSql = 'NOW()';
        completedAtSql = 'NULL';
      } else {
        startedAtSql = 'NULL';
        completedAtSql = 'NULL';
      }
      await client.query(
        `UPDATE user_pathway_steps SET status = $1, notes = $2,
           started_at = ${startedAtSql}, completed_at = ${completedAtSql}
         WHERE user_pathway_id = $3 AND pathway_step_id = $4`,
        [item.status, item.notes ?? null, actualUserPathwayId, item.pathway_step_id]
      );
    }
    const counts = await client.query(
      `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
       FROM user_pathway_steps WHERE user_pathway_id = $1`, [actualUserPathwayId]
    );
    const complete = counts.rows[0].total > 0 && counts.rows[0].total === counts.rows[0].completed;
    await client.query('UPDATE user_pathways SET status = $1, updated_at = NOW() WHERE id = $2', [complete ? 'completed' : 'active', actualUserPathwayId]);
    await client.query('COMMIT');
    return getUserPathway(userId, actualUserPathwayId);
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

export async function savePathway(userId, pathwayId) {
  const pathway = await pool.query(`SELECT id FROM pathways WHERE id = $1 AND record_status = 'published' AND pathway_type = 'template'`, [pathwayId]);
  if (!pathway.rows[0]) return false;
  await pool.query(
    `INSERT INTO saved_items (user_id, item_type, item_id) VALUES ($1, 'pathway', $2) ON CONFLICT (user_id, item_type, item_id) DO NOTHING`, [userId, pathwayId]
  );
  return true;
}

export async function unsavePathway(userId, pathwayId) {
  const result = await pool.query(`DELETE FROM saved_items WHERE user_id = $1 AND item_type = 'pathway' AND item_id = $2 RETURNING id`, [userId, pathwayId]);
  return Boolean(result.rows[0]);
}
