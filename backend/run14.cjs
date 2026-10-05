const { pool } = require('./src/config/database.js');
async function run() {
  const i = await pool.query("SELECT id FROM institutions WHERE name = 'Goa College of Engineering'");
  const instId = i.rows[0].id;
  const q = await pool.query(`
    SELECT 
      c2.id, c2.title, c2.course_type, c2.qualification,
      COALESCE(
        json_agg(
          DISTINCT jsonb_build_object(
            'careerId', cr.id,
            'careerName', cr.title,
            'description', substring(cr.description from 1 for 100),
            'relationshipReason', 'Requires ' || c1.title || ' or equivalent'
          )
        ) FILTER (WHERE cr.id IS NOT NULL), 
        '[]'
      ) AS career_directions
    FROM courses c2
    LEFT JOIN courses c1 ON (
      c1.title ILIKE c2.title OR 
      c1.subject ILIKE c2.title OR 
      c1.title ILIKE c2.subject OR 
      (c1.subject IS NOT NULL AND c2.subject IS NOT NULL AND c1.subject ILIKE c2.subject)
    )
    LEFT JOIN course_careers cc ON cc.course_id = c1.id
    LEFT JOIN careers cr ON cr.id = cc.career_id AND cr.record_status = 'published'
    WHERE c2.institution_id = $1
    GROUP BY c2.id
  `, [instId]);
  console.log('Matches:', JSON.stringify(q.rows, null, 2));
  process.exit(0);
}
run();
