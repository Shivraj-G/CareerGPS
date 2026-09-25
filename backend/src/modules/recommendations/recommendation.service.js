import { pool } from '../../config/database.js';
export async function buildRecommendationContext(userId, goal, preferences) {
  const [profile, skills, careers] = await Promise.all([
    pool.query(`SELECT education, experience, interests, preferred_locations, career_goal, constraints FROM user_profiles WHERE user_id = $1`, [userId]),
    pool.query(`SELECT s.id, s.name, us.level FROM user_skills us JOIN skills s ON s.id = us.skill_id WHERE us.user_id = $1 AND s.record_status = 'published'`, [userId]),
    pool.query(`SELECT c.id, c.title, c.description, c.qualifications, c.entry_routes FROM careers c WHERE c.record_status = 'published' ORDER BY c.title`)
  ]);
  const ids = careers.rows.map((c) => c.id);
  const mappings = ids.length ? await pool.query(`SELECT cs.career_id, s.id AS skill_id, s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = ANY($1::uuid[]) AND s.record_status = 'published'`, [ids]) : { rows: [] };
  const byCareer = new Map();
  for (const row of mappings.rows) { if (!byCareer.has(row.career_id)) byCareer.set(row.career_id, []); byCareer.get(row.career_id).push(row); }
  return { profile: profile.rows[0] ?? null, skills: skills.rows, careers: careers.rows.map((c) => ({ ...c, required_skills: byCareer.get(c.id) ?? [] })), goal: goal ?? profile.rows[0]?.career_goal ?? null, preferences: preferences ?? {} };
}
export async function saveRecommendation(userId, goal, preferences, results) {
  const result = await pool.query(`INSERT INTO recommendations (user_id, goal, preferences, results) VALUES ($1,$2,$3,$4) RETURNING id, created_at`, [userId, goal ?? null, preferences ?? {}, JSON.stringify(results)]);
  return result.rows[0];
}
