const serviceUrl = (process.env.AI_SERVICE_URL || 'https://careergps-nc6z.onrender.com').replace(/\/+$/, '');
const response = await fetch(`${serviceUrl}/internal/v1/health`, { headers: { 'x-internal-service-token': 'INVALID_TOKEN' } });
console.log('STATUS:', response.status);
console.log('BODY:', await response.text());
