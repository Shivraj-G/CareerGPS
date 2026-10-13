import { pool } from '../src/config/database.js';

const DOMAINS = [
  // BBA Digital Marketing
  {
    domain: 'marketing',
    degrees: ['BBA', 'MBA'],
    specializations: ['Digital Marketing', 'Marketing'],
    skills: [
      { name: 'Search Engine Optimization (SEO)', type: 'technical', aliases: ['SEO'] },
      { name: 'Search Engine Marketing (SEM)', type: 'technical', aliases: ['SEM'] },
      { name: 'Social Media Marketing', type: 'practical', aliases: ['SMM'] },
      { name: 'Content Strategy', type: 'analytical', aliases: ['Content Marketing'] },
      { name: 'Copywriting', type: 'creative', aliases: [] },
      { name: 'Campaign Management', type: 'management', aliases: [] },
      { name: 'Marketing Analytics', type: 'analytical', aliases: [] },
      { name: 'Audience Segmentation', type: 'analytical', aliases: [] },
      { name: 'Conversion Rate Optimization', type: 'technical', aliases: ['CRO'] },
      { name: 'Advertising Platforms', type: 'technical', aliases: ['Google Ads', 'Facebook Ads'] },
      { name: 'Brand Strategy', type: 'analytical', aliases: ['Branding'] }
    ]
  },
  // BSc Geography
  {
    domain: 'geography',
    degrees: ['BSc', 'BA', 'MSc', 'MA'],
    specializations: ['Geography', 'Geomatics'],
    skills: [
      { name: 'Geographic Information Systems (GIS)', type: 'technical', aliases: ['GIS'] },
      { name: 'Cartography', type: 'practical', aliases: ['Map Making'] },
      { name: 'Remote Sensing', type: 'technical', aliases: [] },
      { name: 'Spatial Analysis', type: 'analytical', aliases: [] },
      { name: 'Field Surveying', type: 'practical', aliases: ['Surveying'] },
      { name: 'Geospatial Tools', type: 'technical', aliases: ['QGIS', 'ArcGIS'] },
      { name: 'Environmental Impact Assessment', type: 'analytical', aliases: ['EIA'] }
    ]
  },
  // BCom
  {
    domain: 'accounting',
    degrees: ['BCom', 'MCom'],
    specializations: ['Accounting', 'Finance', 'Commerce'],
    skills: [
      { name: 'Financial Reporting', type: 'technical', aliases: [] },
      { name: 'Taxation', type: 'technical', aliases: ['Tax Filing'] },
      { name: 'Auditing', type: 'analytical', aliases: ['Internal Audit', 'External Audit'] },
      { name: 'Bookkeeping', type: 'practical', aliases: [] },
      { name: 'Corporate Finance', type: 'analytical', aliases: [] },
      { name: 'Financial Analysis', type: 'analytical', aliases: [] }
    ]
  },
  // BCA
  {
    domain: 'computer_science',
    degrees: ['BCA', 'MCA', 'BSc', 'BTech'],
    specializations: ['Computer Applications', 'Computer Science'],
    skills: [
      { name: 'Object-Oriented Programming', type: 'technical', aliases: ['OOP'] },
      { name: 'Data Structures and Algorithms', type: 'analytical', aliases: ['DSA'] },
      { name: 'Database Management Systems', type: 'technical', aliases: ['DBMS', 'SQL'] },
      { name: 'Web Development', type: 'technical', aliases: ['Frontend Development', 'Backend Development'] },
      { name: 'Software Engineering', type: 'practical', aliases: [] },
      { name: 'Computer Networks', type: 'technical', aliases: ['Networking'] },
      { name: 'Software Testing', type: 'technical', aliases: ['QA'] }
    ]
  },
  // BTech Mechanical
  {
    domain: 'engineering',
    degrees: ['BTech', 'BE', 'MTech', 'ME'],
    specializations: ['Mechanical Engineering'],
    skills: [
      { name: 'Computer-Aided Design (CAD)', type: 'technical', aliases: ['CAD'] },
      { name: 'Mechanical Design', type: 'analytical', aliases: [] },
      { name: 'Manufacturing Processes', type: 'practical', aliases: [] },
      { name: 'Thermodynamics', type: 'academic', aliases: [] },
      { name: 'Materials Science', type: 'academic', aliases: [] },
      { name: 'Finite Element Analysis', type: 'technical', aliases: ['FEA'] }
    ]
  },
  // BSc Biology
  {
    domain: 'biology',
    degrees: ['BSc', 'MSc'],
    specializations: ['Biology', 'Botany', 'Zoology', 'Biotechnology'],
    skills: [
      { name: 'Laboratory Methods', type: 'practical', aliases: ['Lab Techniques'] },
      { name: 'Biological Research', type: 'analytical', aliases: [] },
      { name: 'Microbiology Analysis', type: 'technical', aliases: [] },
      { name: 'Genetics', type: 'academic', aliases: [] },
      { name: 'Molecular Biology', type: 'academic', aliases: [] },
      { name: 'Data Analysis (Biology)', type: 'analytical', aliases: ['Biostatistics'] }
    ]
  },
  // BA Mass Communication
  {
    domain: 'media',
    degrees: ['BA', 'MA'],
    specializations: ['Mass Communication', 'Journalism', 'Media Studies'],
    skills: [
      { name: 'Journalism', type: 'practical', aliases: ['Reporting'] },
      { name: 'Media Production', type: 'creative', aliases: ['Audio/Video Production'] },
      { name: 'News Writing', type: 'communication', aliases: [] },
      { name: 'Digital Media Strategy', type: 'analytical', aliases: [] },
      { name: 'Public Relations', type: 'communication', aliases: ['PR'] },
      { name: 'Storytelling', type: 'creative', aliases: [] }
    ]
  },
  // BA Psychology
  {
    domain: 'psychology',
    degrees: ['BA', 'MA', 'BSc', 'MSc'],
    specializations: ['Psychology', 'Counseling', 'Clinical Psychology'],
    skills: [
      { name: 'Psychological Research Methods', type: 'analytical', aliases: [] },
      { name: 'Behavioral Assessment', type: 'practical', aliases: ['Behavioral Analysis'] },
      { name: 'Cognitive Behavioral Therapy (CBT)', type: 'practical', aliases: ['CBT'] },
      { name: 'Psychotherapy Fundamentals', type: 'practical', aliases: [] },
      { name: 'Research Ethics', type: 'academic', aliases: [] },
      { name: 'Counseling Techniques', type: 'interpersonal', aliases: ['Counseling'] }
    ]
  },
  // LLB (Law)
  {
    domain: 'law',
    degrees: ['LLB', 'LLM', 'BA LLB'],
    specializations: ['Law', 'Legal Studies', 'Corporate Law'],
    skills: [
      { name: 'Legal Research', type: 'analytical', aliases: [] },
      { name: 'Contract Drafting', type: 'practical', aliases: ['Drafting'] },
      { name: 'Litigation Strategy', type: 'analytical', aliases: ['Litigation'] },
      { name: 'Corporate Law Compliance', type: 'technical', aliases: ['Compliance'] },
      { name: 'Intellectual Property Rights', type: 'technical', aliases: ['IPR'] },
      { name: 'Legal Reasoning', type: 'analytical', aliases: [] }
    ]
  },
  // BSc Nursing
  {
    domain: 'healthcare',
    degrees: ['BSc', 'MSc', 'Diploma'],
    specializations: ['Nursing', 'Healthcare', 'Clinical Care'],
    skills: [
      { name: 'Patient Care', type: 'practical', aliases: ['Clinical Care'] },
      { name: 'Basic Life Support (BLS)', type: 'technical', aliases: ['BLS'] },
      { name: 'Medication Administration', type: 'technical', aliases: [] },
      { name: 'Health Records Management', type: 'management', aliases: [] },
      { name: 'Clinical Assessment', type: 'analytical', aliases: [] },
      { name: 'Infection Control', type: 'practical', aliases: [] }
    ]
  },
  // BDes
  {
    domain: 'design',
    degrees: ['BDes', 'MDes'],
    specializations: ['Design', 'Graphic Design', 'UI/UX Design', 'Industrial Design'],
    skills: [
      { name: 'UI/UX Design', type: 'creative', aliases: ['User Experience', 'User Interface'] },
      { name: 'Graphic Design', type: 'creative', aliases: [] },
      { name: 'Typography', type: 'creative', aliases: [] },
      { name: 'Prototyping', type: 'practical', aliases: [] },
      { name: 'Industrial Design Principles', type: 'academic', aliases: [] },
      { name: 'Design Tools (Figma/Adobe)', type: 'technical', aliases: ['Figma', 'Adobe Creative Suite'] }
    ]
  },
  // BSc Agriculture
  {
    domain: 'agriculture',
    degrees: ['BSc', 'MSc'],
    specializations: ['Agriculture', 'Agronomy', 'Horticulture'],
    skills: [
      { name: 'Agronomy', type: 'academic', aliases: [] },
      { name: 'Crop Management', type: 'practical', aliases: [] },
      { name: 'Soil Science Analysis', type: 'analytical', aliases: ['Soil Science'] },
      { name: 'Agricultural Economics', type: 'analytical', aliases: [] },
      { name: 'Plant Pathology', type: 'academic', aliases: [] },
      { name: 'Sustainable Farming Techniques', type: 'practical', aliases: [] }
    ]
  },
  // BPharm
  {
    domain: 'pharmacy',
    degrees: ['BPharm', 'MPharm', 'PharmD'],
    specializations: ['Pharmacy', 'Pharmacology'],
    skills: [
      { name: 'Pharmacology', type: 'academic', aliases: [] },
      { name: 'Drug Dispensing', type: 'practical', aliases: [] },
      { name: 'Pharmaceutical Compounding', type: 'technical', aliases: [] },
      { name: 'Clinical Pharmacy', type: 'practical', aliases: [] },
      { name: 'Regulatory Affairs', type: 'management', aliases: [] },
      { name: 'Pharmacokinetics', type: 'analytical', aliases: [] }
    ]
  },
  // BA Economics
  {
    domain: 'economics',
    degrees: ['BA', 'MA', 'BSc'],
    specializations: ['Economics', 'Applied Economics'],
    skills: [
      { name: 'Macroeconomic Theory', type: 'academic', aliases: ['Macroeconomics'] },
      { name: 'Microeconomic Theory', type: 'academic', aliases: ['Microeconomics'] },
      { name: 'Econometrics', type: 'analytical', aliases: [] },
      { name: 'Economic Forecasting', type: 'analytical', aliases: [] },
      { name: 'Quantitative Analysis (Economics)', type: 'analytical', aliases: [] },
      { name: 'Public Policy Analysis', type: 'analytical', aliases: [] }
    ]
  }
];

async function runSeeder() {
  const client = await pool.connect();
  console.log('Starting Massive Skills Seeder Pipeline...');
  
  let insertedSkills = 0;
  let insertedAliases = 0;
  let insertedMappings = 0;
  let duplicateSkills = 0;

  try {
    await client.query('BEGIN');
    
    for (const domainGroup of DOMAINS) {
      for (const skill of domainGroup.skills) {
        // 1. Insert Canonical Skill
        const res = await client.query(`
          INSERT INTO skills (name, category, record_status, parent_domain, skill_type, source, verification_status)
          VALUES ($1, $2, 'published', $3, $4, 'career_gps_curated_dataset', 'verified')
          ON CONFLICT (name) DO UPDATE SET record_status = 'published'
          RETURNING id
        `, [skill.name, domainGroup.domain, domainGroup.domain, skill.type]);
        
        const isNew = res.rowCount > 0 && res.command === 'INSERT'; // PG returns INSERT/UPDATE
        let skillId;
        
        if (res.rows.length > 0) {
          skillId = res.rows[0].id;
          if (isNew) insertedSkills++;
        } else {
          // Existed but maybe DO NOTHING fired if we change query
          const existing = await client.query('SELECT id FROM skills WHERE name = $1', [skill.name]);
          skillId = existing.rows[0].id;
          duplicateSkills++;
        }

        // 2. Insert Aliases
        for (const alias of skill.aliases) {
          const aliasRes = await client.query(`
            INSERT INTO skill_aliases (skill_id, alias_name)
            VALUES ($1, $2)
            ON CONFLICT (alias_name) DO NOTHING
            RETURNING id
          `, [skillId, alias]);
          if (aliasRes.rowCount > 0) insertedAliases++;
        }

        // 3. Insert Education Mappings
        for (const degree of domainGroup.degrees) {
          for (const spec of domainGroup.specializations) {
            const mapRes = await client.query(`
              INSERT INTO skill_education_mappings (skill_id, degree_name, specialization, is_core)
              VALUES ($1, $2, $3, true)
              ON CONFLICT (skill_id, education_level, degree_name, specialization) DO NOTHING
              RETURNING id
            `, [skillId, degree, spec]);
            if (mapRes.rowCount > 0) insertedMappings++;
          }
        }
      }
    }

    await client.query('COMMIT');
    
    console.log('--- SEED PIPELINE COMPLETE ---');
    console.log(`Canonical Skills Inserted/Updated: ${insertedSkills}`);
    console.log(`Duplicate Skills Avoided: ${duplicateSkills}`);
    console.log(`Aliases Inserted: ${insertedAliases}`);
    console.log(`Education Mappings Inserted: ${insertedMappings}`);
    console.log(`Note: 100,000 real verified unique skills cannot be procedurally generated without fabricating data or importing an external dataset (like O*NET or ESCO). The schema now fully supports the 100,000 scale and has mapped the explicitly verified skills across all core requested domains.`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed pipeline failed. Changes rolled back.', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

runSeeder();
