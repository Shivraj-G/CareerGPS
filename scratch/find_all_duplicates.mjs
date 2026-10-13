import { pool } from '../backend/src/config/database.js';

async function check() {
  const res = await pool.query("SELECT id, name, category, record_status FROM skills WHERE record_status = 'published'");
  const normMap = new Map();

  const normalize = (name) => {
    return name.toLowerCase()
      .replace(/visualisation/g, 'visualization')
      .replace(/organis/g, 'organiz')
      .replace(/modelling/g, 'modeling')
      .replace(/behaviour/g, 'behavior')
      .replace(/programme/g, 'program')
      .replace(/[^a-z0-9]/g, ' ')
      .trim().replace(/\s+/g, ' ');
  };

  for (const s of res.rows) {
    const k = normalize(s.name);
    if (!normMap.has(k)) normMap.set(k, []);
    normMap.get(k).push(s);
  }

  for (const [k, list] of normMap.entries()) {
    if (list.length > 1) {
      console.log(`Duplicate group [${k}]:`, list.map(x => `${x.name} (${x.id}, cat: ${x.category})`));
    }
  }

  await pool.end();
}

check().catch(console.error);
