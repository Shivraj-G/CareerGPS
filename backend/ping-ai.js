const serviceUrl = (process.env.AI_SERVICE_URL || 'https://careergps-nc6z.onrender.com').replace(/\/+$/, '');
const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
if (!serviceToken) throw new Error('Set INTERNAL_SERVICE_TOKEN before running this diagnostic.');
const response = await fetch(`${serviceUrl}/internal/v1/health`, { headers: { 'x-internal-service-token': serviceToken } });
console.log('STATUS:', response.status);
console.log('BODY:', await response.text());
