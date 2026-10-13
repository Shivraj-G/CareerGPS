import { pool } from '../src/config/database.js';
import fs from 'fs';
import path from 'path';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-token';

async function enrichTemplateMappings() {
  const filePath = path.join(process.cwd(), 'seeds', 'careergps_education_skills_seed.json');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const templateRecords = data.records.filter(r => r.mapping_status && r.mapping_status.includes('template-mapped'));
  
  console.log(`Found ${templateRecords.length} template-mapped records. Re-enriching them with AI-Service...`);
  
  const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published'`);
  const knownSkills = knownSkillsRes.rows.map(r => r.name);

  let successCount = 0;

  for (const record of templateRecords) {
    const degreeName = record.qualification ? record.qualification.trim() : null;
    const specialization = record.discipline ? record.discipline.trim() : '';
    
    if (!degreeName) continue;
    
    console.log(`Enriching ${degreeName}...`);
    
    // Call AI Service
    const eduContext = `Level: ${record.level}, Degree: ${degreeName}, Specialization: ${specialization}`;
    const payload = {
      query: eduContext,
      education: eduContext,
      career_goal: '',
      limit: 15,
      known_skills: knownSkills,
      profile: {
        education: [{ level: record.level, degree: degreeName, specialization: specialization }]
      }
    };

    try {
      const aiRes = await fetch(`${AI_SERVICE_URL}/internal/v1/skills/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-internal-service-token': INTERNAL_TOKEN },
        body: JSON.stringify(payload)
      });

      if (aiRes.ok) {
        const aiData = await aiRes.json();
        
        if (aiData.skills && Array.isArray(aiData.skills) && aiData.skills.length > 0) {
          // Delete generic template mappings
          await pool.query(`DELETE FROM skill_education_mappings WHERE degree_name ILIKE $1`, [degreeName]);
          
          let insertedCount = 0;
          for (const sk of aiData.skills) {
            const targetName = sk.matches_catalogue_skill || sk.name;
            if (!targetName) continue;
            
            // Insert skill if missing (but AI tries to match known skills)
            let dbSkill = await pool.query(`SELECT id FROM skills WHERE name ILIKE $1`, [targetName]);
            let skillId;
            if (dbSkill.rows.length > 0) {
              skillId = dbSkill.rows[0].id;
            } else {
              const ins = await pool.query(`INSERT INTO skills (name, record_status, source, verification_status) VALUES ($1, 'published', 'ai_enriched', 'verified') RETURNING id`, [targetName]);
              skillId = ins.rows[0].id;
            }
            
            const isCore = sk.relationship === 'direct' || sk.relationship === 'core';
            
            await pool.query(`
              INSERT INTO skill_education_mappings (skill_id, education_level, degree_name, specialization, is_core, relevance_score)
              VALUES ($1, $2, $3, $4, $5, 1.0)
              ON CONFLICT (skill_id, education_level, degree_name, specialization) DO NOTHING
            `, [skillId, record.level || 'Undergraduate', degreeName, specialization, isCore]);
            insertedCount++;
          }
          console.log(`-> Saved ${insertedCount} precise skills for ${degreeName}.`);
          successCount++;
        }
      }
    } catch (err) {
      console.error(`Error mapping ${degreeName}:`, err.message);
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`Finished enriching ${successCount} template-mapped records!`);
  pool.end();
}

enrichTemplateMappings().catch(console.error);
