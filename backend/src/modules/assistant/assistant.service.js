import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

async function callAi(payload) {
  if (!env.AI_SERVICE_URL) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    const response = await fetch(`${env.AI_SERVICE_URL}/internal/v1/assistant/answer`, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; } finally { clearTimeout(timeout); }
}

export async function listConversations(userId) {
  const result = await pool.query(`SELECT id, title, created_at, updated_at FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 100`, [userId]);
  return result.rows;
}

export async function getConversation(userId, conversationId) {
  const result = await pool.query(`SELECT id, title, created_at, updated_at FROM conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
  if (!result.rows[0]) return null;
  const messages = await pool.query(`SELECT id, role, content, citations, created_at FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at ASC`, [conversationId]);
  return { ...result.rows[0], messages: messages.rows };
}

async function retrieveContext(message, userId) {
  const terms = message.toLowerCase().split(/[^a-z0-9]+/).filter((x) => x.length >= 3).slice(0, 12);
  const pattern = terms.length ? `%${terms.join('%')}%` : '%';
  const [profile, careers, opportunities, pathways, courses] = await Promise.all([
    pool.query(`SELECT education, experience, interests, preferred_locations, career_goal FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT id, title, description, qualifications, entry_routes, source_id, source_url, source_document_url, verified_at FROM careers WHERE record_status = 'published' AND (LOWER(title) LIKE $1 OR LOWER(COALESCE(description,'')) LIKE $1) ORDER BY title LIMIT 8`, [pattern]),
    pool.query(`SELECT id, title, organization, opportunity_type, location, status, application_deadline, description, source_id, source_url, source_document_url, verified_at FROM opportunities WHERE record_status = 'published' AND (LOWER(title) LIKE $1 OR LOWER(COALESCE(description,'')) LIKE $1 OR LOWER(COALESCE(location,'')) LIKE $1) ORDER BY application_deadline NULLS LAST LIMIT 8`, [pattern]),
    pool.query(`SELECT p.id, p.title, p.description, p.career_id, c.title AS career_title, p.source_url, p.source_document_url, p.verified_at FROM pathways p JOIN careers c ON c.id = p.career_id WHERE p.record_status = 'published' AND p.pathway_type = 'template' AND (LOWER(p.title) LIKE $1 OR LOWER(COALESCE(p.description,'')) LIKE $1) ORDER BY p.title LIMIT 8`, [pattern]),
    pool.query(`SELECT c.id, c.title, c.description, c.location, c.institution_id, c.source_url, c.source_document_url, c.verified_at FROM courses c WHERE c.record_status = 'published' AND (LOWER(c.title) LIKE $1 OR LOWER(COALESCE(c.description,'')) LIKE $1) ORDER BY c.title LIMIT 8`, [pattern])
  ]);
  return {
    profile: profile.rows[0] ? { education: profile.rows[0].education ?? [], experience: profile.rows[0].experience ?? [], interests: profile.rows[0].interests ?? [], preferred_locations: profile.rows[0].preferred_locations ?? [], career_goal: profile.rows[0].career_goal ?? null } : null,
    careers: careers.rows, opportunities: opportunities.rows, pathways: pathways.rows, courses: courses.rows
  };
}

export async function chat(userId, input) {
  let conversationId = input.conversation_id;
  if (conversationId) {
    const owner = await pool.query(`SELECT id FROM conversations WHERE id = $1 AND user_id = $2`, [conversationId, userId]);
    if (!owner.rows[0]) { const e = new Error('Conversation not found.'); e.statusCode = 404; e.code = 'CONVERSATION_NOT_FOUND'; throw e; }
  } else {
    const created = await pool.query(`INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id`, [userId, input.message.slice(0, 80)]);
    conversationId = created.rows[0].id;
  }
  await pool.query(`INSERT INTO conversation_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`, [conversationId, input.message]);
  const context = await retrieveContext(input.message, userId);
  const ai = await callAi({ question: input.message, context });
  const answer = ai?.answer ?? 'The assistant service is currently unavailable. Please use the structured career, pathway, course, and opportunity pages while the service is unavailable.';
  const citations = Array.isArray(ai?.citations) ? ai.citations : [];
  const inserted = await pool.query(`INSERT INTO conversation_messages (conversation_id, role, content, citations) VALUES ($1, 'assistant', $2, $3) RETURNING id, role, content, citations, created_at`, [conversationId, answer, JSON.stringify(citations)]);
  await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
  return { conversation_id: conversationId, message: inserted.rows[0] };
}

export async function deleteConversation(userId, conversationId) {
  const result = await pool.query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id`, [conversationId, userId]);
  return Boolean(result.rows[0]);
}
