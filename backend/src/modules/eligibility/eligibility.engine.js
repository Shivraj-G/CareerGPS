const LEVELS = { unknown: 0, beginner: 1, intermediate: 2, advanced: 3, expert: 4 };

function normalized(value) { return String(value ?? '').trim().toLowerCase(); }
function containsText(values, target) { return values.some((value) => normalized(value).includes(normalized(target))); }

export function evaluateRequirement(requirement, profile) {
  if (requirement.verification_status !== 'verified') {
    return { status: 'unable_to_determine', reason: 'The requirement is not verified.', evidence: [] };
  }
  const rule = requirement.rule_data ?? {};
  if (requirement.requirement_type === 'skill') {
    const skillName = rule.skill_name;
    const userSkills = profile.skills ?? [];
    if (!skillName) return { status: 'unable_to_determine', reason: 'The skill requirement has no structured skill name.', evidence: [] };
    const skill = userSkills.find((item) => normalized(item.name) === normalized(skillName));
    if (!skill) return { status: 'not_satisfied', reason: `Required skill '${skillName}' is not listed in the profile.`, evidence: [] };
    const minLevel = rule.minimum_level ? LEVELS[rule.minimum_level] : null;
    if (rule.minimum_level && minLevel === undefined) return { status: 'unable_to_determine', reason: 'The minimum skill level is unsupported.', evidence: [] };
    if (minLevel !== null && LEVELS[skill.level] < minLevel) return { status: 'not_satisfied', reason: `The listed skill level is below the required ${rule.minimum_level}.`, evidence: [] };
    if (rule.minimum_years !== undefined && Number(skill.years_experience ?? 0) < Number(rule.minimum_years)) return { status: 'not_satisfied', reason: `The profile lists fewer than ${rule.minimum_years} years of experience for this skill.`, evidence: [] };
    return { status: 'satisfied', reason: 'The listed skill requirement is met by the profile.', evidence: [] };
  }
  if (requirement.requirement_type === 'education') {
    const qualification = rule.qualification;
    if (!qualification) return { status: 'unable_to_determine', reason: 'The education requirement has no structured qualification.', evidence: [] };
    const matched = (profile.education ?? []).find((item) => normalized(item.qualification).includes(normalized(qualification)));
    if (!matched) return { status: 'not_satisfied', reason: `The profile does not list the required qualification '${qualification}'.`, evidence: [] };
    return { status: 'satisfied', reason: 'The listed education requirement is met by the profile.', evidence: [] };
  }
  if (requirement.requirement_type === 'experience') {
    if (rule.minimum_years === undefined) return { status: 'unable_to_determine', reason: 'The experience requirement has no structured minimum years.', evidence: [] };
    const years = (profile.experience ?? []).reduce((sum, item) => sum + Number(item.years_experience ?? item.years ?? 0), 0);
    if (!Number.isFinite(years)) return { status: 'unable_to_determine', reason: 'The profile experience data is not structured enough to evaluate.', evidence: [] };
    if (years < Number(rule.minimum_years)) return { status: 'not_satisfied', reason: `The profile lists approximately ${years} years against a minimum of ${rule.minimum_years}.`, evidence: [] };
    return { status: 'satisfied', reason: 'The listed experience requirement is met by the profile.', evidence: [] };
  }
  if (requirement.requirement_type === 'location') {
    const location = rule.location;
    if (!location) return { status: 'unable_to_determine', reason: 'The location requirement has no structured location.', evidence: [] };
    const preferred = profile.preferred_locations ?? [];
    if (!preferred.length) return { status: 'unable_to_determine', reason: 'No preferred location is listed in the profile.', evidence: [] };
    const matches = containsText(preferred, location);
    return { status: matches ? 'satisfied' : 'not_satisfied', reason: matches ? 'The preferred locations include the listed location.' : 'The listed location is not present in the profile preferences.', evidence: [] };
  }
  return { status: 'unable_to_determine', reason: 'This requirement type is not deterministically supported yet.', evidence: [] };
}
