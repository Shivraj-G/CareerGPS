/**
 * Shared Skill Normalization & Canonical Deduplication for Frontend
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

export function deduplicateSkillList(skills, selectedIds = new Set()) {
  if (!Array.isArray(skills)) return [];
  const result = [];
  const seen = new Map();

  for (const sk of skills) {
    if (!sk || !sk.name) continue;
    const key = normalizeSkillKey(sk.name);
    if (!key) continue;

    const isSel = sk.id && selectedIds.has(sk.id);

    if (seen.has(key)) {
      const idx = seen.get(key);
      const existing = result[idx];
      if (!selectedIds.has(existing.id) && isSel) {
        result[idx] = sk;
      } else {
        if ((!existing.category || existing.category === 'Other') && sk.category && sk.category !== 'Other') {
          existing.category = sk.category;
        }
        if (sk.is_core && !existing.is_core) {
          existing.is_core = true;
          existing.relationship = 'direct';
        }
      }
      continue;
    }

    seen.set(key, result.length);
    result.push(sk);
  }

  return result;
}
