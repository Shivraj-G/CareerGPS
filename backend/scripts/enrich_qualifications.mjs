import { pool } from '../src/config/database.js';

const mappings = [
  { careers: ['Backend Developer', 'Software Developer', 'Full Stack Developer', 'Web Developer', 'AI Engineer', 'Data Analyst', 'Data Engineer', 'Cybersecurity Analyst', 'ERP Specialist', 'Finance Technology Analyst'], degrees: ['BCA', 'Computer Engineering', 'Information Technology', 'B.Tech', 'B.E.', 'MCA', 'COMPUTER ENGG.'] },
  { careers: ['Clerk', 'Administrative'], degrees: ['B.A.', 'B.Com.', 'BBA', '12th'] },
  { careers: ['Business Analyst', 'Management', 'Operations'], degrees: ['BBA', 'MBA', 'B.Com.', 'MODERN OFFICE PRACTICES'] },
  { careers: ['Accounting', 'Finance'], degrees: ['B.Com.', 'M.Com.', 'BBA', 'Finance'] },
  { careers: ['Assistant Professor', 'Professor', 'Lecturer'], degrees: ['M.Sc', 'M.A.', 'Ph.D', 'Postgraduate'] },
  { careers: ['Chef', 'Hotel Management'], degrees: ['DIPLOMA IN HOTEL MANAGEMENT', 'Hospitality', 'Hotel'] },
  { careers: ['Civil Engineer', 'Construction'], degrees: ['CIVIL ENGG.', 'Civil Engineering', 'B.Arch', 'M.Arch'] },
  { careers: ['Mechanical Engineer', 'Automobile Engineer'], degrees: ['MECHANICAL ENGG.', 'AUTOMOBILE ENGG.', 'Mechanical Engineering', 'Automobile Engineering'] },
  { careers: ['Electrical Engineer', 'Electronics', 'Cloud / DevOps Engineer'], degrees: ['ELECTRICAL ENGG.', 'ELECTRONICS ENGG.', 'Electrical & Electronics Engineering', 'Electronics & Communication Engineering'] },
  { careers: ['Pharmacy', 'Pharmacist', 'Medical', 'Doctor', 'Nurse', 'Dentist'], degrees: ['DIPLOMA IN PHARMACY (D.PHARM)', 'B.Pharm', 'MBBS', 'MD', 'BDS', 'MDS', 'B.Sc. Nursing', 'GNM', 'BHMS'] }
];

async function run() {
  try {
    for (const { careers, degrees } of mappings) {
      for (const title of careers) {
        const qs = JSON.stringify(degrees);
        
        // Update careers table
        const cRes = await pool.query(`SELECT id, qualifications FROM careers WHERE title ILIKE $1`, [`%${title}%`]);
        for (const row of cRes.rows) {
          let q = [];
          if (Array.isArray(row.qualifications)) q = row.qualifications;
          else if (typeof row.qualifications === 'string') {
             try { q = JSON.parse(row.qualifications); } catch { q = []; }
          }
          if (!Array.isArray(q)) q = [];
          const newQ = Array.from(new Set([...q, ...degrees]));
          await pool.query(`UPDATE careers SET qualifications = $1 WHERE id = $2`, [JSON.stringify(newQ), row.id]);
        }
  
        // Update ai_career_profiles table
        const aiRes = await pool.query(`SELECT id, qualifications FROM ai_career_profiles WHERE title ILIKE $1`, [`%${title}%`]);
        for (const row of aiRes.rows) {
          let q = [];
          if (Array.isArray(row.qualifications)) q = row.qualifications;
          else if (typeof row.qualifications === 'string') {
             try { q = JSON.parse(row.qualifications); } catch { q = []; }
          }
          if (!Array.isArray(q)) q = [];
          const newQ = Array.from(new Set([...q, ...degrees]));
          await pool.query(`UPDATE ai_career_profiles SET qualifications = $1 WHERE id = $2`, [JSON.stringify(newQ), row.id]);
        }
      }
    }
    console.log("Enrichment done.");
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
