import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

async function callAi(path, payload) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
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
    AND ($2 = '' OR p.career_id = $2)`;
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
    let template;
    if (input.pathway_id) {
      const result = await client.query(
        `SELECT p.id, p.career_id, p.title, p.description, p.verification_status,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'id', ps.id, 'step_order', ps.step_order, 'title', ps.title,
                  'description', ps.description, 'step_type', ps.step_type, 'metadata', ps.metadata
                ) ORDER BY ps.step_order) FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb) AS steps
         FROM pathways p WHERE p.id = $1 AND p.record_status = 'published' AND p.pathway_type = 'template'
         FOR SHARE`, [input.pathway_id]
      );
      template = result.rows[0];
    } else {
      const result = await client.query(
        `SELECT p.id, p.career_id, p.title, p.description, p.verification_status,
                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                  'id', ps.id, 'step_order', ps.step_order, 'title', ps.title,
                  'description', ps.description, 'step_type', ps.step_type, 'metadata', ps.metadata
                ) ORDER BY ps.step_order) FROM pathway_steps ps WHERE ps.pathway_id = p.id), '[]'::jsonb) AS steps
         FROM pathways p WHERE p.career_id = $1 AND p.record_status = 'published' AND p.pathway_type = 'template'
         ORDER BY p.title LIMIT 1 FOR SHARE`, [input.career_id]
      );
      template = result.rows[0];
    }
    if (!template) {
      const error = new Error('A published pathway template could not be found.');
      error.statusCode = 404; error.code = 'PATHWAY_TEMPLATE_NOT_FOUND'; throw error;
    }
    if (template.verification_status !== 'verified') {
      const error = new Error('The pathway template is not verified and cannot be used for a personalized pathway.');
      error.statusCode = 409; error.code = 'PATHWAY_NOT_VERIFIED'; throw error;
    }

    const profileResult = await client.query(
      `SELECT education, experience, interests, preferred_locations, career_goal, constraints
       FROM user_profiles WHERE user_id = $1`, [userId]
    );
    const profile = profileResult.rows[0] ?? {};
    const ai = await callAi('/internal/v1/pathways/reason', {
      goal: input.goal ?? profile.career_goal ?? null,
      preferences: input.preferences ?? { preferred_locations: profile.preferred_locations ?? [], constraints: profile.constraints ?? {} },
      template: { id: template.id, career_id: template.career_id, title: template.title, description: template.description, steps: template.steps },
      profile: { education: profile.education ?? [], experience: profile.experience ?? [], interests: profile.interests ?? [] }
    });

    const context = {
      generated_from_pathway_id: template.id,
      generated_at: new Date().toISOString(),
      goal: input.goal ?? profile.career_goal ?? null,
      preferences: input.preferences ?? {},
      ai_reasoning: ai?.reasoning ?? null,
      ai_available: Boolean(ai)
    };
    const userPathway = await client.query(
      `INSERT INTO user_pathways (user_id, pathway_id, title, generated_context)
       VALUES ($1, $2, $3, $4) RETURNING id, user_id, pathway_id, title, status, generated_context, created_at, updated_at`,
      [userId, template.id, `${template.title} — Personalized`, JSON.stringify(context)]
    );
    for (const step of template.steps) {
      await client.query(
        `INSERT INTO user_pathway_steps (user_pathway_id, pathway_step_id) VALUES ($1, $2)`,
        [userPathway.rows[0].id, step.id]
      );
    }
    await client.query('COMMIT');
    return { ...userPathway.rows[0], steps: template.steps.map((step) => ({ ...step, status: 'not_started' })), ai_reasoning: ai?.reasoning ?? null };
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
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
      const timestamps = item.status === 'completed'
        ? [item.status, item.notes ?? null, 'COALESCE(started_at, NOW())', 'NOW()']
        : item.status === 'in_progress'
          ? [item.status, item.notes ?? null, 'NOW()', 'NULL']
          : [item.status, item.notes ?? null, 'NULL', 'NULL'];
      await client.query(
        `UPDATE user_pathway_steps SET status = $1, notes = $2,
           started_at = ${timestamps[2]}, completed_at = ${timestamps[3]}
         WHERE user_pathway_id = $3 AND pathway_step_id = $4`,
        [timestamps[0], timestamps[1], actualUserPathwayId, item.pathway_step_id]
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
