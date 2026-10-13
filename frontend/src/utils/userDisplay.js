/**
 * Single Canonical Identity & Display Name Helper for NaviGoa / CareerGPS
 *
 * Enforces strict identity resolution rules across the entire application:
 * 1. Checks canonical saved full_name or name from user/profile records.
 * 2. NEVER derives a name from an email address (e.g. email prefix), numeric ID, or UUID.
 * 3. Falls back to a clean neutral label ("User") and initial ("U") when no name is provided.
 * 4. Derives accurate initials:
 *    - Two or more words: First and Last word initials (e.g., "Mittal Halarnekar" -> "MH")
 *    - Single word: First initial (e.g., "Rahul" -> "R")
 *    - Missing name: "U"
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_OR_NUMERIC_PATTERN = /^[0-9a-fA-F-]{8,}$|^\d+$/;

/**
 * Extracts and validates the genuine saved full name from user/profile records or form inputs.
 * Returns null if no valid real name is present.
 */
export function resolveUserFullName(...sources) {
  for (const src of sources) {
    if (!src) continue;

    // Direct string passed
    if (typeof src === "string") {
      const candidate = src.trim().replace(/\s+/g, " ");
      if (candidate && !candidate.includes("@") && !UUID_OR_NUMERIC_PATTERN.test(candidate)) {
        return candidate;
      }
      continue;
    }

    if (typeof src === "object") {
      const candidates = [
        src.full_name,
        src.fullName,
        src.name,
        src.displayName,
        src.localName,
        src.first_name && src.last_name ? `${src.first_name} ${src.last_name}` : null,
        src.firstName && src.lastName ? `${src.firstName} ${src.lastName}` : null,
        src.first_name,
        src.firstName
      ];

      for (const raw of candidates) {
        if (typeof raw === "string") {
          const candidate = raw.trim().replace(/\s+/g, " ");
          // Strictly reject email addresses, email prefixes like localpart@, or raw UUIDs/numeric IDs
          if (
            candidate &&
            !candidate.includes("@") &&
            !UUID_OR_NUMERIC_PATTERN.test(candidate) &&
            candidate.toLowerCase() !== "null" &&
            candidate.toLowerCase() !== "undefined"
          ) {
            return candidate;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Resolves the display name for a user.
 * Returns the validated full name or a neutral fallback (default: "User").
 * Never returns email local part or numeric ID.
 */
export function getDisplayName(user, profile = null, fallback = "User") {
  const resolved = resolveUserFullName(user, profile);
  if (resolved) return resolved;
  return fallback;
}

/**
 * Resolves the avatar initials for a user.
 * Multi-word: First + Last initials (e.g. "Mittal Halarnekar" -> "MH").
 * Single-word: First initial (e.g. "Rahul" -> "R").
 * Missing name: Fallback initial (default: "U").
 */
export function getAvatarInitials(user, profile = null, fallback = "U") {
  const resolved = resolveUserFullName(user, profile);
  if (!resolved) return fallback;

  const words = resolved.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const firstInitial = words[0].charAt(0).toUpperCase();
    const lastInitial = words[words.length - 1].charAt(0).toUpperCase();
    return `${firstInitial}${lastInitial}`;
  }

  if (words.length === 1 && words[0].length > 0) {
    return words[0].charAt(0).toUpperCase();
  }

  return fallback;
}

/**
 * Resolves the first name for friendly greetings (e.g. "Welcome back, Mittal").
 * Fallback is neutral (default: "there").
 */
export function getFirstName(user, profile = null, fallback = "there") {
  const resolved = resolveUserFullName(user, profile);
  if (!resolved) return fallback;

  const words = resolved.split(/\s+/).filter(Boolean);
  if (words.length > 0 && words[0]) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }

  return fallback;
}
