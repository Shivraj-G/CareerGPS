const payload = {
  question: "What is a Machine Learning Engineer?",
  context: {
    careers: [{id: 1, title: 'Baker', description: 'baking'}],
    opportunities: [],
    pathways: [],
    courses: [],
    profile: {}
  }
};

fetch('http://localhost:8000/internal/v1/assistant/answer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || ''
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log).catch(console.error);
