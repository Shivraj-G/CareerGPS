import React, { useEffect, useState, useMemo, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
  useParams,
  Navigate,
} from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Search,
  MapPin,
  UserRound,
  Menu,
  X,
  ChevronDown,
  Check,
  CheckCircle2,
  Circle,
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  Building2,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  SlidersHorizontal,
  Clock3,
  ExternalLink,
  ShieldCheck,
  Target,
  TrendingUp,
  LogOut,
  Plus,
  LayoutDashboard,
  Compass,
  Route as RouteIcon,
  CalendarDays,
  UserCog,
  Lightbulb,
  LockKeyhole,
  Mail,
  Eye,
  EyeOff,
  Bell,
  MessageCircle,
  Bot,
  FileCheck2,
  Award,
  Zap,
  CircleHelp,
  Send,
  Trash2,
  XCircle,
  AlertCircle,
  HelpCircle,
  CheckCircle,
  RotateCcw,
} from "lucide-react";
import { api, getToken, setToken, clearToken } from "./api/client.js";
import "./styles.css";
import ProfilePage from "./pages/ProfilePage.jsx";
import CareerDetailPage from "./pages/CareerDetailPage.jsx";
import SkillGapPage from "./pages/SkillGapPage.jsx";
import CareerPathwayView from "./components/pathway/CareerPathwayView.jsx";
import { ProjectsStudioPage } from "./pages/ProjectsStudioPage.jsx";
import { PublicPortfolioPage } from "./pages/PublicPortfolioPage.jsx";
import SkillsInterestsPanel from "./components/profile/SkillsInterestsPanel.jsx";
import OnboardingGoalFeasibilityCard from "./components/onboarding/OnboardingGoalFeasibilityCard.jsx";
import { NotificationBell } from "./components/notifications/NotificationBell.jsx";
import { getDisplayName, getAvatarInitials, getFirstName } from "./utils/userDisplay.js";

/* ---------------------------------------------------------------------
 * NOTE ON THIS FILE
 * Every request in this file was checked against the actual backend
 * source (routes/validation/service files under backend/src/modules),
 * not guessed. Full contract: docs/API-INTEGRATION-MAP.md.
 *
 * A few real backend gaps shape parts of this UI on purpose (see the
 * doc for details, and grep "BACKEND GAP" below for each spot):
 *   - There is no endpoint that lists "the current user's pathways" or
 *     "the current user's saved items" - only save/unsave actions
 *     exist. The most recently generated pathway id is kept in
 *     localStorage as a client-side stand-in so the Pathway page and
 *     Dashboard can find it again after a refresh.
 *   - POST /eligibility/check is scoped to a single opportunity_id
 *     (it evaluates opportunity_requirements), not a career. The
 *     closest real per-career capability is POST /skills/gap-analysis,
 *     which is what the career guide's "Is this career for you?" card
 *     uses instead of a fabricated career-eligibility endpoint.
 *   - Saving a plain career (as opposed to a pathway) has no backing
 *     endpoint at all, so the Career guide no longer offers a fake
 *     "save" toggle; saving is real and wired on the Pathway page,
 *     against the pathway's own save/unsave endpoints.
 * ------------------------------------------------------------------- */

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

// Every documented single-object response is wrapped as { data: {...} }.
function unwrapObject(data) {
  if (
    data &&
    typeof data === "object" &&
    data.data &&
    typeof data.data === "object" &&
    !Array.isArray(data.data)
  ) {
    return data.data;
  }
  return data ?? {};
}

function AIBadge({ origin, verificationStatus, fallback }) {
  if (origin === 'ai_generated') {
    return (
      <span className="detail-meta">
        <Sparkles size={15} /> AI-generated
      </span>
    );
  }
  if (verificationStatus === 'unverified' || verificationStatus === 'needs_review') {
    return (
      <span className="detail-meta">
        Not yet verified
      </span>
    );
  }
  return fallback || null;
}

// The backend has no "full name" field anywhere in its contract (register,
// /users/me and the profile schema are all name-less), so any display name
// is client-side only.
const LOCAL_NAME_KEY = "careerpath_display_name";
function getLocalName(userId) {
  return userId
    ? localStorage.getItem(`${LOCAL_NAME_KEY}_${userId}`) || ""
    : "";
}
function setLocalName(userId, name) {
  if (!userId) return;
  if (name) localStorage.setItem(`${LOCAL_NAME_KEY}_${userId}`, name);
  else localStorage.removeItem(`${LOCAL_NAME_KEY}_${userId}`);
}

// Removed localStorage fallback for pathway enrollment. Backend is now the source of truth.

// "Goa + Remote" <-> ["Goa", "Remote"] for the preferred_locations array field.
function parseLocations(str) {
  return String(str || "")
    .split(/\+|,/)
    .map((s) => s.trim())
    .filter(Boolean);
}
function joinLocations(arr) {
  return (Array.isArray(arr) && arr.length ? arr : ["Goa", "Remote"]).join(
    " + ",
  );
}

const STUDY_MODE_MAP = {
  "Online / Part-time": ["online", "part-time"],
  Offline: ["offline"],
  Hybrid: ["hybrid"],
};

function normalizeCareer(c) {
  if (!c) return c;
  const careerId = c.ai_career_id ?? c.career_id ?? c.id ?? "";
  return {
    id: careerId,
    career_id: careerId,
    isAiProfile: !!c.ai_career_id,
    title: c.title ?? "Untitled career",
    description: c.description ?? "",
    responsibilities: Array.isArray(c.responsibilities)
      ? c.responsibilities
      : [],
    qualifications: Array.isArray(c.qualifications) ? c.qualifications : [],
    entryRoutes: Array.isArray(c.entry_routes) ? c.entry_routes : [],
    skills: Array.isArray(c.skills) ? c.skills : [],
    verificationStatus: c.verification_status ?? "needs_review",
    origin: c.origin ?? "curated",
    sourceUrl: c.source_url ?? null,
    disclaimer: c.disclaimer ?? null,
  };
}

function formatOpportunityStatus(status, deadline) {
  const normalized = String(status || "").trim().toLowerCase();
  const deadlineTime = deadline ? new Date(deadline).getTime() : null;
  const now = Date.now();
  const isPast = deadlineTime && deadlineTime < now;
  const isClosingSoon = deadlineTime && !isPast && (deadlineTime - now <= 30 * 24 * 60 * 60 * 1000);

  if (normalized === "closed" || isPast) return { label: "Closed", class: "closed", key: "closed" };
  if (normalized === "upcoming") return { label: "Upcoming", class: "upcoming", key: "upcoming" };
  if (normalized === "cancelled") return { label: "Cancelled", class: "cancelled", key: "cancelled" };
  if (isClosingSoon) return { label: "Closing soon", class: "warning", key: "closing_soon" };
  if (normalized === "open") return { label: "Open", class: "open", key: "open" };
  if (deadline) return { label: "Active notice", class: "open", key: "open" };
  return { label: "Open", class: "open", key: "open" };
}

function formatOpportunityType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const labels = {
    government_recruitment: "Government",
    government: "Government",
    private_job: "Private Sector",
    private: "Private Sector",
    private_sector: "Private Sector",
    private_careers: "Private Sector",
    internship: "Internship",
    apprenticeship: "Apprenticeship",
    graduate_programme: "Programme",
    programme: "Programme",
    scholarship: "Scholarship",
    official_government: "Official Government",
  };
  if (labels[normalized]) return labels[normalized];
  return normalized.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeOpportunity(o) {
  const statusInfo = formatOpportunityStatus(o.status, o.application_deadline);
  return {
    id: o.id ?? "",
    title: o.title ?? "Untitled opportunity",
    status: statusInfo.label,
    statusClass: statusInfo.class,
    statusKey: statusInfo.key,
    rawStatus: o.status ?? "open",
    type: formatOpportunityType(o.opportunity_type),
    rawType: o.opportunity_type ?? "",
    org: o.organization || o.org || "Organization not specified",
    location: o.location || "Location not specified",
    deadline: o.application_deadline
      ? new Date(o.application_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "Deadline not specified",
    deadlineDate: o.application_deadline
      ? new Date(o.application_deadline)
      : null,
    vacancies: o.vacancies_total ?? null,
    description: o.description ?? "",
    advertisementNumber: o.advertisement_number ?? null,
    sourceUrl: o.source_url ?? null,
    sourceDocumentUrl: o.source_document_url ?? null,
    sourceName: o.source_name ?? null,
    sourceType: o.source_type ? formatOpportunityType(o.source_type) : null,
    verificationStatus: o.verification_status ?? "verified",
    verifiedAt: o.verified_at ? new Date(o.verified_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null,
    lastCheckedAt: o.source_last_checked_at ? new Date(o.source_last_checked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null,
    requirements: Array.isArray(o.requirements) ? o.requirements : [],
    relatedCareers: Array.isArray(o.related_careers) ? o.related_careers : [],
  };
}

/* ---------------------------------------------------------------------
 * Auth context - wraps GET /users/me so any page can read the logged
 * in user without re-fetching, and clears the token on a 401.
 * ------------------------------------------------------------------- */
const AuthContext = React.createContext({
  user: null,
  loading: true,
  refreshUser: async () => { },
  logout: () => { },
});
function useAuth() {
  return React.useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const navigate = useNavigate();

  async function refreshUser() {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.me();
      setUser(unwrapObject(data));
    } catch (err) {
      if (err.status === 401) {
        clearToken();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    navigate("/login");
  }

  useEffect(() => {
    refreshUser(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="app-shell">
        <main className="page-content" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LoadingState label="Loading your account..." />
        </main>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

/* ---------------------------------------------------------------------
 * Shared loading / error states
 * ------------------------------------------------------------------- */
function LoadingState({ label = "Loading...", layout }) {
  if (layout === "list")
    return (
      <div className="skeleton-list" style={{ display: "grid", gap: "9px" }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="career-row">
            <div
              className="career-image skeleton"
              style={{ width: "78px", height: "68px" }}
            ></div>
            <div className="career-row-main">
              <div className="skeleton skel-title"></div>
              <div className="skeleton skel-text"></div>
            </div>
          </div>
        ))}
      </div>
    );
  if (layout === "opportunity")
    return (
      <div className="opportunity-list opportunity-skeleton-list" aria-label="Loading opportunities">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="opportunity-skeleton-card" aria-hidden="true">
            <div className="skeleton opportunity-skeleton-logo" />
            <div className="opportunity-skeleton-content">
              <div className="skeleton skel-pill" />
              <div className="skeleton skel-title" />
              <div className="skeleton skel-text" />
              <div className="skeleton skel-meta" />
            </div>
          </div>
        ))}
      </div>
    );
  if (layout === "grid")
    return (
      <div className="institution-grid" style={{ marginBottom: "20px" }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="institution-card">
            <div
              className="institution-image skeleton"
              style={{ height: "120px" }}
            ></div>
            <div className="skeleton skel-title"></div>
            <div className="skeleton skel-text"></div>
          </div>
        ))}
      </div>
    );
  if (layout === "profile")
    return (
      <div className="profile-grid" style={{ marginBottom: "20px" }}>
        <div className="panel">
          <div className="skeleton skel-title" style={{ height: "24px" }}></div>
          <div
            className="skeleton skel-text"
            style={{ marginTop: "15px" }}
          ></div>
          <div className="skeleton skel-text"></div>
        </div>
        <div className="panel">
          <div className="skeleton skel-title" style={{ height: "24px" }}></div>
          <div
            className="skeleton skel-text"
            style={{ marginTop: "15px" }}
          ></div>
        </div>
      </div>
    );
  return (
    <div className="empty-state loading-pulse">
      <Clock3 size={24} />
      <h2>{label}</h2>
    </div>
  );
}
// Central error-state rendering: every major API-driven page in this file
// funnels its caught ApiError into this one component, so the copy for
// each status code only needs to be right in one place.
function ErrorState({
  text = "Something went wrong. Please try again.",
  status,
  onRetry,
}) {
  if (status === 401) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>Please log in</h2>
        <p>You need to be logged in to see this.</p>
        <Link className="btn outline" to="/login">
          Log in
        </Link>
      </div>
    );
  }
  if (status === 403) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>You don't have permission</h2>
        <p>{text}</p>
      </div>
    );
  }
  if (status === 404) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>Not found</h2>
        <p>{text}</p>
        {onRetry && (
          <button className="btn outline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (status === 409) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>This can't be done right now</h2>
        <p>{text}</p>
        {onRetry && (
          <button className="btn outline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (status === 400 || status === 422) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>Please check the form</h2>
        <p>{text}</p>
      </div>
    );
  }
  if (status === 503) {
    return (
      <div className="empty-state">
        <Sparkles size={24} />
        <h2>AI service is temporarily unavailable</h2>
        <p>
          {text} Everything else in NaviGoa (career search, pathways,
          opportunities) keeps working normally without it.
        </p>
        {onRetry && (
          <button className="btn outline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  if (status === 429) {
    return (
      <div className="empty-state">
        <CircleHelp size={24} />
        <h2>Too many requests</h2>
        <p>{text}</p>
        {onRetry && (
          <button className="btn outline" onClick={onRetry}>
            Try again
          </button>
        )}
      </div>
    );
  }
  return (
    <div className="empty-state">
      <CircleHelp size={24} />
      <h2>Something went wrong</h2>
      <p>{text}</p>
      {onRetry && (
        <button className="btn outline" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

// Real integration for the assistant: POST /assistant/chat and
// GET/DELETE /assistant/conversations[/:id] (src/modules/assistant).
// The backend degrades gracefully on its own when the Python AI service
// isn't configured - assistant.service.js's chat() still persists the
// conversation and returns a real, honest fallback message instead of a
// 503, unlike /recommendations/careers - so this widget always works
// end-to-end, even before AI_SERVICE_URL is set up.
function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [lastMessageText, setLastMessageText] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState(null);

  const loggedIn = !!getToken();

  useEffect(() => {
    if (open && loggedIn) loadConversations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function loadConversations() {
    setLoadingList(true);
    api
      .assistantConversations()
      .then((res) => setConversations(unwrapList(res)))
      .catch(() => {
        /* history list failing shouldn't block chatting */
      })
      .finally(() => setLoadingList(false));
  }

  function openConversation(id) {
    setLoadingConvo(true);
    setError(null);
    api
      .assistantConversation(id)
      .then((res) => {
        const data = unwrapObject(res);
        setConversationId(data.id);
        setMessages(data.messages || []);
        setShowHistory(false);
      })
      .catch((err) => setError(err))
      .finally(() => setLoadingConvo(false));
  }

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLastMessageText(null);
    setShowHistory(false);
  }

  async function send(retryText) {
    const text = retryText ?? input.trim();
    if (!text || sending) return;
    if (!retryText) {
      setInput("");
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content: text,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setLastMessageText(text);
    setError(null);
    setSending(true);
    try {
      const res = await api.assistantChat({
        conversation_id: conversationId || undefined,
        message: text,
      });
      const data = unwrapObject(res);
      if (!data?.conversation_id || !data?.message?.content) {
        throw new Error("The assistant returned an invalid response. Please try again.");
      }
      console.debug("[NaviGoa Assistant]", {
        conversationId: data.conversation_id,
        requestStatus: "success",
      });
      setConversationId(data.conversation_id);
      setMessages((m) => [...m, data.message]);
      loadConversations();
    } catch (err) {
      console.debug("[NaviGoa Assistant]", {
        conversationId,
        requestStatus: "error",
        responseStatus: err.status || "network",
      });
      let msg = "Unable to connect to the NaviGoa backend.";
      if (err.status === 401)
        msg = "Your session has expired. Please log in again.";
      else if (err.status === 403)
        msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429)
        msg = "Too many requests. Please try again shortly.";
      else if (err.status === 503)
        msg = err.message || "The assistant service is temporarily unavailable. Please try again shortly.";
      else if (err.status >= 500)
        msg = "NaviGoa couldn't process that request. Please try again.";
      else if (err.message) msg = err.message;
      setError(new Error(msg));
    } finally {
      setSending(false);
    }
  }

  async function removeConversation(id, e) {
    e.stopPropagation();
    try {
      await api.deleteAssistantConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      if (conversationId === id) startNew();
    } catch {
      /* leave it in the list so the user can try again */
    }
  }

  return (
    <>
      <button
        className="assistant-fab"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>
      {open && (
        <div className="assistant-panel">
          <div className="assistant-head">
            <div className="assistant-head-title">
              <Bot size={18} />
              <b>NaviGoa Assistant</b>
            </div>
            <div className="assistant-head-actions">
              {loggedIn && (
                <button
                  className="icon-btn"
                  onClick={() => setShowHistory((s) => !s)}
                  title="Conversations"
                >
                  <MessageCircle size={16} />
                </button>
              )}
              {loggedIn && (
                <button
                  className="icon-btn"
                  onClick={startNew}
                  title="New conversation"
                >
                  <Plus size={16} />
                </button>
              )}
              <button
                className="icon-btn"
                onClick={() => setOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          {!loggedIn ? (
            <div className="assistant-body assistant-empty">
              <CircleHelp size={22} />
              <p>
                Log in to use the assistant - your conversations are saved to
                your account.
              </p>
              <Link
                className="btn outline"
                to="/login"
                onClick={() => setOpen(false)}
              >
                Log in
              </Link>
            </div>
          ) : showHistory ? (
            <div className="assistant-body assistant-history">
              {loadingList && <LoadingState label="Loading conversations..." />}
              {!loadingList && conversations.length === 0 && (
                <p className="muted" style={{ padding: 16 }}>
                  No conversations yet.
                </p>
              )}
              {conversations.map((c) => (
                <div
                  className={`assistant-convo-row ${c.id === conversationId ? "active" : ""}`}
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                >
                  <span>{c.title || "Untitled conversation"}</span>
                  <button
                    className="icon-btn"
                    onClick={(e) => removeConversation(c.id, e)}
                    title="Delete conversation"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="assistant-body assistant-messages">
                {loadingConvo && (
                  <LoadingState label="Loading conversation..." />
                )}
                {!loadingConvo && messages.length === 0 && (
                  <div className="assistant-empty">
                    <Sparkles size={20} />
                    <p>
                      Ask about careers, pathways, courses or opportunities in
                      Goa. Answers are grounded in NaviGoa's own data - if
                      something isn't known, the assistant will say so instead
                      of guessing.
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div className={`assistant-msg ${m.role}`} key={m.id ?? i}>
                    <div className="assistant-bubble">
                      {(m.content || "").split("\n").map((line, li) => {
                        // Render **bold** text and plain lines
                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <span key={li}>
                            {parts.map((p, pi) =>
                              p.startsWith("**") && p.endsWith("**") ? (
                                <strong key={pi}>{p.slice(2, -2)}</strong>
                              ) : (
                                p
                              ),
                            )}
                            {li < (m.content || "").split("\n").length - 1 ? (
                              <br />
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                    {import.meta.env.DEV &&
                      m.content?.includes(
                        "assistant service is currently unavailable",
                      ) && (
                        <div
                          style={{
                            fontSize: 11,
                            color: "var(--muted)",
                            marginTop: 4,
                          }}
                        >
                          Dev Diagnostic: Backend reached, but the AI service
                          did not return a generated response.
                        </div>
                      )}
                    {Array.isArray(m.citations) && m.citations.length > 0 && (
                      <div className="assistant-citations">
                        {m.citations.map((c, ci) => {
                          const label =
                            typeof c === "string"
                              ? c
                              : c.title || c.source_url || c.url || "Source";
                          const url =
                            typeof c === "object" && c
                              ? c.source_url || c.url
                              : null;
                          return url ? (
                            <a
                              key={ci}
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {label} <ExternalLink size={11} />
                            </a>
                          ) : (
                            <span key={ci}>{label}</span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="assistant-msg assistant">
                    <div className="assistant-bubble typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>
              {error && (
                <div className="assistant-error">
                  <p>{error.message}</p>
                  <button
                    className="btn outline"
                    onClick={() => send(lastMessageText)}
                  >
                    Retry
                  </button>
                </div>
              )}
              <div className="assistant-input-row">
                <textarea
                  rows="1"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  aria-label="Message NaviGoa Assistant"
                  placeholder="Ask something…"
                  disabled={sending}
                />
                <button
                  className="assistant-send"
                  onClick={() => send()}
                  disabled={sending || !input.trim()}
                  aria-label="Send"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// The backend genuinely exposes GET /institutions and GET /institutions/:id
// (src/modules/institutions/institution.routes.js) - the Institutions page
// below calls it for real instead of using a static array.
function normalizeInstitution(i) {
  return {
    id: i.id ?? "",
    name: i.name ?? "Untitled institution",
    location: i.location ?? "",
    description: i.description ?? "",
    website_url: i.website_url ?? "",
    courses: Array.isArray(i.courses) ? i.courses : [],
  };
}

// GET /courses only supports `search`, `mode` ('online'|'offline'|'hybrid')
// and `location` query params - there is no `course_type` filter on the
// backend, unlike careers/opportunities.
function normalizeCourse(c) {
  return {
    id: c.id ?? "",
    title: c.title ?? "Untitled course",
    course_type: c.course_type ?? "",
    qualification: c.qualification ?? "",
    duration: c.duration_text ?? "",
    mode: c.mode ?? "",
    location: c.location ?? "",
    subject: c.subject ?? "",
    fees: c.fees_text ?? "",
    institution_id: c.institution_id ?? "",
    institution_name: c.institution_name ?? "",
  };
}

function AppShell({ children }) {
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (!showLogoutConfirm) return;
    function handleKeyDown(e) {
      if (e.key === "Escape") setShowLogoutConfirm(false);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showLogoutConfirm]);
  const nav = [
    ["/dashboard", "Home", LayoutDashboard],
    ["/careers", "Explore Careers", Compass],
    ["/pathway", "My Plan", RouteIcon],
    ["/projects", "Projects & Studio", Sparkles],
    ["/saved", "Saved Careers", Bookmark],
    ["/opportunities", "Opportunities", BriefcaseBusiness],
    ["/profile", "Profile", UserCog],
  ];
  const publicPage = ["/", "/signup", "/login", "/onboarding"].includes(
    location.pathname,
  );
  const isPublicPortfolio = location.pathname.startsWith("/portfolio/p/");

  if (publicPage || isPublicPortfolio) return <>{children}</>;

  if (loading)
    return (
      <div className="app-shell">
        <main
          className="page-content"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoadingState label="Loading your account..." />
        </main>
      </div>
    );

  return (
    <div className="app-shell">
      {mobile && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobile(false)}
          aria-hidden="true"
        />
      )}
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Logo />
        <div className="side-section-label">YOUR JOURNEY</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <Link
              key={to}
              to={to}
              className={location.pathname === to ? "active" : ""}
              onClick={() => setMobile(false)}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button
            className="side-user"
            onClick={() => setShowLogoutConfirm(true)}
            title="Log out"
            style={{
              border: 0,
              width: "100%",
              textAlign: "left",
              cursor: "pointer",
              background: "transparent",
            }}
          >
            <div className="avatar">
              {getAvatarInitials(user)}
            </div>
            <div>
              <strong>
                {getDisplayName(user)}
              </strong>
              <span>{user?.role || "Log out"}</span>
            </div>
            <LogOut size={16} color="var(--muted)" />
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" aria-label={mobile ? "Close navigation menu" : "Open navigation menu"} aria-expanded={mobile} onClick={() => setMobile((v) => !v)}>
            {mobile ? <X /> : <Menu />}
          </button>
          <div className="mobile-brand">
            <Link to="/dashboard" className="mobile-brand-link" aria-label="NaviGoa Dashboard">
              <img
                src="/navigoa-logo.jpg"
                alt="NaviGoa"
                className="mobile-brand-logo"
              />
            </Link>
          </div>
          <div className="top-links">
            <Link to="/careers">Careers</Link>
            <Link to="/learn">Learn</Link>
            <Link to="/institutions">Institutions</Link>
            <Link to="/opportunities">Opportunities</Link>
          </div>
          <div className="top-actions">
            <NotificationBell />
            <Link 
              to="/profile" 
              className="avatar small" 
              aria-label="Open profile"
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              {getAvatarInitials(user)}
            </Link>
          </div>
        </header>
        <main className="page-content">{children}</main>
        <SiteFooter />
      </div>
      <AssistantWidget />

      {showLogoutConfirm && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', display: 'grid', placeItems: 'center', zIndex: 9999, padding: '20px', backdropFilter: 'blur(2px)' }}
          onClick={() => setShowLogoutConfirm(false)}
        >
          <div
            style={{ background: '#fff', borderRadius: '12px', padding: '24px', width: '100%', maxWidth: '320px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid var(--line)', textAlign: 'center' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: '18px', marginBottom: '16px' }}>Log out?</h2>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
              Are you sure you want to log out?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyItems: 'center', justifyContent: 'center' }}>
              <button
                className="btn ghost"
                onClick={() => setShowLogoutConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  logout();
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <div className="brand landing-brand">
      <img
        className="brand-image"
        src="/navigoa-logo.jpg"
        alt="NaviGoa — Navigate, Build, Grow"
      />
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className={`landing-links ${mobileNavOpen ? "open" : ""}`} aria-label="Primary navigation">
          <Link to="/careers" onClick={() => setMobileNavOpen(false)}>Careers</Link>
          <Link to="/learn" onClick={() => setMobileNavOpen(false)}>Learn</Link>
          <Link to="/institutions" onClick={() => setMobileNavOpen(false)}>Institutions</Link>
          <Link to="/opportunities" onClick={() => setMobileNavOpen(false)}>Opportunities</Link>
        </nav>
        <div className="landing-auth">
          <Link to="/login">Login</Link>
          <Link className="btn primary small" to="/signup">
            Sign Up
          </Link>
          <button
            type="button"
            className="landing-mobile-menu"
            aria-label={mobileNavOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>
      <section className="hero">
        <img
          className="hero-goa-image"
          src="/goa-fontainhas-street.jpg"
          alt="Colourful Portuguese-influenced streets of Fontainhas in Panaji, Goa"
          width="1920"
          height="1280"
          fetchpriority="high"
        />
        <div className="hero-overlay" />
      <div className="hero-content">
          <div className="eyebrow">
            <Sparkles size={14} /> Career discovery, built for Goa
          </div>
          <h1>
            Navigate your future.
            <br />
            <span>Discover your opportunities.</span>
          </h1>
          <p>
            Explore career paths, build in-demand skills, discover employment
            and internship opportunities across Goa, and turn your learning
            into a future you can work towards.
          </p>
          <div className="hero-search">
            <Search size={19} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a career (e.g. Data Analyst, Police Constable, Chef)"
              onKeyDown={(e) =>
                e.key === "Enter" && navigate("/careers?search=" + query)
              }
            />
            <button onClick={() => navigate("/careers?search=" + query)}>
              <ArrowRight size={19} />
            </button>
          </div>
          <div className="hero-cards">
            <button onClick={() => navigate("/signup")}>
              <GraduationCap />
              <span>
                <b>
                  Start my
                  <br />
                  career
                </b>
                <small>For students</small>
              </span>
            </button>
            <button onClick={() => navigate("/careers")}>
              <TrendingUp />
              <span>
                <b>
                  Upgrade my
                  <br />
                  career
                </b>
                <small>For working professionals</small>
              </span>
            </button>
            <button onClick={() => navigate("/careers")}>
              <RouteIcon />
              <span>
                <b>
                  Change my
                  <br />
                  career
                </b>
                <small>Explore new fields</small>
              </span>
            </button>
          </div>
        </div>
        <div className="hero-location">
          <MapPin size={15} /> Goa-first career intelligence
        </div>
      </section>
      <section className="landing-trust">
        <div>
          <ShieldCheck />{" "}
          <span>
            <b>Source-backed</b>
            <small>Requirements linked to official sources</small>
          </span>
        </div>
        <div>
          <Target />{" "}
          <span>
            <b>Pathway intelligence</b>
            <small>Know your next practical step</small>
          </span>
        </div>
        <div>
          <FileCheck2 />{" "}
          <span>
            <b>Eligibility checks</b>
            <small>Structured rules, not AI guesses</small>
          </span>
        </div>
      </section>
      <section className="goa-story" aria-labelledby="goa-story-title">
        <div className="goa-story-copy">
          <div className="section-kicker">ROOTED IN GOA</div>
          <h2 id="goa-story-title">Built here. Open to what’s next.</h2>
          <p>
            NaviGoa connects the character of Goa with practical career
            direction — helping students, graduates, and working professionals
            discover paths locally, remotely, and beyond.
          </p>
          <Link className="btn outline" to="/opportunities">
            Explore opportunities <ArrowRight size={16} />
          </Link>
        </div>
        <div className="goa-story-media">
          <figure className="goa-story-image goa-story-image-main">
            <img
              src="/goa-hero.jpg"
              alt="Goa coastline, palms, and green coastal landscape"
              width="1296"
              height="768"
              loading="lazy"
            />
            <figcaption>Goa’s coastline and green hinterland</figcaption>
          </figure>
          <div className="goa-story-note">
            <MapPin size={16} />
            <span>Career guidance with a Goa-first perspective</span>
          </div>
        </div>
      </section>
      <section className="landing-journey" aria-labelledby="journey-title">
        <div>
          <div className="section-kicker">A CLEARER NEXT STEP</div>
          <h2 id="journey-title">
            Plan a career journey that fits where you are now.
          </h2>
        </div>
        <div className="journey-grid">
          <Link id="careers" to="/careers">
            <Compass />
            <h3>Explore careers</h3>
            <p>Search practical career directions by title, skill or field.</p>
            <span>
              Explore careers <ArrowRight size={15} />
            </span>
          </Link>
          <Link id="eligibility" to="/eligibility">
            <ShieldCheck />
            <h3>Check eligibility</h3>
            <p>
              See what is met, what needs verification, and what is missing.
            </p>
            <span>
              Check a profile <ArrowRight size={15} />
            </span>
          </Link>
          <Link id="pathway" to="/pathway">
            <RouteIcon />
            <h3>Build your pathway</h3>
            <p>
              Turn a target role into education, skills and experience steps.
            </p>
            <span>
              View pathway <ArrowRight size={15} />
            </span>
          </Link>
          <Link id="opportunities" to="/opportunities">
            <BriefcaseBusiness />
            <h3>Find opportunities</h3>
            <p>Review sourced openings when they are available to NaviGoa.</p>
            <span>
              View opportunities <ArrowRight size={15} />
            </span>
          </Link>
          <Link id="institutions" to="/institutions">
            <GraduationCap />
            <h3>Discover learning</h3>
            <p>
              Find institutions and learning routes relevant to your direction.
            </p>
            <span>
              Find learning options <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}

function Signup() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPasswordError("");
    setEmailError("");

    if (form.password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.register({
        email: form.email,
        password: form.password,
        full_name: form.name?.trim() || undefined,
      });
      // Confirmed against backend src/modules/auth/auth.service.js:
      // register() returns { user, accessToken } directly (no data wrapper).
      let token = res?.accessToken;
      if (!token) {
        // Some backends don't log the user in on register - fall back to login.
        const loginRes = await api.login({
          email: form.email,
          password: form.password,
        });
        token = loginRes?.accessToken;
      }
      if (!token)
        throw new Error(
          "Account created, but no access token was returned. Please log in.",
        );
      setToken(token);
      const u = await api.me();
      setLocalName(unwrapObject(u).id, form.name);
      await refreshUser();
      navigate("/onboarding");
    } catch (err) {
      if (err.code === "EMAIL_ALREADY_EXISTS") {
        setEmailError("This email is already registered. Please log in instead.");
      } else {
        setError(
          err.message || "Could not create your account. Please try again.",
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand-header">
          <Link to="/" className="brand-link" aria-label="NaviGoa home">
            <img
              className="auth-logo-img"
              src="/navigoa-logo.jpg"
              alt="NaviGoa — Navigate, Build, Grow"
              width="210"
              height="140"
            />
          </Link>
        </div>
        <div className="auth-card">
          <div className="auth-heading">
            <h1>Create your account</h1>
            <p>Start your NaviGoa career journey</p>
          </div>
          <form className="form-stack" onSubmit={handleSubmit}>
            <label>
              Full name
              <input
                required
                placeholder="Enter your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              Email address
              <input
                required
                type="email"
                placeholder="you@example.com"
                value={form.email}
                aria-invalid={!!emailError}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (emailError) setEmailError("");
                }}
              />
              {emailError && (
                <p style={{ color: "var(--red)", fontSize: 11, margin: "4px 0 0 0" }} role="alert">
                  {emailError}
                </p>
              )}
            </label>
            <label>
              Password
              <div className="password">
                <input
                  required
                  type={show ? "text" : "password"}
                  placeholder="Create a password"
                  value={form.password}
                  aria-invalid={!!passwordError}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (e.target.value.length >= 8 && passwordError) {
                      setPasswordError("");
                    }
                  }}
                />
                <button type="button" onClick={() => setShow((v) => !v)}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p style={{ color: "var(--red)", fontSize: 11, margin: "4px 0 0 0" }} role="alert">
                  {passwordError}
                </p>
              )}
            </label>
            {error && (
              <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }}>
                {error}
              </p>
            )}
            <button
              className="btn primary full auth-submit-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>

        <Link to="/" className="auth-back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>
      </div>
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const from = location.state?.from?.pathname || "/dashboard";

  async function handleSubmit(e) {
    e.preventDefault();
    if (submitting) return;
    setEmailError("");
    setPasswordError("");
    setGeneralError("");
    setSubmitting(true);
    try {
      const res = await api.login({
        email: form.email,
        password: form.password,
      });
      // Confirmed against backend: login() returns { user, accessToken } directly.
      const token = res?.accessToken;
      if (!token)
        throw new Error("Login succeeded but no access token was returned.");
      setToken(token);
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      if (err.code === "UNKNOWN_EMAIL") {
        setEmailError("This email is not registered with NaviGoa.");
      } else if (err.code === "INVALID_PASSWORD") {
        setPasswordError("Incorrect password. Please try again.");
      } else {
        setGeneralError(err.message || "Login failed. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand-header">
          <Link to="/" className="brand-link" aria-label="NaviGoa home">
            <img
              className="auth-logo-img"
              src="/navigoa-logo.jpg"
              alt="NaviGoa — Navigate, Build, Grow"
              width="210"
              height="140"
            />
          </Link>
        </div>

        <div className="auth-card">
          <div className="auth-heading">
            <h1>Welcome back</h1>
            <p>Sign in to continue your NaviGoa career journey.</p>
          </div>

          <form className="form-stack" onSubmit={handleSubmit} noValidate>
            <label htmlFor="login-email">
              Email address
              <input
                id="login-email"
                name="email"
                required
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={form.email}
                aria-invalid={!!emailError}
                aria-describedby={emailError ? "login-email-error" : undefined}
                onChange={(e) => {
                  setForm({ ...form, email: e.target.value });
                  if (emailError) setEmailError("");
                  if (generalError) setGeneralError("");
                }}
              />
              {emailError && (
                <p id="login-email-error" className="auth-error-text" role="alert">
                  {emailError}
                </p>
              )}
            </label>

            <label htmlFor="login-password">
              Password
              <div className="auth-password-wrapper">
                <input
                  id="login-password"
                  name="password"
                  required
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={form.password}
                  aria-invalid={!!passwordError}
                  aria-describedby={passwordError ? "login-password-error" : undefined}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (passwordError) setPasswordError("");
                    if (generalError) setGeneralError("");
                  }}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {passwordError && (
                <p id="login-password-error" className="auth-error-text" role="alert">
                  {passwordError}
                </p>
              )}
            </label>

            {generalError && (
              <div className="auth-general-error" role="alert">
                <AlertCircle size={16} />
                <span>{generalError}</span>
              </div>
            )}

            <button
              className="btn primary full auth-submit-btn"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "Signing in..." : "Log In"}
            </button>
          </form>

          <p className="auth-footer">
            New to NaviGoa? <Link to="/signup">Create an account</Link>
          </p>
        </div>

        <Link to="/" className="auth-back-link">
          <ArrowLeft size={15} /> Back to home
        </Link>
      </div>
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    status: "Bachelor Student",
    educationStage: "Higher Education",
    stream: "",
    degree: "",
    masterDegree: "",
    specialization: "",
    diplomaField: "",
    currentYear: "",
    location: "Goa",
    educationStatus: "Pursuing",
    experience: "",
    industry: "",
    currentRole: "",
    professionalExperience: "",
    skills: [],
    preferredLocation: "Goa + Remote",
    careerGoal: "",
    careerId: "",
    careerGoalReason: "",
    studyPreference: "Online / Part-time",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [validationError, setValidationError] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  const [availableMasterPrograms, setAvailableMasterPrograms] = useState([]);
  const [masterProgramsLoading, setMasterProgramsLoading] = useState(false);

  useEffect(() => {
    if (form.educationStage === "Higher Education" || form.educationLevel === "Undergraduate" || form.educationLevel === "Postgraduate") {
      setProgramsLoading(true);
      api.educationPrograms(form.stream).then(res => {
        const programs = res.data || [];
        const excluded = ["Masters", "Other", "MBA", "MCA"];
        const displayPrograms = programs.filter(p => !excluded.includes(p) || p === form.degree);
        setAvailablePrograms(displayPrograms);
        if (form.degree && !programs.includes(form.degree)) {
          setForm(prev => ({ ...prev, degree: "" }));
          setError("Your selected program is not compatible with this stream. Please select another program.");
        }
      }).catch(err => {
        console.error(err);
      }).finally(() => {
        setProgramsLoading(false);
      });
    } else {
      setAvailablePrograms([]);
    }
  }, [form.stream, form.educationStage, form.educationLevel]);

  useEffect(() => {
    if (form.status === "Master Student" && form.degree) {
      setMasterProgramsLoading(true);
      api.masterPrograms(form.degree).then(res => {
        setAvailableMasterPrograms(res.data || []);
      }).catch(err => {
        console.error("Failed to load master programs:", err);
      }).finally(() => {
        setMasterProgramsLoading(false);
      });
    } else {
      setAvailableMasterPrograms([]);
    }
  }, [form.degree, form.status]);

  function validateStep(currentStep) {
    const missing = [];
    if (currentStep === 1) {
      if (!form.status) missing.push("Status");
      if (!form.location) missing.push("Location");
    } else if (currentStep === 2) {
      if (!form.educationStage) missing.push("Education stage");
      if (form.educationStage === "Currently in 12th" && !form.stream) missing.push("12th Stream");
      if (form.educationStage === "Higher Education") {
        if (form.status === "Master Student") {
          if (!form.degree) missing.push("Previous Bachelor's Qualification");
          if (!form.masterDegree) missing.push("Intended / Current Master's Program");
        } else {
          if (!form.stream) missing.push("12th Stream");
          if (!form.degree) missing.push("Current Education");
        }
        if (!form.educationStatus) missing.push("Status");
      }
      if (form.educationStage === "Working Professional") {
        if (!form.industry) missing.push("Industry / Field");
        if (!form.currentRole) missing.push("Current role");
        if (!form.professionalExperience) missing.push("Years of experience");
      }
    } else if (currentStep === 3) {
      if (!form.preferredLocation) missing.push("Preferred location");
      if (!form.studyPreference) missing.push("Study preference");
      if (!form.careerGoal || !form.careerGoal?.trim()) missing.push("Career goal");
    } else if (currentStep === 4) {
      if (!form.skills || form.skills.length === 0) missing.push("Skills");
    }
    return missing;
  }

  const steps = [
    "Basic Information",
    "Education / Experience",
    "Career Goal & Preferences",
    "Skills & Interests",
    "Review & Complete",
  ];

  // Real skills from GET /skills
  const [allSkills, setAllSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState(null);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.profile(),
      api.mySkills(),
      api.myCustomSkills()
    ]).then(([profileRes, mySkillsRes, myCustomSkillsRes]) => {
      if (!active) return;
      let p = {};
      if (profileRes.status === "fulfilled") p = unwrapObject(profileRes.value);

      let existingSkills = [];
      if (mySkillsRes.status === "fulfilled") {
        const mySkillsData = mySkillsRes.value?.data || mySkillsRes.value || [];
        existingSkills = existingSkills.concat(mySkillsData.map(s => ({
          skill_id: s.skill_id || s.id,
          name: s.name,
          level: s.level,
          is_custom: false
        })));
      }
      if (myCustomSkillsRes.status === "fulfilled") {
        const customData = myCustomSkillsRes.value?.data || myCustomSkillsRes.value || [];
        existingSkills = existingSkills.concat(customData.map(s => ({
          skill_id: s.id,
          name: s.name,
          level: s.level,
          is_custom: true
        })));
      }

      const bachelors = Array.isArray(p.education) ? p.education.find(e => e.level === "Undergraduate") : null;
      const masters = Array.isArray(p.education) ? p.education.find(e => e.level === "Postgraduate") : null;
      const school = Array.isArray(p.education) ? p.education.find(e => e.education_stage === "SCHOOL_12") : null;
      
      const latest = masters || bachelors || school || (Array.isArray(p.education) && p.education.length ? p.education[0] : {});

      let eduStage = "Higher Education";
      if (latest.education_stage === "SCHOOL_12" || latest.level === "12th / Higher Secondary" || latest.level === "12th") {
        eduStage = "Currently in 12th";
      } else if (latest.education_stage === "WORKING_PROFESSIONAL" || latest.level === "Working Professional") {
        eduStage = "Working Professional";
      } else if (!latest.education_stage && !latest.level && !latest.degree) {
        eduStage = "Currently in 12th";
      }

      let derivedStatus = "Bachelor Student";
      if (eduStage === "Currently in 12th") {
        derivedStatus = "Higher Secondary Student";
      } else if (eduStage === "Working Professional") {
        derivedStatus = "Working Professional";
      } else if (eduStage === "Higher Education") {
        if (masters) {
          derivedStatus = "Master Student";
        } else {
          derivedStatus = "Bachelor Student";
        }
      }

      let exp = "";
      let ind = "";
      let role = "";
      let profExp = "";

      if (Array.isArray(p.experience) && p.experience.length > 0) {
        const firstExp = p.experience[0];
        if (firstExp.role || firstExp.industry || firstExp.duration) {
          ind = firstExp.industry || "";
          role = firstExp.role || "";
          profExp = firstExp.duration || "";
        } else {
          exp = firstExp.description || "";
        }
      }

      const loc = Array.isArray(p.preferred_locations) && p.preferred_locations.length ? p.preferred_locations[0] : "Goa + Remote";

      setForm(f => ({
        ...f,
        status: derivedStatus,
        educationStage: eduStage,
        stream: bachelors?.school_12_stream || bachelors?.stream || latest.school_12_stream || latest.stream || "",
        degree: bachelors?.current_program || bachelors?.degree || latest.current_program || latest.degree || "",
        masterDegree: masters?.current_program || masters?.degree || "",
        specialization: latest.specialization || "",
        diplomaField: latest.diplomaField || "",
        currentYear: latest.year ? String(latest.year) : "",
        educationStatus: latest.status ? (latest.status.charAt(0).toUpperCase() + latest.status.slice(1)) : "Pursuing",
        experience: exp,
        industry: ind,
        currentRole: role,
        professionalExperience: profExp,
        preferredLocation: loc,
        careerGoal: p.career_goal || "",
        careerId: p.career_id || "",
        skills: existingSkills
      }));
    }).finally(() => {
      if (active) setLoadingProfile(false);
    });
    return () => { active = false; };
  }, []);

  function loadSkills() {
    if (allSkills.length > 0 || skillsLoading) return;
    setSkillsLoading(true);
    setSkillsError(null);
    api
      .skills({ limit: 100 })
      .then((res) => {
        setAllSkills(unwrapList(res));
      })
      .catch((err) => {
        setSkillsError(err.message || "Could not load skills from the server.");
      })
      .finally(() => setSkillsLoading(false));
  }

  async function handleStepForward() {
    const missing = validateStep(step);
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowValidationPopup(true);
      return;
    }
    
    setError("");
    setSubmitting(true);
    
    try {
      if (step === 1) {
        // Save base education structure to lock in the category
        await api.updateProfile({
          education: getCleanedEducation(),
          experience: getCleanedExperience()
        });
      } else if (step === 2) {
        await api.updateProfile({
          education: getCleanedEducation(),
          experience: getCleanedExperience()
        });
        loadSkills();
      } else if (step === 3) {
        // Step 3 is Career Goal & Preferences.
        if (validationData && validationData.allow_continue === false) {
          setError(validationData.reason || "Your current background restricts direct progression into this goal.");
          setSubmitting(false);
          return;
        }

        let targetCareerId = form.careerId;
        if (form.careerGoal?.trim() && !validationData) {
          try {
            const valRes = await api.validateGoal({
              goal: form.careerGoal,
              profileContext: JSON.parse(currentProfileContext)
            });
            const vData = unwrapObject(valRes);
            setValidationData(vData);
            if (vData?.career_id) targetCareerId = vData.career_id;
            if (vData && vData.allow_continue === false) {
              setError(vData.reason || "Your current background restricts direct progression into this goal.");
              setSubmitting(false);
              return;
            }
          } catch (vErr) {
            console.error("Goal validation check failed:", vErr);
          }
        }

        await api.updateProfile({
          education: getCleanedEducation(),
          experience: getCleanedExperience(),
          preferred_locations: parseLocations(form.preferredLocation),
          career_goal: validationData?.goal || form.careerGoal || null,
          career_id: validationData?.career_id || targetCareerId || null,
          constraints: { study_mode: STUDY_MODE_MAP[form.studyPreference] || [] },
        });
        loadSkills();
      } else if (step === 4) {
        // Step 4 is Skills & Interests. Persist chosen skills.
        await api.updateMySkills({
          skills: form.skills.filter((s) => !s.is_custom).map((s) => ({
            skill_id: s.skill_id || s.id,
            level: s.level || "beginner",
          })),
        });
      }
      setStep((s) => s + 1);
    } catch (err) {
      setError(err.message || "Failed to save your progress. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleSkill(skill) {
    let skillId = skill.id;
    let skillName = skill.name;
    let isCustom = !!skill.is_custom;

    // Check if it's an AI skill without an ID yet (or a temporary ID)
    if (!skillId || String(skillId).startsWith('ai-temp-')) {
      try {
        const added = unwrapObject(await api.addCustomSkill({ name: skill.name, level: "beginner" }));
        skillId = added.id;
        skillName = added.name;
        isCustom = true;
      } catch (err) {
        console.error("Failed to add custom skill", err);
        return;
      }
    }

    const already = form.skills.some((s) => (s.skill_id || s.id) === skillId);
    let newSkills = already
      ? form.skills.filter((s) => (s.skill_id || s.id) !== skillId)
      : [
          ...form.skills,
          { skill_id: skillId, name: skillName, level: "beginner", is_custom: isCustom },
        ];

    setForm(f => ({ ...f, skills: newSkills }));
    
    // Immediately persist
    try {
      await api.updateMySkills({
        skills: newSkills.filter((s) => !s.is_custom).map((s) => ({
          skill_id: s.skill_id || s.id,
          level: s.level || "beginner",
        })),
      });
    } catch (err) {
      console.error("Failed to persist skill selection:", err);
    }
  }

  function handleStatusChange(e) {
    const newStatus = e.target.value;
    const updates = { status: newStatus };

    let newStage = form.educationStage;

    if (newStatus === "Bachelor Student") {
      newStage = "Higher Education";
      updates.masterDegree = "";
    } else if (newStatus === "Master Student") {
      newStage = "Higher Education";
    } else if (newStatus === "Higher Secondary Student") {
      newStage = "Currently in 12th";
      updates.educationStatus = "Pursuing";
    } else if (newStatus === "Working Professional") {
      newStage = "Working Professional";
    }

    if (newStage !== form.educationStage) {
      updates.educationStage = newStage;
      const isPro = newStage === "Working Professional";
      const wasPro = form.educationStage === "Working Professional";
      if (isPro && !wasPro) {
        updates.stream = "";
        updates.degree = "";
        updates.masterDegree = "";
        updates.specialization = "";
        updates.diplomaField = "";
        updates.currentYear = "";
        updates.experience = "";
      } else if (!isPro && wasPro) {
        updates.industry = "";
        updates.currentRole = "";
        updates.professionalExperience = "";
      }
    }

    if (newStage === "Currently in 12th") {
      updates.degree = "";
      updates.masterDegree = "";
      updates.specialization = "";
      updates.diplomaField = "";
    }

    setForm({ ...form, ...updates });
  }


  function getCleanedEducation() {
    const list = [];
    if (form.educationStage === "Currently in 12th") {
      const edu = {};
      edu.education_stage = "SCHOOL_12";
      edu.school_12_status = "PURSUING";
      if (form.stream) {
        edu.school_12_stream = form.stream;
        edu.stream = form.stream;
      }
      edu.status = "pursuing";
      edu.level = "12th / Higher Secondary"; // legacy fallback
      list.push(edu);
    } else if (form.educationStage === "Higher Education") {
      const bachelors = {};
      bachelors.education_stage = "HIGHER_EDUCATION";
      if (form.stream) {
        bachelors.school_12_stream = form.stream;
        bachelors.stream = form.stream;
      }
      if (form.degree) {
        bachelors.current_program = form.degree;
        bachelors.degree = form.degree;
      }
      if (form.specialization) bachelors.specialization = form.specialization;
      if (form.diplomaField) bachelors.diplomaField = form.diplomaField;
      if (form.currentYear && !isNaN(parseInt(form.currentYear))) {
        bachelors.year = parseInt(form.currentYear);
      }
      bachelors.level = "Undergraduate";

      if (form.status === "Master Student") {
        // If master student, bachelor's is completed, and we push master's as well
        bachelors.status = "completed";
        list.push(bachelors);

        const masters = {};
        masters.education_stage = "HIGHER_EDUCATION";
        masters.level = "Postgraduate";
        if (form.masterDegree) {
          masters.current_program = form.masterDegree;
          masters.degree = form.masterDegree;
        }
        if (form.specialization) masters.specialization = form.specialization;
        masters.status = (form.educationStatus || "pursuing").toLowerCase();
        list.push(masters);
      } else {
        bachelors.status = (form.educationStatus || "pursuing").toLowerCase();
        list.push(bachelors);
      }
    } else {
      const edu = {};
      edu.education_stage = "WORKING_PROFESSIONAL";
      edu.level = "Working Professional"; // legacy fallback
      list.push(edu);
    }
    return list;
  }

  function getCleanedExperience() {
    if (form.educationStage === "Working Professional") {
      const exp = {};
      if (form.industry) exp.industry = form.industry;
      if (form.currentRole) exp.role = form.currentRole;
      if (form.professionalExperience) exp.duration = form.professionalExperience;
      return Object.keys(exp).length > 0 ? [exp] : [];
    } else {
      return form.experience ? [{ description: form.experience }] : [];
    }
  }

  const lastValidatedGoalRef = useRef("");

  const currentProfileContext = JSON.stringify({
    education: getCleanedEducation(),
    experience: getCleanedExperience(),
    skills: form.skills ? form.skills.filter((s) => !s.is_custom).map((s) => ({ skill_id: s.skill_id || s.id })) : []
  });

  useEffect(() => {
    if (step !== 3 || !form.careerGoal?.trim()) {
      if (validationData) setValidationData(null);
      setValidationError(null);
      setIsValidating(false);
      lastValidatedGoalRef.current = "";
      return;
    }
    const validationKey = `${form.careerGoal}::${currentProfileContext}`;
    if (validationKey === lastValidatedGoalRef.current) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsValidating(true);
      setValidationData(null);
      setValidationError(null);
      setError("");
      try {
        const valRes = await api.validateGoal(
          { goal: form.careerGoal, profileContext: JSON.parse(currentProfileContext) },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          const vData = unwrapObject(valRes);
          setValidationData(vData);
          setValidationError(null);
          lastValidatedGoalRef.current = validationKey;
          if (vData?.career_id) {
            setForm(f => ({ ...f, careerId: vData.career_id }));
          }
        }
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError' || err.code === 'TIMEOUT' || err.code === 'CANCELLED') return;
        console.error("Live validation failed", err);
        setValidationError(err?.message || "Failed to validate career goal.");
      } finally {
        if (!controller.signal.aborted) setIsValidating(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.careerGoal, step, currentProfileContext]);

  async function validateAndFinish() {
    const allMissing = [];
    allMissing.push(...validateStep(1));
    allMissing.push(...validateStep(2));
    allMissing.push(...validateStep(3));
    allMissing.push(...validateStep(4));
    if (allMissing.length > 0) {
      setMissingFields(allMissing);
      setShowValidationPopup(true);
      return;
    }

    if (!form.careerGoal?.trim()) {
      return finish();
    }
    const validationKey = `${form.careerGoal}::${currentProfileContext}`;
    if (validationData && lastValidatedGoalRef.current === validationKey) {
      if (validationData && validationData.allow_continue === false) return;
      return finish();
    }
    setIsValidating(true);
    setError("");
    setValidationData(null);
    try {
      const valRes = await api.validateGoal({
        goal: form.careerGoal,
        profileContext: JSON.parse(currentProfileContext)
      });
      const data = unwrapObject(valRes);
      setValidationData(data);
      lastValidatedGoalRef.current = validationKey;
      if (data && data.allow_continue === false) return;
      return finish();

    } catch (err) {
      setError(err.message || "Failed to validate goal.");
      setValidationData(null);
    } finally {
      setIsValidating(false);
    }
  }

  async function finish() {
    const allMissing = [];
    allMissing.push(...validateStep(1));
    allMissing.push(...validateStep(2));
    allMissing.push(...validateStep(3));
    allMissing.push(...validateStep(4));
    if (allMissing.length > 0) {
      setMissingFields(allMissing);
      setShowValidationPopup(true);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await api.updateMySkills({
        skills: form.skills.filter((s) => !s.is_custom).map((s) => ({
          skill_id: s.skill_id || s.id,
          level: s.level || "beginner",
        })),
      });
      await api.updateProfile({
        education: getCleanedEducation(),
        experience: getCleanedExperience(),
        interests: [],
        preferred_locations: parseLocations(form.preferredLocation),
        career_goal: validationData?.goal || form.careerGoal || null,
        career_id: validationData?.career_id || form.careerId || null,
        constraints: { study_mode: STUDY_MODE_MAP[form.studyPreference] || [] },
      });
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.message ||
        "Could not save your profile — you can update it later from the profile page.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProfile) {
    return (
      <div className="onboarding-page">
        <div className="onboarding-top"><Logo /></div>
        <LoadingState label="Loading profile data..." />
      </div>
    );
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-top">
        <Logo />
        <span>Step {Math.min(step, 5)} of 5</span>
      </div>
      <div className="onboarding-grid">
        <div className="stepper">
          {steps.map((s, i) => (
            <div
              className={`step ${step === i + 1 ? "current" : step > i + 1 ? "done" : ""}`}
              key={s}
            >
              <div className="step-circle">
                {step > i + 1 ? <Check size={14} /> : i + 1}
              </div>
              <span>{s}</span>
            </div>
          ))}
        </div>
        <div className="onboard-card">
          {step < 5 ? (
            <>
              <div className="section-kicker">PROFILE SETUP</div>
              <h1>
                {step === 1
                  ? "Tell us about yourself"
                  : step === 2
                    ? "Your education and experience"
                    : step === 3
                      ? "Where do you want to build your career?"
                      : "What are you good at?"}
              </h1>
              <p className="muted">
                {step === 1
                  ? "This helps us show you relevant career options."
                  : step === 2
                    ? "Tell us your qualifications to customize your progression."
                    : step === 3
                      ? "Select your target career goal and location preferences to personalize role-specific skills."
                      : `Browse core competencies and supporting skills for ${validationData?.goal || form.careerGoal || "your target role"}.`}
              </p>

              {step === 1 && (
                <div className="form-stack">
                  <label>
                    I am a
                    <select
                      value={form.status}
                      onChange={handleStatusChange}
                    >
                      <option>Higher Secondary Student</option>
                      <option>Bachelor Student</option>
                      <option>Master Student</option>
                      <option>Working Professional</option>
                    </select>
                  </label>
                  <label>
                    Location
                    <select
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                    >
                      <option>Goa</option>
                      <option>Remote</option>
                      <option>Other state</option>
                    </select>
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="form-stack">

                  {form.educationStage === "Working Professional" ? (
                    <>
                      <label>
                        Industry / Field
                        <select
                          value={form.industry}
                          onChange={(e) => setForm({ ...form, industry: e.target.value })}
                        >
                          <option value="">Select Industry</option>
                          <option>Engineering / Technology</option>
                          <option>Finance & Accounting</option>
                          <option>Business / Management</option>
                          <option>Healthcare</option>
                          <option>Education</option>
                          <option>Marketing / Sales</option>
                          <option>Design / Creative</option>
                          <option>Legal</option>
                          <option>Government / Public Sector</option>
                          <option>Hospitality / Tourism</option>
                          <option>Manufacturing</option>
                          <option>Other</option>
                        </select>
                      </label>
                      <label>
                        Current Role / Job Title
                        <input
                          placeholder="e.g. Software Developer"
                          value={form.currentRole}
                          onChange={(e) => setForm({ ...form, currentRole: e.target.value })}
                        />
                      </label>
                      <label>
                        Years of Experience
                        <select
                          value={form.professionalExperience}
                          onChange={(e) => setForm({ ...form, professionalExperience: e.target.value })}
                        >
                          <option value="">Select Experience</option>
                          <option>Less than 1 year</option>
                          <option>1–2 years</option>
                          <option>3–5 years</option>
                          <option>5–10 years</option>
                          <option>10+ years</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <label>
                        12th Stream
                        <select
                          value={form.stream}
                          onChange={(e) => setForm({ ...form, stream: e.target.value })}
                        >
                          <option value="">Select Stream</option>
                          <option>Science — PCM</option>
                          <option>Science — PCB</option>
                          <option>Science — PCMB</option>
                          <option>Science — PCM + Computer Science</option>
                          <option>Science — PCB + Computer Science/IP</option>
                          <option>Science — Other</option>
                          <option>Commerce with Mathematics</option>
                          <option>Commerce without Mathematics</option>
                          <option>Commerce + Computer Science/IP</option>
                          <option>Humanities with Mathematics</option>
                          <option>Humanities without Mathematics</option>
                          <option>Vocational</option>
                          <option>Custom</option>
                        </select>
                      </label>

                      {form.educationStage === "Higher Education" && (
                        <>
                          <label>
                            {form.status === "Master Student" ? "Previous Bachelor's Qualification" : "Current Education / Program"}
                            {programsLoading ? (
                              <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading programs...</div>
                            ) : (
                              <>
                                <select
                                  value={form.degree}
                                  onChange={(e) => setForm({ ...form, degree: e.target.value })}
                                >
                                  <option value="">Select Program</option>
                                  {availablePrograms.map(p => (
                                    <option key={p} value={p}>{p}</option>
                                  ))}
                                </select>
                                {availablePrograms.length === 0 && !form.stream && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Select 12th Stream first.
                                  </div>
                                )}
                                {availablePrograms.length === 0 && form.stream && (
                                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    No eligible bachelor's programs found for the selected subjects.
                                  </div>
                                )}
                              </>
                            )}
                          </label>

                          {form.status === "Master Student" && (
                            <label>
                              Intended / Current Master's Program
                              {masterProgramsLoading ? (
                                <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading programs...</div>
                              ) : (
                                <>
                                  <select
                                    value={form.masterDegree}
                                    onChange={(e) => setForm({ ...form, masterDegree: e.target.value })}
                                  >
                                    <option value="">Select Program</option>
                                    {Object.entries(
                                      availableMasterPrograms.reduce((acc, curr) => {
                                        if (typeof curr === 'string') {
                                          if (!acc['Other']) acc['Other'] = [];
                                          acc['Other'].push(curr);
                                          return acc;
                                        }
                                        if (!acc[curr.discipline]) acc[curr.discipline] = [];
                                        acc[curr.discipline].push(curr.program);
                                        return acc;
                                      }, {})
                                    ).map(([discipline, programs]) => (
                                      <optgroup key={discipline} label={discipline}>
                                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                                      </optgroup>
                                    ))}
                                  </select>
                                  {availableMasterPrograms.length === 0 && !form.degree && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      Select Previous Bachelor's Qualification first.
                                    </div>
                                  )}
                                  {availableMasterPrograms.length === 0 && form.degree && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                      No eligible master's programs found for this qualification. Please contact support.
                                    </div>
                                  )}
                                </>
                              )}
                            </label>
                          )}

                          <label>
                            Specialization / Major (Optional)
                            <input
                              placeholder="e.g. Artificial Intelligence, Marketing"
                              value={form.specialization}
                              onChange={(e) => setForm({ ...form, specialization: e.target.value })}
                            />
                          </label>

                          <label>
                            Status
                            <select
                              value={form.educationStatus}
                              onChange={(e) => {
                                const newEdStatus = e.target.value;
                                // In the new UI, if they are a Master Student, they stay a Master Student whether pursuing or completed.
                                // If they are a Bachelor Student, they stay a Bachelor Student whether pursuing or completed.
                                // We don't automatically downgrade them or change their category based on pursuing/completed anymore.
                                setForm({ 
                                  ...form, 
                                  educationStatus: newEdStatus
                                });
                              }}
                            >
                              <option>Pursuing</option>
                              <option>Completed</option>
                            </select>
                          </label>
                        </>
                      )}

                      <label>
                        Experience
                        <textarea
                          value={form.experience}
                          onChange={(e) => setForm({ ...form, experience: e.target.value })}
                          placeholder="Projects, internships, work experience..."
                        />
                      </label>
                    </>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="form-stack">
                  <label>
                    Preferred locations
                    <select
                      value={form.preferredLocation}
                      onChange={(e) => setForm({ ...form, preferredLocation: e.target.value })}
                    >
                      <option>Goa + Remote</option>
                      <option>Goa</option>
                      <option>Pan India</option>
                      <option>Remote</option>
                    </select>
                  </label>
                  <label>
                    Study preference
                    <select
                      value={form.studyPreference}
                      onChange={(e) => setForm({ ...form, studyPreference: e.target.value })}
                    >
                      <option>Online / Part-time</option>
                      <option>Offline</option>
                      <option>Hybrid</option>
                    </select>
                  </label>

                  <div style={{ marginTop: 24 }}>
                    <label>
                      Career goal
                      <input
                        value={form.careerGoal}
                        onChange={(e) => {
                          setForm({ ...form, careerGoal: e.target.value });
                          if (validationData) setValidationData(null);
                        }}
                        placeholder="e.g. Data Analyst, Backend Developer, Chef, Lawyer"
                      />
                    </label>

                    <OnboardingGoalFeasibilityCard
                      validationData={validationData}
                      isValidating={isValidating}
                      careerGoal={form.careerGoal}
                      validationError={validationError}
                      onRetry={() => {
                        lastValidatedGoalRef.current = "";
                        setValidationError(null);
                        setIsValidating(true);
                        api.validateGoal(
                          { goal: form.careerGoal, profileContext: JSON.parse(currentProfileContext) }
                        ).then((valRes) => {
                          const vData = unwrapObject(valRes);
                          setValidationData(vData);
                          setValidationError(null);
                          lastValidatedGoalRef.current = `${form.careerGoal}::${currentProfileContext}`;
                          if (vData?.career_id) {
                            setForm((f) => ({ ...f, careerId: vData.career_id }));
                          }
                        }).catch((err) => {
                          console.error("Retry validation failed", err);
                          setValidationError(err?.message || "Failed to validate career goal.");
                        }).finally(() => {
                          setIsValidating(false);
                        });
                      }}
                      onReset={() => {
                        setValidationData(null);
                        setValidationError(null);
                        lastValidatedGoalRef.current = "";
                        setForm({ ...form, careerGoal: "", careerId: null });
                      }}
                    />
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="onboarding-skills-wrapper" style={{ marginTop: 8 }}>
                  <SkillsInterestsPanel
                    userSkillIds={new Set(form.skills.map(s => s.skill_id || s.id))}
                    selectedSkillsObjects={form.skills}
                    allSkills={allSkills}
                    careerGoal={validationData?.goal || form.careerGoal}
                    careerId={validationData?.career_id || form.careerId}
                    educationContext={[form.educationStage, form.stream, form.degree, form.specialization, form.industry, form.currentRole].filter(Boolean).join(' ')}
                    onToggleSkill={toggleSkill}
                    onAddCustomSkill={async (name) => {
                      try {
                        const added = unwrapObject(await api.addCustomSkill({ name, level: "beginner" }));
                        toggleSkill({ id: added.id, name: added.name, is_custom: true });
                      } catch (err) {
                        console.error("Failed to add custom skill", err);
                      }
                    }}
                  />
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn ghost"
                  disabled={step === 1 || isValidating || submitting}
                  onClick={() => {
                    if (validationData && ['D'].includes(validationData.classification)) {
                      setValidationData(null);
                      lastValidatedGoalRef.current = "";
                    } else {
                      setStep((s) => s - 1);
                    }
                  }}
                >
                  <ArrowLeft /> Back
                </button>

                {step === 4 ? (
                  <button
                    className="btn primary"
                    disabled={submitting || form.skills.length === 0}
                    onClick={handleStepForward}
                  >
                    {submitting ? "Saving..." : "Review & Complete"} <ArrowRight />
                  </button>
                ) : (
                  <button
                    className="btn primary"
                    disabled={submitting || (step === 3 && isValidating)}
                    onClick={handleStepForward}
                  >
                    {submitting ? "Saving..." : isValidating ? "Validating..." : "Next"} <ArrowRight />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="onboarding-review-card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div className="success-orb" style={{ margin: 0, width: 48, height: 48 }}>
                  <CheckCircle2 size={26} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', color: 'var(--text)' }}>Review & Complete Setup</h2>
                  <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '0.875rem' }}>
                    Confirm your profile summary and personalized career intelligence.
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Status & Location
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {form.status} • {form.location}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#64748b', marginTop: 4 }}>
                    Preferred: {form.preferredLocation} ({form.studyPreference})
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Education Background
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                    {form.degree || form.masterDegree || form.stream || form.educationStage}
                  </div>
                  {form.specialization && (
                    <div style={{ fontSize: '0.825rem', color: 'var(--brand)', marginTop: 2 }}>
                      Specialization: {form.specialization}
                    </div>
                  )}
                </div>

                <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 4 }}>
                    Target Career Goal
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{validationData?.goal || form.careerGoal || "Not selected"}</span>
                  </div>
                  {validationData?.classification && (
                    <div style={{ fontSize: '0.825rem', marginTop: 4, color: validationData.classification === 'A' ? 'var(--green)' : 'var(--brand)' }}>
                      {validationData.classification === 'A' ? "✓ Highly aligned with foundation" : validationData.classification === 'B' || validationData.classification === 'C' ? "⚡ Achievable route with preparation" : "Route under review"}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>
                    Selected Competencies ({form.skills.length})
                  </div>
                  <button
                    type="button"
                    className="btn text sm"
                    style={{ padding: '2px 8px', fontSize: '0.8rem' }}
                    onClick={() => setStep(4)}
                  >
                    Edit Skills
                  </button>
                </div>
                {form.skills.length > 0 ? (
                  <div className="chip-picker compact" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {form.skills.map((sk) => (
                      <span key={sk.skill_id || sk.id} className="chip active" style={{ fontSize: '0.82rem', padding: '4px 10px' }}>
                        {sk.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ margin: 0, fontSize: '0.85rem' }}>No skills selected yet.</p>
                )}
              </div>

              {error && <p style={{ color: "var(--red)", fontSize: 13, margin: 0 }}>{error}</p>}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => setStep(4)}
                  disabled={submitting}
                >
                  <ArrowLeft /> Back to Skills
                </button>
                <button
                  type="button"
                  className="btn primary"
                  onClick={finish}
                  disabled={submitting}
                >
                  {submitting ? "Completing setup..." : "Complete Setup & Go to Dashboard"} <ArrowRight />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showValidationPopup && (
        <div className="modal-overlay" style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, animation: 'fade-in 0.2s ease-out' }}>
          <div className="modal" style={{ background: '#fff', borderRadius: 16, padding: 32, width: '100%', maxWidth: 440, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
            <p style={{ marginBottom: 16, color: 'var(--text-muted)' }}>Please complete all required information:</p>
            <ul style={{ marginBottom: 24, paddingLeft: 20, color: 'var(--text)' }}>
              {missingFields.map((field, idx) => (
                <li key={`missing-${idx}`} style={{ marginBottom: 8, fontWeight: 500 }}>{field}</li>
              ))}
            </ul>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn outline" onClick={() => setShowValidationPopup(false)}>
                Okay, I will fix it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  // Pathway state (independent)
  const [pathwaySummary, setPathwaySummary] = useState(null);
  const [pathwayLoading, setPathwayLoading] = useState(true);
  const [pathwayError, setPathwayError] = useState(null);

  // Careers state (independent)
  const [careers, setCareers] = useState([]);
  const [careersLoading, setCareersLoading] = useState(true);
  const [careersError, setCareersError] = useState(null);

  const currentGoalTitle = useMemo(() => {
    const cg = profile?.current_goal;
    if (cg && typeof cg === "object" && cg.title) return cg.title;
    if (typeof cg === "string" && cg.trim()) return cg.trim();
    if (profile?.career_goal && profile.career_goal.trim()) return profile.career_goal.trim();
    return null;
  }, [profile]);

  const loadPathway = useCallback(() => {
    setPathwayLoading(true);
    setPathwayError(null);
    let active = true;

    api.userPathways()
      .then((res) => {
        if (!active) return;
        const pathways = unwrapList(res);
        if (pathways.length > 0) {
          const latest = pathways[0];
          return api.pathwayProgress(latest.id).then((pRes) => {
            if (!active) return;
            const p = unwrapObject(pRes);
            const steps = p.steps || [];
            const completed = steps.filter((s) => s.status === "completed").length;
            const total = steps.length;
            const remaining = Math.max(0, total - completed);
            const pct = total ? Math.round((completed / total) * 100) : 0;
            setPathwaySummary({
              id: latest.id,
              title: latest.title,
              careerTitle: latest.career_title,
              status: p.status,
              steps,
              completed,
              total,
              remaining,
              pct,
            });
            setPathwayLoading(false);
          });
        } else {
          setPathwaySummary(null);
          setPathwayLoading(false);
        }
      })
      .catch((err) => {
        if (!active) return;
        setPathwayError(err.message || "Unable to load pathway progress.");
        setPathwayLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const loadCareers = useCallback((goal) => {
    setCareersLoading(true);
    setCareersError(null);
    let active = true;

    function dedupeAndSet(rawItems) {
      if (!active) return;
      const normalized = (rawItems || []).map(normalizeCareer);
      const seenIds = new Set();
      const seenTitles = new Set();
      const unique = [];
      for (const item of normalized) {
        if (!item) continue;
        const idKey = item.id ? String(item.id) : null;
        const titleKey = item.title ? item.title.toLowerCase().trim() : null;
        if (idKey && seenIds.has(idKey)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;
        if (idKey) seenIds.add(idKey);
        if (titleKey) seenTitles.add(titleKey);
        unique.push(item);
      }
      setCareers(unique);
      setCareersLoading(false);
    }

    if (goal) {
      api.recommendCareers({ goal })
        .then((recRes) => {
          if (!active) return;
          const recData = unwrapObject(recRes);
          let items = [];
          if (recData && Array.isArray(recData.results) && recData.results.length > 0) {
            items = recData.results.slice(0, 3).map(normalizeCareer);
          }
          if (items.length > 0) {
            dedupeAndSet(items);
            return;
          }
          return api.careers({ search: goal, limit: 3 }).then((cRes) => {
            if (!active) return;
            const cItems = unwrapList(cRes).map(normalizeCareer);
            if (cItems.length > 0) {
              dedupeAndSet(cItems);
            } else {
              return api.careers({ limit: 3 }).then((fallbackRes) => {
                if (!active) return;
                dedupeAndSet(unwrapList(fallbackRes));
              });
            }
          });
        })
        .catch(() => {
          if (!active) return;
          api.careers({ limit: 3 })
            .then((cRes) => {
              if (!active) return;
              dedupeAndSet(unwrapList(cRes));
            })
            .catch((err) => {
              if (!active) return;
              setCareersError(err.message || "Failed to load careers.");
              setCareersLoading(false);
            });
        });
    } else {
      api.careers({ limit: 3 })
        .then((cRes) => {
          if (!active) return;
          dedupeAndSet(unwrapList(cRes));
        })
        .catch((err) => {
          if (!active) return;
          setCareersError(err.message || "Failed to load careers.");
          setCareersLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setProfileLoading(true);

    api.profile()
      .then((profileRes) => {
        if (!active) return;
        const p = unwrapObject(profileRes);
        if (p.profile_status !== "complete") {
          navigate("/onboarding", { replace: true });
          return;
        }
        setProfile(p);
        setProfileLoading(false);

        const cg = p.current_goal;
        const goal = (cg && typeof cg === "object" && cg.title)
          ? cg.title
          : (typeof cg === "string" && cg.trim() ? cg.trim() : (p.career_goal?.trim() || null));

        loadPathway();
        loadCareers(goal);
      })
      .catch(() => {
        if (!active) return;
        setProfile(null);
        setProfileLoading(false);
        loadPathway();
        loadCareers(null);
      });

    return () => {
      active = false;
    };
  }, [user?.id, navigate, loadPathway, loadCareers]);

  if (profileLoading) {
    return (
      <AppShell>
        <LoadingState label="Loading your career intelligence dashboard..." />
      </AppShell>
    );
  }

  const firstName = getFirstName(user);

  return (
    <AppShell>
      <div className="dash-container">
        {/* SECTION A: Welcome Header */}
        <div className="dash-welcome-row">
          <div className="dash-welcome-text">
            <div className="dash-kicker">CAREER INTELLIGENCE DASHBOARD</div>
            <h1>Welcome back, {firstName}</h1>
            <p>Your next opportunity starts here.</p>
          </div>
          <button
            type="button"
            className="dash-edit-profile-btn"
            onClick={() => navigate("/profile")}
            aria-label="Edit Profile"
          >
            <UserRound size={16} /> Edit Profile
          </button>
        </div>

        {/* SECTION B: Current Career Goal */}
        <div className="dash-goal-banner">
          <div className="dash-goal-left">
            <span className="dash-kicker-badge">
              <Target size={13} /> Current Career Goal
            </span>
            <div className="dash-goal-title-row">
              <h2 className="dash-goal-title">
                {currentGoalTitle || "No career goal set yet"}
              </h2>
              {currentGoalTitle && (
                <span className="dash-goal-pill">Active Target</span>
              )}
            </div>
            <p className="dash-goal-subtext">
              {currentGoalTitle
                ? "Your compass for customized pathways, skill gap analysis, and verified Goa opportunities."
                : "Set a career goal in your profile to unlock tailored pathways, skill matching, and targeted opportunities."}
            </p>
          </div>
          <div className="dash-goal-actions">
            {currentGoalTitle ? (
              <>
                <Link
                  to={`/careers?search=${encodeURIComponent(currentGoalTitle)}`}
                  className="btn outline sm"
                  style={{ textDecoration: "none" }}
                >
                  Explore matching careers <ArrowRight size={14} />
                </Link>
                <Link
                  to="/profile"
                  style={{
                    fontSize: 13,
                    color: "var(--muted, #64748b)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Change goal
                </Link>
              </>
            ) : (
              <Link
                to="/profile"
                className="btn primary sm"
                style={{ textDecoration: "none" }}
              >
                Set a career goal <ArrowRight size={14} />
              </Link>
            )}
          </div>
        </div>

        {/* SECTION C: Quick Actions */}
        <div>
          <div className="section-title" style={{ marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: 0 }}>
              Quick actions
            </h2>
          </div>
          <div className="dash-quick-grid">
            <Link className="dash-quick-action" to="/careers">
              <div className="dash-quick-icon-wrap">
                <Compass size={20} />
              </div>
              <div className="dash-quick-info">
                <b>Explore Careers</b>
                <span>Discover in-demand careers and qualifications in Goa.</span>
              </div>
              <ArrowRight size={16} color="#94a3b8" style={{ marginLeft: "auto", flexShrink: 0 }} />
            </Link>

            <Link className="dash-quick-action" to="/pathway">
              <div className="dash-quick-icon-wrap">
                <RouteIcon size={20} />
              </div>
              <div className="dash-quick-info">
                <b>Continue Learning Pathway</b>
                <span>Follow structured milestones and skill roadmaps.</span>
              </div>
              <ArrowRight size={16} color="#94a3b8" style={{ marginLeft: "auto", flexShrink: 0 }} />
            </Link>

            <Link className="dash-quick-action" to="/opportunities">
              <div className="dash-quick-icon-wrap">
                <BriefcaseBusiness size={20} />
              </div>
              <div className="dash-quick-info">
                <b>Find Opportunities</b>
                <span>Verified jobs, internships, scholarships & exams.</span>
              </div>
              <ArrowRight size={16} color="#94a3b8" style={{ marginLeft: "auto", flexShrink: 0 }} />
            </Link>
          </div>
        </div>

        {/* SECTION D: Opportunities — Explore Opportunities */}
        <div className="dash-section-card dash-explore-opps-card">
          <div className="dash-explore-opps-header">
            <div className="dash-explore-opps-header-text">
              <div className="dash-kicker">GOA CAREER OPPORTUNITIES</div>
              <h2>Explore Opportunities</h2>
              <p>
                Discover jobs, internships, scholarships, government recruitment, examinations, and training programmes across Goa. Explore opportunities from government departments, private employers, and educational institutions to find your next step.
              </p>
            </div>
          </div>

          <div className="dash-explore-categories-wrap">
            <span className="dash-explore-category-pill">
              <BriefcaseBusiness size={14} /> Jobs
            </span>
            <span className="dash-explore-category-pill">
              <GraduationCap size={14} /> Internships
            </span>
            <span className="dash-explore-category-pill">
              <Building2 size={14} /> Government Recruitment
            </span>
            <span className="dash-explore-category-pill">
              <Award size={14} /> Scholarships
            </span>
            <span className="dash-explore-category-pill">
              <BookOpen size={14} /> Training Programmes
            </span>
          </div>

          <div className="dash-explore-opps-footer">
            <Link
              to="/opportunities"
              className="btn primary sm"
              style={{
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 22px",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Explore Opportunities <ArrowRight size={15} />
            </Link>
            <Link
              to="/opportunities"
              className="dash-header-action-link"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              View all opportunities <ArrowRight size={14} />
            </Link>
          </div>
        </div>

        {/* SECTION E: Your Career Pathway (BELOW Opportunities) */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <div className="dash-section-header-text">
              <div className="dash-kicker">YOUR CAREER PATHWAY</div>
              <h2>
                {pathwaySummary?.careerTitle
                  ? `${pathwaySummary.careerTitle} Pathway`
                  : "Your Learning Pathway"}
              </h2>
              <p>
                {pathwaySummary?.title ||
                  "Step-by-step milestones, verified qualifications, and skill acquisition."}
              </p>
            </div>
            <Link to="/pathway" className="dash-header-action-link">
              View full pathway <ArrowRight size={14} />
            </Link>
          </div>

          {pathwayLoading && (
            <LoadingState label="Loading pathway progress..." />
          )}

          {!pathwayLoading && pathwayError && (
            <div className="dash-error-box">
              <p>
                <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {pathwayError}
              </p>
              <button
                type="button"
                className="dash-retry-btn"
                onClick={loadPathway}
              >
                <RotateCcw size={13} /> Retry
              </button>
            </div>
          )}

          {!pathwayLoading && !pathwayError && pathwaySummary && (
            <div className="dash-pathway-content">
              <div className="dash-pathway-meta-row">
                <span>
                  {pathwaySummary.completed} of {pathwaySummary.total} milestones completed
                </span>
                <span>{pathwaySummary.pct}% Overall Progress</span>
              </div>
              <div className="dash-pathway-progress-track">
                <div
                  className="dash-pathway-progress-bar"
                  style={{ width: `${pathwaySummary.pct}%` }}
                />
              </div>

              {pathwaySummary.steps && pathwaySummary.steps.length > 0 && (
                <div className="dash-pathway-steps-preview">
                  {pathwaySummary.steps.slice(0, 4).map((s, idx) => (
                    <div
                      className={`dash-pathway-step-card ${s.status === "completed" ? "completed" : ""}`}
                      key={s.id ? `dash-step-${s.id}` : `dash-step-${s.step_number ?? idx}-${idx}`}
                    >
                      <div className="dash-pathway-step-dot">
                        {s.status === "completed" ? <Check size={13} /> : idx + 1}
                      </div>
                      <div className="dash-pathway-step-info">
                        <b>{s.title}</b>
                        <span>
                          {s.description || (s.status === "completed" ? "Completed milestone" : "Milestone roadmap")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="dash-pathway-actions">
                <Link to="/pathway" className="btn primary sm" style={{ textDecoration: "none" }}>
                  Continue Pathway <ArrowRight size={14} />
                </Link>
                <Link to="/pathway" className="btn outline sm" style={{ textDecoration: "none" }}>
                  Review All Milestones
                </Link>
              </div>
            </div>
          )}

          {!pathwayLoading && !pathwayError && !pathwaySummary && (
            <div className="dash-state-box">
              <RouteIcon size={28} color="#64748b" />
              <h3>No active learning pathway yet</h3>
              <p>
                Choose your target career guide to generate a structured, step-by-step career pathway tailored to your background.
              </p>
              <Link to="/careers" className="btn primary sm" style={{ marginTop: 6, textDecoration: "none" }}>
                Create or select pathway <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </div>

        {/* SECTION F: Explore Careers (BELOW Pathway) */}
        <div className="dash-section-card">
          <div className="dash-section-header">
            <div className="dash-section-header-text">
              <div className="dash-kicker">EXPLORE CAREERS</div>
              <h2>
                {currentGoalTitle
                  ? `Careers Related to ${currentGoalTitle}`
                  : "Careers to Explore"}
              </h2>
              <p>Curated career guides and requirements in Goa.</p>
            </div>
            <Link to="/careers" className="dash-header-action-link">
              See all careers <ArrowRight size={14} />
            </Link>
          </div>

          {careersLoading && (
            <LoadingState label="Loading career recommendations..." />
          )}

          {!careersLoading && careersError && (
            <div className="dash-error-box">
              <p>
                <AlertCircle size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
                {careersError}
              </p>
              <button
                type="button"
                className="dash-retry-btn"
                onClick={() => loadCareers(currentGoalTitle)}
              >
                <RotateCcw size={13} /> Retry
              </button>
            </div>
          )}

          {!careersLoading && !careersError && careers.length > 0 && (
            <div className="dash-careers-grid">
              {careers.map((c, idx) => (
                <Link
                  className="dash-career-card"
                  to={`/careers/${c.id}`}
                  key={c.id ? `dash-career-${c.id}` : `dash-career-${idx}-${encodeURIComponent(c.title || 'item')}`}
                >
                  <div className="dash-career-thumb">
                    <BriefcaseBusiness size={20} />
                  </div>
                  <div className="dash-career-body">
                    <b>{c.title}</b>
                    <span>
                      {c.description
                        ? (c.description.length > 95
                            ? c.description.slice(0, 95) + "..."
                            : c.description)
                        : "View official career guide, prerequisites and pathways."}
                    </span>
                  </div>
                  <ArrowRight size={16} color="#94a3b8" style={{ alignSelf: "center", flexShrink: 0 }} />
                </Link>
              ))}
            </div>
          )}

          {!careersLoading && !careersError && careers.length === 0 && (
            <div className="dash-state-box">
              <Compass size={28} color="#64748b" />
              <h3>No career recommendations found</h3>
              <p>Browse our complete Goa career catalogue to find guides that match your goals.</p>
              <Link to="/careers" className="btn outline sm" style={{ marginTop: 6 }}>
                Browse all careers
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function ActionCard({ icon: Icon, title, text, to }) {
  return (
    <Link className="action-card" to={to}>
      <div className="action-icon">
        <Icon size={20} />
      </div>
      <div>
        <b>{title}</b>
        <span>{text}</span>
      </div>
      <ArrowRight size={17} />
    </Link>
  );
}

// Defensive normalization for POST /recommendations/careers results: the
// backend passes the AI service's response through as opaque JSON
// (`results` in recommendation.routes.js is whatever the AI service
// returned), so - unlike the rest of this file - there is no documented
// backend schema to normalize against here. This tries a few reasonable
// field names rather than assuming one.
function normalizeRecommendationResult(r) {
  return {
    careerId: r.career_id ?? r.careerId ?? r.id ?? null,
    aiCareerId: r.ai_career_id ?? r.aiCareerId ?? null,
    title: r.title ?? r.career_title ?? r.name ?? "Recommended career",
    reasoning: r.reasoning ?? r.explanation ?? r.why ?? "",
    matchScore: r.match_score ?? r.matchScore ?? r.score ?? null,
    missingSkills: r.missing_skills ?? r.skill_gaps ?? r.gaps ?? [],
    matchedSkills: r.matched_skills ?? r.matchedSkills ?? [],
    matchType: r.match_type ?? r.matchType ?? 'related',
    source: r.source ?? 'database',
    verified: r.verified ?? true,
  };
}

function Careers() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [careers, setCareers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null); // { id, goal, results, groups, ... }
  const [recFilter, setRecFilter] = useState("all"); // "all" | "direct" | "related" | "pathway"
  const [recError, setRecError] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});

  const [notACareerReason, setNotACareerReason] = useState(null);

  const abortControllerRef = useRef(null);
  
  const hasActiveSearch = (searchParams.get("search") || "").trim().length > 0;

  function load(search, loadPage = 1) {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    let active = true;
    if (loadPage === 1) {
      setStatus("loading");
      setCareers([]);
      setTotal(0);
    } else {
      setStatus("loading_more");
    }
    setError(null);
    setNotACareerReason(null);
    
    const params = { limit: 20, page: loadPage };
    if (search) params.search = search;
    
    api
      .careers(params, { signal })
      .then(async (data) => {
        if (!active || signal.aborted) return;
        const results = unwrapList(data).map(normalizeCareer);
        const newTotal = data.pagination?.total ?? results.length;
        setTotal(newTotal);

        if (results.length === 0 && search && search.length <= 120 && getToken() && loadPage === 1) {
          setStatus("exploring");
          try {
            const exploreRes = await api.exploreCareer({ query: search }, { signal });
            if (!active || signal.aborted) return;
            if (exploreRes.status === "not_a_career") {
              setNotACareerReason(exploreRes.reason);
              setStatus("not_a_career");
            } else if (exploreRes.data) {
              setCareers([normalizeCareer(exploreRes.data)]);
              setTotal(1);
              setStatus("ready");
            } else {
              setCareers([]);
              setStatus("ready");
            }
          } catch (err) {
            if (!active || signal.aborted) return;
            const normalizedErr = new Error(
              err?.status === 400
                ? (err.message || "Invalid search input. Please try a valid career title or skill keyword.")
                : (err?.code === 'AI_UNAVAILABLE' || err?.status === 503)
                ? "AI career exploration is currently unavailable. Please try again or search existing catalogue careers."
                : (err?.message || "Temporary server error while exploring careers. Please try again.")
            );
            normalizedErr.status = err?.status || (err?.code === 'AI_UNAVAILABLE' ? 503 : 500);
            normalizedErr.code = err?.code || 'UNKNOWN';
            setError(normalizedErr);
            setStatus("error");
          }
        } else {
          setCareers(prev => loadPage === 1 ? results : [...prev, ...results]);
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!active || signal.aborted || err.code === 'CANCELLED') return;
        const normalizedErr = new Error(err?.message || "Unable to load careers. Please try again.");
        normalizedErr.status = err?.status || 500;
        normalizedErr.code = err?.code || 'UNKNOWN';
        setError(normalizedErr);
        setStatus("error");
      });
    return () => {
      active = false;
      controller.abort();
    };
  }
  useEffect(() => load(searchParams.get("search") || "", 1), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setPage(1);
    setSearchParams(next.trim() ? { search: next } : {});
    load(next, 1);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    load(query, nextPage);
  }

  // Real integration for POST /recommendations/careers (auth required).
  // Uses the user's saved profile (goal + preferred locations) - the
  // backend fills in anything omitted from the profile itself, so no
  // extra form is needed here.
  async function findCareersForMe() {
    if (!getToken()) {
      setRecError({
        status: 401,
        message: "Log in to get recommendations based on your profile.",
      });
      return;
    }
    if ((searchParams.get("search") || "").trim().length > 0) {
      runSearch("");
    }
    setRecommending(true);
    setRecError(null);
    try {
      let resolvedGoal = null;
      try {
        const profRes = await api.profile();
        const prof = unwrapObject(profRes);
        resolvedGoal = prof.current_goal?.title || prof.career_goal || null;
      } catch {
        /* fallback to backend auth context resolution */
      }

      const res = await api.recommendCareers(resolvedGoal ? { goal: resolvedGoal } : {});
      const data = unwrapObject(res);
      const rawResults =
        data.results || data.recommendations || data.data || [];
      const normalizedResults = Array.isArray(rawResults)
        ? rawResults.map(normalizeRecommendationResult)
        : [];

      setRecommendation({
        id: data.recommendation_id || data.id,
        goal: data.goal || resolvedGoal || null,
        results: normalizedResults,
        groups: data.groups ? {
          direct_matches: (data.groups.direct_matches || []).map(normalizeRecommendationResult),
          related_careers: (data.groups.related_careers || []).map(normalizeRecommendationResult),
          career_transitions: (data.groups.career_transitions || []).map(normalizeRecommendationResult),
          alternative_pathways: (data.groups.alternative_pathways || []).map(normalizeRecommendationResult),
        } : null,
        aiGenerated: Boolean(data.ai_generated),
        fallbackUsed: Boolean(data.fallback_used),
      });
      setRecFilter("all");
    } catch (err) {
      setRecError(err);
    } finally {
      setRecommending(false);
    }
  }

  async function sendFeedback(rating) {
    if (!recommendation?.id) return;
    try {
      await api.recommendationFeedback(recommendation.id, { rating });
      setFeedbackGiven((f) => ({ ...f, [recommendation.id]: rating }));
    } catch {
      /* non-critical - feedback failing shouldn't block the page */
    }
  }

  const directMatches = recommendation?.groups?.direct_matches || (recommendation?.results || []).filter(r => r.matchType === 'direct');
  const relatedMatches = recommendation?.groups?.related_careers || (recommendation?.results || []).filter(r => r.matchType === 'related');
  const transitionMatches = recommendation?.groups?.career_transitions || (recommendation?.results || []).filter(r => r.matchType === 'transition');
  const pathwayMatches = recommendation?.groups?.alternative_pathways || (recommendation?.results || []).filter(r => r.matchType === 'pathway' || r.matchType === 'general');

  const visibleResults = recommendation?.results ? (
    recFilter === 'direct' ? directMatches :
    recFilter === 'related' ? relatedMatches :
    recFilter === 'transition' ? transitionMatches :
    recFilter === 'pathway' ? pathwayMatches :
    recommendation.results
  ) : [];

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">CAREER DISCOVERY</div>
            <h1>Explore careers</h1>
            <p>
              Browse career directions and understand what it takes to get
              there.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={findCareersForMe}
            disabled={recommending}
          >
            <Sparkles size={16} />{" "}
            {recommending ? "Finding careers..." : "Find careers for me"}
          </button>
        </div>
        <div className="search-bar">
          <Search />
          <input
            aria-label="Search careers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && status !== "loading" && status !== "exploring" && runSearch(query)}
            placeholder="Search careers by title, skill or keyword"
          />
          <button type="button" onClick={() => runSearch(query)} disabled={status === "loading" || status === "exploring"}>
            Search
          </button>
        </div>

        {recError && !hasActiveSearch && (
          <ErrorState
            text={recError.message}
            status={recError.status}
            onRetry={findCareersForMe}
          />
        )}
        {recommendation && !hasActiveSearch && (
          <div style={{ marginBottom: 24, padding: '24px 28px', background: '#fff', borderRadius: 16, border: '1px solid var(--line)', boxShadow: '0 4px 20px rgba(30,42,62,0.03)', position: 'relative', animation: 'fade-in 0.3s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', letterSpacing: '0.08em' }}>GOAL-CENTERED CAREER INTELLIGENCE</span>
                  {recommendation.fallbackUsed ? (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                      Verified Database Engine
                    </span>
                  ) : (
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#eff6ff', color: '#2563eb', fontWeight: 600 }}>
                      AI-Enriched Analysis
                    </span>
                  )}
                </div>
                <h2 style={{ fontSize: 22, margin: '0 0 6px 0', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  Centered on: <span style={{ color: 'var(--blue)' }}>{recommendation.goal || 'Your Target Ambition'}</span>
                </h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Prioritized by your primary career goal, technical skill overlaps, and educational compatibility.
                </p>
              </div>

              {recommendation.id && !feedbackGiven[recommendation.id] && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn ghost small"
                    onClick={() => sendFeedback("helpful")}
                    style={{ background: '#f8fafc', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#edf2f7'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    Helpful
                  </button>
                  <button
                    className="btn ghost small"
                    onClick={() => sendFeedback("not_helpful")}
                    style={{ background: '#f8fafc', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#edf2f7'}
                    onMouseLeave={e => e.currentTarget.style.background = '#f8fafc'}
                  >
                    Not helpful
                  </button>
                </div>
              )}
              {recommendation.id && feedbackGiven[recommendation.id] && (
                <span className="muted" style={{ fontSize: 12 }}>Thanks for the feedback.</span>
              )}
            </div>

            {/* Category Filter Strip */}
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 16, borderBottom: '1px solid #f1f5f9' }}>
              <button
                type="button"
                onClick={() => setRecFilter('all')}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: recFilter === 'all' ? '1px solid var(--blue)' : '1px solid #e2e8f0',
                  background: recFilter === 'all' ? '#eff6ff' : '#f8fafc',
                  color: recFilter === 'all' ? 'var(--blue)' : '#475569',
                  transition: 'all 0.15s'
                }}
              >
                All Recommendations ({recommendation.results.length})
              </button>
              {directMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecFilter('direct')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: recFilter === 'direct' ? '1px solid #2563eb' : '1px solid #e2e8f0',
                    background: recFilter === 'direct' ? '#eff6ff' : '#f8fafc',
                    color: recFilter === 'direct' ? '#1d4ed8' : '#475569',
                    transition: 'all 0.15s'
                  }}
                >
                  Direct Goal Matches ({directMatches.length})
                </button>
              )}
              {relatedMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecFilter('related')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: recFilter === 'related' ? '1px solid #475569' : '1px solid #e2e8f0',
                    background: recFilter === 'related' ? '#f1f5f9' : '#f8fafc',
                    color: recFilter === 'related' ? '#0f172a' : '#475569',
                    transition: 'all 0.15s'
                  }}
                >
                  Related Careers ({relatedMatches.length})
                </button>
              )}
              {transitionMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecFilter('transition')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: recFilter === 'transition' ? '1px solid #7c3aed' : '1px solid #e2e8f0',
                    background: recFilter === 'transition' ? '#f5f3ff' : '#f8fafc',
                    color: recFilter === 'transition' ? '#6d28d9' : '#475569',
                    transition: 'all 0.15s'
                  }}
                >
                  Career Transitions ({transitionMatches.length})
                </button>
              )}
              {pathwayMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRecFilter('pathway')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: recFilter === 'pathway' ? '1px solid #059669' : '1px solid #e2e8f0',
                    background: recFilter === 'pathway' ? '#ecfdf5' : '#f8fafc',
                    color: recFilter === 'pathway' ? '#065f46' : '#475569',
                    transition: 'all 0.15s'
                  }}
                >
                  Alternative Pathways ({pathwayMatches.length})
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {visibleResults.length ? (
                visibleResults.map((r, i) => (
                  <div
                    key={r.careerId ?? r.aiCareerId ?? i}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                      gap: 16,
                      padding: 18,
                      border: r.matchType === 'direct' ? '1.5px solid #bfdbfe' : '1px solid #eef1f6',
                      borderRadius: 12,
                      background: r.matchType === 'direct' ? '#f8faff' : '#fafbfc',
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,42,62,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                  >
                    <div style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: r.matchType === 'direct' ? '#dbeafe' : (r.matchType === 'transition' ? '#f5f3ff' : (r.matchType === 'pathway' ? '#d1fae5' : '#eef4ff')),
                      color: r.matchType === 'direct' ? '#1d4ed8' : (r.matchType === 'transition' ? '#6d28d9' : (r.matchType === 'pathway' ? '#047857' : 'var(--blue)')),
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none'
                    }}>
                      <Sparkles size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 220 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                        <h3 style={{ fontSize: 16, margin: 0, fontWeight: 700, color: '#0f172a' }}>
                          {r.title}
                        </h3>
                        {r.matchType === 'direct' && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#dbeafe', color: '#1e40af', fontWeight: 700 }}>
                            🎯 Direct Match
                          </span>
                        )}
                        {r.matchType === 'related' && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f1f5f9', color: '#334155', fontWeight: 600 }}>
                            🔗 Related Career
                          </span>
                        )}
                        {r.matchType === 'transition' && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f5f3ff', color: '#6d28d9', fontWeight: 600, border: '1px solid #ddd6fe' }}>
                            🔄 Career Transition
                          </span>
                        )}
                        {r.matchType === 'pathway' && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#ecfdf5', color: '#047857', fontWeight: 600 }}>
                            🌱 Alternative Pathway
                          </span>
                        )}
                        {r.source === 'ai_general' && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#faf5ff', color: '#7e22ce', fontWeight: 600, border: '1px solid #e9d5ff' }}>
                            ✨ AI Exploration
                          </span>
                        )}
                        {r.matchScore != null && (
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f8fafc', color: '#0f172a', fontWeight: 700, border: '1px solid #e2e8f0', marginLeft: 'auto' }}>
                            {r.matchScore}% Match
                          </span>
                        )}
                      </div>
                      {r.reasoning && (
                        <p style={{ margin: '0 0 8px 0', fontSize: 13, color: '#334155', lineHeight: 1.5 }}>
                          {r.reasoning}
                        </p>
                      )}

                      {/* Matched & Missing Skills Chips */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {r.matchedSkills && r.matchedSkills.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                            <span style={{ fontWeight: 600, color: '#047857' }}>Your matching skills:</span>
                            {r.matchedSkills.slice(0, 5).map((s, idx) => (
                              <span key={idx} style={{ padding: '2px 7px', background: '#ecfdf5', color: '#065f46', borderRadius: 6, border: '1px solid #a7f3d0' }}>
                                ✓ {typeof s === 'object' ? s.name : s}
                              </span>
                            ))}
                          </div>
                        )}
                        {r.missingSkills && r.missingSkills.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11 }}>
                            <span style={{ fontWeight: 600, color: '#64748b' }}>Skills to build:</span>
                            {r.missingSkills.slice(0, 5).map((s, idx) => (
                              <span key={idx} style={{ padding: '2px 7px', background: '#f8fafc', color: '#475569', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                                + {typeof s === 'object' ? s.name || s.skill : s}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    {r.careerId ? (
                      <Link className="btn outline small" to={`/careers/${r.careerId}`} style={{ flex: 'none', background: '#fff' }}>
                        View Career <ArrowRight size={14} />
                      </Link>
                    ) : r.aiCareerId ? (
                      <Link className="btn outline small" to={`/careers/${r.aiCareerId}?type=ai_profile`} style={{ flex: 'none', background: '#fff' }}>
                        View Career <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <Link className="btn outline small" to={`/careers/rec_${recommendation.id}_${encodeURIComponent(r.title)}`} style={{ flex: 'none', background: '#fff' }}>
                        View Career <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '32px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #dce2eb' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#1e293b' }}>No careers found under this filter.</p>
                  <button type="button" onClick={() => setRecFilter('all')} className="btn outline small">Show all recommendations</button>
                </div>
              )}
            </div>
            <style dangerouslySetInnerHTML={{
              __html: `
              @keyframes fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}} />
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 22 }}>
          <div className="results">
            {(status === "ready" || status === "loading_more") && careers.length > 0 && (
              <div className="results-top">
                <span>
                  Showing <b>{careers.length}</b> of <b>{total}</b> careers
                </span>
              </div>
            )}
            {status === "loading" && (
              <LoadingState label="Loading careers..." layout="list" />
            )}
            {status === "exploring" && (
              <LoadingState label="Researching this career..." layout="list" />
            )}
            {status === "not_a_career" && (
              <EmptyState
                title="Not a career"
                text={notACareerReason || "This search term does not represent a recognizable career."}
                action="Clear search"
                onAction={() => runSearch("")}
              />
            )}
            {status === "error" && (
              <ErrorState
                text={error?.message}
                status={error?.status}
                onRetry={() => load(query || searchParams.get("search") || "", 1)}
              />
            )}
            {(status === "ready" || status === "loading_more") && careers.length > 0 && careers.map((c) => <CareerRow c={c} key={c.id} />)}
            {(status === "ready" || status === "loading_more") && careers.length === 0 && (
                <EmptyState
                  title="No careers matched that search"
                  text={!getToken() ? "Log in to get AI-powered career exploration." : "Try a career title or a skill such as SQL or Python."}
                  action="Clear search"
                  onAction={() => runSearch("")}
                />
            )}
            {(status === "ready" || status === "loading_more") && careers.length > 0 && careers.length < total && (
              <button 
                className="btn outline" 
                style={{ width: '100%', marginTop: 24 }} 
                disabled={status === "loading_more"} 
                onClick={loadMore}
              >
                {status === "loading_more" ? "Loading more..." : "Load more careers"}
              </button>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function CareerRow({ c }) {
  return (
    <Link className="career-row" to={`/careers/${c.id}${c.isAiProfile ? '?type=ai_profile' : ''}`}>
      <div className="career-image">
        <BriefcaseBusiness size={21} />
      </div>
      <div className="career-row-main">
        <h3>
          {c.title}{" "}
          {c.origin === 'ai_generated' && (
            <span className="ai-badge" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'var(--brand-surface)', color: 'var(--brand)', borderRadius: 12, marginLeft: 8, fontWeight: 'normal' }}>
              <Sparkles size={10} /> AI-generated
            </span>
          )}
        </h3>
        <p>{c.description}</p>
      </div>
      <ArrowRight className="row-arrow" size={19} />
    </Link>
  );
}

function EmptyState({ title, text, action, onAction }) {
  return (
    <div className="empty-state">
      <Search size={24} />
      <h2>{title}</h2>
      <p>{text}</p>
      {action && (
        <button className="btn outline" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function CareerDetail() {
  const { user } = useAuth();
  return (
    <AppShell>
      <CareerDetailPage user={user} />
    </AppShell>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <b>{value || "—"}</b>
    </div>
  );
}

function SkillGap() {
  const { user } = useAuth();
  return (
    <AppShell>
      <SkillGapPage user={user} />
    </AppShell>
  );
}

// POST /eligibility/check is scoped to ONE opportunity_id (it evaluates
// opportunity_requirements against the user's profile) - see
// src/modules/eligibility/eligibility.service.js. Used from the
// Opportunity detail page, not from a career guide.
function Eligibility() {
  const [params] = useSearchParams();
  const opportunityId = params.get("opportunity") || "";
  const opportunityTitle = params.get("title") || "this opportunity";
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runCheck() {
    if (!opportunityId) return;
    if (!getToken()) {
      setError({ status: 401, message: "Log in to check your eligibility." });
      return;
    }
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const data = unwrapObject(await api.checkEligibility(opportunityId));
      setResult(data);
    } catch (err) {
      setError(err);
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    if (opportunityId)
      runCheck(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [opportunityId]);

  const outcome = result?.outcome;
  const requirements = result?.results || [];
  const outcomeCopy = {
    meets_listed_requirements: {
      label: "Meets listed requirements",
      pillClass: "open",
      icon: <CheckCircle2 size={15} />,
    },
    does_not_meet_listed_requirements: {
      label: "Does not meet listed requirements",
      pillClass: "warning",
      icon: <X size={15} />,
    },
    unable_to_determine: {
      label: "Unable to determine",
      pillClass: "warning",
      icon: <CircleHelp size={15} />,
    },
  }[outcome];

  return (
    <AppShell>
      <div className="eligibility-page">
        <div className="breadcrumbs">
          {opportunityId ? (
            <Link to={`/opportunities/${opportunityId}`}>
              ← Back to opportunity
            </Link>
          ) : (
            <Link to="/opportunities">← Back to opportunities</Link>
          )}
        </div>
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">ELIGIBILITY CHECK</div>
            <h1>Eligibility for {opportunityTitle}</h1>
            <p>
              Compares your saved profile with this opportunity's structured
              requirements.
            </p>
          </div>
          {outcomeCopy && (
            <span className={`status-pill ${outcomeCopy.pillClass}`}>
              {outcomeCopy.icon} {outcomeCopy.label}
            </span>
          )}
        </div>
        <div className="eligibility-layout">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Your eligibility</h2>
                <p>Based on your saved profile</p>
              </div>
              <button
                className="btn outline"
                onClick={runCheck}
                disabled={checking || !opportunityId}
              >
                {checking ? "Checking..." : "Re-run check"}
              </button>
            </div>
            {!opportunityId && (
              <p className="muted">
                Open this page from an opportunity to check eligibility for it.
              </p>
            )}
            {error && <ErrorState text={error.message} status={error.status} />}
            {checking && <LoadingState label="Checking eligibility..." />}
            {!checking &&
              !error &&
              requirements.map((r, i) => (
                <div className="requirement" key={r.requirement_id ?? i}>
                  <div
                    className={`req-icon ${r.status === "satisfied" ? "met" : r.status === "not_satisfied" ? "missing" : "unknown"}`}
                  >
                    {r.status === "satisfied" ? (
                      <Check size={15} />
                    ) : r.status === "not_satisfied" ? (
                      <X size={15} />
                    ) : (
                      <CircleHelp size={15} />
                    )}
                  </div>
                  <div>
                    <b>{r.requirement_type}</b>
                    <span>{r.requirement_text}</span>
                    {r.reason && <small>{r.reason}</small>}
                  </div>
                  <em>
                    {r.status === "satisfied"
                      ? "Meets"
                      : r.status === "not_satisfied"
                        ? "Missing"
                        : "Needs verification"}
                  </em>
                </div>
              ))}
            {!checking &&
              !error &&
              opportunityId &&
              requirements.length === 0 && (
                <p className="muted">
                  No structured requirements have been published for this
                  opportunity yet, so an overall outcome couldn't be produced.
                </p>
              )}
            {!checking && !error && result?.explanation && (
              <div className="callout" style={{ marginTop: 14 }}>
                <Lightbulb size={17} />
                <div>
                  <b>AI explanation</b>
                  <span>{result.explanation}</span>
                </div>
              </div>
            )}
          </div>
          <aside className="next-box">
            <div className="callout">
              <Lightbulb size={17} />
              <div>
                <b>Always verify official sources.</b>
                <span>This result reflects listed requirements only.</span>
              </div>
            </div>
            <div className="source-note">
              <ShieldCheck size={15} />
              <span>
                Always verify the current official recruitment notice before
                applying.
              </span>
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Pathway() {
  const { user } = useAuth();
  return (
    <AppShell>
      <CareerPathwayView user={user} />
    </AppShell>
  );
}

function ProjectsStudio() {
  const { user } = useAuth();
  return (
    <AppShell>
      <ProjectsStudioPage user={user} />
    </AppShell>
  );
}

function Opportunities() {
  const [type, setType] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  const [opportunities, setOpportunities] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const load = (curSearch, curType, curStatus, curLoc, curPage) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const signal = controller.signal;

    setStatus("loading");
    setError(null);

    let backendType;
    if (curType === "Government") backendType = "government";
    else if (curType === "Private Sector") backendType = "private_sector";
    else if (curType === "Internship") backendType = "internship";

    let backendStatus;
    if (curStatus === "Open") backendStatus = "open";
    else if (curStatus === "Closing Soon") backendStatus = "closing_soon";
    else if (curStatus === "Closed") backendStatus = "closed";

    const params = {
      page: curPage,
      limit,
      search: curSearch.trim() || undefined,
      opportunity_type: backendType,
      status: backendStatus,
      location: curLoc !== "All" ? curLoc : undefined,
    };

    api
      .opportunities(params, { signal })
      .then((data) => {
        if (signal.aborted) return;
        const items = unwrapList(data).map(normalizeOpportunity);
        setOpportunities(items);
        const serverTotal = data?.pagination?.total ?? items.length;
        setTotal(serverTotal);
        setTotalPages(data?.pagination?.total_pages ?? Math.max(1, Math.ceil(serverTotal / limit)));
        setStatus("ready");
      })
      .catch((err) => {
        if (signal.aborted) return;
        setError(err);
        setStatus("error");
      });
  };

  useEffect(() => {
    const delay = search.trim() ? 260 : 0;
    const timer = window.setTimeout(() => {
      load(search, type, statusFilter, locationFilter, page);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [search, type, statusFilter, locationFilter, page]);

  const handleSearchChange = (val) => {
    setSearch(val);
    setPage(1);
  };

  const handleTypeChange = (val) => {
    setType(val);
    setPage(1);
  };

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
  };

  const handleLocationChange = (val) => {
    setLocationFilter(val);
    setPage(1);
  };

  const resetFilters = () => {
    setSearch("");
    setType("All");
    setStatusFilter("All");
    setLocationFilter("All");
    setPage(1);
  };

  const hasActiveFilters = search.trim() !== "" || type !== "All" || statusFilter !== "All" || locationFilter !== "All";
  const activeFilterCount = [Boolean(search.trim()), type !== "All", statusFilter !== "All", locationFilter !== "All"]
    .filter(Boolean).length;
  const isClosingSoonTab = statusFilter === "Closing Soon";

  const clearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const filterBar = (
    <div className={`opportunity-filter ${mobileFiltersOpen ? "is-open" : ""}`}>
      <div className="opportunity-search-row">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Search opportunities"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search by title, employer, category…"
        />
        {search && (
          <button type="button" className="opportunity-clear-search" onClick={clearSearch} aria-label="Clear opportunity search">
            <X size={14} />
          </button>
        )}
      </div>
      <button
        type="button"
        className="mobile-filter-toggle"
        aria-expanded={mobileFiltersOpen}
        onClick={() => setMobileFiltersOpen((open) => !open)}
      >
        <SlidersHorizontal size={14} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
      </button>
      <div className="opportunity-filter-controls">
        <label>
          <span>Type</span>
          <select aria-label="Opportunity type" value={type} onChange={(e) => handleTypeChange(e.target.value)}>
            <option value="All">All types</option>
            <option value="Government">Government</option>
            <option value="Private Sector">Private Sector</option>
            <option value="Internship">Internship</option>
          </select>
        </label>
        <label>
          <span>Status</span>
          <select aria-label="Opportunity status" value={statusFilter} onChange={(e) => handleStatusChange(e.target.value)}>
            <option value="All">All statuses</option>
            <option value="Open">Open</option>
            <option value="Closing Soon">Closing soon</option>
            <option value="Closed">Closed</option>
          </select>
        </label>
        <label>
          <span>Location</span>
          <select aria-label="Opportunity location" value={locationFilter} onChange={(e) => handleLocationChange(e.target.value)}>
            <option value="All">All locations</option>
            <option value="Goa">Goa</option>
            <option value="Bengaluru">Bengaluru</option>
            <option value="Remote">Remote</option>
          </select>
        </label>
      </div>
      {hasActiveFilters && (
        <button
          type="button"
          className="opp-filter-reset"
          onClick={resetFilters}
          title="Reset all filters"
        >
          <X size={12} /> Reset
        </button>
      )}
    </div>
  );

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">OPPORTUNITIES</div>
            <h1>Jobs, internships & programmes</h1>
            <p>
              Explore opportunities and verify the official notice before
              applying.
            </p>
          </div>
        </div>
        <div className="tabs opportunity-tabs">
          <a
            className={!isClosingSoonTab ? "active" : ""}
            onClick={() => handleStatusChange("All")}
            style={{ cursor: "pointer" }}
          >
            All opportunities
          </a>
          <a
            className={isClosingSoonTab ? "active" : ""}
            onClick={() => handleStatusChange("Closing Soon")}
            style={{ cursor: "pointer" }}
          >
            Closing soon
          </a>
        </div>
        {filterBar}
        {status === "loading" && (
          <LoadingState label="Loading opportunities..." layout="opportunity" />
        )}
        {status === "error" && (
          <ErrorState text={error?.message} status={error?.status} onRetry={() => load(search, type, statusFilter, locationFilter, page)} />
        )}
        {status === "ready" &&
          (opportunities.length > 0 ? (
            <>
              <div className="opportunity-results-summary" aria-live="polite">
                <strong>{total}</strong> source-backed {total === 1 ? "opportunity" : "opportunities"}
                {hasActiveFilters ? <span> matching your filters</span> : <span> available to explore</span>}
              </div>
              <div className="opportunity-list">
                {opportunities.map((o) => (
                  <Link
                    className="opportunity-card"
                    to={`/opportunities/${o.id}`}
                    key={o.id}
                  >
                    <div className="opp-logo">
                      <Building2 />
                    </div>
                    <div className="opp-main">
                      <div className="opp-top">
                        <span className={`status-pill ${o.statusClass}`}>
                          {o.status}
                        </span>
                        <span>{o.type}</span>
                        {o.sourceName && (
                          <span style={{ fontSize: 11, color: "var(--muted, #64748b)" }}>
                            · {o.sourceName}
                          </span>
                        )}
                      </div>
                      <h2>{o.title}</h2>
                      <p>
                        <Building2 size={14} />
                        {o.org}
                        {o.location ? " · " : ""}
                        {o.location && <MapPin size={14} />}
                        {o.location ? ` ${o.location}` : ""}
                      </p>
                      <div className="opp-meta">
                        <span>
                          <CalendarDays /> Deadline: <b>{o.deadline}</b>
                        </span>
                        {o.vacancies ? (
                          <span>
                            · Vacancies: <b>{o.vacancies}</b>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight size={18} />
                  </Link>
                ))}
              </div>
              {total > limit && (
                <div className="opportunity-pagination">
                  <span>
                    Showing {Math.min((page - 1) * limit + 1, total)}–{Math.min(page * limit, total)} of {total} opportunities
                  </span>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      <ArrowLeft size={13} /> Previous
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <EmptyState
              title="No opportunities match your filters"
              text={
                hasActiveFilters
                  ? "Try adjusting your search keywords, status, or category filter to discover more opportunities."
                  : "NaviGoa does not show sample vacancies as if they are live. Check back when a source-backed listing is available."
              }
              action={hasActiveFilters ? "Reset filters" : undefined}
              onAction={hasActiveFilters ? resetFilters : undefined}
            />
          ))}
      </div>
    </AppShell>
  );
}

function OpportunityDetail() {
  const location = useLocation();
  const params = useParams();
  const id =
    params.id || location.pathname.split("/").filter(Boolean).pop() || "";
  const [o, setO] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api
      .opportunity(id)
      .then((data) => {
        if (!active) return;
        setO(unwrapObject(data));
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        setStatus(err.status === 404 ? "notfound" : "error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading opportunity..." />
      </AppShell>
    );
  if (status === "notfound") return <NotFound />;
  if (status === "error" || !o)
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  const statusInfo = formatOpportunityStatus(o.status, o.application_deadline);
  const oppType = formatOpportunityType(o.opportunity_type);
  const deadline = o.application_deadline
    ? new Date(o.application_deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "Deadline not specified";
  const requirements = Array.isArray(o.requirements) ? o.requirements : [];
  const relatedCareers = Array.isArray(o.related_careers) ? o.related_careers : [];

  const descParagraphs = (o.description || "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <AppShell>
      <div className="detail-page">
        <div className="breadcrumbs">
          <Link to="/opportunities">Opportunities</Link>
          <span>/</span>
          <b>{o.title}</b>
        </div>
        <div className="detail-hero">
          <div className="detail-image">
            <Building2 size={42} />
          </div>
          <div className="detail-title">
            <div className="tag">{oppType}</div>
            <h1>{o.title}</h1>
            <div className="detail-meta">
              <span>
                <Building2 size={15} />
                {o.organization || "Organization not specified"}
              </span>
              <span>
                <MapPin size={15} />
                {o.location || "Location not specified"}
              </span>
              <span>
                <CalendarDays size={15} />
                Deadline: {deadline}
              </span>
              <span className={`status-pill ${statusInfo.class}`}>
                {statusInfo.label}
              </span>
              {o.vacancies_total ? (
                <span>
                  Vacancies: <b>{o.vacancies_total}</b>
                </span>
              ) : null}
              {o.advertisement_number ? (
                <span>
                  Notice #: <b>{o.advertisement_number}</b>
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <section className="panel detail-panel">
              <h2>About this Opportunity</h2>
              {descParagraphs.length > 0 ? (
                descParagraphs.map((p, idx) => (
                  <p key={idx} className="opp-desc-paragraph">
                    {p}
                  </p>
                ))
              ) : (
                <p className="muted">
                  No extended role description provided in the notice. Review official notice links and requirements below.
                </p>
              )}
            </section>

            <section className="panel detail-panel">
              <h2>Requirements & Eligibility</h2>
              {requirements.length ? (
                requirements.map((r, idx) => {
                  const isVerified = r.verification_status === "verified";
                  const reqText = r.requirement_text || "";
                  const hasSubClauses = /\((?:i|ii|iii|iv|v|[a-z]|\d+)\)/i.test(reqText);
                  const subClauses = hasSubClauses
                    ? reqText.split(/(?=\((?:i|ii|iii|iv|v|[a-z]|\d+)\))/i).map((s) => s.trim()).filter(Boolean)
                    : [];

                  return (
                    <div className="requirement" key={r.id || idx}>
                      <div className={`req-icon ${isVerified ? "verified" : "pending"}`}>
                        {isVerified ? <CheckCircle2 size={15} /> : <CircleHelp size={15} />}
                      </div>
                      <div>
                        <b>{r.requirement_type ? formatOpportunityType(r.requirement_type) : "Requirement"}</b>
                        {subClauses.length > 1 ? (
                          <ul className="req-sublist">
                            {subClauses.map((clause, cIdx) => (
                              <li key={cIdx}>{clause}</li>
                            ))}
                          </ul>
                        ) : (
                          <span>{reqText}</span>
                        )}
                        <small style={{ marginTop: 4, display: "block" }}>
                          {isVerified ? "Verified requirement" : "Needs verification — consult official notice"}
                        </small>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="muted">
                  No structured requirements have been published for this
                  opportunity yet. Verify criteria directly on the official
                  application notice.
                </p>
              )}
            </section>
            {relatedCareers.length > 0 && (
              <section className="panel detail-panel">
                <h2>Related careers</h2>
                <div className="tag-row">
                  {relatedCareers.map((c) => (
                    <Link key={c.career_id} to={`/careers/${c.career_id}`}>
                      {c.title}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
          <aside className="eligibility-card">
            <div className="eligibility-icon">
              <ShieldCheck />
            </div>
            <h2>Are you eligible?</h2>
            <p>
              Compare your saved profile with this opportunity's structured
              requirements.
            </p>
            <Link
              className="btn primary full"
              to={`/eligibility?opportunity=${o.id}&title=${encodeURIComponent(o.title)}`}
            >
              Check my eligibility <ArrowRight size={16} />
            </Link>
            <small>
              {o.verification_status === "verified"
                ? "Verified source-backed listing."
                : "Awaiting manual verification."}
              {o.verified_at && ` Verified on ${new Date(o.verified_at).toLocaleDateString("en-IN")}.`}
            </small>
            {o.source_url && (
              <a
                href={o.source_url}
                target="_blank"
                rel="noreferrer"
                className="btn secondary full"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 12 }}
              >
                Apply / Official notice <ExternalLink size={14} />
              </a>
            )}
            {o.source_document_url && o.source_document_url !== o.source_url && (
              <a
                href={o.source_document_url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", marginTop: 8, fontSize: 11, textAlign: "center" }}
              >
                Official document notice <ExternalLink size={12} />
              </a>
            )}
            {o.source_name && (
              <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted, #64748b)", textAlign: "center" }}>
                Source: <b>{o.source_name}</b>
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Institutions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [page, setPage] = useState(parseInt(searchParams.get("page")) || 1);
  const [totalPages, setTotalPages] = useState(1);

  function load(search, pageNum = 1) {
    let active = true;
    setStatus("loading");
    setError(null);
    api
      .institutions(search ? { search, page: pageNum } : { page: pageNum })
      .then((data) => {
        if (!active) return;
        setItems(unwrapList(data).map(normalizeInstitution));
        if (data.pagination) setTotalPages(data.pagination.totalPages);
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }
  useEffect(() => load(searchParams.get("search") || "", page), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setPage(1);
    setSearchParams(next.trim() ? { search: next, page: 1 } : { page: 1 });
    load(next, 1);
  }

  function handlePageChange(newPage) {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    setSearchParams(query.trim() ? { search: query, page: newPage } : { page: newPage });
    load(query, newPage);
  }

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">LEARN</div>
            <h1>Institutions & courses</h1>
            <p>
              Find institutions that can help you close your skill or
              qualification gaps.
            </p>
          </div>
        </div>
        <div className="search-bar">
          <Search />
          <input
            aria-label="Search institutions"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="Search institutions by name or location"
          />
          <button type="button" onClick={() => runSearch(query)}>
            Search
          </button>
        </div>
        {status === "loading" && (
          <LoadingState label="Loading institutions..." layout="grid" />
        )}
        {status === "error" && (
          <ErrorState
            text={error?.message}
            status={error?.status}
            onRetry={() => load(query)}
          />
        )}
        {status === "ready" &&
          (items.length ? (
            <div className="institution-grid">
              {items.map((i) => (
                <Link
                  className="institution-card"
                  to={`/institutions/${i.id}`}
                  key={i.id}
                >
                  <div className="institution-image">
                    <Building2 size={26} />
                  </div>
                  <h2>{i.name}</h2>
                  {i.location && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MapPin size={14} />
                      {i.location}
                    </p>
                  )}
                  {i.courses && i.courses.length > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {i.courses.length} Available programme{i.courses.length !== 1 ? 's' : ''}
                    </p>
                  )}
                  <span className="btn outline full">
                    View institution <ArrowRight size={15} />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No institutions matched that search"
              text="Try a different name, district, or course type."
              action="Clear search"
              onAction={() => runSearch("")}
            />
          ))}

        {status === "ready" && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 32, alignItems: 'center' }}>
            <button
              className="btn outline"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              Previous
            </button>
            <span style={{ fontSize: 14 }}>Page {page} of {totalPages}</span>
            <button
              className="btn outline"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              Next
            </button>
          </div>
        )}
        <div className="source-note learn-note">
          <ShieldCheck size={15} />
          <span>
            NaviGoa lists institutions for reference only. Confirm admissions,
            fees and recognition directly with the institution.
          </span>
        </div>
      </div>
    </AppShell>
  );
}

function InstitutionDetail() {
  const location = useLocation();
  const params = useParams();
  const id =
    params.id || location.pathname.split("/").filter(Boolean).pop() || "";
  const [inst, setInst] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api
      .institution(id)
      .then((data) => {
        if (!active) return;
        setInst(normalizeInstitution(unwrapObject(data)));
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        setStatus(err.status === 404 ? "notfound" : "error");
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading institution..." />
      </AppShell>
    );
  if (status === "notfound") return <NotFound />;
  if (status === "error" || !inst)
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="detail-page">
        <div className="breadcrumbs">
          <Link to="/institutions">Institutions</Link>
          <span>/</span>
          <b>{inst.name}</b>
        </div>
        <div className="detail-hero">
          <div className="detail-image">
            <Building2 size={42} />
          </div>
          <div className="detail-title">
            <h1>{inst.name}</h1>
            <p>{inst.description}</p>
            {inst.location && (
              <div className="detail-meta">
                <span>
                  <MapPin size={15} />
                  {inst.location}
                </span>
              </div>
            )}
          </div>
        </div>
        {inst.courses && inst.courses.length > 0 && (
          <section className="panel detail-panel" style={{ marginTop: 24 }}>
            <h2>Available courses ({inst.courses.length})</h2>
            <div style={{ marginTop: 16 }}>
              {inst.courses.map(course => (
                <div key={course.id} style={{ marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
                    <h3 style={{ margin: 0, fontSize: 18 }}>{course.title}</h3>
                    {course.qualification && (
                      <span className="tag" style={{ marginLeft: 12 }}>
                        {course.qualification}
                      </span>
                    )}
                  </div>

                  {course.career_directions && course.career_directions.length > 0 ? (
                    <div>
                      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 12, fontWeight: 500 }}>
                        Possible career directions:
                      </p>
                      <div className="learning-grid" style={{ gridTemplateColumns: '1fr', gap: 12 }}>
                        {course.career_directions.map(career => (
                          <div key={career.careerId} className="learning-card" style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface-sunken)' }}>
                            <div style={{ flex: 1, paddingRight: 16 }}>
                              <h4 style={{ margin: '0 0 4px 0', fontSize: 16 }}>{career.careerName}</h4>
                              {career.description && (
                                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
                                  {career.description}...
                                </p>
                              )}
                              {career.relationshipReason && (
                                <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--brand-main)' }}>
                                  {career.relationshipReason}
                                </p>
                              )}
                            </div>
                            <Link to={`/careers/${career.careerId}`} className="btn outline">
                              Explore career <ArrowRight size={14} />
                            </Link>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}
        {inst.website_url && (
          <section className="panel detail-panel" style={{ marginTop: 24 }}>
            <h2>Website</h2>
            <a href={inst.website_url} target="_blank" rel="noreferrer">
              {inst.website_url} <ExternalLink size={13} />
            </a>
          </section>
        )}
      </div>
    </AppShell>
  );
}

function Learn() {
  const [careers, setCareers] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    api
      .careers()
      .then((data) => {
        if (!active) return;
        setCareers(unwrapList(data).map(normalizeCareer).slice(0, 4));
        setStatus("ready");
      })
      .catch(() => {
        if (active) setStatus("error");
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">LEARNING</div>
            <h1>Build skills for your next step</h1>
            <p>
              Start with the skills and qualifications listed on each career
              guide, then use the institution directory to compare learning
              options.
            </p>
          </div>
          <Link className="btn primary" to="/careers">
            Explore career guides <ArrowRight size={16} />
          </Link>
        </div>
        {status === "loading" && (
          <LoadingState label="Loading career guides..." />
        )}
        {status === "error" && (
          <ErrorState text="Could not load career guides." />
        )}
        {status === "ready" && (
          <div className="learning-grid">
            {careers.map((c) => (
              <Link
                className="learning-card"
                key={c.id}
                to={`/careers/${c.id}`}
              >
                <BookOpen />
                <h2>{c.title}</h2>
                <p>
                  {(c.keyInformation?.typicalQualification || c.qualifications[0])
                    ? `Typical qualification: ${c.keyInformation?.typicalQualification || c.qualifications[0]}`
                    : c.description}
                </p>
                <span>
                  View career guide <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        )}
        <div className="source-note learn-note">
          <ShieldCheck size={15} />
          <span>
            NaviGoa lists learning directions, not endorsements of individual
            courses. Confirm curriculum, eligibility, fees and recognition
            directly with the provider.
          </span>
        </div>
      </div>
    </AppShell>
  );
}

function SkillPicker({ userSkillIds, selectedSkills = [], toggleSkill, careerGoal, educationContext }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [activeTab, setActiveTab] = useState('recommended'); // 'recommended', 'all'
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [recommendedSkills, setRecommendedSkills] = useState([]);
  const [searchSkills, setSearchSkills] = useState([]);

  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [recsError, setRecsError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, activeTab]);

  useEffect(() => {
    if (!educationContext && !careerGoal) {
      setRecommendedSkills([]);
      if (activeTab === 'recommended') setActiveTab('all');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRecsError(null);
      setLoadingRecs(true);
      api.suggestSkills({ 
        education: educationContext || undefined, 
        career_goal: careerGoal || undefined 
      }, { signal: controller.signal })
        .then(res => setRecommendedSkills(unwrapList(res)))
        .catch((err) => {
          if (err.name === 'AbortError' || err.code === 'TIMEOUT' || err.code === 'CANCELLED') return;
          console.error("Failed to load skill suggestions:", err);
          setRecsError("Personalized suggestions are temporarily unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingRecs(false);
        });
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [careerGoal, educationContext]);

  useEffect(() => {
    if (activeTab !== 'all' && !debouncedQuery) return; // Only load search skills when in 'all' tab or when searching
    setLoadingSearch(true);
    api.skills({ search: debouncedQuery, category: selectedCategory, page, limit: 30 })
      .then(res => {
        const data = unwrapList(res);
        if (page === 1) setSearchSkills(data);
        else setSearchSkills(prev => [...prev, ...data]);
        setHasMore(res.pagination && page < res.pagination.total_pages);
      })
      .catch(() => { })
      .finally(() => setLoadingSearch(false));
  }, [debouncedQuery, page, selectedCategory, activeTab]);

  // If user types a query, automatically switch to "All Skills" to search everything
  useEffect(() => {
    if (debouncedQuery) setActiveTab('all');
  }, [debouncedQuery]);

  const displaySkills = activeTab === 'recommended' && !debouncedQuery ? recommendedSkills : searchSkills;
  
  const uniqueDisplaySkills = Array.from(new Map(displaySkills.map(sk => [sk.id || sk.name, sk])).values());
  const groups = { direct: {}, supporting: {}, optional: {}, general: {} };
  
  for (const sk of uniqueDisplaySkills) {
    const cat = sk.category || "Other";
    if (activeTab === 'recommended' && !debouncedQuery) {
      let rel = sk.relationship;
      if (rel === 'possessed' || rel === 'direct') rel = 'direct';
      else if (rel === 'optional') rel = 'optional';
      else rel = 'supporting'; // Default for recommended

      if (!groups[rel][cat]) groups[rel][cat] = [];
      groups[rel][cat].push(sk);
    } else {
      if (!groups.general[cat]) groups.general[cat] = [];
      groups.general[cat].push(sk);
    }
  }

  // Predefined common categories for the filter
  const commonCategories = [
    'programming', 'frontend', 'backend', 'databases', 'cloud', 'AI', 'data_science',
    'finance', 'business', 'marketing', 'design', 'soft_skill', 'tools'
  ];

  return (
    <div className="skill-picker-container" style={{ marginTop: 12 }}>
      
      {/* Search and Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div className="search-bar" style={{ position: 'relative' }}>
          <Search size={16} />
          <input
            placeholder="Search thousands of skills..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {(loadingRecs || loadingSearch) && <span className="muted" style={{ fontSize: 12, position: 'absolute', right: 12 }}>Loading...</span>}
        </div>
        
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <button 
            type="button" 
            className={`btn small ${activeTab === 'recommended' ? 'primary' : 'outline'}`} 
            onClick={() => { setActiveTab('recommended'); setQuery(''); }}
            disabled={!educationContext && !careerGoal}
          >
            Recommended for you
          </button>
          <button 
            type="button" 
            className={`btn small ${activeTab === 'all' ? 'primary' : 'outline'}`} 
            onClick={() => setActiveTab('all')}
          >
            All Skills Catalogue
          </button>
        </div>
      </div>

      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--bg-light)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               Your Selected Skills ({selectedSkills.length})
             </div>
          </div>
          <div className="chip-picker compact">
            {selectedSkills.map(sk => (
              <span
                key={sk.id || sk.skill_id}
                className="chip active"
                onClick={() => toggleSkill(sk)}
                style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {sk.name}
                <X size={12} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter for All Skills tab */}
      {activeTab === 'all' && !debouncedQuery && (
         <div style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
           <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
              <span 
                className={`chip ${!selectedCategory ? 'active' : ''}`}
                onClick={() => setSelectedCategory('')}
                style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px' }}
              >
                All Categories
              </span>
              {commonCategories.map(cat => (
                <span 
                  key={cat}
                  className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px', textTransform: 'capitalize' }}
                >
                  {cat.replace('_', ' ')}
                </span>
              ))}
           </div>
         </div>
      )}

      {/* Error State */}
      {recsError && activeTab === 'recommended' && (
        <div style={{ padding: 12, background: "rgba(255, 165, 0, 0.1)", borderRadius: 6, marginBottom: 16 }}>
          <p style={{ color: "var(--brand)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} /> {recsError}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Browse the full catalogue under "All Skills".
          </p>
        </div>
      )}

      {/* Empty State for Recommendations */}
      {activeTab === 'recommended' && uniqueDisplaySkills.length === 0 && !loadingRecs && !recsError && (
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          No personalized recommendations found. Check the "All Skills" tab to browse.
        </div>
      )}

      {/* Recommended Tab Content */}
      {activeTab === 'recommended' && !debouncedQuery && uniqueDisplaySkills.length > 0 && !recsError && (
        <>
          {Object.keys(groups.direct).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', marginBottom: 12 }}>
                Core Skills
              </div>
              {Object.entries(groups.direct).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
                  <div className="chip-picker compact">
                    {skills.map(sk => {
                      const selected = userSkillIds.has(sk.id);
                      return (
                        <span
                          key={sk.id || sk.name}
                          className={`chip ${selected ? "active" : ""}`}
                          onClick={() => toggleSkill(sk)}
                          style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={sk.description || sk.name}
                        >
                          {sk.name}
                          {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                          {selected && <Check size={14} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(groups.supporting).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', marginBottom: 12 }}>
                Supporting Skills
              </div>
              {Object.entries(groups.supporting).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
                  <div className="chip-picker compact">
                    {skills.map(sk => {
                      const selected = userSkillIds.has(sk.id);
                      return (
                        <span
                          key={sk.id || sk.name}
                          className={`chip ${selected ? "active" : ""}`}
                          onClick={() => toggleSkill(sk)}
                          style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={sk.description || sk.name}
                        >
                          {sk.name}
                          {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                          {selected && <Check size={14} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(groups.optional).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', marginBottom: 12 }}>
                Optional / Transferable Skills
              </div>
              {Object.entries(groups.optional).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
                  <div className="chip-picker compact">
                    {skills.map(sk => {
                      const selected = userSkillIds.has(sk.id);
                      return (
                        <span
                          key={sk.id || sk.name}
                          className={`chip ${selected ? "active" : ""}`}
                          onClick={() => toggleSkill(sk)}
                          style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={sk.description || sk.name}
                        >
                          {sk.name}
                          {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                          {selected && <Check size={14} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All Skills Tab Content */}
      {activeTab === 'all' && (
        <>
          {Object.entries(groups.general).map(([cat, skills]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
              <div className="chip-picker compact">
                {skills.map(sk => {
                  const selected = userSkillIds.has(sk.id);
                  return (
                    <span
                      key={sk.id || sk.name}
                      className={`chip ${selected ? "active" : ""}`}
                      onClick={() => toggleSkill(sk)}
                      style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title={sk.description || sk.name}
                    >
                      {sk.name}
                      {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                      {selected && <Check size={14} />}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          {uniqueDisplaySkills.length === 0 && !loadingSearch && (
            <p className="muted" style={{ fontSize: 14 }}>No skills found matching your search.</p>
          )}

          {hasMore && (
            <button
              type="button"
              className="btn outline"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => setPage(p => p + 1)}
              disabled={loadingSearch}
            >
              {loadingSearch ? "Loading..." : "Load More"}
            </button>
          )}
        </>
      )}
    </div>
  );
}


function Profile() {
  // Pass the same authenticated identity context used by ProtectedRoute and
  // AppShell into the extracted ProfilePage component. This avoids a second,
  // unrelated AuthContext instance and keeps email/refreshUser available.
  const { user, refreshUser } = useAuth();
  return (
    <AppShell>
      <ProfilePage user={user} refreshUser={refreshUser} />
    </AppShell>
  );
}

// BACKEND GAP: there is no endpoint that lists a user's saved items of any
// kind (career or pathway) - src/modules/pathways/pathway.routes.js only
// exposes POST/DELETE .../save (a toggle), never a GET list, and there is
// no saved-careers endpoint at all (see docs/API-INTEGRATION-MAP.md). This
// page is honest about that instead of calling a fabricated endpoint or
// showing fake data.
// Dedicated /assistant page - full inline chat UI (not the floating widget).
// Uses the same API calls as AssistantWidget but renders full-width as a page.
function AssistantPage() {
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [loadingConvo, setLoadingConvo] = useState(false);
  const [error, setError] = useState(null);
  const [lastMessageText, setLastMessageText] = useState(null);
  const loggedIn = !!getToken();

  useEffect(() => {
    if (loggedIn) {
      setLoadingList(true);
      api
        .assistantConversations()
        .then((res) => setConversations(unwrapList(res)))
        .catch(() => { })
        .finally(() => setLoadingList(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setLastMessageText(null);
    setShowHistory(false);
  }

  function openConversation(id) {
    setLoadingConvo(true);
    setError(null);
    api
      .assistantConversation(id)
      .then((res) => {
        const data = unwrapObject(res);
        setConversationId(data.id);
        setMessages(data.messages || []);
        setShowHistory(false);
      })
      .catch((err) => setError(err))
      .finally(() => setLoadingConvo(false));
  }

  async function send(retryText) {
    const text = retryText ?? input.trim();
    if (!text || sending) return;
    if (!retryText) {
      setInput("");
      setMessages((m) => [
        ...m,
        {
          id: `local-${Date.now()}`,
          role: "user",
          content: text,
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setLastMessageText(text);
    setError(null);
    setSending(true);
    try {
      const res = await api.assistantChat({
        conversation_id: conversationId || undefined,
        message: text,
      });
      const data = unwrapObject(res);
      console.debug("[NaviGoa Assistant]", {
        conversationId: data.conversation_id,
        requestStatus: "success",
      });
      setConversationId(data.conversation_id);
      setMessages((m) => [...m, data.message]);
      api
        .assistantConversations()
        .then((r) => setConversations(unwrapList(r)))
        .catch(() => { });
    } catch (err) {
      console.debug("[NaviGoa Assistant]", {
        conversationId,
        requestStatus: "error",
        responseStatus: err.status || "network",
      });
      let msg = "Unable to connect to the NaviGoa backend.";
      if (err.status === 401)
        msg = "Your session has expired. Please log in again.";
      else if (err.status === 403)
        msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429)
        msg = "Too many requests. Please try again shortly.";
      else if (err.status === 503)
        msg = err.message || "The assistant service is temporarily unavailable. Please try again shortly.";
      else if (err.status >= 500)
        msg = "NaviGoa couldn't process that request. Please try again.";
      else if (err.message) msg = err.message;
      setError(new Error(msg));
    } finally {
      setSending(false);
    }
  }

  async function removeConversation(id, e) {
    e.stopPropagation();
    try {
      await api.deleteAssistantConversation(id);
      setConversations((c) => c.filter((x) => x.id !== id));
      if (conversationId === id) startNew();
    } catch { }
  }

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">AI ASSISTANT</div>
            <h1>NaviGoa Assistant</h1>
            <p>
              Ask about careers, pathways, courses and opportunities in Goa.
              Answers are grounded in NaviGoa data.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {loggedIn && (
              <button
                className="btn outline"
                onClick={() => setShowHistory((s) => !s)}
              >
                <MessageCircle size={16} />{" "}
                {showHistory ? "Back to chat" : "History"}
              </button>
            )}
            {loggedIn && (
              <button className="btn outline" onClick={startNew}>
                <Plus size={16} /> New chat
              </button>
            )}
          </div>
        </div>
        {!loggedIn ? (
          <div className="empty-state">
            <Bot size={24} />
            <h2>Log in to use the assistant</h2>
            <p>
              Your conversations are saved to your account so you can continue
              them later.
            </p>
            <Link className="btn primary" to="/login">
              Log in <ArrowRight size={15} />
            </Link>
          </div>
        ) : showHistory ? (
          <div className="panel" style={{ padding: 16 }}>
            <h2 style={{ fontSize: 15, marginBottom: 16 }}>
              Conversation history
            </h2>
            {loadingList && <LoadingState label="Loading conversations..." />}
            {!loadingList && conversations.length === 0 && (
              <p className="muted">No conversations yet. Start a new chat.</p>
            )}
            {conversations.map((c) => (
              <div
                className="assistant-convo-row"
                key={c.id}
                onClick={() => openConversation(c.id)}
                style={{ padding: "12px 10px", fontSize: 13 }}
              >
                <span>{c.title || "Untitled conversation"}</span>
                <button
                  className="icon-btn"
                  onClick={(e) => removeConversation(c.id, e)}
                  title="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="panel"
            style={{
              display: "flex",
              flexDirection: "column",
              minHeight: 520,
              maxHeight: "70vh",
              padding: 0,
            }}
          >
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {loadingConvo && <LoadingState label="Loading conversation..." />}
              {!loadingConvo && messages.length === 0 && (
                <div
                  className="assistant-empty"
                  style={{ marginTop: "auto", marginBottom: "auto" }}
                >
                  <Sparkles size={22} />
                  <p>
                    Ask me about careers, courses, pathways or opportunities
                    available through NaviGoa. I'll use NaviGoa data rather
                    than guessing.
                  </p>
                </div>
              )}
              {messages.map((m, i) => (
                <div className={`assistant-msg ${m.role}`} key={m.id ?? i}>
                  <div className="assistant-bubble">
                    {(m.content || "").split("\n").map((line, li) => {
                      const parts = line.split(/(\*\*[^*]+\*\*)/g);
                      return (
                        <span key={li}>
                          {parts.map((p, pi) =>
                            p.startsWith("**") && p.endsWith("**") ? (
                              <strong key={pi}>{p.slice(2, -2)}</strong>
                            ) : (
                              p
                            ),
                          )}
                          {li < (m.content || "").split("\n").length - 1 ? (
                            <br />
                          ) : null}
                        </span>
                      );
                    })}
                  </div>
                  {Array.isArray(m.citations) && m.citations.length > 0 && (
                    <div className="assistant-citations">
                      {m.citations.map((c, ci) => {
                        const label =
                          typeof c === "string"
                            ? c
                            : c.title || c.source_url || "Source";
                        const url =
                          typeof c === "object" && c
                            ? c.source_url || c.url
                            : null;
                        return url ? (
                          <a
                            key={ci}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {label} <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span key={ci}>{label}</span>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {sending && (
                <div className="assistant-msg assistant">
                  <div className="assistant-bubble typing">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              )}
            </div>
            {error && (
              <div className="assistant-error">
                <p>{error.message}</p>
                <button
                  className="btn outline"
                  onClick={() => send(lastMessageText)}
                >
                  Retry
                </button>
              </div>
            )}
            <div
              className="assistant-input-row"
              style={{
                borderTop: "1px solid var(--line)",
                padding: 12,
                display: "flex",
                gap: 8,
              }}
            >
              <textarea
                rows="1"
                style={{
                  flex: 1,
                  border: "1px solid var(--line)",
                  borderRadius: 20,
                  padding: "10px 16px",
                  fontSize: 13,
                  outline: "none",
                  resize: "none",
                  minHeight: 40,
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                aria-label="Message NaviGoa Assistant"
                placeholder="Ask something…"
                disabled={sending}
              />
              <button
                className="assistant-send"
                onClick={() => send()}
                disabled={sending || !input.trim()}
                aria-label="Send"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Dedicated /recommendations page
function RecommendationsPage() {
  const [status, setStatus] = useState("idle");
  const [recommendation, setRecommendation] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [error, setError] = useState(null);

  async function run() {
    if (!getToken()) {
      setError({
        status: 401,
        message:
          "Log in to get AI career recommendations based on your profile.",
      });
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      const res = await api.recommendCareers({});
      const data = unwrapObject(res);
      setRecommendation({
        id: data.recommendation_id,
        results: (data.results || []).map(normalizeRecommendationResult),
      });
      setStatus("ready");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  }

  async function sendFeedback(rating) {
    if (!recommendation?.id) return;
    try {
      await api.recommendationFeedback(recommendation.id, { rating });
      setFeedbackGiven((f) => ({ ...f, [recommendation.id]: rating }));
    } catch {
      /* non-critical */
    }
  }

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">AI RECOMMENDATIONS</div>
            <h1>Find careers for you</h1>
            <p>
              Get AI-powered career recommendations based on your profile,
              skills and goals.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={run}
            disabled={status === "loading"}
          >
            <Sparkles size={16} />{" "}
            {status === "loading"
              ? "Finding careers..."
              : "Get recommendations"}
          </button>
        </div>
        {error && (
          <ErrorState
            text={error.message}
            status={error.status}
            onRetry={run}
          />
        )}
        {status === "idle" && !error && (
          <div className="empty-state">
            <Sparkles size={24} />
            <h2>Ready when you are</h2>
            <p>
              Click "Get recommendations" to run AI-powered career matching
              based on your saved profile, skills and career goal.
            </p>
          </div>
        )}
        {status === "ready" && recommendation && (
          <div className="panel" style={{ padding: 20 }}>
            <div className="panel-head">
              <div>
                <span className="label">RECOMMENDED FOR YOU</span>
                <h2>Based on your profile</h2>
              </div>
              {recommendation.id && !feedbackGiven[recommendation.id] && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    className="btn outline"
                    onClick={() => sendFeedback("helpful")}
                  >
                    Helpful
                  </button>
                  <button
                    className="btn outline"
                    onClick={() => sendFeedback("not_helpful")}
                  >
                    Not helpful
                  </button>
                </div>
              )}
              {recommendation.id && feedbackGiven[recommendation.id] && (
                <span className="muted">Thanks for the feedback.</span>
              )}
            </div>
            {recommendation.results.length ? (
              recommendation.results.map((r, i) => (
                <div className="rec-item" key={r.careerId ?? i}>
                  <div className="career-thumb">
                    <Sparkles size={17} />
                  </div>
                  <div>
                    <b>
                      {r.title}
                      {!r.careerId && r.source === 'ai_general' && (
                        <span className="ai-badge" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', background: 'var(--brand-surface)', color: 'var(--brand)', borderRadius: 12, marginLeft: 8, fontWeight: 'normal' }}>
                          <Sparkles size={10} /> AI suggestion
                        </span>
                      )}
                    </b>
                    {r.reasoning && <span>{r.reasoning}</span>}
                    {r.missingSkills?.length > 0 && (
                      <span>
                        Skills to build:{" "}
                        {r.missingSkills
                          .map((s) => s.skill ?? s.name ?? s)
                          .join(", ")}
                      </span>
                    )}
                  </div>
                  {r.careerId ? (
                    <Link className="btn outline" to={`/careers/${r.careerId}`}>
                      View <ArrowRight size={14} />
                    </Link>
                  ) : r.aiCareerId ? (
                    <Link className="btn outline" to={`/careers/${r.aiCareerId}?type=ai_profile`}>
                      View <ArrowRight size={14} />
                    </Link>
                  ) : (
                    <Link className="btn outline" to={`/careers/rec_${recommendation.id}_${encodeURIComponent(r.title)}`}>
                      Explore <ArrowRight size={14} />
                    </Link>
                  )}
                </div>
              ))
            ) : (
              <p className="muted">
                No specific careers were returned this time. Try again or update
                your profile.
              </p>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

// Courses page - GET /courses with search, mode, location filters.
// Note: 'locFilter' is used for the location state variable to avoid shadowing
// the 'useLocation' hook import.
function Courses() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [mode, setMode] = useState("");
  const [locFilter, setLocFilter] = useState("");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  function load(search, modeVal, locationVal) {
    let active = true;
    setStatus("loading");
    setError(null);
    api
      .courses({
        search: search || undefined,
        mode: modeVal || undefined,
        location: locationVal || undefined,
      })
      .then((data) => {
        if (!active) return;
        setItems(unwrapList(data).map(normalizeCourse));
        setStatus("ready");
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        setStatus("error");
      });
    return () => {
      active = false;
    };
  }
  useEffect(() => load(searchParams.get("search") || "", "", ""), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setSearchParams(next.trim() ? { search: next } : {});
    load(next, mode, locFilter);
  }

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">COURSES</div>
            <h1>Browse courses</h1>
            <p>Find courses by keyword, delivery mode or location.</p>
          </div>
        </div>
        <div className="search-bar">
          <Search />
          <input
            aria-label="Search courses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(query)}
            placeholder="Search courses by title or subject"
          />
          <button type="button" onClick={() => runSearch(query)}>
            Search
          </button>
        </div>
        <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
          <select
            aria-label="Delivery mode"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              load(query, e.target.value, locFilter);
            }}
            style={{
              border: "1px solid #dfe4eb",
              borderRadius: 6,
              padding: "7px 9px",
              fontSize: 11,
              background: "#fff",
            }}
          >
            <option value="">All modes</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="hybrid">Hybrid</option>
          </select>
          <input
            aria-label="Location filter"
            value={locFilter}
            onChange={(e) => {
              setLocFilter(e.target.value);
              load(query, mode, e.target.value);
            }}
            placeholder="Filter by location"
            style={{
              border: "1px solid #dfe4eb",
              borderRadius: 6,
              padding: "7px 9px",
              fontSize: 11,
              background: "#fff",
            }}
          />
        </div>
        {status === "loading" && <LoadingState label="Loading courses..." />}
        {status === "error" && (
          <ErrorState
            text={error?.message}
            status={error?.status}
            onRetry={() => load(query, mode, locFilter)}
          />
        )}
        {status === "ready" &&
          (items.length ? (
            <div className="institution-grid">
              {items.map((c) => (
                <Link
                  className="institution-card"
                  to={`/courses/${c.id}`}
                  key={c.id}
                >
                  <div className="institution-image">
                    <GraduationCap size={26} />
                  </div>
                  <span className="tag">
                    {c.course_type || c.mode || "Course"}
                  </span>
                  <h2>{c.title}</h2>
                  {c.institution_name && (
                    <p>
                      <Building2 size={14} />
                      {c.institution_name}
                    </p>
                  )}
                  <span className="muted">
                    {c.duration || c.locFilter || ""}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No courses matched"
              text="Try a different search or filter."
              action="Clear"
              onAction={() => {
                setQuery("");
                setMode("");
                setLocFilter("");
                load("", "", "");
              }}
            />
          ))}
        <div className="source-note learn-note">
          <ShieldCheck size={15} />
          <span>
            Confirm curriculum, fees, eligibility and recognition directly with
            the institution.
          </span>
        </div>
      </div>
    </AppShell>
  );
}

// Course detail page
function CourseDetail() {
  const params = useParams();
  const id = params.id || "";
  const [course, setCourse] = useState(null);
  const [eligibility, setEligibility] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    Promise.allSettled([api.course(id), api.courseEligibility(id)]).then(
      ([cRes, eRes]) => {
        if (!active) return;
        if (cRes.status === "rejected") {
          setError(cRes.reason);
          setStatus(cRes.reason?.status === 404 ? "notfound" : "error");
          return;
        }
        setCourse(normalizeCourse(unwrapObject(cRes.value)));
        setEligibility(
          eRes.status === "fulfilled" ? unwrapList(eRes.value) : [],
        );
        setStatus("ready");
      },
    );
    return () => {
      active = false;
    };
  }, [id]);

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading course..." />
      </AppShell>
    );
  if (status === "notfound") return <NotFound />;
  if (status === "error" || !course)
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="detail-page">
        <div className="breadcrumbs">
          <Link to="/courses">Courses</Link>
          <span>/</span>
          <b>{course.title}</b>
        </div>
        <div className="detail-hero">
          <div className="detail-image">
            <GraduationCap size={42} />
          </div>
          <div className="detail-title">
            {course.course_type && (
              <div className="tag">{course.course_type}</div>
            )}
            <h1>{course.title}</h1>
            {course.institution_name && (
              <p>
                <Building2 size={14} /> {course.institution_name}
              </p>
            )}
            <div className="detail-meta">
              {course.mode && <span>{course.mode}</span>}
              {course.location && (
                <span>
                  <MapPin size={15} />
                  {course.location}
                </span>
              )}
              {course.duration && <span>{course.duration}</span>}
              {course.fees && <span>{course.fees}</span>}
            </div>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            {eligibility.length > 0 && (
              <section className="panel detail-panel">
                <h2>Eligibility rules</h2>
                {eligibility.map((e, i) => (
                  <div className="requirement" key={e.id ?? i}>
                    <div className="req-icon unknown">
                      <CircleHelp size={15} />
                    </div>
                    <div>
                      <b>{e.rule_type}</b>
                      <span>{JSON.stringify(e.rule_data)}</span>
                    </div>
                  </div>
                ))}
              </section>
            )}
            {eligibility.length === 0 && (
              <section className="panel detail-panel">
                <h2>Eligibility</h2>
                <p className="muted">
                  No structured eligibility rules have been published for this
                  course yet.
                </p>
              </section>
            )}
          </div>
          <aside className="eligibility-card">
            <div className="eligibility-icon">
              <GraduationCap />
            </div>
            <h2>More options</h2>
            <p>
              Find similar courses or view what careers this qualification
              supports.
            </p>
            <Link className="btn outline full" to="/courses">
              Browse all courses <ArrowRight size={15} />
            </Link>
            <Link
              className="btn outline full"
              style={{ marginTop: 8 }}
              to="/careers"
            >
              Explore careers <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Saved() {
  const { user } = useAuth();
  const [savedCareers, setSavedCareers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      if (active) {
        setStatus("ready");
        setSavedCareers([]);
      }
      return;
    }

    const key = `careergps_saved_careers_${user.id}`;
    let savedIds = [];
    try {
      savedIds = JSON.parse(localStorage.getItem(key) || "[]");
    } catch { }

    if (savedIds.length === 0) {
      if (active) {
        setStatus("ready");
        setSavedCareers([]);
      }
      return;
    }

    setStatus("loading");
    Promise.allSettled(savedIds.map(async (id) => {
      if (id.startsWith("rec_")) {
        const parts = id.split("_");
        const recId = parts[1];
        const title = decodeURIComponent(parts.slice(2).join("_"));
        const data = await api.recommendation(recId);
        const rec = unwrapObject(data);
        const item = rec.results.find(x => x.title === title);
        if (!item) throw { status: 404 };
        return {
          data: {
            id,
            title: item.title,
            description: item.reasoning,
            origin: 'ai_generated',
            skills: item.missingSkills ? item.missingSkills.map(s => ({ name: s.skill || s.name || s, importance: 'recommended' })) : []
          }
        };
      }
      return api.career(id).catch(err => {
        if (err?.status === 404) return api.aiCareer(id);
        throw err;
      });
    }))
      .then((results) => {
        if (!active) return;
        const validCareers = [];
        let staleIds = [];
        results.forEach((res, i) => {
          const id = savedIds[i];
          if (res.status === "fulfilled") {
            validCareers.push(normalizeCareer(unwrapObject(res.value)));
          } else if (res.reason?.status === 404) {
            staleIds.push(id);
          }
        });
        if (staleIds.length > 0) {
          try {
            const currentIds = JSON.parse(localStorage.getItem(key) || "[]");
            const nextIds = currentIds.filter((cid) => !staleIds.includes(cid));
            localStorage.setItem(key, JSON.stringify(nextIds));
          } catch { }
        }
        setSavedCareers(validCareers);
        setStatus("ready");
      })
      .catch((err) => {
        if (active) {
          setError(err);
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [user]);

  function removeCareer(id) {
    if (!user) return;
    const key = `careergps_saved_careers_${user.id}`;
    try {
      const currentIds = JSON.parse(localStorage.getItem(key) || "[]");
      const nextIds = currentIds.filter((cid) => cid !== id);
      localStorage.setItem(key, JSON.stringify(nextIds));
      setSavedCareers((prev) => prev.filter((c) => c.id !== id));
    } catch { }
  }

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading saved careers..." layout="grid" />
      </AppShell>
    );
  if (status === "error")
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="listing-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">SAVED</div>
            <h1>Saved careers</h1>
            <p>Keep career options and pathways you want to revisit.</p>
          </div>
        </div>
        {!user ? (
          <div className="empty-state">
            <Bookmark size={24} />
            <h2>Log in to save careers</h2>
            <p>
              Your saved careers are stored on your device and linked to your
              account.
            </p>
            <Link className="btn primary" to="/login">
              Log in <ArrowRight size={15} />
            </Link>
          </div>
        ) : savedCareers.length === 0 ? (
          <div className="empty-state">
            <Bookmark size={24} />
            <h2>No saved careers yet.</h2>
            <p>Explore career guides and save careers you want to revisit.</p>
            <Link className="btn outline" to="/careers">
              Explore careers <ArrowRight size={15} />
            </Link>
          </div>
        ) : (
          <>
            <div
              style={{
                width: "100%",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {savedCareers.map((c) => (
                <div
                  className="panel"
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      flex: 1,
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: "var(--surface)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--primary)",
                      }}
                    >
                      <BriefcaseBusiness size={24} />
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 4px 0", fontSize: 16 }}>
                        {c.title}{" "}
                        {c.verificationStatus === "verified" && (
                          <ShieldCheck
                            size={14}
                            style={{
                              color: "var(--primary)",
                              verticalAlign: "middle",
                            }}
                            title="Verified information"
                          />
                        )}
                      </h3>
                      <p
                        style={{
                          margin: 0,
                          color: "var(--muted)",
                          fontSize: 13,
                        }}
                      >
                        {c.description}
                      </p>
                      {(c.keyInformation?.typicalQualification || (c.qualifications && c.qualifications[0])) && (
                        <p
                          style={{
                            margin: "4px 0 0 0",
                            fontSize: 12,
                            color: "var(--muted)",
                          }}
                        >
                          Typical qualification: {c.keyInformation?.typicalQualification || c.qualifications[0]}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: 12, alignItems: "center" }}
                  >
                    <button
                      className="btn outline"
                      onClick={() => removeCareer(c.id)}
                    >
                      Remove
                    </button>
                    <Link className="btn primary" to={`/careers/${c.id}`}>
                      View career
                    </Link>
                  </div>
                </div>
              ))}
            </div>
            <p
              className="muted"
              style={{ fontSize: 12, textAlign: "center", marginTop: 32 }}
            >
              Saved careers are stored on this device.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://careergpsgoa.in";
const BRAND = "NaviGoa";
const DEFAULT_DESCRIPTION =
  "NaviGoa helps people in Goa explore careers, understand requirements, find learning pathways and discover opportunities using structured, source-backed career information.";

function Seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  breadcrumbs = [],
  type = "website",
}) {
  useEffect(() => {
    const canonical = new URL(path, SITE_URL).href;
    document.title = title;
    const setMeta = (name, content, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) {
        el = document.createElement("meta");
        el.setAttribute(attr, name);
        document.head.appendChild(el);
      }
      el.setAttribute("content", content);
    };
    setMeta("description", description);
    const privatePath = [
      "/signup",
      "/login",
      "/onboarding",
      "/dashboard",
      "/profile",
      "/saved",
      "/eligibility",
      "/pathway",
    ].includes(path);
    setMeta(
      "robots",
      privatePath
        ? "noindex,nofollow"
        : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
    );
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:url", canonical, true);
    setMeta("og:type", type, true);
    setMeta("og:site_name", BRAND, true);
    setMeta("og:image", new URL("/og-image.jpg", SITE_URL).href, true);
    setMeta(
      "og:image:alt",
      "NaviGoa logo with the Navigate, Build, Grow tagline",
      true,
    );
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", new URL("/og-image.jpg", SITE_URL).href);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;

    const graph = [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: BRAND,
        url: SITE_URL,
        logo: new URL("/navigoa-logo.jpg", SITE_URL).href,
        areaServed: { "@type": "AdministrativeArea", name: "Goa, India" },
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: BRAND,
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    ];
    if (breadcrumbs.length) {
      graph.push({
        "@type": "BreadcrumbList",
        itemListElement: breadcrumbs.map((item, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: item.name,
          item: new URL(item.path, SITE_URL).href,
        })),
      });
    }
    let ld = document.head.querySelector('script[data-seo-ld="true"]');
    if (!ld) {
      ld = document.createElement("script");
      ld.type = "application/ld+json";
      ld.dataset.seoLd = "true";
      document.head.appendChild(ld);
    }
    ld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": graph,
    });
  }, [title, description, path, JSON.stringify(breadcrumbs), type]);
  return null;
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <Logo />
        <p>Explore, plan, learn and grow with Goa-first career intelligence.</p>
      </div>
      <div className="footer-links">
        <div>
          <b>Explore</b>
          <Link to="/careers">Careers</Link>
          <Link to="/opportunities">Opportunities</Link>
        </div>
        <div>
          <b>Learn</b>
          <Link to="/institutions">Institutions</Link>
          <Link to="/learn">Learning</Link>
          <Link to="/pathway">Career pathways</Link>
        </div>
        <div>
          <b>Account</b>
          <Link to="/signup">Create account</Link>
          <Link to="/login">Log in</Link>
        </div>
      </div>
    </footer>
  );
}

function SeoRouter() {
  const location = useLocation();
  const path = location.pathname;
  // Career/opportunity/institution detail pages set their own <Seo/> once
  // real data has loaded, since titles/descriptions come from the backend.
  const isDetailPage = /^\/(careers|opportunities|institutions)\/[^/]+$/.test(
    path,
  );
  if (isDetailPage) return null;
  const data = {
    "/": {
      title: "NaviGoa | Navigate, Build, Grow in Goa",
      description: DEFAULT_DESCRIPTION,
      path: "/",
    },
    "/signup": {
      title: "Create Your NaviGoa Account | Goa Career Platform",
      description:
        "Create a NaviGoa account to build your profile and explore career pathways, skills and opportunities.",
      path,
    },
    "/login": {
      title: "Log In | NaviGoa",
      description:
        "Log in to your NaviGoa account and continue your career pathway.",
      path,
    },
    "/onboarding": {
      title: "Set Up Your Career Profile | NaviGoa",
      description:
        "Set up your education, skills, interests and career preferences for a personalized NaviGoa experience.",
      path,
    },
    "/dashboard": {
      title: "Career Dashboard | NaviGoa",
      description:
        "Review your career goal, pathway progress, saved careers and recommended next steps.",
      path,
    },
    "/careers": {
      title: "Explore Careers in Goa | NaviGoa",
      description:
        "Search careers by keyword, then explore pathways, skills and requirements.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Careers", path: "/careers" },
      ],
    },
    "/skill-gap": {
      title: "Skill Gap Check | NaviGoa",
      description:
        "Compare your saved skills profile with what a career typically requires.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Careers", path: "/careers" },
        { name: "Skill gap", path },
      ],
    },
    "/eligibility": {
      title: "Opportunity Eligibility Check | NaviGoa",
      description:
        "Compare your profile with an opportunity's structured requirements and identify items that need verification.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Opportunities", path: "/opportunities" },
        { name: "Eligibility", path },
      ],
    },
    "/pathway": {
      title: "Personal Career Pathway | NaviGoa",
      description:
        "Follow a step-by-step learning and experience pathway toward a target career.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "My Plan", path },
      ],
    },
    "/opportunities": {
      title: "Jobs, Internships & Programmes in Goa | NaviGoa",
      description:
        "Explore career opportunities and review requirements and source information before applying.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Opportunities", path },
      ],
    },
    "/institutions": {
      title: "Institutions & Courses in Goa | NaviGoa",
      description:
        "Explore institutions and courses that can help close career skill and qualification gaps.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Institutions", path },
      ],
    },
    "/learn": {
      title: "Learning Resources & Courses | NaviGoa",
      description:
        "Find learning options connected to career pathways and skill development.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Learn", path },
      ],
    },
    "/profile": {
      title: "Career Profile | NaviGoa",
      description:
        "Manage your education, skills, interests and career preferences.",
      path,
    },
    "/saved": {
      title: "Saved Careers | NaviGoa",
      description:
        "Review careers you saved for later and continue exploring their pathways.",
      path,
    },
    "/projects": {
      title: "Projects & Portfolio Studio | NaviGoa",
      description:
        "Apply your pathway learning to real-world deliverables, build verified project evidence, and showcase your portfolio.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Projects & Studio", path },
      ],
    },
  }[path] || {
    title: "Page Not Found | NaviGoa",
    description: "The NaviGoa page you requested could not be found.",
    path,
    breadcrumbs: [{ name: "Home", path: "/" }],
  };
  return <Seo {...data} />;
}

function NotFound() {
  return (
    <div className="not-found">
      <Logo />
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>We couldn't find that page.</h1>
        <p>The page may have moved or the address may be incorrect.</p>
        <div className="not-found-actions">
          <Link className="btn primary" to="/">
            Go to NaviGoa home <ArrowRight size={16} />
          </Link>
          <Link className="btn outline" to="/careers">
            Explore careers
          </Link>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <SeoRouter />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/careers/:id" element={<CareerDetail />} />
          <Route path="/skill-gap" element={<ProtectedRoute><SkillGap /></ProtectedRoute>} />
          <Route path="/eligibility" element={<ProtectedRoute><Eligibility /></ProtectedRoute>} />
          <Route path="/pathway" element={<ProtectedRoute><Pathway /></ProtectedRoute>} />
          <Route path="/opportunities" element={<Opportunities />} />
          <Route path="/opportunities/:id" element={<OpportunityDetail />} />
          <Route path="/institutions" element={<Institutions />} />
          <Route path="/institutions/:id" element={<InstitutionDetail />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/courses/:id" element={<CourseDetail />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><Saved /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsStudio /></ProtectedRoute>} />
          <Route path="/portfolio/p/:shareSlug" element={<PublicPortfolioPage />} />
          <Route path="/recommendations" element={<ProtectedRoute><RecommendationsPage /></ProtectedRoute>} />
          <Route path="/assistant" element={<ProtectedRoute><AssistantPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
