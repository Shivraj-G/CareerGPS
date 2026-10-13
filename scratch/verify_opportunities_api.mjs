async function main() {
  const res = await fetch('http://localhost:5000/api/v1/opportunities?limit=5');
  if (!res.ok) {
    console.error(`API returned ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const data = await res.json();
  console.log('Total returned:', data.data?.pagination?.total || data.pagination?.total || data.data?.length);
  console.log('Pagination:', data.data?.pagination || data.pagination);
  console.log('Sample items:');
  const items = data.data?.data || data.data || [];
  for (const item of items.slice(0, 5)) {
    console.log(`- [${item.opportunity_type}] "${item.title}"`);
    console.log(`  Org: "${item.organization}" | Loc: "${item.location}" | Status: "${item.status}"`);
    console.log(`  Deadline: ${item.application_deadline} | Source: "${item.source_name}" (${item.source_type})`);
    console.log(`  URL: ${item.source_url}\n`);
  }

  // Check categories filter
  for (const cat of ['Government', 'Private Job', 'Internship']) {
    const catRes = await fetch(`http://localhost:5000/api/v1/opportunities?opportunity_type=${encodeURIComponent(cat)}&limit=5`);
    const catData = await catRes.json();
    const catItems = catData.data?.data || catData.data || [];
    const total = catData.data?.pagination?.total || catData.pagination?.total || catItems.length;
    console.log(`Filter [${cat}]: total = ${total}`);
  }
}

main().catch(console.error);
