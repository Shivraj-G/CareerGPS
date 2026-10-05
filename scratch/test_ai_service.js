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
    'x-internal-service-token': '246faeb20c364ac79f47fb3d0d0c18bae62b6e154fe12dd74db5bba0232b5aafa2f6f1f93219741963a37b724d4201c29a2e83f26f218e4216eca270237e145a'
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log).catch(console.error);
