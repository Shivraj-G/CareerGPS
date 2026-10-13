async function check() {
  const base = 'http://localhost:5000/api/v1';

  // 1. Assistant Professor (17e40e2c-763d-496c-8fc8-c18e40bd8ab1)
  console.log('--- Testing Assistant Professor ---');
  const apDetailRes = await fetch(`${base}/careers/17e40e2c-763d-496c-8fc8-c18e40bd8ab1`);
  const apDetail = await apDetailRes.json();
  console.log('AP Title:', apDetail.data?.title);
  console.log('AP Domain:', apDetail.data?.domainInfo?.topDomain);
  console.log('AP Progression:', apDetail.data?.progressionLadder?.map(p => `${p.level}: ${p.role}`));
  console.log('AP Mandatory:', apDetail.data?.regulatoryGuidance?.mandatory);
  console.log('AP Statutory Framework:', apDetail.data?.regulatoryGuidance?.statutoryFramework?.authority);
  console.log('AP Next Action:', apDetail.data?.regulatoryGuidance?.recommendedNextAction);

  const apRelRes = await fetch(`${base}/careers/17e40e2c-763d-496c-8fc8-c18e40bd8ab1/related`);
  const apRel = await apRelRes.json();
  console.log('AP Related Careers count:', apRel.data?.length);
  console.log('AP Related Careers:', apRel.data?.map(r => ({
    title: r.title,
    transition_level: r.transition_level,
    score: r.score,
    relation_reason: r.relation_reason,
    distinction: r.distinction,
    shared_skills: r.shared_skills
  })));
  console.log('AP Meta:', apRel.meta);

  // 2. ERP Specialist (863e1d32-8e45-4cac-a937-304f45a82550)
  console.log('\n--- Testing ERP Specialist ---');
  const erpRelRes = await fetch(`${base}/careers/863e1d32-8e45-4cac-a937-304f45a82550/related`);
  const erpRel = await erpRelRes.json();
  console.log('ERP Related Careers count:', erpRel.data?.length);
  console.log('ERP Top 3:', erpRel.data?.slice(0, 3).map(r => ({
    title: r.title,
    transition_level: r.transition_level,
    score: r.score,
    shared_skills: r.shared_skills
  })));

  // 3. Backend Developer (dd929e8c-07b1-4567-a202-384a53b6e254)
  console.log('\n--- Testing Backend Developer ---');
  const beRelRes = await fetch(`${base}/careers/dd929e8c-07b1-4567-a202-384a53b6e254/related`);
  const beRel = await beRelRes.json();
  console.log('Backend Dev Related Top 4:', beRel.data?.slice(0, 4).map(r => ({
    title: r.title,
    transition_level: r.transition_level,
    score: r.score,
    shared_skills: r.shared_skills
  })));
}

check().catch(console.error);
