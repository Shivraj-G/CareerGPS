import { pool } from '../backend/src/config/database.js';

// Define domain taxonomy and generic skills
const GENERIC_SKILLS = new Set([
  'communication', 'professionalcommunication', 'verbalcommunication', 'writtencommunication',
  'teamwork', 'collaboration', 'interpersonalskills',
  'problemsolving', 'analyticalthinking',
  'criticalthinking',
  'timemanagement', 'organization', 'attentiontodetail',
  'adaptability', 'flexibility',
  'creativity', 'creativitypresentation', 'presentationskills',
  'digitalliteracy', 'computerliteracy',
  'physicalfitness', 'customerservice'
]);

function normalizeString(str) {
  return str.toLowerCase().replace(/[^a-z0-9+#]/g, '');
}

function classifyDomain(title = '', desc = '', skills = []) {
  const t = (title || '').toLowerCase();
  const d = (desc || '').toLowerCase();
  const s = Array.isArray(skills) ? skills.join(' ').toLowerCase() : '';

  const domainScores = {
    ACADEMIA_EDUCATION: 0,
    SOFTWARE_PLATFORMS: 0,
    DATA_INTELLIGENCE: 0,
    ENTERPRISE_SYSTEMS: 0,
    FINANCE_ACCOUNTING: 0,
    HEALTHCARE_CLINICAL: 0,
    PUBLIC_SAFETY_LAW: 0,
    CULINARY_HOSPITALITY: 0,
    ADMINISTRATION: 0,
    TECHNICAL_TRADES: 0
  };

  const check = (domain, patternTitle, patternSkills, patternDesc) => {
    if (patternTitle && patternTitle.test(t)) domainScores[domain] += 50;
    if (patternSkills && patternSkills.test(s)) domainScores[domain] += 20;
    if (patternDesc && patternDesc.test(d)) domainScores[domain] += 5;
  };

  check(
    'ACADEMIA_EDUCATION',
    /\b(professor|lecturer|teacher|academic|faculty|instructor|educator)\b/,
    /\b(research methodology|curriculum development|academic writing|teaching|pedagogy|assessment)\b/,
    /\b(undergraduate|postgraduate|university|colleges|syllabus|dissertation|scholarly)\b/
  );

  check(
    'SOFTWARE_PLATFORMS',
    /\b(developer|frontend|backend|full stack|fullstack|devops|cloud|software engineer)\b/,
    /\b(javascript|react|node\.js|express|docker|git|aws|linux|rest apis|html|css)\b/,
    /\b(web applications|apis|services|cloud computing|ci\/cd)\b/
  );

  check(
    'DATA_INTELLIGENCE',
    /\b(data analyst|data scientist|data engineer|ai engineer)\b/,
    /\b(python|machine learning|statistics|power bi|etl|rag|llm|data analysis|data cleaning)\b/,
    /\b(datasets|predictive models|data pipeline|dashboards)\b/
  );

  check(
    'ENTERPRISE_SYSTEMS',
    /\b(business analyst|erp specialist|functional consultant|systems analyst)\b/,
    /\b(business analysis|erp concepts|requirements gathering|business process)\b/,
    /\b(enterprise resource planning|stakeholders|workflows|specifications)\b/
  );

  check(
    'FINANCE_ACCOUNTING',
    /\b(finance|financial|accounting|fintech|accountant)\b/,
    /\b(financial analysis|accounting|financial modeling|audit)\b/,
    /\b(financial reports|ledgers|fiscal|balance sheet)\b/
  );

  check(
    'HEALTHCARE_CLINICAL',
    /\b(doctor|surgeon|physician|nurse|nursing|dentist|cardiologist)\b/,
    /\b(patient care|clinical diagnosis|surgery|pharmacology|anatomy)\b/,
    /\b(hospital|treatment|medical records|clinical practice)\b/
  );

  check(
    'PUBLIC_SAFETY_LAW',
    /\b(police|police officer|lawyer|advocate|law enforcement|detective)\b/,
    /\b(law knowledge|physical fitness|investigation|patrolling)\b/,
    /\b(law and order|public safety|legal compliance)\b/
  );

  check(
    'CULINARY_HOSPITALITY',
    /\b(chef|cook|culinary|food safety officer|restaurant manager|catering)\b/,
    /\b(culinary techniques|menu planning|food safety|hygiene)\b/,
    /\b(kitchen|food preparation|gastronomy)\b/
  );

  check(
    'ADMINISTRATION',
    /\b(clerk|receptionist|office assistant|data entry operator)\b/,
    /\b(data entry|office administration|record keeping|filing)\b/,
    /\b(administrative support|paperwork|documentation)\b/
  );

  check(
    'TECHNICAL_TRADES',
    /\b(technician|electrician|mechanic|maintenance engineer)\b/,
    /\b(technical knowledge|equipment repair|troubleshooting|safety & compliance)\b/,
    /\b(machinery|maintenance|troubleshoot)\b/
  );

  // Find max domain
  let topDomain = 'GENERAL';
  let maxScore = 0;
  for (const [dom, score] of Object.entries(domainScores)) {
    if (score > maxScore) {
      maxScore = score;
      topDomain = dom;
    }
  }
  return { topDomain, domainScores };
}

function areDomainsCompatible(domA, domB) {
  if (domA === domB) return { compatible: true, affinityScore: 35 };

  const pairs = [
    [['SOFTWARE_PLATFORMS', 'DATA_INTELLIGENCE'], 18],
    [['DATA_INTELLIGENCE', 'ENTERPRISE_SYSTEMS'], 15],
    [['ENTERPRISE_SYSTEMS', 'FINANCE_ACCOUNTING'], 18],
    [['SOFTWARE_PLATFORMS', 'TECHNICAL_TRADES'], 10]
  ];

  for (const [pair, affinity] of pairs) {
    if ((pair[0] === domA && pair[1] === domB) || (pair[1] === domA && pair[0] === domB)) {
      return { compatible: true, affinityScore: affinity };
    }
  }

  return { compatible: false, affinityScore: 0 };
}

async function testOccupationalEngine() {
  const careersRes = await pool.query(`
    SELECT c.id, c.title, c.description,
           json_agg(json_build_object('id', s.id, 'name', s.name, 'importance', cs.importance)) FILTER (WHERE s.id IS NOT NULL) as skills
    FROM careers c
    LEFT JOIN career_skills cs ON cs.career_id = c.id
    LEFT JOIN skills s ON s.id = cs.skill_id
    GROUP BY c.id, c.title, c.description
  `);

  const careers = careersRes.rows;

  function findRelated(sourceCareer) {
    const srcSkillNames = (sourceCareer.skills || []).map(s => s.name);
    const srcDomainInfo = classifyDomain(sourceCareer.title, sourceCareer.description, srcSkillNames);
    const srcDomain = srcDomainInfo.topDomain;

    const results = [];

    for (const cand of careers) {
      if (cand.id === sourceCareer.id) continue;

      const candSkillNames = (cand.skills || []).map(s => s.name);
      const candDomainInfo = classifyDomain(cand.title, cand.description, candSkillNames);
      const candDomain = candDomainInfo.topDomain;

      const domainComp = areDomainsCompatible(srcDomain, candDomain);

      // Skill overlap
      const sharedDomainSkills = [];
      const sharedGenericSkills = [];
      const uniqueToCand = [];

      for (const sk of candSkillNames) {
        const norm = normalizeString(sk);
        const isShared = srcSkillNames.some(s => normalizeString(s) === norm);
        if (isShared) {
          if (GENERIC_SKILLS.has(norm)) {
            sharedGenericSkills.push(sk);
          } else {
            sharedDomainSkills.push(sk);
          }
        } else {
          uniqueToCand.push(sk);
        }
      }

      // ANTI-CONTAMINATION HARD FILTER:
      // If domains are not compatible and no domain-specific skills are shared, DISQUALIFY!
      if (!domainComp.compatible && sharedDomainSkills.length === 0) {
        continue;
      }

      let score = domainComp.affinityScore;
      score += sharedDomainSkills.length * 15;
      score += Math.min(sharedGenericSkills.length * 1, 3); // Max 3 points for generic skills

      // Title keyword similarity
      const srcWords = sourceCareer.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const candWords = cand.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      const wordOverlap = srcWords.filter(w => candWords.includes(w));
      score += wordOverlap.length * 10;

      // Classify Relationship Tier
      let transitionLevel = 'Transferable Role';
      let transitionDescription = '';
      let relationReason = '';
      let distinction = '';

      if (srcDomain === candDomain) {
        // Same domain
        if (wordOverlap.length > 0 || sharedDomainSkills.length >= 3) {
          transitionLevel = 'Closely Related';
          transitionDescription = 'Direct domain alignment with shared technical competencies';
        } else if (
          (sourceCareer.title.includes('Assistant') && cand.title.includes('Professor')) ||
          (sourceCareer.title.includes('Junior') && cand.title.includes('Senior')) ||
          (sourceCareer.title === 'Doctor' && cand.title === 'Surgeon') ||
          (sourceCareer.title === 'Data Analyst' && cand.title === 'Data Scientist')
        ) {
          transitionLevel = 'Direct Progression';
          transitionDescription = 'Vertical career advancement within the same professional ladder';
        } else {
          transitionLevel = 'Closely Related';
          transitionDescription = 'Specialized operational path in the same occupational family';
        }
      } else {
        transitionLevel = 'Transferable Role';
        transitionDescription = 'Adjacent domain reusing foundational technical capabilities';
      }

      if (sharedDomainSkills.length > 0) {
        relationReason = `Shares core domain competencies in ${sharedDomainSkills.slice(0, 3).join(', ')}`;
      } else if (domainComp.compatible) {
        relationReason = `Operates within the adjacent ${candDomain.toLowerCase().replace(/_/g, ' ')} domain with compatible workflows`;
      }

      if (uniqueToCand.length > 0) {
        distinction = `Emphasizes ${uniqueToCand.slice(0, 2).join(' and ')} in daily operations`;
      }

      results.push({
        id: cand.id,
        title: cand.title,
        domain: candDomain,
        score,
        sharedDomainSkills,
        sharedGenericSkills,
        transitionLevel,
        transitionDescription,
        relationReason,
        distinction
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }

  // Test Assistant Professor
  const ap = careers.find(c => c.title === 'Assistant Professor');
  console.log('\n=======================================');
  console.log('RESULTS FOR ASSISTANT PROFESSOR:');
  console.log('=======================================');
  const apRel = findRelated(ap);
  for (const r of apRel) {
    console.log(`- ${r.title} | ${r.transitionLevel} | Score: ${r.score} | Shared Domain: [${r.sharedDomainSkills.join(', ')}] | Shared Generic: [${r.sharedGenericSkills.join(', ')}]`);
  }

  // Test ERP Specialist
  const erp = careers.find(c => c.title === 'ERP Specialist');
  console.log('\n=======================================');
  console.log('RESULTS FOR ERP SPECIALIST:');
  console.log('=======================================');
  const erpRel = findRelated(erp);
  for (const r of erpRel) {
    console.log(`- ${r.title} | ${r.transitionLevel} | Score: ${r.score} | Shared Domain: [${r.sharedDomainSkills.join(', ')}]`);
  }

  // Test Backend Developer
  const be = careers.find(c => c.title === 'Backend Developer');
  console.log('\n=======================================');
  console.log('RESULTS FOR BACKEND DEVELOPER:');
  console.log('=======================================');
  const beRel = findRelated(be);
  for (const r of beRel) {
    console.log(`- ${r.title} | ${r.transitionLevel} | Score: ${r.score} | Shared Domain: [${r.sharedDomainSkills.join(', ')}]`);
  }

  // Test Doctor
  const doc = careers.find(c => c.title === 'Doctor');
  console.log('\n=======================================');
  console.log('RESULTS FOR DOCTOR:');
  console.log('Doctor domain:', classifyDomain(doc.title, doc.description, (doc.skills || []).map(s => s.name)));
  console.log('=======================================');
  const docRel = findRelated(doc);
  for (const r of docRel) {
    console.log(`- ${r.title} | ${r.transitionLevel} | Domain: ${r.domain} | Score: ${r.score} | Shared Domain: [${r.sharedDomainSkills.join(', ')}]`);
  }

  await pool.end();
}

testOccupationalEngine().catch(console.error);
