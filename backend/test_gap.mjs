fetch('http://localhost:5000/api/v1/skills/gap-analysis', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ target_ai_career_id: 'rec_abc' })
}).then(async r => console.log(r.status, await r.json()));
