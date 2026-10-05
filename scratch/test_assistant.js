const payload = {
  message: "What is a Machine Learning Engineer?"
};

fetch('http://localhost:3000/api/assistant/chat', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + process.env.TEST_TOKEN // Wait, how to test?
  },
  body: JSON.stringify(payload)
}).then(res => res.json()).then(console.log);
