import { pool } from '../src/config/database.js';
import fs from 'fs';

async function discoverQualifications() {
  console.log('Discovering all unique qualifications in the database...');
  try {
    // 1. Get from courses table
    const coursesRes = await pool.query('SELECT DISTINCT qualification, subject FROM courses WHERE qualification IS NOT NULL');
    // 2. Get from career_qualifications table
    const careerQualsRes = await pool.query('SELECT DISTINCT qualification FROM career_qualifications WHERE qualification IS NOT NULL');
    
    // 3. Get from skill_education_mappings to see what is already mapped
    const mappedRes = await pool.query('SELECT DISTINCT degree_name, specialization FROM skill_education_mappings');

    const mappedSet = new Set(mappedRes.rows.map(r => `${(r.degree_name||'').toLowerCase()}|${(r.specialization||'').toLowerCase()}`));
    
    const allQuals = [];
    
    coursesRes.rows.forEach(r => {
      if (r.qualification) {
        allQuals.push({
          source: 'courses',
          degree: r.qualification.trim(),
          specialization: r.subject ? r.subject.trim() : ''
        });
      }
    });
    
    careerQualsRes.rows.forEach(r => {
      if (r.qualification) {
        allQuals.push({
          source: 'career_qualifications',
          degree: r.qualification.trim(),
          specialization: ''
        });
      }
    });

    // Deduplicate
    const uniqueMap = new Map();
    for (const q of allQuals) {
      const key = `${q.degree.toLowerCase()}|${q.specialization.toLowerCase()}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, { ...q, isMapped: mappedSet.has(key) });
      }
    }
    
    const report = {
      totalDiscovered: uniqueMap.size,
      mappedCount: 0,
      unmappedCount: 0,
      qualifications: Array.from(uniqueMap.values())
    };

    report.qualifications.forEach(q => {
      if (q.isMapped) report.mappedCount++;
      else report.unmappedCount++;
    });

    fs.writeFileSync('qualification_coverage_report.json', JSON.stringify(report, null, 2));
    
    console.log(`Discovered ${report.totalDiscovered} unique qualifications.`);
    console.log(`Mapped: ${report.mappedCount}`);
    console.log(`Unmapped: ${report.unmappedCount}`);
    console.log('Report saved to qualification_coverage_report.json');

  } catch (error) {
    console.error('Error discovering qualifications:', error);
  } finally {
    process.exit(0);
  }
}

discoverQualifications();
