import { pool } from '../../config/database.js';

export async function getUserSkills(userId) {
  const result = await pool.query(
    `SELECT s.id, s.name, s.description, us.level, us.years_experience, us.verified
     FROM user_skills us JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = $1 AND s.record_status = 'published'
     ORDER BY s.name`, [userId]
  );
  return result.rows;
}

export async function calculateSkillGap(userId, careerId) {
  const [userSkills, careerSkills] = await Promise.all([
    getUserSkills(userId),
    pool.query(`SELECT s.id, s.name, cs.importance FROM career_skills cs JOIN skills s ON s.id = cs.skill_id WHERE cs.career_id = $1 AND s.record_status = 'published' ORDER BY CASE cs.importance WHEN 'required' THEN 1 WHEN 'important' THEN 2 ELSE 3 END, s.name`, [careerId])
  ]);

  const owned = new Map(userSkills.map((s) => [s.id, s]));
  const matched = [];
  const missing = [];
  for (const required of careerSkills.rows) {
    const existing = owned.get(required.id);
    if (existing) matched.push({ skill_id: required.id, skill: required.name, level: existing.level, importance: required.importance });
    else missing.push({ skill_id: required.id, skill: required.name, importance: required.importance });
  }
  return { target_career_id: careerId, matched_skills: matched, missing_skills: missing };
}
