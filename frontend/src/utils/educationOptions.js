/**
 * Canonical Education Catalogue and Options for CareerGPS
 * Shared across Onboarding and Profile flows to guarantee 100% consistency.
 */

export const SUPPORTED_STREAMS = [
  "Science — PCM",
  "Science — PCB",
  "Science — PCMB",
  "Science — PCM + Computer Science",
  "Science — PCB + Computer Science/IP",
  "Science — Other",
  "Commerce with Mathematics",
  "Commerce without Mathematics",
  "Commerce + Computer Science/IP",
  "Humanities with Mathematics",
  "Humanities without Mathematics",
  "Vocational",
  "Custom"
];

export const EDUCATION_STAGES = [
  { value: "Currently in 12th", label: "Currently in 12th / Senior Secondary" },
  { value: "Higher Education", label: "Higher Education (Undergraduate / Degree / Diploma)" },
  { value: "Working Professional", label: "Working Professional" }
];

export const STUDENT_STATUS_OPTIONS = [
  "Higher Secondary Student",
  "Bachelor Student",
  "Master Student",
  "Working Professional"
];

export const EDUCATION_STATUS_OPTIONS = [
  "Pursuing",
  "Completed",
  "Awaiting Results",
  "Discontinued"
];

export const INDUSTRY_OPTIONS = [
  "Engineering / Technology",
  "Finance & Accounting",
  "Business / Management",
  "Healthcare & Life Sciences",
  "Education / Academia",
  "Marketing / Digital Media",
  "Design / Creative",
  "Legal & Compliance",
  "Hospitality & Tourism",
  "Government / Public Sector",
  "Manufacturing",
  "Other"
];

export const EXPERIENCE_OPTIONS = [
  "Less than 1 year",
  "1–2 years",
  "3–5 years",
  "5–10 years",
  "10+ years"
];

export const YEAR_OPTIONS = [
  { value: "1", label: "1st Year" },
  { value: "2", label: "2nd Year" },
  { value: "3", label: "3rd Year" },
  { value: "4", label: "4th Year" },
  { value: "5", label: "5th Year / Final Year" }
];

/**
 * Normalizes user-input, legacy label, or dropdown stream string to the canonical format.
 */
export function normalizeStream(stream) {
  if (!stream || typeof stream !== 'string') return '';
  const s = stream.trim();
  const lower = s.toLowerCase();

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

  if (lower.includes('commerce + computer') || lower.includes('commerce cs')) {
    return 'Commerce + Computer Science/IP';
  }
  if (lower.includes('commerce with math') || (lower.includes('commerce') && lower.includes('math'))) {
    return 'Commerce with Mathematics';
  }
  if (lower.includes('commerce without math')) {
    return 'Commerce without Mathematics';
  }
  if (lower.includes('commerce')) {
    return 'Commerce with Mathematics';
  }

  if (lower.includes('humanities with math') || lower.includes('arts with math')) {
    return 'Humanities with Mathematics';
  }
  if (lower.includes('humanities without math') || lower.includes('arts without math') || lower.includes('arts / humanities') || lower.includes('humanities') || lower.includes('arts')) {
    return 'Humanities without Mathematics';
  }

  if (lower.includes('vocational')) {
    return 'Vocational';
  }
  if (lower.includes('custom')) {
    return 'Custom';
  }

  const exact = SUPPORTED_STREAMS.find(st => st.toLowerCase() === lower);
  if (exact) return exact;

  return s;
}
