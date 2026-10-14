const serviceUrl = (process.env.AI_SERVICE_URL || 'https://careergps-nc6z.onrender.com').replace(/\/+$/, '');
const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
if (!serviceToken) throw new Error('Set INTERNAL_SERVICE_TOKEN before running this diagnostic.');
const response = await fetch(`${serviceUrl}/internal/v1/careers/explore`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-internal-service-token': serviceToken },
  body: JSON.stringify({ query: 'Designer', known_careers: [], known_skills: [], user_skill_names: [] })
});
console.log('STATUS:', response.status);
console.log('BODY:', await response.text());
