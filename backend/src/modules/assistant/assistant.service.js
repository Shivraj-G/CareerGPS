import { pool } from '../../config/database.js';
import { env } from '../../config/env.js';

async function callAi(payload) {
  if (!env.AI_SERVICE_URL) {
    console.error('[assistant] AI_SERVICE_URL is not configured — set AI_SERVICE_URL in backend .env');
    return null;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const headers = { 'content-type': 'application/json' };
    if (env.INTERNAL_SERVICE_TOKEN) headers['x-internal-service-token'] = env.INTERNAL_SERVICE_TOKEN;
    const response = await fetch(`${env.AI_SERVICE_URL}/internal/v1/assistant/answer`, {
      method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[assistant] AI service returned HTTP ${response.status}: ${text}`);
      return null;
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('[assistant] AI service request timed out after 15s');
    } else {
      console.error('[assistant] AI service unreachable:', err.message);
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
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

async function retrieveContext(message, userId, conversationId) {
  const stopWords = new Set(['what', 'where', 'when', 'why', 'who', 'how', 'can', 'could', 'would', 'should', 'is', 'are', 'was', 'were', 'am', 'the', 'a', 'an', 'in', 'for', 'of', 'to', 'and', 'or', 'with', 'about', 'from', 'i', 'do', 'does', 'did', 'my', 'me', 'want', 'become', 'options', 'there', 'here', 'any', 'some', 'after', 'pursue']);
  const terms = message.toLowerCase().split(/[^a-z0-9]+/)
    .filter((x) => x.length >= 3 && !stopWords.has(x))
    .slice(0, 12);
  
  const ilikeTerms = terms.map(t => `%${t}%`);
  const termCondition = ilikeTerms.length > 0 
    ? `(title ILIKE ANY($1) OR COALESCE(description,'') ILIKE ANY($1))` 
    : '1=1';

  const queries = [
    pool.query(`SELECT education, experience, interests, preferred_locations, career_goal FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT id, title, description, qualifications, entry_routes, source_url, source_document_url, verified_at FROM careers WHERE record_status = 'published' AND ${termCondition} ORDER BY title LIMIT 8`, ilikeTerms.length ? [ilikeTerms] : []),
    pool.query(`SELECT id, title, organization, opportunity_type, location, status, application_deadline, description, source_url, source_document_url, verified_at FROM opportunities WHERE record_status = 'published' AND (${termCondition} OR COALESCE(location,'') ILIKE ANY($1)) ORDER BY application_deadline NULLS LAST LIMIT 8`, ilikeTerms.length ? [ilikeTerms] : []),
    pool.query(`SELECT p.id, p.title, p.description, p.career_id, c.title AS career_title, p.source_url, p.source_document_url, p.verified_at FROM pathways p JOIN careers c ON c.id = p.career_id WHERE p.record_status = 'published' AND p.pathway_type = 'template' AND (${ilikeTerms.length > 0 ? `(p.title ILIKE ANY($1) OR COALESCE(p.description,'') ILIKE ANY($1))` : '1=1'}) ORDER BY p.title LIMIT 8`, ilikeTerms.length ? [ilikeTerms] : []),
    pool.query(`SELECT c.id, c.title, c.description, c.location, c.source_url, c.source_document_url, c.verified_at FROM courses c WHERE c.record_status = 'published' AND (${termCondition}) ORDER BY c.title LIMIT 8`, ilikeTerms.length ? [ilikeTerms] : []),
  ];

  const [profile, careers, opportunities, pathways, courses] = await Promise.all(queries);

  // If keyword search found nothing for any category, fetch a broad set so the AI has
  // real CareerGPS data to reference for general questions like "Hello" or "What can you do?"
  let allCareers = careers.rows;
  let allOpportunities = opportunities.rows;
  let allPathways = pathways.rows;
  let allCourses = courses.rows;

  if (!allCareers.length && !allOpportunities.length && !allPathways.length && !allCourses.length) {
    const [broadCareers, broadOpportunities] = await Promise.all([
      pool.query(`SELECT id, title, description FROM careers WHERE record_status = 'published' ORDER BY title LIMIT 12`),
      pool.query(`SELECT id, title, organization, status FROM opportunities WHERE record_status = 'published' ORDER BY application_deadline NULLS LAST LIMIT 8`),
    ]);
    allCareers = broadCareers.rows;
    allOpportunities = broadOpportunities.rows;
  }

  // Fetch recent conversation history for continuity (last 10 messages)
  let history = [];
  if (conversationId) {
    const histResult = await pool.query(
      `SELECT role, content FROM conversation_messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [conversationId]
    );
    history = histResult.rows.reverse(); // oldest first
  }

  return {
    profile: profile.rows[0] ? {
      education: profile.rows[0].education ?? [],
      experience: profile.rows[0].experience ?? [],
      interests: profile.rows[0].interests ?? [],
      preferred_locations: profile.rows[0].preferred_locations ?? [],
      career_goal: profile.rows[0].career_goal ?? null
    } : null,
    careers: allCareers,
    opportunities: allOpportunities,
    pathways: allPathways,
    courses: allCourses,
    history,
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
  const context = await retrieveContext(input.message, userId, conversationId);
  const ai = await callAi({ question: input.message, context });
  const answer = ai?.answer ?? 'The assistant service is currently unavailable. Please use the structured career, pathway, course, and opportunity pages while the service is unavailable.';
  const citations = Array.isArray(ai?.citations) ? ai.citations : [];
  const inserted = await pool.query(
    `INSERT INTO conversation_messages (conversation_id, role, content, citations) VALUES ($1, 'assistant', $2, $3) RETURNING id, role, content, citations, created_at`,
    [conversationId, answer, JSON.stringify(citations)]
  );
  await pool.query(`UPDATE conversations SET updated_at = NOW() WHERE id = $1`, [conversationId]);
  return { conversation_id: conversationId, message: inserted.rows[0] };
}

export async function deleteConversation(userId, conversationId) {
  const result = await pool.query(`DELETE FROM conversations WHERE id = $1 AND user_id = $2 RETURNING id`, [conversationId, userId]);
  return Boolean(result.rows[0]);
}
