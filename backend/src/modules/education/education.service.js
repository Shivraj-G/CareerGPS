const MEDICAL_SCIENCE = ["Science — PCB", "Science — PCMB", "Science"];
const ENGIN_SCIENCE = ["Science — PCM", "Science — PCMB", "Science"];
const ALL_SCIENCE = ["Science", "Science — PCM", "Science — PCB", "Science — PCMB"];
const ALL_STREAMS = ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"];
const COMMERCE_AND_SCIENCE = ["Commerce", "Science", "Science — PCM", "Science — PCB", "Science — PCMB"];

const PROGRAM_REQUIREMENTS = [
  // MEDICAL / HEALTHCARE
  { program: "MBBS", required_streams: MEDICAL_SCIENCE },
  { program: "BDS", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Nursing", required_streams: MEDICAL_SCIENCE },
  { program: "BPT / Bachelor of Physiotherapy", required_streams: MEDICAL_SCIENCE },
  { program: "BOT / Bachelor of Occupational Therapy", required_streams: MEDICAL_SCIENCE },
  { program: "BASLP / Audiology & Speech-Language Pathology", required_streams: MEDICAL_SCIENCE },
  { program: "BMLT / Medical Laboratory Technology", required_streams: MEDICAL_SCIENCE },
  { program: "Bachelor of Radiology / Medical Imaging", required_streams: MEDICAL_SCIENCE },
  { program: "Bachelor of Optometry", required_streams: MEDICAL_SCIENCE },
  { program: "Bachelor of Medical Biotechnology", required_streams: MEDICAL_SCIENCE },
  { program: "Bachelor of Public Health", required_streams: MEDICAL_SCIENCE },
  { program: "Bachelor of Allied Health Sciences", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Medical Laboratory Technology", required_streams: MEDICAL_SCIENCE },
  { program: "B.Pharm", required_streams: ALL_SCIENCE },
  { program: "Pharm.D", required_streams: ALL_SCIENCE },

  // ENGINEERING / TECHNOLOGY
  { program: "B.Tech / BE", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Computer Science", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Information Technology", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Artificial Intelligence", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Data Science", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Cyber Security", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Electronics", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Electrical", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Mechanical", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Civil", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Chemical", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Biotechnology", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Biomedical", required_streams: ALL_SCIENCE },
  { program: "B.Tech Robotics", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Mechatronics", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Automobile", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Aerospace", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Environmental", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Agricultural Engineering", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Food Technology", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Marine Engineering", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Petroleum Engineering", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Instrumentation", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Electronics & Communication", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Computer Engineering", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Software Engineering", required_streams: ENGIN_SCIENCE },
  { program: "B.Tech Internet of Things", required_streams: ENGIN_SCIENCE },

  // PURE SCIENCE
  { program: "B.Sc", required_streams: ALL_SCIENCE },
  { program: "B.Sc Physics", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Chemistry", required_streams: ALL_SCIENCE },
  { program: "B.Sc Mathematics", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Statistics", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Biology", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Botany", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Zoology", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Biotechnology", required_streams: ALL_SCIENCE },
  { program: "B.Sc Microbiology", required_streams: MEDICAL_SCIENCE },
  { program: "B.Sc Biochemistry", required_streams: ALL_SCIENCE },
  { program: "B.Sc Environmental Science", required_streams: ALL_SCIENCE },
  { program: "B.Sc Geology", required_streams: ALL_SCIENCE },
  { program: "B.Sc Geography", required_streams: ALL_STREAMS },
  { program: "B.Sc Food Science", required_streams: ALL_SCIENCE },
  { program: "B.Sc Forensic Science", required_streams: ALL_SCIENCE },

  // COMPUTER / IT
  { program: "BCA", required_streams: ALL_STREAMS },
  { program: "B.Sc Computer Science", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Information Technology", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Data Science", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Artificial Intelligence", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Cyber Security", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Information Systems", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Software Development", required_streams: ENGIN_SCIENCE },
  { program: "B.Sc Computer Applications", required_streams: ENGIN_SCIENCE },

  // COMMERCE / BUSINESS
  { program: "B.Com", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Accounting", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Finance", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Banking & Insurance", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Taxation", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Business Analytics", required_streams: COMMERCE_AND_SCIENCE },
  { program: "B.Com Computer Applications", required_streams: COMMERCE_AND_SCIENCE },
  { program: "BBA", required_streams: ALL_STREAMS },
  { program: "BBA Finance", required_streams: ALL_STREAMS },
  { program: "BBA Marketing", required_streams: ALL_STREAMS },
  { program: "BBA Human Resources", required_streams: ALL_STREAMS },
  { program: "BBA International Business", required_streams: ALL_STREAMS },
  { program: "BBA Business Analytics", required_streams: ALL_STREAMS },
  { program: "BBA Digital Marketing", required_streams: ALL_STREAMS },
  { program: "BMS", required_streams: ALL_STREAMS },
  { program: "BBM", required_streams: ALL_STREAMS },
  { program: "Bachelor of Management Studies", required_streams: ALL_STREAMS },
  { program: "Bachelor of Financial Management", required_streams: COMMERCE_AND_SCIENCE },
  { program: "Bachelor of Banking & Finance", required_streams: COMMERCE_AND_SCIENCE },
  { program: "Bachelor of Economics", required_streams: ALL_STREAMS },

  // ARTS / HUMANITIES
  { program: "BA", required_streams: ALL_STREAMS },
  { program: "BA English", required_streams: ALL_STREAMS },
  { program: "BA Economics", required_streams: ALL_STREAMS },
  { program: "BA Psychology", required_streams: ALL_STREAMS },
  { program: "BA Sociology", required_streams: ALL_STREAMS },
  { program: "BA Political Science", required_streams: ALL_STREAMS },
  { program: "BA History", required_streams: ALL_STREAMS },
  { program: "BA Geography", required_streams: ALL_STREAMS },
  { program: "BA Philosophy", required_streams: ALL_STREAMS },
  { program: "BA Journalism", required_streams: ALL_STREAMS },
  { program: "BA Mass Communication", required_streams: ALL_STREAMS },
  { program: "BA Communication", required_streams: ALL_STREAMS },
  { program: "BA Public Administration", required_streams: ALL_STREAMS },
  { program: "BA International Relations", required_streams: ALL_STREAMS },
  { program: "BA Social Work", required_streams: ALL_STREAMS },
  { program: "BA English Literature", required_streams: ALL_STREAMS },
  { program: "BA Hindi", required_streams: ALL_STREAMS },
  { program: "BA Languages", required_streams: ALL_STREAMS },
  { program: "BA Fine Arts", required_streams: ALL_STREAMS },

  // MEDIA / COMMUNICATION
  { program: "Bachelor of Journalism", required_streams: ALL_STREAMS },
  { program: "Bachelor of Mass Communication", required_streams: ALL_STREAMS },
  { program: "Bachelor of Media Studies", required_streams: ALL_STREAMS },
  { program: "Bachelor of Journalism & Mass Communication", required_streams: ALL_STREAMS },
  { program: "Bachelor of Film Studies", required_streams: ALL_STREAMS },
  { program: "Bachelor of Digital Media", required_streams: ALL_STREAMS },
  { program: "Bachelor of Advertising", required_streams: ALL_STREAMS },
  { program: "Bachelor of Public Relations", required_streams: ALL_STREAMS },
  { program: "Bachelor of Multimedia", required_streams: ALL_STREAMS },
  { program: "Bachelor of Visual Communication", required_streams: ALL_STREAMS },

  // DESIGN / CREATIVE
  { program: "B.Des", required_streams: ALL_STREAMS },
  { program: "Bachelor of Fashion Design", required_streams: ALL_STREAMS },
  { program: "Bachelor of Interior Design", required_streams: ALL_STREAMS },
  { program: "Bachelor of Graphic Design", required_streams: ALL_STREAMS },
  { program: "Bachelor of Product Design", required_streams: ALL_STREAMS },
  { program: "Bachelor of Communication Design", required_streams: ALL_STREAMS },
  { program: "Bachelor of Animation", required_streams: ALL_STREAMS },
  { program: "Bachelor of Visual Arts", required_streams: ALL_STREAMS },
  { program: "Bachelor of Fine Arts", required_streams: ALL_STREAMS },
  { program: "Bachelor of Textile Design", required_streams: ALL_STREAMS },

  // LAW
  { program: "LLB", required_streams: ALL_STREAMS },

  // AGRICULTURE / ENVIRONMENT
  { program: "B.Sc Agriculture", required_streams: ALL_SCIENCE },
  { program: "B.Sc Horticulture", required_streams: ALL_SCIENCE },
  { program: "B.Sc Forestry", required_streams: ALL_SCIENCE },
  { program: "B.Sc Fisheries", required_streams: ALL_SCIENCE },
  { program: "B.Tech Agricultural Engineering", required_streams: ENGIN_SCIENCE },
  { program: "Bachelor of Environmental Science", required_streams: ALL_SCIENCE },
  { program: "Bachelor of Food Technology", required_streams: ALL_SCIENCE },
  { program: "Bachelor of Dairy Technology", required_streams: ENGIN_SCIENCE },
  { program: "Bachelor of Veterinary Science", required_streams: MEDICAL_SCIENCE },

  // EDUCATION
  { program: "B.Ed", required_streams: ALL_STREAMS },
  { program: "B.El.Ed", required_streams: ALL_STREAMS },
  { program: "D.El.Ed", required_streams: ALL_STREAMS },

  // TOURISM / HOSPITALITY
  { program: "Bachelor of Hotel Management", required_streams: ALL_STREAMS },
  { program: "BHM", required_streams: ALL_STREAMS },
  { program: "Bachelor of Tourism Management", required_streams: ALL_STREAMS },
  { program: "Bachelor of Travel & Tourism", required_streams: ALL_STREAMS },
  { program: "Bachelor of Hospitality Management", required_streams: ALL_STREAMS },

  // SPORTS
  { program: "Bachelor of Physical Education", required_streams: ALL_STREAMS },
  { program: "B.P.Ed", required_streams: ALL_STREAMS },
  { program: "Bachelor of Sports Management", required_streams: ALL_STREAMS },
  { program: "Bachelor of Sports Science", required_streams: ALL_STREAMS },

  // ARCHITECTURE / PLANNING
  { program: "B.Arch", required_streams: ENGIN_SCIENCE },
  { program: "B.Plan", required_streams: ENGIN_SCIENCE },
  { program: "Bachelor of Architecture", required_streams: ENGIN_SCIENCE },
  { program: "Bachelor of Planning", required_streams: ENGIN_SCIENCE },

  // POSTGRADUATE / OTHERS (Preserved for backward compatibility)
  { program: "MCA", required_streams: [] },
  { program: "MBA", required_streams: [] },
  { program: "Masters", required_streams: [] },
  { program: "Other", required_streams: [] }
];

export function getCompatiblePrograms(stream) {
  if (!stream) {
    return PROGRAM_REQUIREMENTS.map(p => p.program);
  }
  return PROGRAM_REQUIREMENTS.filter(p => {
    if (p.required_streams.length === 0) return true; // unknown/any
    return p.required_streams.includes(stream) || 
           // If user selects specific "Science - PCM", it fulfills generic "Science"
           (stream.startsWith("Science") && p.required_streams.includes("Science"));
  }).map(p => p.program);
}

export function validateProgramCompatibility(stream, program) {
  if (!program) return true; // valid if not provided
  if (!stream) return true; // if we don't know the stream, we can't restrict

  const progReq = PROGRAM_REQUIREMENTS.find(p => p.program === program);
  if (!progReq) return true; // unknown program, default to valid

  if (progReq.required_streams.length === 0) return true; // unknown/any requirement

  if (progReq.required_streams.includes(stream)) return true;
  
  if (stream.startsWith("Science") && progReq.required_streams.includes("Science")) return true;

  return false;
}
