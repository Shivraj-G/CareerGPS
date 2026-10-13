import { pool } from '../src/config/database.js';
import fs from 'fs';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
const INTERNAL_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || 'local-dev-token';

async function mapAllQualifications() {
  console.log('Discovering and mapping all qualifications dynamically...');
  let report = { totalDiscovered: 0, mappedCount: 0, unmappedCount: 0, qualifications: [] };

  try {
    // 1. Discover Qualifications
    const coursesRes = await pool.query('SELECT DISTINCT qualification, subject FROM courses WHERE qualification IS NOT NULL');
    const careerQualsRes = await pool.query('SELECT DISTINCT qualification FROM career_qualifications WHERE qualification IS NOT NULL');
    const existingMappings = await pool.query('SELECT DISTINCT degree_name, specialization FROM skill_education_mappings');
    const mappedSet = new Set(existingMappings.rows.map(r => `${(r.degree_name||'').toLowerCase()}|${(r.specialization||'').toLowerCase()}`));
    
    const allQuals = [];
    coursesRes.rows.forEach(r => allQuals.push({ source: 'courses', degree: r.qualification.trim(), specialization: r.subject ? r.subject.trim() : '' }));
    careerQualsRes.rows.forEach(r => allQuals.push({ source: 'career_qualifications', degree: r.qualification.trim(), specialization: '' }));

    const uniqueMap = new Map();
    for (const q of allQuals) {
      const key = `${q.degree.toLowerCase()}|${q.specialization.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...q, isMapped: mappedSet.has(key), mappedSkillCount: 0, coreSkillCount: 0, status: 'unmapped' });
      }
    }
    
    report.qualifications = Array.from(uniqueMap.values());
    report.totalDiscovered = report.qualifications.length;

    // 2. Fetch known skills for the AI context
    const knownSkillsRes = await pool.query(`SELECT name FROM skills WHERE record_status = 'published'`);
    const knownSkills = knownSkillsRes.rows.map(r => r.name);

    // 3. Process unmapped qualifications
    for (const qual of report.qualifications) {
      if (qual.isMapped) {
        qual.status = 'already_mapped';
        report.mappedCount++;
        continue;
      }
      
      console.log(`Mapping ${qual.degree} ${qual.specialization}...`);
      
      const eduContext = `Level: ${qual.degree}, Specialization: ${qual.specialization}`;
      const payload = {
        query: eduContext,
        education: eduContext,
        career_goal: '',
        limit: 10,
        known_skills: knownSkills,
        profile: {
          education: [{ level: 'Undergraduate', degree: qual.degree, specialization: qual.specialization }]
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
          let insertedCount = 0;
          let coreCount = 0;

          if (aiData.skills && Array.isArray(aiData.skills)) {
            for (const sk of aiData.skills) {
              const targetName = sk.matches_catalogue_skill || sk.name;
              if (!targetName) continue;
              
              // Validate against catalogue
              const dbSkill = await pool.query(`SELECT id FROM skills WHERE name ILIKE $1`, [targetName]);
              if (dbSkill.rows.length > 0) {
                const skillId = dbSkill.rows[0].id;
                const isCore = sk.relationship === 'direct' || sk.relationship === 'core';
                
                // Persist mapping
                await pool.query(`
                  INSERT INTO skill_education_mappings (skill_id, degree_name, specialization, is_core, relevance_score)
                  VALUES ($1, $2, $3, $4, 1.0)
                  ON CONFLICT (skill_id, education_level, degree_name, specialization) DO NOTHING
                `, [skillId, qual.degree, qual.specialization, isCore]);
                
                insertedCount++;
                if (isCore) coreCount++;
              }
            }
          }
          
          qual.mappedSkillCount = insertedCount;
          qual.coreSkillCount = coreCount;
          qual.status = insertedCount > 0 ? 'success' : 'no_valid_skills_returned';
          qual.isMapped = insertedCount > 0;
          
          if (qual.isMapped) report.mappedCount++;
          else report.unmappedCount++;
        } else {
          qual.status = 'ai_service_error';
          report.unmappedCount++;
        }
      } catch (err) {
        console.error(`Error mapping ${qual.degree}:`, err.message);
        qual.status = 'ai_service_fetch_failed';
        report.unmappedCount++;
      }
      
      // Delay to avoid overwhelming AI service
      await new Promise(r => setTimeout(r, 1000));
    }

    fs.writeFileSync('universal_mapping_coverage_report.json', JSON.stringify(report, null, 2));
    
    console.log('\n--- UNIVERSAL MAPPING COMPLETE ---');
    console.log(`Total Discovered Qualifications: ${report.totalDiscovered}`);
    console.log(`Successfully Mapped: ${report.mappedCount}`);
    console.log(`Unmapped / Failed: ${report.unmappedCount}`);
    console.log('Report saved to universal_mapping_coverage_report.json');

  } catch (error) {
    console.error('Fatal mapping error:', error);
  } finally {
    process.exit(0);
  }
}

mapAllQualifications();
