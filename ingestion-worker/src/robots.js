const USER_AGENT_TOKEN = 'Goa-Career-Intelligence-Ingestion';

function matchesPath(pattern, pathname) {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const body = pattern.replace(/\$$/, '').replace(/\*/g, '.*');
  try { return new RegExp(`^${body}${anchored ? '$' : ''}`).test(pathname); }
  catch { return pathname.startsWith(pattern.replace(/\*|\$/g, '')); }
}

export function parseRobotsTxt(text) {
  const groups = [];
  let active = null;
  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const split = line.indexOf(':');
    if (split < 0) continue;
    const key = line.slice(0, split).trim().toLowerCase();
    const value = line.slice(split + 1).trim();
    if (key === 'user-agent') {
      if (!active || active.hasRules) { active = { agents: [], rules: [], crawlDelay: null, hasRules: false }; groups.push(active); }
      active.agents.push(value.toLowerCase());
      continue;
    }
    if (!active) continue;
    if (key === 'allow' || key === 'disallow') {
      if (value !== '') { active.rules.push({ type: key, path: value }); active.hasRules = true; }
    } else if (key === 'crawl-delay') {
      const delay = Number(value);
      if (Number.isFinite(delay) && delay >= 0) active.crawlDelay = delay;
    }
  }
  const named = groups.filter((group) => group.agents.some((agent) => agent === USER_AGENT_TOKEN.toLowerCase()));
  const wildcard = groups.filter((group) => group.agents.includes('*'));
  return [...named, ...wildcard];
}

export class RobotsPolicy {
  constructor(fetchText, { failClosedOnForbidden = true } = {}) {
    this.fetchText = fetchText;
    this.failClosedOnForbidden = failClosedOnForbidden;
    this.cache = new Map();
  }

  async getPolicy(origin) {
    if (this.cache.has(origin)) return this.cache.get(origin);
    let policy;
    try {
      const result = await this.fetchText(`${origin}/robots.txt`);
      if (result.status === 404 || result.status === 410) policy = { rules: [], crawlDelay: 0, disallowedAll: false };
      else if (!result.ok) {
        policy = {
          rules: [],
          crawlDelay: 0,
          disallowedAll: this.failClosedOnForbidden && [401, 403].includes(result.status),
          status: result.status
        };
      } else {
        const groups = parseRobotsTxt(result.text);
        const matching = groups.filter((group) => group.agents.some((agent) => agent === USER_AGENT_TOKEN.toLowerCase()));
        const wildcard = groups.filter((group) => group.agents.includes('*'));
        const selected = matching.length ? matching : wildcard;
        policy = {
          rules: selected.flatMap((group) => group.rules),
          crawlDelay: Math.max(0, ...selected.map((group) => (group.crawlDelay || 0) * 1000)),
          disallowedAll: false,
          status: result.status
        };
      }
    } catch {
      // A transport error is not treated as permission to bypass an explicit rule;
      // no rule was obtained, so let the caller know that the status is unknown.
      policy = { rules: [], crawlDelay: 0, disallowedAll: false, unavailable: true };
    }
    this.cache.set(origin, policy);
    return policy;
  }

  async check(urlValue) {
    const url = new URL(urlValue);
    const policy = await this.getPolicy(url.origin);
    if (policy.disallowedAll) {
      return {
        allowed: false,
        crawlDelay: policy.crawlDelay,
        reason: 'robots.txt returned a forbidden response',
        code: 'ROBOTS_FORBIDDEN',
        status: policy.status || 403
      };
    }
    let bestLength = -1;
    let bestType = null;
    for (const rule of policy.rules) {
      if (!matchesPath(rule.path, `${url.pathname}${url.search}`)) continue;
      const length = rule.path.replace(/[\*$]/g, '').length;
      if (length > bestLength || (length === bestLength && rule.type === 'allow')) {
        bestLength = length;
        bestType = rule.type;
      }
    }
    if (bestType === 'disallow') {
      return {
        allowed: false,
        crawlDelay: policy.crawlDelay,
        reason: 'disallowed by robots.txt',
        code: 'ROBOTS_DISALLOWED'
      };
    }
    return { allowed: true, crawlDelay: policy.crawlDelay, policyUnavailable: Boolean(policy.unavailable) };
  }
}

export const ROBOTS_USER_AGENT = `${USER_AGENT_TOKEN}/2.0 (+public-opportunity-ingestion; respect-robots)`;
