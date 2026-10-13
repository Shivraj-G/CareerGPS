import { evaluateGoalEligibility } from './src/modules/goals/goal.engine.js';

const testCases = [
  { id: 1, qual: "12th Pass", stream: "Physics, Chem, Math", goal: "Mechanical Engineer", exp: "A", action: "JEE" },
  { id: 2, qual: "12th Pass", stream: "Physics, Chem, Math", goal: "Software Developer", exp: "A", action: "BTech CSE" },
  { id: 3, qual: "12th Pass", stream: "Physics, Chem, Math", goal: "Investment Banker", exp: "C", action: "Finance" },
  { id: 4, qual: "12th Pass", stream: "Physics, Chem, Math", goal: "MBBS Doctor", exp: "D", action: "NMC" },
  { id: 5, qual: "UG Ongoing", stream: "Mechanical", goal: "Data Scientist", exp: "C", action: "bootcamp" },
  { id: 6, qual: "UG Pass", stream: "Civil", goal: "Civil Services (IAS)", exp: "A", action: "UPSC" },
  { id: 7, qual: "UG Pass", stream: "Math", goal: "Actuary", exp: "A", action: "ACET" },
  { id: 8, qual: "UG Pass", stream: "Comp App", degree: "BCA", goal: "Cybersecurity Analyst", exp: "B", action: "CompTIA" },
  { id: 9, qual: "UG Pass", stream: "Comp App", degree: "BCA", goal: "MCA in NITs", exp: "D/C", action: "flexible" },
  { id: 10, qual: "10th", stream: "General", goal: "Robotics Engineer", exp: "B", action: "11th" },
  { id: 11, qual: "12th Pass", stream: "Physics, Chem, Bio", goal: "MBBS Doctor", exp: "A", action: "NEET" },
  { id: 12, qual: "12th Pass", stream: "Physics, Chem, Bio", goal: "Software Engineer", exp: "C", action: "BCA" },
  { id: 13, qual: "UG Pass", stream: "Zoology", degree: "BSc Zoology", goal: "Data Analyst", exp: "C", action: "SQL" },
  { id: 14, qual: "UG Pass", stream: "Dentistry", degree: "BDS", goal: "Hospital Administrator", exp: "A", action: "MHA/MBA" },
  { id: 15, qual: "12th Fail", stream: "PCB", status: "drop-out", goal: "Nurse", exp: "B", action: "NIOS" },
  { id: 16, qual: "UG Pass", stream: "Nursing", degree: "BSc Nursing", goal: "Clinical Researcher", exp: "A", action: "PG Diploma" },
  { id: 17, qual: "UG Pass", stream: "Pharmacy", degree: "BPharm", goal: "Product Manager (Tech)", exp: "C", action: "PM cert" },
  { id: 18, qual: "11th Ongoing", stream: "PCB", level: "11th", goal: "Architect", exp: "D", action: "Math" },
  { id: 19, qual: "UG Pass", stream: "Agri", degree: "BSc Agriculture", goal: "Bank PO", exp: "A", action: "IBPS" },
  { id: 20, qual: "UG Pass", stream: "Medicine", degree: "MBBS", goal: "Surgeon", exp: "A", action: "NEET PG" },
  { id: 21, qual: "12th Pass", stream: "Accounts, Econ, Math", goal: "Chartered Accountant", exp: "A", action: "ICAI" },
  { id: 22, qual: "12th Pass", stream: "Accounts, Econ", goal: "BSc Economics Hons", exp: "B/C", action: "specific university" },
  { id: 23, qual: "UG Pass", stream: "Commerce", degree: "BCom", goal: "Software Developer", exp: "C", action: "Bootcamp" },
  { id: 24, qual: "UG Pass", stream: "Commerce", degree: "BCom", goal: "Corporate Lawyer", exp: "A", action: "LLB" },
  { id: 25, qual: "12th Pass", stream: "Accounts, Bus Studies", goal: "Game Designer", exp: "A", action: "portfolio" },
  { id: 26, qual: "UG Ongoing", stream: "Management", degree: "BBA", goal: "HR Manager", exp: "A", action: "CAT/XAT" },
  { id: 27, qual: "Professional", stream: "CA", goal: "Financial Analyst", exp: "C", action: "CFA" },
  { id: 28, qual: "PG Pass", stream: "Commerce", degree: "MCom", level: "PG", goal: "Professor", exp: "B", action: "UGC NET" },
  { id: 29, qual: "11th Ongoing", stream: "Comm", level: "11th", goal: "Commercial Pilot", exp: "D/C", action: "NIOS" },
  { id: 30, qual: "UG Pass", stream: "Commerce", degree: "BCom", goal: "Digital Marketer", exp: "A", action: "Google" },
  { id: 31, qual: "12th Pass", stream: "History, Pol Sci", goal: "Civil Judge", exp: "A", action: "CLAT" },
  { id: 32, qual: "UG Pass", stream: "History", degree: "BA History", goal: "UX Designer", exp: "C", action: "Figma" },
  { id: 33, qual: "12th Pass", stream: "Sociology, Psych", goal: "Clinical Psychologist", exp: "A", action: "BA/BSc Psych" },
  { id: 34, qual: "UG Pass", stream: "English", degree: "BA English", goal: "Data Scientist", exp: "C", action: "Python" },
  { id: 35, qual: "PG Pass", stream: "Pol Sci", degree: "MA Pol Sci", goal: "Journalist", exp: "A", action: "PG Diploma" },
  { id: 36, qual: "UG Pass", stream: "Fine Arts", degree: "BA Fine Arts", goal: "3D Animator", exp: "A", action: "Maya/Blender" },
  { id: 37, qual: "12th Pass", stream: "Econ, Geog", goal: "Investment Banker", exp: "C", action: "BA Econ" },
  { id: 38, qual: "UG Pass", stream: "Sociology", degree: "BA Sociology", goal: "HR Professional", exp: "A", action: "MSW (HR) or MBA" },
  { id: 39, qual: "10th", stream: "Gen", goal: "Fashion Designer", exp: "B", action: "12th" },
  { id: 40, qual: "UG Pass", stream: "Geog", degree: "BA Geography", goal: "GIS Analyst", exp: "A", action: "PG Diploma" },
  { id: 41, qual: "Diploma Pass", stream: "Mechanical", level: "Diploma", goal: "Automobile Engineer", exp: "A", action: "LEET" },
  { id: 42, qual: "ITI Pass", stream: "Electrical", level: "ITI", goal: "Electrical Engineer", exp: "C", action: "Polytechnic" },
  { id: 43, qual: "None", stream: "Unknown", goal: "Software Engineer", exp: "E", action: "Please enter" },
  { id: 44, qual: "12th Pass", stream: "PCM", goal: "Pilot", exp: "A", action: "DGCA" },
  { id: 45, qual: "UG Pass", stream: "Agri", degree: "BSc Agriculture", goal: "Civil Engineer", exp: "D", action: "constraints" },
  { id: 46, qual: "UG Pass", stream: "Commerce", degree: "BCom", goal: null, exp: "N/A", action: "dashboard" },
  { id: 47, qual: "PG Pass", stream: "Marketing", degree: "MBA", goal: "Product Manager", exp: "A", action: "portfolio" },
  { id: 48, qual: "12th Pass", stream: "PCM", degree: "BTech", status: "drop-out", goal: "Software Developer", exp: "C", action: "IGNOU" },
  { id: 49, qual: "12th Pass", stream: "Arts", age: 25, goal: "NDA", exp: "D", action: "age limit" },
  { id: 50, qual: "Diploma", stream: "Nursing", level: "Diploma", goal: "Head Nurse", exp: "B", action: "Post Basic" },
];

let passed = 0;
let failed = [];

testCases.forEach((tc) => {
  const profile = {
    age: tc.age || 18,
    education: tc.qual === "None" ? [] : [{
      level: tc.level || (tc.qual.includes("12th") ? "12th" : tc.qual.includes("10th") ? "10th" : "UG"),
      school_12_stream: tc.stream,
      degree: tc.degree || "",
      status: tc.status || "completed"
    }]
  };
  
  const res = evaluateGoalEligibility(profile, tc.goal ? { title: tc.goal } : null);
  
  const okStatus = res.status === tc.exp;
  const okAction = res.action.toLowerCase().includes(tc.action.toLowerCase());
  
  if (okStatus && okAction) {
    passed++;
  } else {
    failed.push({
      id: tc.id,
      expectedStatus: tc.exp,
      gotStatus: res.status,
      expectedAction: tc.action,
      gotAction: res.action,
      goal: tc.goal
    });
  }
});

console.log(`\n============================`);
console.log(`TEST RESULTS: ${passed}/50 PASSED`);
console.log(`============================\n`);

if (failed.length > 0) {
  console.log('FAILURES:');
  failed.forEach(f => console.log(f));
}
