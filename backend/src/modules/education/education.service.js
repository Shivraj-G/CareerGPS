export const ALL_STREAMS = [
  "Science — PCM", "Science — PCB", "Science — PCMB", "Science — PCM + Computer Science", "Science — PCB + Computer Science/IP", "Science — Other",
  "Commerce with Mathematics", "Commerce without Mathematics", "Commerce + Computer Science/IP",
  "Humanities with Mathematics", "Humanities without Mathematics",
  "Vocational", "Custom"
];

export const SUPPORTED_STREAMS = ALL_STREAMS;

/**
 * Normalizes legacy display labels, abbreviations, or raw stream strings
 * into canonical standard stream names.
 */
export function normalizeStream(stream) {
  if (!stream || typeof stream !== 'string') return '';
  const s = stream.trim();
  const lower = s.toLowerCase();

  // Science combinations
  if (lower.includes('pcmb') || (lower.includes('math') && lower.includes('bio'))) {
    return 'Science — PCMB';
  }
  if (lower.includes('pcm + computer') || lower.includes('pcm cs') || lower.includes('physics, mathematics & computer') || lower.includes('science pmc')) {
    return 'Science — PCM + Computer Science';
  }
  if (lower.includes('pcb + computer') || lower.includes('pcb cs')) {
    return 'Science — PCB + Computer Science/IP';
  }
  if (lower.includes('pcm') || (lower.includes('physics') && lower.includes('math'))) {
    return 'Science — PCM';
  }
  if (lower.includes('pcb') || (lower.includes('physics') && lower.includes('bio'))) {
    return 'Science — PCB';
  }
  if (lower.startsWith('science')) {
    return 'Science — Other';
  }

  // Commerce combinations
  if (lower.includes('commerce + computer') || lower.includes('commerce cs')) {
    return 'Commerce + Computer Science/IP';
  }
  if (lower.includes('commerce without math')) {
    return 'Commerce without Mathematics';
  }
  if (lower.includes('commerce with math') || (lower.includes('commerce') && lower.includes('math'))) {
    return 'Commerce with Mathematics';
  }
  if (lower.includes('commerce')) {
    return 'Commerce with Mathematics';
  }

  // Humanities / Arts
  if (lower.includes('humanities without math') || lower.includes('arts without math')) {
    return 'Humanities without Mathematics';
  }
  if (lower.includes('humanities with math') || lower.includes('arts with math')) {
    return 'Humanities with Mathematics';
  }
  if (lower.includes('arts / humanities') || lower.includes('humanities') || lower.includes('arts')) {
    return 'Humanities without Mathematics';
  }

  // Vocational / Custom
  if (lower.includes('vocational')) {
    return 'Vocational';
  }
  if (lower.includes('custom')) {
    return 'Custom';
  }

  const exact = ALL_STREAMS.find(st => st.toLowerCase() === lower);
  if (exact) return exact;

  return s;
}
const MEDICAL_SCIENCE = ["Science — PCB", "Science — PCMB", "Science — PCB + Computer Science/IP", "Science — Other", "Custom"];
const ENGIN_SCIENCE = ["Science — PCM", "Science — PCMB", "Science — PCM + Computer Science", "Science — Other", "Custom"];
const ALL_SCIENCE = ["Science — PCM", "Science — PCB", "Science — PCMB", "Science — PCM + Computer Science", "Science — PCB + Computer Science/IP", "Science — Other", "Custom"];
const COMMERCE_AND_SCIENCE = [...ALL_SCIENCE, "Commerce with Mathematics", "Commerce without Mathematics", "Commerce + Computer Science/IP"];

export const PROGRAM_REQUIREMENTS = [
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

  // VOCATIONAL / OTHER
  { program: "B.Voc", required_streams: ALL_STREAMS },
  { program: "B.Voc Software Development", required_streams: ALL_STREAMS },
  { program: "BFA", required_streams: ALL_STREAMS },
  { program: "Bachelor of Fine Arts", required_streams: ALL_STREAMS },

  // DIPLOMA / POLYTECHNIC
  { program: "Diploma", required_streams: ALL_STREAMS },
  { program: "Diploma in Engineering", required_streams: ALL_STREAMS },
  { program: "Polytechnic Diploma", required_streams: ALL_STREAMS },
  { program: "Diploma in Hotel Management", required_streams: ALL_STREAMS },
  { program: "Diploma in Pharmacy (D.Pharm)", required_streams: ALL_SCIENCE },
  { program: "Diploma in Computer Applications", required_streams: ALL_STREAMS },

  // POSTGRADUATE / OTHERS (Preserved for backward compatibility)
  { program: "MCA", required_streams: [] },
  { program: "MBA", required_streams: [] },
  { program: "Masters", required_streams: [] },
  { program: "Other", required_streams: [] }
];

export function getCompatiblePrograms(stream) {
  if (!stream) {
    return [...new Set(PROGRAM_REQUIREMENTS.map(p => p.program))];
  }
  const normStream = normalizeStream(stream);
  const programs = PROGRAM_REQUIREMENTS.filter(p => {
    if (p.required_streams.length === 0) return true; // unknown/any
    return p.required_streams.includes(normStream) || p.required_streams.includes(stream);
  }).map(p => p.program);
  return [...new Set(programs)];
}

export function validateProgramCompatibility(stream, program) {
  if (!program) return true; // valid if not provided
  if (!stream) return true; // if we don't know the stream, we can't restrict

  const normStream = normalizeStream(stream);
  const progReq = PROGRAM_REQUIREMENTS.find(p => p.program.toLowerCase() === program.trim().toLowerCase());
  if (!progReq) return true; // unknown program, default to valid

  if (progReq.required_streams.length === 0) return true; // unknown/any requirement

  if (progReq.required_streams.includes(normStream) || progReq.required_streams.includes(stream)) return true;
  
  return false;
}

const MASTERS_CATALOGUE = [
  // Arts & Humanities
  { discipline: "Arts & Humanities", program: "MA English" },
  { discipline: "Arts & Humanities", program: "MA History" },
  { discipline: "Arts & Humanities", program: "MA Political Science" },
  { discipline: "Arts & Humanities", program: "MA Sociology" },
  { discipline: "Arts & Humanities", program: "MA Psychology" },
  { discipline: "Arts & Humanities", program: "MA Geography" },
  { discipline: "Arts & Humanities", program: "MA Philosophy" },
  { discipline: "Arts & Humanities", program: "MA Languages" },
  { discipline: "Arts & Humanities", program: "MA Public Administration" },
  { discipline: "Arts & Humanities", program: "MA International Relations" },

  // Commerce & Accounting
  { discipline: "Commerce & Accounting", program: "M.Com" },
  { discipline: "Commerce & Accounting", program: "M.Com Accounting" },
  { discipline: "Commerce & Accounting", program: "M.Com Finance" },
  { discipline: "Commerce & Accounting", program: "M.Com Taxation" },
  { discipline: "Commerce & Accounting", program: "M.Com Banking" },

  // Science
  { discipline: "Science", program: "M.Sc Mathematics" },
  { discipline: "Science", program: "M.Sc Statistics" },
  { discipline: "Science", program: "M.Sc Physics" },
  { discipline: "Science", program: "M.Sc Chemistry" },
  { discipline: "Science", program: "M.Sc Biology" },
  { discipline: "Science", program: "M.Sc Biotechnology" },
  { discipline: "Science", program: "M.Sc Microbiology" },
  { discipline: "Science", program: "M.Sc Environmental Science" },

  // Computing & Emerging Tech
  { discipline: "Computing & Emerging Tech", program: "MCA" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Computer Science" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Information Technology" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Data Science" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Artificial Intelligence" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Machine Learning" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Cybersecurity" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Cloud Computing" },
  { discipline: "Computing & Emerging Tech", program: "M.Sc Software Engineering" },

  // Engineering & Technology
  { discipline: "Engineering & Technology", program: "M.Tech CSE" },
  { discipline: "Engineering & Technology", program: "M.Tech IT" },
  { discipline: "Engineering & Technology", program: "M.Tech AI/ML" },
  { discipline: "Engineering & Technology", program: "M.Tech Data Science" },
  { discipline: "Engineering & Technology", program: "M.Tech Cybersecurity" },
  { discipline: "Engineering & Technology", program: "M.Tech Electronics" },
  { discipline: "Engineering & Technology", program: "M.Tech Electrical" },
  { discipline: "Engineering & Technology", program: "M.Tech Mechanical" },
  { discipline: "Engineering & Technology", program: "M.Tech Civil" },
  { discipline: "Engineering & Technology", program: "M.Tech Chemical" },
  { discipline: "Engineering & Technology", program: "M.Tech Biotechnology" },
  { discipline: "Engineering & Technology", program: "M.Tech Robotics" },
  { discipline: "Engineering & Technology", program: "M.Tech VLSI" },

  // Business & Management
  { discipline: "Business & Management", program: "MBA" },
  { discipline: "Business & Management", program: "MMS" },
  { discipline: "Business & Management", program: "MBA Finance" },
  { discipline: "Business & Management", program: "MBA Marketing" },
  { discipline: "Business & Management", program: "MBA Human Resources" },
  { discipline: "Business & Management", program: "MBA Business Analytics" },

  // Economics, Finance & Analytics
  { discipline: "Economics, Finance & Analytics", program: "MA Economics" },
  { discipline: "Economics, Finance & Analytics", program: "M.Sc Economics" },
  { discipline: "Economics, Finance & Analytics", program: "Master of Financial Management" },

  // Law
  { discipline: "Law", program: "LL.M" },

  // Medicine & Dentistry
  { discipline: "Medicine & Dentistry", program: "MD" },
  { discipline: "Medicine & Dentistry", program: "MS" },
  { discipline: "Medicine & Dentistry", program: "MDS" },

  // Nursing & Allied Health
  { discipline: "Nursing & Allied Health", program: "M.Pharm" },
  { discipline: "Nursing & Allied Health", program: "M.Sc Nursing" },
  { discipline: "Nursing & Allied Health", program: "MPT" },
  { discipline: "Nursing & Allied Health", program: "MPH" },

  // Agriculture & Natural Resources
  { discipline: "Agriculture & Natural Resources", program: "M.Sc Agriculture" },
  { discipline: "Agriculture & Natural Resources", program: "M.Sc Forestry" },
  { discipline: "Agriculture & Natural Resources", program: "M.Sc Horticulture" },

  // Architecture & Planning
  { discipline: "Architecture & Planning", program: "M.Arch" },
  { discipline: "Architecture & Planning", program: "M.Plan" },

  // Design & Creative Arts
  { discipline: "Design & Creative Arts", program: "M.Des" },
  { discipline: "Design & Creative Arts", program: "MFA" },

  // Media & Communication
  { discipline: "Media & Communication", program: "MA Journalism" },
  { discipline: "Media & Communication", program: "MJMC" },

  // Education
  { discipline: "Education", program: "M.Ed" },

  // Social Work & Public Policy
  { discipline: "Social Work & Public Policy", program: "MSW" },
  { discipline: "Social Work & Public Policy", program: "MPA" },

  // Psychology & Behavioural Sciences
  { discipline: "Psychology & Behavioural Sciences", program: "MA Psychology" },
  { discipline: "Psychology & Behavioural Sciences", program: "M.Sc Psychology" },

  // Hospitality & Tourism
  { discipline: "Hospitality & Tourism", program: "Master in Tourism Administration" },
  { discipline: "Hospitality & Tourism", program: "M.Sc Hospitality" },

  // Sports & Physical Education
  { discipline: "Sports & Physical Education", program: "M.P.Ed" },

  // Library & Information Science
  { discipline: "Library & Information Science", program: "M.Lib.I.Sc." },

  // Interdisciplinary & Emerging
  { discipline: "Interdisciplinary & Emerging", program: "M.Sc Environmental Sustainability" },
  { discipline: "Interdisciplinary & Emerging", program: "M.Sc Forensic Science" }
];

export function getEligibleMasterPrograms(bachelorsDegree) {
  if (!bachelorsDegree) return [];

  const bd = bachelorsDegree.toUpperCase();
  const allowed = new Set();

  const addByProgram = (progStr) => {
    const found = MASTERS_CATALOGUE.filter(m => m.program.toUpperCase().includes(progStr.toUpperCase()));
    found.forEach(f => allowed.add(JSON.stringify(f)));
  };

  const addByDiscipline = (discStr) => {
    const found = MASTERS_CATALOGUE.filter(m => m.discipline === discStr);
    found.forEach(f => allowed.add(JSON.stringify(f)));
  };

  // General Management is open to most
  addByDiscipline("Business & Management");
  addByProgram("MA Public Administration");

  // BCA / Computing
  if (bd.includes("BCA") || bd.includes("B.SC IT") || bd.includes("B.SC COMP") || bd.includes("B.TECH COMP") || bd.includes("B.TECH INFO") || bd.includes("B.TECH CS")) {
    addByDiscipline("Computing & Emerging Tech");
    addByProgram("MBA Business Analytics");
  }

  // B.Com / Business
  if (bd.includes("B.COM") || bd.includes("BBA") || bd.includes("BMS") || bd.includes("BBM")) {
    addByDiscipline("Commerce & Accounting");
    addByProgram("Master of Financial Management");
    addByProgram("MA Economics");
    addByProgram("M.Sc Economics");
  }

  // B.Tech / B.E
  if (bd.includes("B.TECH") || bd.includes("B.E")) {
    addByDiscipline("Engineering & Technology");
    if (bd.includes("COMP") || bd.includes("INFO") || bd.includes("DATA") || bd.includes("CYBER") || bd.includes("SOFTWARE")) {
      addByDiscipline("Computing & Emerging Tech");
    }
  }

  // B.Sc
  if (bd.includes("B.SC")) {
    if (bd.includes("MATH") || bd.includes("STAT")) {
      addByProgram("M.Sc Mathematics");
      addByProgram("M.Sc Statistics");
      addByProgram("M.Sc Data Science");
      addByProgram("MCA");
      addByProgram("M.Sc Economics");
    }
    if (bd.includes("PHYS")) addByProgram("M.Sc Physics");
    if (bd.includes("CHEM")) addByProgram("M.Sc Chemistry");
    if (bd.includes("BIO")) {
      addByProgram("M.Sc Biology");
      addByProgram("M.Sc Biotechnology");
      addByProgram("M.Sc Microbiology");
    }
    addByProgram("M.Sc Environmental Sustainability");
    addByProgram("M.Sc Forensic Science");
  }

  // BA
  if (bd.includes("BA ") || bd === "BA") {
    addByDiscipline("Arts & Humanities");
    addByDiscipline("Media & Communication");
    addByDiscipline("Social Work & Public Policy");
    if (bd.includes("ECON")) {
      addByDiscipline("Economics, Finance & Analytics");
    }
    if (bd.includes("PSYCH")) {
      addByDiscipline("Psychology & Behavioural Sciences");
    }
  }

  // B.Pharm / Medical
  if (bd.includes("B.PHARM")) {
    addByDiscipline("Nursing & Allied Health");
  }
  if (bd.includes("MBBS") || bd.includes("BDS")) {
    addByDiscipline("Medicine & Dentistry");
    addByProgram("MPH");
  }

  // B.Des / BFA
  if (bd.includes("B.DES") || bd.includes("BFA") || bd.includes("FINE ART")) {
    addByDiscipline("Design & Creative Arts");
  }

  // Law
  if (bd.includes("LLB") || bd.includes("LL.B") || bd.includes("LAW")) {
    addByDiscipline("Law");
  }

  // Agriculture
  if (bd.includes("AGRICULTURE") || bd.includes("AGRI")) {
    addByDiscipline("Agriculture & Natural Resources");
  }

  // Education
  if (bd.includes("B.ED")) {
    addByDiscipline("Education");
  }

  // Generic fallback if empty or very basic degree
  if (allowed.size === 0) {
    addByDiscipline("Arts & Humanities");
    addByDiscipline("Business & Management");
    addByDiscipline("Social Work & Public Policy");
  }

  // Ensure unique and parse back, sorting by discipline then program
  return Array.from(allowed)
    .map(str => JSON.parse(str))
    .sort((a, b) => a.discipline.localeCompare(b.discipline) || a.program.localeCompare(b.program));
}
