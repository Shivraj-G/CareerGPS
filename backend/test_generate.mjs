const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTQwMDAtODAwMC0wMDAwMDAwMDAwMDMiLCJyb2xlIjoiVVNFUiIsImlhdCI6MTc5MDcwNDYzNiwiZXhwIjoxNzkwNzI2MjM2fQ.qoBJX_52-jFGDnoWarI9xWybP5qlzhJ15k-4Pt8zsFA'; 

fetch('http://localhost:5000/api/v1/pathways/generate', { 
  method: 'POST', 
  headers: { 
    'Content-Type': 'application/json', 
    'Authorization': 'Bearer ' + token 
  }, 
  body: JSON.stringify({ career_id: '54290ccd-b861-463b-8ea4-d0ea178462f8' }) 
})
.then(r => r.json().then(data => ({status: r.status, data})))
.then(({status, data}) => {
  console.log("Status:", status);
  console.log("Response:", JSON.stringify(data, null, 2));
})
.catch(console.error);
