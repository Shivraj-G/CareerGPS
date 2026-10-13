async function run() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJyb2xlIjoidXNlciIsImlhdCI6MTc5MTY1Mzc2NSwiZXhwIjoxNzkxNzQwMTY1fQ.3-SLT5QVGYQoWKOAYWhZN6CjcrMrXqSLRLwBoapHyTc';

  async function testValidateGoal(goal, profileContext) {
    const res = await fetch('http://localhost:5000/api/v1/profiles/me/validate-goal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': "Bearer " + token
      },
      body: JSON.stringify({ goal, profileContext })
    });
    const data = await res.json();
    console.log("\\n================================\\nGOAL: " + goal + "\\n================================");
    console.log(JSON.stringify(data, null, 2));
  }

  await testValidateGoal("Backend Developer", {
    education: [{ education_stage: "SCHOOL_12", school_12_stream: "Science (PCM)", school_12_status: "Completed" }, { current_program: "BCA", status: "Pursuing" }]
  });

  await testValidateGoal("Doctor", {
    education: [{ education_stage: "SCHOOL_12", school_12_stream: "Science (PCB)", school_12_status: "Completed" }]
  });

  await testValidateGoal("Beggar", {
    education: [{ education_stage: "SCHOOL_12", school_12_stream: "Commerce", school_12_status: "Completed" }]
  });
}
run();
