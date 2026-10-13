import { pool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';

async function importSeed() {
  const filePath = path.join(process.cwd(), 'seeds', 'careergps_education_skills_seed.json');
  console.log(`Reading dataset from ${filePath}...`);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  
  const records = data.records || [];
  console.log(`Found ${records.length} records to process.`);

  let totalSkillsInserted = 0;
  let totalMappingsInserted = 0;
  let duplicateSkillsAvoided = 0;
  let invalidRecords = 0;
  const missingMappings = [];

  for (const record of records) {
    const degreeName = record.qualification ? record.qualification.trim() : null;
    const specialization = record.discipline ? record.discipline.trim() : '';
    
    if (!degreeName) {
      invalidRecords++;
      continue;
    }

    // Determine skills to insert (all_recommended_skills is the superset, but we need to know if they are core or not)
    const allSkills = record.all_recommended_skills || [];
    const coreSkillsSet = new Set((record.core_skills || []).map(s => s.toLowerCase().trim()));

    if (allSkills.length === 0) {
      missingMappings.push(`${degreeName} - ${specialization}`);
      continue;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      for (const skillName of allSkills) {
        const normName = skillName.trim().replace(/\s+/g, ' ');
        if (!normName) continue;

        const isCore = coreSkillsSet.has(normName.toLowerCase());

        let skillId;
        // Check if skill exists
        const exist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [normName]);
        
        if (exist.rows.length > 0) {
          skillId = exist.rows[0].id;
          duplicateSkillsAvoided++;
        } else {
          // Insert skill
          try {
            const skillResult = await client.query(
              `INSERT INTO skills (name, record_status, source, verification_status) 
               VALUES ($1, 'published', 'careergps_seed', 'verified') RETURNING id`, 
              [normName]
            );
            skillId = skillResult.rows[0].id;
            totalSkillsInserted++;
          } catch (err) {
             // Fallback for race conditions or missing constraints
             const reExist = await client.query('SELECT id FROM skills WHERE lower(name) = lower($1) LIMIT 1', [normName]);
             if (reExist.rows.length > 0) {
                 skillId = reExist.rows[0].id;
                 duplicateSkillsAvoided++;
             } else {
                 throw err;
             }
          }
        }

        // Insert Mapping
        await client.query(`
          INSERT INTO skill_education_mappings (skill_id, education_level, degree_name, specialization, is_core, relevance_score)
          VALUES ($1, $2, $3, $4, $5, 1.0)
          ON CONFLICT (skill_id, education_level, degree_name, specialization) DO NOTHING
        `, [skillId, record.level || 'Undergraduate', degreeName, specialization, isCore]);
        
        totalMappingsInserted++;
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error processing ${degreeName}:`, err.message);
    } finally {
      client.release();
    }
  }

  // Reporting
  const coverageReport = {
    totalQualificationsFound: records.length,
    importedMappings: totalMappingsInserted,
    missingMappingsCount: missingMappings.length,
    duplicateSkillsAvoided: duplicateSkillsAvoided,
    invalidRecords: invalidRecords,
    missingMappings: missingMappings
  };

  fs.writeFileSync('careergps_seed_coverage_report.json', JSON.stringify(coverageReport, null, 2));

  console.log('--- SEED IMPORT COMPLETE ---');
  console.log(`Unique Skills Inserted: ${totalSkillsInserted}`);
  console.log(`Skill Mappings Inserted: ${totalMappingsInserted}`);
  console.log(`Duplicate Skills Avoided (Reused): ${duplicateSkillsAvoided}`);
  console.log(`Invalid Records Skipped: ${invalidRecords}`);
  console.log(`Qualifications Missing Skills: ${missingMappings.length}`);
  console.log('Coverage report saved to careergps_seed_coverage_report.json');

  pool.end();
}

importSeed().catch(console.error);
