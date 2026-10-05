import 'dotenv/config';

async function run() {
  const jwt = await import('jsonwebtoken');
  const token = jwt.default.sign({ id: '00000000-0000-0000-0000-000000000000', email: 'test@example.com', role: 'student' }, process.env.JWT_SECRET || 'secret');
  
  const res = await fetch('http://localhost:5000/api/assistant/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + token
    },
    body: JSON.stringify({ message: 'What is a Machine Learning Engineer?' })
  });
  console.log(await res.text());
}
run();
