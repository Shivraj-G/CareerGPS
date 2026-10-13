/**
 * Canonical Skill Normalization & Categorization
 * Ensures consistent skill identities, deduplication across UK/US spellings,
 * and reliable categorization into Core vs Supporting skills.
 */

export const SKILL_ALIASES = {
  'communication skills': 'communication',
  'data visualisation': 'data visualization',
  'team work': 'teamwork',
  'problem solving skills': 'problem solving',
  'presentation skill': 'presentation skills'
};

export function normalizeSkillKey(name) {
  if (!name || typeof name !== 'string') return '';
  let key = name.toLowerCase()
    .replace(/\bvisualisation\b/g, 'visualization')
    .replace(/\borganisation\b/g, 'organization')
    .replace(/\bmodelling\b/g, 'modeling')
    .replace(/\bbehaviour\b/g, 'behavior')
    .replace(/\bprogramme\b/g, 'program')
    .replace(/[^a-z0-9]/g, ' ')
    .trim().replace(/\s+/g, ' ');
  return SKILL_ALIASES[key] || key;
}

export const CANONICAL_DISPLAY_NAMES = {
  'data visualization': 'Data Visualization',
  'communication': 'Communication',
  'front office operations': 'Front Office Operations',
  'fact checking': 'Fact Checking',
  'behavioural observation': 'Behavioral Observation'
};

export const GENERAL_TRANSFERABLE_SKILLS = new Set([
  'communication',
  'documentation',
  'problem solving',
  'critical thinking',
  'presentation skills',
  'teamwork',
  'analytical thinking',
  'time management',
  'leadership',
  'creative thinking',
  'customer service',
  'negotiation'
]);

/**
 * Deduplicates an array of skill objects by canonical key.
 * Preserves user-selected IDs where available and prioritizes skills
 * with valid categories over null/Other categories.
 */
export function deduplicateSkills(skills, userSelectedIds = new Set()) {
  const result = [];
  const seenMap = new Map();

  for (const sk of skills) {
    if (!sk || !sk.name) continue;
    const key = normalizeSkillKey(sk.name);
    if (!key) continue;

    const isSelected = sk.id && userSelectedIds.has(sk.id);

    if (seenMap.has(key)) {
      const existingIdx = seenMap.get(key);
      const existing = result[existingIdx];

      // If existing was not selected but new one IS selected, replace with user-selected one
      if (!userSelectedIds.has(existing.id) && isSelected) {
        result[existingIdx] = sk;
      } else {
        // Otherwise, enrich existing metadata if existing lacks category or description
        if ((!existing.category || existing.category === 'Other') && sk.category && sk.category !== 'Other') {
          existing.category = sk.category;
        }
        if (!existing.description && sk.description) {
          existing.description = sk.description;
        }
        if (sk.is_core && !existing.is_core) {
          existing.is_core = true;
          existing.relationship = 'direct';
        }
      }
      continue;
    }

    // Set canonical display name if mapped
    const canonicalName = CANONICAL_DISPLAY_NAMES[key];
    const skillObj = {
      ...sk,
      name: canonicalName || sk.name
    };

    seenMap.set(key, result.length);
    result.push(skillObj);
  }

  return result;
}
