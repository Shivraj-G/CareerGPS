import { pool } from './src/config/database.js';

async function main() {
  const users = await pool.query(`
    SELECT u.id, u.email, u.full_name,
           COUNT(up.id) as total_pathways,
           COUNT(up.id) FILTER (WHERE up.status = 'active') as active_pathways,
           COUNT(up.id) FILTER (WHERE up.status = 'archived') as archived_pathways
    FROM users u
    LEFT JOIN user_pathways up ON up.user_id = u.id
    GROUP BY u.id, u.email, u.full_name
    HAVING COUNT(up.id) > 0
    ORDER BY COUNT(up.id) DESC
  `);
  console.log('Users with pathways:', users.rows);

  const activeChefPathways = await pool.query(`
    SELECT up.id as user_pathway_id, up.user_id, up.pathway_id, up.status, up.title,
           p.id as template_id, p.pathway_type, p.origin, p.career_id,
           u.email
    FROM user_pathways up
    JOIN pathways p ON p.id = up.pathway_id
    JOIN users u ON u.id = up.user_id
    WHERE up.status = 'active'
  `);
  console.log('Active user pathways:', activeChefPathways.rows);

  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
