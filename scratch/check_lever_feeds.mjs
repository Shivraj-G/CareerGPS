const boards = [
  { name: 'Drivetrain', url: 'https://api.lever.co/v0/postings/drivetrain?mode=json' },
  { name: 'Paytm', url: 'https://api.lever.co/v0/postings/paytm?mode=json' },
  { name: 'Paytm Payments', url: 'https://api.lever.co/v0/postings/paytmpayments?mode=json' },
  { name: 'Aleph', url: 'https://api.lever.co/v0/postings/aleph?mode=json' },
  { name: 'Sprinto', url: 'https://api.lever.co/v0/postings/Sprinto?mode=json' },
  { name: 'Weekday', url: 'https://api.lever.co/v0/postings/weekdayworks?mode=json' },
  { name: 'Dun & Bradstreet', url: 'https://api.lever.co/v0/postings/dnb?mode=json' },
  { name: 'Smarsh', url: 'https://api.lever.co/v0/postings/smarsh?mode=json' },
  { name: 'Ninja Van', url: 'https://api.lever.co/v0/postings/ninjavan?mode=json' }
];

for (const b of boards) {
  try {
    const res = await fetch(b.url, { headers: { 'User-Agent': 'Goa-Career-Intelligence-Ingestion' } });
    const data = await res.json().catch(() => null);
    const count = Array.isArray(data) ? data.length : 0;
    const internships = Array.isArray(data) ? data.filter(j => /intern/i.test(`${j.text} ${j.categories?.commitment}`)).length : 0;
    console.log(`[${b.name}] Status: ${res.status}, Total jobs: ${count}, Internships: ${internships}`);
    if (count > 0 && internships > 0) {
      const sample = data.find(j => /intern/i.test(`${j.text} ${j.categories?.commitment}`));
      console.log(`  Sample internship: ${sample.text} | ${sample.categories?.location} | ${sample.hostedUrl}`);
    }
  } catch (e) {
    console.log(`[${b.name}] Error: ${e.message}`);
  }
}
