const PROGRAM_REQUIREMENTS = [
  { program: "MBBS", required_streams: ["Science — PCB", "Science — PCMB", "Science"] },
  { program: "BDS", required_streams: ["Science — PCB", "Science — PCMB", "Science"] },
  { program: "B.Pharm", required_streams: ["Science — PCB", "Science — PCMB", "Science — PCM", "Science"] },
  { program: "B.Tech / BE", required_streams: ["Science — PCM", "Science — PCMB", "Science"] },
  { program: "B.Sc", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB"] },
  { program: "BCA", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"] },
  { program: "B.Com", required_streams: ["Commerce", "Science", "Science — PCM", "Science — PCB", "Science — PCMB"] },
  { program: "BBA", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"] },
  { program: "BBM", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"] },
  { program: "BA", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"] },
  { program: "LLB", required_streams: ["Science", "Science — PCM", "Science — PCB", "Science — PCMB", "Commerce", "Arts / Humanities", "Vocational"] },
  { program: "MCA", required_streams: [] }, // Postgrad, typically depends on undergrad, not strictly 12th stream alone, but we will leave it empty meaning "unknown" or "any" based on logic
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
