/**
 * Robust skill formatting and view-model normalization for CareerGPS.
 * Handles strings, API skill objects with { skill_id, skill_name, category, self_rating, level, verified, evidence_type, evidence_notes, updated_at },
 * missing/null names, and unexpected shapes defensively to prevent React child rendering crashes.
 */

export function getSkillViewModel(skill, index = 0) {
  if (!skill) {
    return {
      id: `skill-missing-${index}`,
      name: 'General Competency',
      category: '',
      level: '',
      verified: false,
      evidence_type: '',
      evidence_notes: ''
    };
  }

  if (typeof skill === 'string') {
    const trimmed = skill.trim();
    return {
      id: `skill-str-${trimmed || index}`,
      name: trimmed || 'General Competency',
      category: '',
      level: '',
      verified: false,
      evidence_type: '',
      evidence_notes: ''
    };
  }

  if (typeof skill === 'object') {
    const id = skill.skill_id || skill.id || `skill-obj-${index}`;
    const nameCandidate = (
      skill.skill_name ||
      skill.name ||
      skill.title ||
      skill.label ||
      skill.skill ||
      ''
    );
    const trimmedName = typeof nameCandidate === 'string' ? nameCandidate.trim() : String(nameCandidate || '');

    return {
      id,
      name: trimmedName || (skill.category ? `${skill.category} Skill` : 'Competency'),
      category: skill.category || '',
      level: skill.level || (skill.self_rating ? `Rating: ${skill.self_rating}` : ''),
      verified: Boolean(skill.verified),
      evidence_type: skill.evidence_type || '',
      evidence_notes: skill.evidence_notes || '',
      updated_at: skill.updated_at || null
    };
  }

  return {
    id: `skill-val-${index}`,
    name: String(skill),
    category: '',
    level: '',
    verified: false,
    evidence_type: '',
    evidence_notes: ''
  };
}

export function formatSkillDisplayName(skill) {
  return getSkillViewModel(skill).name;
}
