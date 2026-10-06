/**
 * Centralized API client for the Node/Express backend (mounted at /api/v1).
 *
 * Every method here maps 1:1 to a real route read from the backend source
 * (src/modules/**\/*.routes.js). Nothing below is guessed:
 *  - error shape is always `{ error: { code, message, details? } }`
 *    (see backend src/middleware/errorHandler.js and every route's own
 *    validation branch), never `{ message }`.
 *  - single-object success responses are `{ data: {...} }`.
 *  - list success responses are either `{ data: [...] }` or, where the
 *    route paginates, `{ data: [...], pagination: { page, limit, total,
 *    total_pages } }` (careers, pathways template list, opportunities).
 *  - auth responses are `{ user: {...}, accessToken: "..." }` (see
 *    backend src/modules/auth/auth.service.js - there is no `token` or
 *    `access_token` property).
 *
 * Endpoints that do NOT exist on the backend (and were removed from an
 * earlier version of this client) are called out in
 * docs/API-INTEGRATION-MAP.md under "Backend gaps": there is no
 * `/dashboard`, no `/users/me/saved*`, no `/users/me/pathways` and no
 * `/users/me/progress`. Do not add calls to those paths back in without
 * confirming they exist in the backend source first.
 */

const RAW_BASE = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE_URL) || "/api/v1";
// Guard against accidentally configuring VITE_API_BASE_URL with a trailing slash.
let API_BASE = RAW_BASE.replace(/\/+$/, "");
// If the user sets VITE_API_BASE_URL=https://careergps-production.up.railway.app without the /api/v1 suffix, automatically append it to prevent 404s.
if (!API_BASE.endsWith("/api/v1")) {
  API_BASE += "/api/v1";
}

const TOKEN_KEY = "careergps_token";
// 60 s default: AI operations (recommendations, pathway generation, career enrichment)
// can legitimately take 20-40 s. VITE_API_TIMEOUT_MS lets deployments override this.
// Requests still return immediately when the backend responds; this is the *maximum* wait.
const REQUEST_TIMEOUT_MS =
  (typeof import.meta !== "undefined" &&
    import.meta.env &&
    Number(import.meta.env.VITE_API_TIMEOUT_MS)) ||
  60000;

export function getToken() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token === "undefined" || token === "null") {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
  return token;
}
export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/**
 * ApiError normalizes every failure (HTTP error responses, network
 * failures, and timeouts) into one shape so pages don't have to guess
 * which property holds the message.
 */
export class ApiError extends Error {
  constructor(message, { status = 0, code = "UNKNOWN", details = null, isNetworkError = false } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.isNetworkError = isNetworkError;
  }
}

/** Human-readable fallback copy per status code, used only when the
 * backend didn't send its own message (e.g. a network failure never
 * reaches errorHandler.js at all). */
function fallbackMessage(status, isNetworkError) {
  if (isNetworkError) return "Unable to connect to CareerGPS. Check that the backend is running and reachable.";
  switch (status) {
    case 401: return "Your session has expired. Please log in again.";
    case 403: return "You don't have permission to access this resource.";
    case 404: return "The requested resource could not be found.";
    case 400:
    case 422: return "The request contains invalid fields.";
    case 429: return "Too many requests. Please wait a moment and try again.";
    case 0: return "The request took too long and was cancelled. Please try again.";
    default: return status >= 500 ? "Something went wrong on the server. Please try again." : "The request could not be completed.";
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener('abort', () => controller.abort());
    }
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (networkErr) {
    clearTimeout(timeout);
    const isAbort = networkErr.name === "AbortError";
    const isManualAbort = options.signal && options.signal.aborted;
    
    if (isManualAbort) {
      throw new ApiError("Request cancelled.", { status: 0, code: "CANCELLED", isNetworkError: true, isManualAbort: true });
    }
    throw new ApiError(fallbackMessage(0, !isAbort), { status: 0, code: isAbort ? "TIMEOUT" : "NETWORK_ERROR", isNetworkError: true });
  }
  clearTimeout(timeout);

  if (response.status === 204) return null;

  let payload = null;
  const text = await response.text();
  if (text) {
    try { payload = JSON.parse(text); } catch { /* non-JSON body */ }
  }

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
    }
    const backendError = payload?.error;
    throw new ApiError(
      backendError?.message || fallbackMessage(response.status, false),
      { status: response.status, code: backendError?.code || "REQUEST_ERROR", details: backendError?.details || null }
    );
  }

  return payload;
}

const get = (path, opts = {}) => request(path, { method: "GET", ...opts });
const post = (path, body, opts = {}) => request(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined, ...opts });
const put = (path, body, opts = {}) => request(path, { method: "PUT", body: JSON.stringify(body), ...opts });
const del = (path, opts = {}) => request(path, { method: "DELETE", ...opts });

export const api = {
  // --- Auth (src/modules/auth) --------------------------------------
  // POST /auth/register  body: { email, password }               -> { user, accessToken }
  register: (body) => post("/auth/register", body),
  // POST /auth/login     body: { email, password }                -> { user, accessToken }
  login: (body) => post("/auth/login", body),

  // --- Current user (src/modules/users) -------------------------------
  // GET /users/me -> { data: { id, email, role, account_status, created_at, updated_at } }
  me: () => get("/users/me"),

  // --- Profile (src/modules/profiles) ---------------------------------
  profile: () => get("/profiles/me"),
  updateProfile: (body, opts = {}) => put("/profiles/me", body, opts),
  profileCompleteness: (opts = {}) => get("/profiles/me/completeness", opts),
  validateGoal: (body, opts = {}) => post("/profiles/me/validate-goal", body, opts),

  // --- Education (src/modules/education) --------------------------------
  educationPrograms: (stream) => get(`/education/programs?stream=${encodeURIComponent(stream || "")}`),
  validateProgram: (body) => post(`/education/validate`, body),

  // --- Careers (src/modules/careers, public) --------------------------
  // GET /careers only supports `search`, `page`, `limit` - there is no
  // industry/location/education/career-type filter on the backend.
  careers: (params = {}, opts = {}) => get(`/careers${buildQuery(params)}`, opts),
  exploreCareer: (body, opts = {}) => post(`/careers/explore`, body, opts),
  career: (id, opts = {}) => get(`/careers/${id}`, opts),
  careerSkills: (id) => get(`/careers/${id}/skills`),
  careerCourses: (id) => get(`/careers/${id}/courses`),
  careerPathways: (id) => get(`/careers/${id}/pathways`),
  careerOpportunities: (id) => get(`/careers/${id}/opportunities`),
  careerRelated: (id) => get(`/careers/${id}/related`),
  careerSources: (id) => get(`/careers/${id}/sources`),

  // --- AI Careers (src/modules/careers/ai-career.routes.js) ------------
  aiCareer: (id) => get(`/ai-careers/${id}`),
  aiCareerPathway: (id) => get(`/ai-careers/${id}/pathway`),
  updateAiCareerPathwayProgress: (id, steps) => post(`/ai-careers/${id}/pathway/progress`, { steps }),
  saveAiCareer: (id) => post(`/ai-careers/${id}/save`),
  unsaveAiCareer: (id) => del(`/ai-careers/${id}/save`),
  myAiCareers: () => get("/users/me/ai-careers"),
  
  // --- Skills (src/modules/skills) -------------------------------------
  skills: (params = {}, opts = {}) => get(`/skills${buildQuery(params)}`, opts),
  suggestSkills: (body, opts = {}) => post(`/skills/suggest`, body, opts),
  mySkills: () => get("/skills/me"),
  updateMySkills: (body) => put("/skills/me", body),
  myCustomSkills: () => get("/skills/me/custom"),
  addCustomSkill: (body) => post("/skills/me/custom", body),
  deleteCustomSkill: (id) => del(`/skills/me/custom/${id}`),
  // POST /skills/gap-analysis body: { target_career_id, target_ai_career_id } -> matched/missing skills.
  // This is the backend's real "is this career for me" capability - there is
  // no generic /careers/:id/eligibility route.
  gapAnalysis: (body) => post("/skills/gap-analysis", body),

  // --- Recommendations (src/modules/recommendations) -------------------
  // POST /recommendations/careers body: { goal?, preferred_locations?, constraints? }
  // -> 201 { data: { recommendation_id, results: [...] } }. `results` shape
  // depends on the AI service and is treated as opaque here.
  recommendCareers: (body) => post("/recommendations/careers", body),
  recommendation: (id) => get(`/recommendations/${id}`),
  // body: { rating: 'helpful' | 'not_helpful', comment? }
  recommendationFeedback: (id, body) => post(`/recommendations/${id}/feedback`, body),

  // --- Pathways (src/modules/pathways) ----------------------------------
  // GET /pathways is the PUBLIC template catalogue (search, career_id, page,
  // limit) - it is not "the current user's pathways". The backend has no
  // endpoint that lists a user's own generated pathways; see
  // docs/API-INTEGRATION-MAP.md.
  pathwayTemplates: (params = {}) => get(`/pathways${buildQuery(params)}`),
  userPathways: () => get("/pathways/me"),
  pathway: (id) => get(`/pathways/${id}`),
  pathwaySteps: (id) => get(`/pathways/${id}/steps`),
  // body: { pathway_id? , career_id?, goal?, preferences? } - one of
  // pathway_id/career_id is required.
  generatePathway: (body) => post("/pathways/generate", body),
  careerPathwaysList: (careerId) => get(`/pathways/career/${careerId}`),
  selectPathway: (userPathwayId) => post(`/pathways/generated/${userPathwayId}/select`),
  selectTemplatePathway: (pathwayId) => post(`/pathways/template/${pathwayId}/select`),
  // GET /pathways/generated/:userPathwayId -> a specific personalized pathway by its own id.
  userPathway: (userPathwayId) => get(`/pathways/generated/${userPathwayId}`),
  // GET/POST accept either the user_pathway id OR the template pathway_id.
  pathwayProgress: (idOrPathwayId) => get(`/pathways/${idOrPathwayId}/progress`),
  updatePathwayProgress: (idOrPathwayId, steps) => post(`/pathways/${idOrPathwayId}/progress`, { steps }),
  // Save/unsave a *template* pathway (saved_items table). There is no
  // equivalent for saving a plain career - see docs/API-INTEGRATION-MAP.md.
  savePathway: (pathwayId) => post(`/pathways/${pathwayId}/save`),
  unsavePathway: (pathwayId) => del(`/pathways/${pathwayId}/save`),

  // --- Eligibility (src/modules/eligibility) ----------------------------
  // POST /eligibility/check body: { opportunity_id } - this checks a user's
  // profile against ONE opportunity's structured requirements. It is not a
  // general career-eligibility endpoint.
  checkEligibility: (opportunityId) => post("/eligibility/check", { opportunity_id: opportunityId }),
  eligibilityCheck: (checkId) => get(`/eligibility/checks/${checkId}`),

  // --- Opportunities (src/modules/opportunities + eligibility/opportunity-requirement, public) ---
  // GET /opportunities query: search, status, opportunity_type, location, career_id, page, limit
  opportunities: (params = {}) => get(`/opportunities${buildQuery(params)}`),
  opportunity: (id) => get(`/opportunities/${id}`),
  opportunityRequirements: (id) => get(`/opportunities/${id}/requirements`),

  // --- Institutions (src/modules/institutions, public) -------------------
  institutions: (params = {}) => get(`/institutions${buildQuery(params)}`),
  institution: (id) => get(`/institutions/${id}`),

  // --- Courses (src/modules/courses, public) ------------------------------
  // GET /courses query: search, mode ('online'|'offline'|'hybrid'), location.
  // There is no `course_type` query param on the backend.
  courses: (params = {}) => get(`/courses${buildQuery(params)}`),
  course: (id) => get(`/courses/${id}`),
  courseEligibility: (id) => get(`/courses/${id}/eligibility`),

  // --- Assistant (src/modules/assistant) ---------------------------------
  // Present on the backend and fully wired here for future use, but not
  // yet surfaced anywhere in this UI.
  assistantChat: (body) => post("/assistant/chat", body),
  assistantConversations: () => get("/assistant/conversations"),
  assistantConversation: (id) => get(`/assistant/conversations/${id}`),
  deleteAssistantConversation: (id) => del(`/assistant/conversations/${id}`)
};
