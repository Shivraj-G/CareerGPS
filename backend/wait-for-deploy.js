const serviceUrl = (process.env.AI_SERVICE_URL || 'https://careergps-nc6z.onrender.com').replace(/\/+$/, '');
const serviceToken = process.env.INTERNAL_SERVICE_TOKEN;
if (!serviceToken) throw new Error('Set INTERNAL_SERVICE_TOKEN before running this diagnostic.');

async function run() {
  while (true) {
    try {
      const response = await fetch(`${serviceUrl}/internal/v1/health`, { headers: { 'x-internal-service-token': serviceToken } });
      const body = await response.json();
      const models = (body.llm?.providers || []).map((provider) => provider.model);
      console.log('Current models:', models);
      if (response.ok && models.length > 0) {
        console.log('AI service is responding.');
        return;
      }
    } catch (error) {
      console.log('Error pinging AI service:', error.message);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

run();
