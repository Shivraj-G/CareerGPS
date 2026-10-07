import React, { useEffect, useState, useMemo, useRef } from "react";
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
} from "lucide-react";
import { api, getToken, setToken, clearToken } from "./api/client.js";
import "./styles.css";

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
  return {
    id: c.ai_career_id ?? c.id ?? "",
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

function normalizeOpportunity(o) {
  return {
    id: o.id ?? "",
    title: o.title ?? "Untitled opportunity",
    status: o.status ?? "unknown",
    type: o.opportunity_type ?? "",
    org: o.organization ?? "",
    location: o.location ?? "",
    deadline: o.application_deadline
      ? new Date(o.application_deadline).toLocaleDateString()
      : "Not specified",
    deadlineDate: o.application_deadline
      ? new Date(o.application_deadline)
      : null,
    vacancies: o.vacancies_total ?? null,
    description: o.description ?? "",
    advertisementNumber: o.advertisement_number ?? null,
    sourceUrl: o.source_url ?? null,
    verificationStatus: o.verification_status ?? "needs_review",
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
          {text} Everything else in CareerGPS (career search, pathways,
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
      console.debug("[CareerGPS Assistant]", {
        conversationId: data.conversation_id,
        requestStatus: "success",
      });
      setConversationId(data.conversation_id);
      setMessages((m) => [...m, data.message]);
      loadConversations();
    } catch (err) {
      console.debug("[CareerGPS Assistant]", {
        conversationId,
        requestStatus: "error",
        responseStatus: err.status || "network",
      });
      let msg = "Unable to connect to the CareerGPS backend.";
      if (err.status === 401)
        msg = "Your session has expired. Please log in again.";
      else if (err.status === 403)
        msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429)
        msg = "Too many requests. Please try again shortly.";
      else if (err.status >= 500)
        msg = "CareerGPS couldn't process that request. Please try again.";
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
              <b>CareerGPS Assistant</b>
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
                      Goa. Answers are grounded in CareerGPS's own data - if
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
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Ask something..."
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
    ["/saved", "Saved Careers", Bookmark],
    ["/opportunities", "Opportunities", BriefcaseBusiness],
    ["/profile", "Profile", UserCog],
  ];
  const publicPage = ["/", "/signup", "/login", "/onboarding"].includes(
    location.pathname,
  );

  if (publicPage) return <>{children}</>;

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
              {(getLocalName(user?.id) || user?.email || "?")
                .charAt(0)
                .toUpperCase()}
            </div>
            <div>
              <strong>
                {getLocalName(user?.id) || user?.email || "Guest"}
              </strong>
              <span>{user?.role || "Log out"}</span>
            </div>
            <LogOut size={16} color="var(--muted)" />
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobile((v) => !v)}>
            {mobile ? <X /> : <Menu />}
          </button>
          <div className="top-links">
            <Link to="/careers">Careers</Link>
            <Link to="/learn">Learn</Link>
            <Link to="/institutions">Institutions</Link>
            <Link to="/opportunities">Opportunities</Link>
          </div>
          <div className="top-actions">
            <button className="icon-btn">
              <Bell size={18} />
            </button>
            <Link 
              to="/profile" 
              className="avatar small" 
              aria-label="Open profile"
              style={{ textDecoration: 'none', cursor: 'pointer' }}
            >
              {(getLocalName(user?.id) || user?.email || "?")
                .charAt(0)
                .toUpperCase()}
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
        src="/careergps-logo.jpg"
        alt="CareerGPS — Explore, Plan, Learn, Grow"
      />
    </div>
  );
}

function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav className="landing-links" aria-label="Primary navigation">
          <Link to="/careers">Careers</Link>
          <Link to="/learn">Learn</Link>
          <Link to="/institutions">Institutions</Link>
          <Link to="/opportunities">Opportunities</Link>
        </nav>
        <div className="landing-auth">
          <Link to="/login">Login</Link>
          <Link className="btn primary small" to="/signup">
            Sign Up
          </Link>
        </div>
      </header>
      <section className="hero">
        <img
          className="hero-goa-image"
          src="/goa-hero.jpg"
          alt="Goa coastline with palm trees and Arabian Sea"
        />
        <div className="hero-overlay" />
        <div className="hero-content">
          <div className="eyebrow">
            <Sparkles size={14} /> Career discovery, built for Goa
          </div>
          <h1>
            Where can your
            <br />
            <span>career go next?</span>
          </h1>
          <p>
            Discover real opportunities based on where you are today — and what
            you want to achieve.
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
            <p>Review sourced openings when they are available to CareerGPS.</p>
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
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // /auth/register only accepts { email, password, role? } - "name" is an
      // unrecognized key and would fail backend validation, so it's kept out
      // of the request body and stored locally for display purposes only.
      const res = await api.register({
        email: form.email,
        password: form.password,
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
      setError(
        err.message || "Could not create your account. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo />
      </div>
      <div className="auth-card">
        <div className="auth-heading">
          <div className="auth-icon">
            <Compass />
          </div>
          <h1>Create your account</h1>
          <p>Start your career journey</p>
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
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <div className="password">
              <input
                required
                type={show ? "text" : "password"}
                placeholder="Create a password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button type="button" onClick={() => setShow((v) => !v)}>
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          {error && (
            <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }}>
              {error}
            </p>
          )}
          <button
            className="btn primary full"
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
    </div>
  );
}

function Login() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
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
      navigate("/dashboard");
    } catch (err) {
      setError(
        err.status === 401
          ? "Incorrect email or password."
          : err.message || "Login failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <Logo />
      </div>
      <div className="auth-card">
        <div className="auth-heading">
          <div className="auth-icon">
            <LockKeyhole />
          </div>
          <h1>Welcome back</h1>
          <p>Continue your CareerGPS journey</p>
        </div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              required
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label>
            Password
            <input
              required
              type="password"
              placeholder="Your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          {error && (
            <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }}>
              {error}
            </p>
          )}
          <button
            className="btn primary full"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="auth-footer">
          New to CareerGPS? <Link to="/signup">Create an account</Link>
        </p>
      </div>
    </div>
  );
}

function Onboarding() {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    status: "College Student",
    educationStage: "Currently in 12th",
    stream: "",
    degree: "",
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
    careerGoalReason: "",
    studyPreference: "Online / Part-time",
  });

  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [showValidationPopup, setShowValidationPopup] = useState(false);
  const [missingFields, setMissingFields] = useState([]);

  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

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

  function validateStep(currentStep) {
    const missing = [];
    if (currentStep === 1) {
      if (!form.status) missing.push("Status");
      if (!form.location) missing.push("Location");
    } else if (currentStep === 2) {
      if (!form.educationStage) missing.push("Education stage");
      if (form.educationStage === "Currently in 12th" && !form.stream) missing.push("12th Stream");
      if (form.educationStage === "Higher Education") {
        if (!form.stream) missing.push("12th Stream");
        if (!form.degree) missing.push("Current Education");
        if (!form.educationStatus) missing.push("Status");
      }
      if (form.educationStage === "Working Professional") {
        if (!form.industry) missing.push("Industry / Field");
        if (!form.currentRole) missing.push("Current role");
        if (!form.professionalExperience) missing.push("Years of experience");
      }
    } else if (currentStep === 3) {
      if (!form.skills || form.skills.length === 0) missing.push("Skills");
    } else if (currentStep === 4) {
      if (!form.preferredLocation) missing.push("Preferred location");
      if (!form.studyPreference) missing.push("Study preference");
      if (!form.careerGoal || !form.careerGoal.trim()) missing.push("Career goal");
    }
    return missing;
  }

  const steps = [
    "Basic Information",
    "Education / Experience",
    "Skills & Interests",
    "Location & Preferences",
    "Complete",
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

      const edu = Array.isArray(p.education) && p.education.length ? p.education[0] : {};

      let eduStage = "Higher Education";
      if (edu.education_stage === "SCHOOL_12" || edu.level === "12th / Higher Secondary" || edu.level === "12th") {
        eduStage = "Currently in 12th";
      } else if (edu.education_stage === "WORKING_PROFESSIONAL" || edu.level === "Working Professional") {
        eduStage = "Working Professional";
      } else if (!edu.education_stage && !edu.level && !edu.degree) {
        eduStage = "Currently in 12th";
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
        educationStage: eduStage,
        stream: edu.school_12_stream || edu.stream || "",
        degree: edu.current_program || edu.degree || "",
        specialization: edu.specialization || "",
        diplomaField: edu.diplomaField || "",
        currentYear: edu.year ? String(edu.year) : "",
        educationStatus: edu.status ? (edu.status.charAt(0).toUpperCase() + edu.status.slice(1)) : "Pursuing",
        experience: exp,
        industry: ind,
        currentRole: role,
        professionalExperience: profExp,
        preferredLocation: loc,
        careerGoal: p.career_goal || "",
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
      .skills()
      .then((res) => {
        setAllSkills(unwrapList(res));
      })
      .catch((err) => {
        setSkillsError(err.message || "Could not load skills from the server.");
      })
      .finally(() => setSkillsLoading(false));
  }

  function handleStepForward() {
    const missing = validateStep(step);
    if (missing.length > 0) {
      setMissingFields(missing);
      setShowValidationPopup(true);
      return;
    }
    if (step === 2) loadSkills();
    setStep((s) => s + 1);
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

    setForm((f) => {
      const already = f.skills.some((s) => s.skill_id === skillId);
      return {
        ...f,
        skills: already
          ? f.skills.filter((s) => s.skill_id !== skillId)
          : [
            ...f.skills,
            { skill_id: skillId, name: skillName, level: "beginner", is_custom: isCustom },
          ],
      };
    });
  }

  function handleEducationStageChange(e) {
    const newStage = e.target.value;
    const isPro = newStage === "Working Professional";
    const wasPro = form.educationStage === "Working Professional";

    const updates = { educationStage: newStage };

    if (isPro && !wasPro) {
      // Clear student fields
      updates.stream = "";
      updates.degree = "";
      updates.specialization = "";
      updates.diplomaField = "";
      updates.currentYear = "";
      updates.experience = "";
    } else if (!isPro && wasPro) {
      // Clear pro fields
      updates.industry = "";
      updates.currentRole = "";
      updates.professionalExperience = "";
    }

    setForm({ ...form, ...updates });
  }

  function getCleanedEducation() {
    const edu = {};
    if (form.educationStage === "Currently in 12th") {
      edu.education_stage = "SCHOOL_12";
      edu.school_12_status = "PURSUING";
      if (form.stream) {
        edu.school_12_stream = form.stream;
        edu.stream = form.stream;
      }
      edu.status = "pursuing";
      edu.level = "12th / Higher Secondary"; // legacy fallback
    } else if (form.educationStage === "Higher Education") {
      edu.education_stage = "HIGHER_EDUCATION";
      if (form.stream) {
        edu.school_12_stream = form.stream;
        edu.stream = form.stream;
      }
      if (form.degree) {
        edu.current_program = form.degree;
        edu.degree = form.degree;
      }
      if (form.specialization) edu.specialization = form.specialization;
      if (form.currentYear && !isNaN(parseInt(form.currentYear))) {
        edu.year = parseInt(form.currentYear);
      }
      edu.status = (form.educationStatus || "pursuing").toLowerCase();
      edu.level = "Undergraduate"; // legacy fallback
    } else {
      edu.education_stage = "WORKING_PROFESSIONAL";
      edu.level = "Working Professional"; // legacy fallback
    }
    return [edu];
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

  const [lastValidatedGoal, setLastValidatedGoal] = useState("");

  const currentProfileContext = JSON.stringify({
    education: getCleanedEducation(),
    experience: getCleanedExperience(),
    skills: form.skills ? form.skills.filter((s) => !s.is_custom).map((s) => ({ skill_id: s.skill_id || s.id })) : []
  });

  useEffect(() => {
    if (step !== 4 || !form.careerGoal.trim()) {
      if (validationData) setValidationData(null);
      return;
    }
    const validationKey = `${form.careerGoal}::${currentProfileContext}`;
    if (validationKey === lastValidatedGoal) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsValidating(true);
      setValidationData(null);
      setError("");
      try {
        const valRes = await api.validateGoal(
          { goal: form.careerGoal, profileContext: JSON.parse(currentProfileContext) },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setValidationData(unwrapObject(valRes));
          setLastValidatedGoal(validationKey);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'TIMEOUT') return;
        console.error("Live validation failed", err);
      } finally {
        if (!controller.signal.aborted) setIsValidating(false);
      }
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form.careerGoal, step, lastValidatedGoal, currentProfileContext, validationData]);

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

    if (!form.careerGoal.trim()) {
      return finish();
    }
    const validationKey = `${form.careerGoal}::${currentProfileContext}`;
    if (validationData && lastValidatedGoal === validationKey) {
      if (['RED', 'INVALID_GOAL'].includes(validationData.classification)) return;
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
      setLastValidatedGoal(validationKey);
      if (data.classification !== 'RED') {
        return finish();
      }
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
          skill_id: s.skill_id,
          level: s.level || "beginner",
        })),
      });
      await api.updateProfile({
        education: getCleanedEducation(),
        experience: getCleanedExperience(),
        interests: [],
        preferred_locations: parseLocations(form.preferredLocation),
        career_goal: validationData?.goal || form.careerGoal || null,
        career_id: validationData?.career_id || null,
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
                      ? "What are you good at?"
                      : "Where do you want to build your career?"}
              </h1>
              <p className="muted">
                This helps us show you relevant career options.
              </p>

              {step === 1 && (
                <div className="form-stack">
                  <label>
                    I am a
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value })}
                    >
                      <option>College Student</option>
                      <option>Working Professional</option>
                      <option>Recent Graduate</option>
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
                  <label>
                    What best describes you?
                    <select
                      value={form.educationStage}
                      onChange={handleEducationStageChange}
                    >
                      <option>Currently in 12th</option>
                      <option>Higher Education</option>
                      <option>Working Professional</option>
                    </select>
                  </label>

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
                          <option>Science</option>
                          <option>Science — PCM</option>
                          <option>Science — PCB</option>
                          <option>Science — PCMB</option>
                          <option>Commerce</option>
                          <option>Arts / Humanities</option>
                          <option>Vocational</option>
                        </select>
                      </label>

                      {form.educationStage === "Higher Education" && (
                        <>
                          <label>
                            Current Education / Program
                            {programsLoading ? (
                              <div style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>Loading programs...</div>
                            ) : (
                              <select
                                value={form.degree}
                                onChange={(e) => setForm({ ...form, degree: e.target.value })}
                              >
                                <option value="">Select Program</option>
                                {availablePrograms.map(p => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                                {availablePrograms.length === 0 && !form.stream && (
                                  <option disabled>Select 12th Stream first</option>
                                )}
                                {availablePrograms.length === 0 && form.stream && (
                                  <option disabled>No eligible bachelor's programs found for the selected subjects.</option>
                                )}
                              </select>
                            )}
                          </label>

                          <label>
                            Status
                            <select
                              value={form.educationStatus}
                              onChange={(e) => setForm({ ...form, educationStatus: e.target.value })}
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

              {step === 3 &&
                (skillsLoading ? (
                  <LoadingState label="Loading skills from CareerGPS..." />
                ) : skillsError ? (
                  <div className="empty-state">
                    <CircleHelp size={20} />
                    <h2>Could not load skills</h2>
                    <p>{skillsError}</p>
                    <button className="btn outline" onClick={loadSkills}>
                      Try again
                    </button>
                  </div>
                ) : allSkills.length === 0 ? (
                  <p className="muted">
                    No skills are published in the CareerGPS database yet. You
                    can add skills from the Profile page after setup.
                  </p>
                ) : (
                  <SkillPicker
                    userSkillIds={new Set(form.skills.map(s => s.skill_id || s.id))}
                    selectedSkills={form.skills.map(s => ({ id: s.skill_id, name: s.name }))}
                    toggleSkill={toggleSkill}
                    careerGoal={form.careerGoal}
                    educationContext={[form.educationStage, form.stream, form.degree, form.specialization, form.industry, form.currentRole].filter(Boolean).join(' ')}
                  />
                ))}

              {step === 4 && (
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
                        placeholder="e.g. Backend Developer"
                      />
                    </label>

                    {isValidating && (
                      <div style={{ padding: "16px 0", textAlign: "center" }}>
                        <span style={{ fontSize: 14, color: "var(--brand)" }}>Checking your career goal...</span>
                      </div>
                    )}
                    {validationData && (
                      <div className="validation-result-card" style={{
                        marginTop: 12,
                        padding: 16,
                        borderRadius: 8,
                        border: `1px solid ${['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'var(--red)' : validationData.classification === 'YELLOW' ? '#eab308' : validationData.classification === 'GREEN' ? 'var(--green)' : 'var(--text-muted)'}`,
                        background: ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'rgba(255,0,0,0.05)' : validationData.classification === 'YELLOW' ? 'rgba(234,179,8,0.05)' : validationData.classification === 'GREEN' ? 'rgba(0,128,0,0.05)' : 'rgba(0,0,0,0.05)'
                      }}>
                        <h4 style={{
                          marginBottom: 8,
                          display: 'flex', alignItems: 'center', gap: 6,
                          color: ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'var(--red)' : validationData.classification === 'YELLOW' ? '#ca8a04' : validationData.classification === 'GREEN' ? 'var(--green)' : 'var(--text-muted)'
                        }}>
                          {validationData.classification === 'INVALID_GOAL' ? <><XCircle size={18} /> Invalid Goal</> :
                              ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? <><XCircle size={18} /> Career Conflict</> :
                                validationData.classification === 'YELLOW' ? <><CheckCircle size={18} /> Challenging path, but achievable</> :
                                  validationData.classification === 'NOT_FOUND' ? <><HelpCircle size={18} /> Career not found</> :
                                    validationData.classification === 'UNKNOWN' ? <><HelpCircle size={18} /> Career requirements unavailable</> :
                                      <><CheckCircle size={18} /> Highly aligned</>}
                        </h4>

                        <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                          {validationData.classification === 'GREEN' && (
                            <p>{validationData.reason || "Your education provides a strong foundation for this career."}</p>
                          )}
                          {validationData.classification === 'YELLOW' && (
                            <>
                              <p style={{ marginBottom: 12 }}>{validationData.reason || "Your current education is not the standard route, but this career can still be pursued with additional preparation."}</p>
                              {validationData.missing_requirements?.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <strong>Your next steps:</strong>
                                  <ul style={{ marginLeft: 20, marginTop: 4 }}>
                                    {validationData.missing_requirements.map((req, idx) => <li key={`req-${idx}`}>{req}</li>)}
                                    {validationData.skill_gaps?.map((gap, idx) => <li key={`gap-${idx}`}>{gap}</li>)}
                                  </ul>
                                </div>
                              )}
                              {validationData.encouragement && (
                                <p style={{ margin: 0, color: 'var(--brand)', fontWeight: 500 }}>{validationData.encouragement}</p>
                              )}
                            </>
                          )}
                          {validationData.classification === 'INVALID_GOAL' && (
                            <p>{validationData.reason || "Please enter a valid career or occupation."}</p>
                          )}
                          {['RED', 'INVALID_GOAL'].includes(validationData.classification) && (
                            <>
                              <p style={{ marginBottom: 12 }}>{validationData.reason || "Your current educational background does not satisfy the formal prerequisites for this career."}</p>
                              {validationData.formal_barriers?.length > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                  <strong>Required:</strong>
                                  <ul style={{ marginLeft: 20, marginTop: 4 }}>
                                    {validationData.formal_barriers.map((bar, idx) => <li key={`bar-${idx}`}>{bar}</li>)}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}

                          {validationData.classification === 'UNKNOWN' && (
                            <p>This appears to be a recognized career, but we don't have detailed prerequisite rules for it yet. You can still proceed.</p>
                          )}
                          {validationData.classification === 'NOT_FOUND' && (
                            <p>We couldn't find this career in the CareerGPS career catalogue.</p>
                          )}

                          {validationData.classification === 'INVALID_GOAL' && (
                            <p>{validationData.reason || "Please enter a valid career or occupation."}</p>
                          )}
                          {['RED', 'INVALID_GOAL'].includes(validationData.classification) && (
                            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                              <button
                                className="btn outline sm"
                                onClick={() => {
                                  setValidationData(null);
                                  setLastValidatedGoal("");
                                  setForm({ ...form, careerGoal: "" });
                                }}
                              >
                                Change Career Goal
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="form-actions">
                <button
                  className="btn ghost"
                  disabled={step === 1 || isValidating || submitting}
                  onClick={() => {
                    if (validationData && ['RED', 'INVALID_GOAL'].includes(validationData.classification)) {
                      setValidationData(null);
                      setLastValidatedGoal("");
                    } else {
                      setStep((s) => s - 1);
                    }
                  }}
                >
                  <ArrowLeft /> Back
                </button>

                {step === 4 ? (
                  (validationData && ['RED', 'INVALID_GOAL'].includes(validationData.classification)) ? null :
                  (!validationData) ? (
                    <button
                      className="btn primary"
                      disabled={submitting || isValidating}
                      onClick={validateAndFinish}
                    >
                      {submitting ? "Saving..." : "Finish"} <ArrowRight />
                    </button>
                  ) : (
                    <button
                      className="btn primary"
                      disabled={submitting || isValidating}
                      onClick={finish}
                    >
                      {submitting ? "Saving..." : validationData.classification === 'GREEN' ? "Continue" : "Continue with this goal"} <ArrowRight />
                    </button>
                  )
                ) : (
                  <button
                    className="btn primary"
                    disabled={submitting || (step === 3 && skillsLoading) || isValidating}
                    onClick={handleStepForward}
                  >
                    Next <ArrowRight />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="complete-state">
              <div className="success-orb">
                <CheckCircle2 size={42} />
              </div>
              <h1>Your profile is ready.</h1>
              <p>We can now personalize careers, skill gaps and pathways around your goals.</p>
              {error && <p style={{ color: "var(--red)", fontSize: 12, marginTop: 12 }}>{error}</p>}
              <button className="btn primary" style={{ marginTop: 24 }} onClick={() => navigate("/dashboard")}>
                Go to my dashboard <ArrowRight />
              </button>
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
  const [careers, setCareers] = useState([]);
  const [pathwaySummary, setPathwaySummary] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    // BACKEND GAP: there is no GET /dashboard on the backend, so this page
    // is composed from the real endpoints that do exist: the profile (for
    // the career goal) and the public careers list (for "careers to
    // explore"). The pathway summary, if any, comes from the most recently
    // generated pathway id we remembered locally - see setLastPathwayId.
    Promise.allSettled([api.profile(), api.careers({ limit: 3 })]).then(
      ([profileRes, careersRes]) => {
        if (!active) return;
        if (profileRes.status === "fulfilled") {
          const p = unwrapObject(profileRes.value);
          if (p.profile_status !== "complete") {
            navigate("/onboarding", { replace: true });
            return;
          }
          setProfile(p);
        } else {
          setProfile(null);
        }
        setCareers(
          careersRes.status === "fulfilled"
            ? unwrapList(careersRes.value).map(normalizeCareer)
            : [],
        );

        api.userPathways().then((res) => {
          if (!active) return;
          const pathways = unwrapList(res);
          if (pathways.length > 0) {
            const latest = pathways[0];
            api.pathwayProgress(latest.id).then(pRes => {
              if (!active) return;
              const p = unwrapObject(pRes);
              setPathwaySummary({ 
                title: latest.title, 
                careerTitle: latest.career_title, 
                status: p.status, 
                steps: p.steps || [] 
              });
            }).catch(() => { });
          }
        }).catch(() => { });
        setStatus("ready");
      },
    );
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading your dashboard..." />
      </AppShell>
    );

  const goalText = profile?.career_goal;

  return (
    <AppShell>
      <div className="dashboard">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">DASHBOARD</div>
            <h1>
              Hello{" "}
              {(() => {
                const localName = getLocalName(user?.id);
                const displayName =
                  localName || user?.name || user?.full_name || "";
                if (displayName) return displayName.trim().split(/\s+/)[0];
                if (user?.email) {
                  const prefix = user.email.split("@")[0];
                  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
                }
                return "there";
              })()}
            </h1>
            <p>Here's a quick overview of your career journey.</p>
          </div>
          <button className="btn outline" onClick={() => navigate("/profile")}>
            <UserRound size={16} /> Edit Profile
          </button>
        </div>
        {goalText ? (
          <div className="goal-card">
            <div>
              <span className="label">YOUR CURRENT GOAL</span>
              <h2>{goalText}</h2>
              <Link to={`/careers?search=${encodeURIComponent(goalText)}`}>
                Explore matching careers <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="goal-card">
            <div>
              <span className="label">YOUR CURRENT GOAL</span>
              <h2>Not set yet</h2>
              <Link to="/profile">
                Set a career goal <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        )}
        <div className="section-title">
          <h2>Quick actions</h2>
        </div>
        <div className="quick-grid">
          <ActionCard
            icon={Compass}
            title="Explore Careers"
            text="Find careers based on your profile."
            to="/careers"
          />
          <ActionCard
            icon={RouteIcon}
            title="Continue Learning Plan"
            text="See your next steps."
            to="/pathway"
          />
          <ActionCard
            icon={BriefcaseBusiness}
            title="Find Opportunities"
            text="Jobs, exams and training programmes."
            to="/opportunities"
          />
        </div>
        <div className="two-col">
          <div className="panel">
            <div className="panel-head">
              <div>
                <span className="label">YOUR PATHWAY</span>
                <h2>{pathwaySummary?.careerTitle ?? "No pathway yet"}</h2>
                {pathwaySummary?.title && <p style={{margin: '4px 0 16px 0', fontSize: '14px', color: 'var(--muted)'}}>{pathwaySummary.title}</p>}
                {pathwaySummary?.steps && pathwaySummary.steps.length > 0 && (() => {
                  const completed = pathwaySummary.steps.filter(s => s.status === 'completed').length;
                  const total = pathwaySummary.steps.length;
                  const pct = total ? Math.round((completed / total) * 100) : 0;
                  return (
                    <div style={{marginBottom: 16}}>
                      <div style={{display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: 4}}>
                        <span>{completed} of {total} steps completed</span>
                        <span>{pct}%</span>
                      </div>
                      <div style={{height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden'}}>
                        <div style={{height: '100%', background: 'var(--brand)', width: `${pct}%`, transition: 'width 0.3s ease'}}></div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <Link to="/pathway">View all</Link>
            </div>
            {pathwaySummary?.steps?.length ? (
              <div className="mini-path">
                {pathwaySummary.steps.slice(0, 4).map((s, i) => (
                  <div
                    className={`mini-step ${(s.status ?? "not_started").toLowerCase()}`}
                    key={s.id ?? i}
                  >
                    <div className="mini-dot">
                      {s.status === "completed" ? <Check size={13} /> : i + 1}
                    </div>
                    <div>
                      <b>{s.title}</b>
                      <span>{s.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted">
                Generate a pathway from a career guide to see it here.
              </p>
            )}
          </div>
          <div className="panel">
            <div className="panel-head">
              <div>
                <span className="label">EXPLORE CAREERS</span>
                <h2>Careers to explore</h2>
              </div>
              <Link to="/careers">See all</Link>
            </div>
            <div className="rec-list">
              {careers.map((c) => (
                <Link className="rec-item" to={`/careers/${c.id}`} key={c.id}>
                  <div className="career-thumb">
                    <BriefcaseBusiness size={17} />
                  </div>
                  <div>
                    <b>{c.title}</b>
                    <span>
                      {c.description?.slice(0, 60) || "View career guide"}
                    </span>
                  </div>
                  <ArrowRight size={16} />
                </Link>
              ))}
            </div>
          </div>
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
  const [recommendation, setRecommendation] = useState(null); // { id, results }
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
            if (err?.code === 'AI_UNAVAILABLE' || err?.status === 503) {
              setError(new Error("AI generation is currently unavailable. No careers found."));
            } else {
              setError(err);
            }
            setStatus("error");
          }
        } else {
          setCareers(prev => loadPage === 1 ? results : [...prev, ...results]);
          setStatus("ready");
        }
      })
      .catch((err) => {
        if (!active || signal.aborted || err.code === 'CANCELLED') return;
        setError(err);
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
      const res = await api.recommendCareers({});
      const data = unwrapObject(res);
      const rawResults =
        data.results || data.recommendations || data.data || [];
      setRecommendation({
        id: data.recommendation_id || data.id,
        results: Array.isArray(rawResults)
          ? rawResults.map(normalizeRecommendationResult)
          : [],
      });
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--blue)', letterSpacing: '0.08em', marginBottom: 6 }}>RECOMMENDED FOR YOU</div>
                <h2 style={{ fontSize: 22, margin: '0 0 6px 0', letterSpacing: '-0.02em' }}>Based on your profile</h2>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>
                  Career paths matched to your skills, goals, education and preferences.
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

            <div style={{ display: 'grid', gap: 12 }}>
              {recommendation.results.length ? (
                recommendation.results.map((r, i) => (
                  <div key={r.careerId ?? i} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 16, padding: 18, border: '1px solid #eef1f6', borderRadius: 12, background: '#fafbfc', transition: 'transform 0.15s, box-shadow 0.15s' }} onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(30,42,62,0.06)'; e.currentTarget.style.borderColor = '#dce4f2'; }} onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#eef1f6'; }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: '#eef4ff', color: 'var(--blue)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                      <Sparkles size={20} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <h3 style={{ fontSize: 15, margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.title}
                        {!r.careerId && r.source === 'ai_general' && (
                          <span style={{ fontSize: 10, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', background: '#edf4ff', color: 'var(--blue)', borderRadius: 12, fontWeight: 600 }}>
                            <Sparkles size={10} /> AI suggestion
                          </span>
                        )}
                      </h3>
                      {r.reasoning && <p style={{ margin: 0, fontSize: 12, color: '#475467', lineHeight: 1.5 }}>{r.reasoning}</p>}
                      {r.missingSkills?.length > 0 && (
                        <p style={{ margin: '7px 0 0 0', fontSize: 11, color: '#6b7280' }}>
                          <span style={{ fontWeight: 600 }}>Missing skills:</span> {r.missingSkills.map((s) => s.skill ?? s.name ?? s).join(", ")}
                        </p>
                      )}
                    </div>
                    {r.careerId ? (
                      <Link className="btn outline small" to={`/careers/${r.careerId}`} style={{ flex: 'none', background: '#fff' }}>
                        View <ArrowRight size={14} />
                      </Link>
                    ) : r.aiCareerId ? (
                      <Link className="btn outline small" to={`/careers/${r.aiCareerId}?type=ai_profile`} style={{ flex: 'none', background: '#fff' }}>
                        View <ArrowRight size={14} />
                      </Link>
                    ) : (
                      <Link className="btn outline small" to={`/careers/rec_${recommendation.id}_${encodeURIComponent(r.title)}`} style={{ flex: 'none', background: '#fff' }}>
                        View <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                ))
              ) : (
                <div style={{ padding: '32px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 12, border: '1px dashed #dce2eb' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: 600, color: '#1e293b' }}>Your personalized recommendations are not available yet.</p>
                  <p style={{ margin: '0 0 20px 0', fontSize: 13, color: 'var(--muted)' }}>Complete or update your profile to help us find career paths that match your goals and skills.</p>
                  <Link to="/profile" className="btn outline">Update profile</Link>
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
                onRetry={() => load(query, page)}
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
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const id =
    params.id || location.pathname.split("/").filter(Boolean).pop() || "";
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get("type");
  const [c, setC] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [tab, setTab] = useState("overview");
  const [tabData, setTabData] = useState({});
  const [tabStatus, setTabStatus] = useState("idle");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || !id) return;
    const key = `careergps_saved_careers_${user.id}`;
    try {
      const savedIds = JSON.parse(localStorage.getItem(key) || "[]");
      setSaved(savedIds.includes(id));
    } catch { }
  }, [id, user]);

  function toggleSave() {
    if (!user) {
      alert("Please log in to save careers.");
      return;
    }
    const key = `careergps_saved_careers_${user.id}`;
    let savedIds = [];
    try {
      savedIds = JSON.parse(localStorage.getItem(key) || "[]");
    } catch { }
    let nextIds;
    if (saved) {
      nextIds = savedIds.filter((savedId) => savedId !== id);
    } else {
      nextIds = Array.from(new Set([...savedIds, id]));
    }
    localStorage.setItem(key, JSON.stringify(nextIds));
    setSaved(!saved);
  }

  useEffect(() => {
    let active = true;
    setStatus("loading");
    let fetcher;
    if (id.startsWith("rec_")) {
      const parts = id.split("_");
      const recId = parts[1];
      const title = decodeURIComponent(parts.slice(2).join("_"));

      fetcher = api.exploreCareer({ query: title }).then(explored => {
        const res = unwrapObject(explored);
        const realId = res.ai_career_id || res.id;
        if (realId) {
          const realType = res.ai_career_id ? 'ai_profile' : 'catalogue';
          if (active) {
            navigate(`/careers/${realId}?type=${realType}`, { replace: true });
            return new Promise(() => { }); // never resolves, component unmounts
          }
        }
        throw { status: 404, message: "Could not generate AI career profile." };
      }).catch((err) => {
        console.error("Explore failed, falling back to dummy recommendation", err);
        return api.recommendation(recId).then(data => {
          const rec = unwrapObject(data);
          const item = rec.results.find(x => x.title === title);
          if (!item) throw { status: 404, message: "Recommendation not found" };
          return {
            data: {
              id,
              title: item.title,
              description: item.reasoning,
              responsibilities: [],
              qualifications: [],
              entry_routes: [],
              skills: item.missingSkills ? item.missingSkills.map(s => ({
                name: s.skill || s.name || s,
                importance: 'recommended'
              })) : [],
              origin: 'ai_generated',
              verification_status: 'unverified'
            }
          };
        });
      });
    } else {
      fetcher = type === 'ai_profile' ? api.aiCareer(id) : api.career(id);
    }

    fetcher
      .then((data) => {
        if (!active) return;
        setC(normalizeCareer(unwrapObject(data)));
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

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "skills", label: "Skills" },
    { key: "pathways", label: "Career Path" },
    { key: "courses", label: "Courses" },
    { key: "opportunities", label: "Opportunities" },
  ];

  useEffect(() => {
    if (tab === "overview" || tabData[tab] || !id) return;
    let active = true;
    setTabStatus("loading");

    if (id.startsWith("rec_")) {
      if (tab === "skills" && c?.skills) {
        setTabData((d) => ({ ...d, [tab]: c.skills }));
      } else {
        setTabData((d) => ({ ...d, [tab]: [] }));
      }
      setTabStatus("ready");
      return;
    }


    const fetchers = {
      skills: () => api.careerSkills(id),
      pathways: () => api.careerPathways(id),
      courses: () => api.careerCourses(id),
      opportunities: () => api.careerOpportunities(id),
    };
    fetchers[tab]()
      .then((res) => {
        if (!active) return;
        setTabData((d) => ({ ...d, [tab]: unwrapList(res) }));
        setTabStatus("ready");
      })
      .catch((err) => {
        if (active) setTabStatus("error");
      });
    return () => {
      active = false;
    };
  }, [tab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading career..." />
      </AppShell>
    );
  if (status === "notfound") return <NotFound />;
  if (status === "error" || !c)
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="detail-page">
        <Seo
          title={`${c.title} Career Guide | CareerGPS`}
          description={`${c.description} Explore skills, qualifications, pathways and related opportunities with CareerGPS.`}
          path={location.pathname}
          breadcrumbs={[
            { name: "Home", path: "/" },
            { name: "Careers", path: "/careers" },
            { name: c.title, path: location.pathname },
          ]}
        />
        <div className="breadcrumbs">
          <Link to="/careers">Careers</Link>
          <span>/</span>
          <b>{c.title}</b>
        </div>
        <div className="detail-hero">
          <div className="detail-image">
            <BriefcaseBusiness size={42} />
          </div>
          <div className="detail-title">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
              }}
            >
              <h1>{c.title}</h1>
              <button
                className="icon-save"
                onClick={toggleSave}
                style={{ whiteSpace: "nowrap" }}
              >
                {saved ? <BookmarkCheck /> : <Bookmark />}{" "}
                <span>{saved ? "Saved" : "Save"}</span>
              </button>
            </div>
            <p>{c.description}</p>
            {c.origin === 'ai_generated' && c.disclaimer && (
              <div className="alert-banner warning" style={{ marginBottom: '16px' }}>
                <Sparkles size={16} />
                <span>{c.disclaimer}</span>
              </div>
            )}
            {c.verificationStatus === "verified" && c.origin !== 'ai_generated' ? (
              <div className="detail-meta">
                <span>
                  <ShieldCheck size={15} />
                  Verified information
                </span>
              </div>
            ) : (
              <AIBadge origin={c.origin} verificationStatus={c.verificationStatus} />
            )}
          </div>
        </div>
        <div className="tabs">
          {TABS.map((t) => (
            <a
              key={t.key}
              className={tab === t.key ? "active" : ""}
              onClick={() => setTab(t.key)}
              style={{ cursor: "pointer" }}
            >
              {t.label}
            </a>
          ))}
        </div>
        <div className="detail-grid">
          <div>
            {tab === "overview" && (
              <>
                <section className="panel detail-panel">
                  <h2>Key information</h2>
                  <div className="info-grid">
                    <Info
                      label="Typical qualification"
                      value={c.keyInformation?.typicalQualification || c.qualifications[0]}
                    />
                    <Info label="Entry route" value={c.keyInformation?.entryRoute || c.entryRoutes[0]} />
                  </div>
                </section>
                {c.responsibilities.length > 0 && (
                  <section className="panel detail-panel">
                    <h2>Typical responsibilities</h2>
                    <ul className="check-list">
                      {c.responsibilities.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </section>
                )}
                {c.qualifications.length > 1 && (
                  <section className="panel detail-panel">
                    <h2>Qualifications</h2>
                    <ul className="check-list">
                      {c.qualifications.map((q, i) => (
                        <li key={i}>{q}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
            {tab !== "overview" && tabStatus === "loading" && (
              <LoadingState label={`Loading ${tab}...`} />
            )}
            {tab !== "overview" && tabStatus === "error" && (
              <ErrorState text="Could not load this section." />
            )}
            {tab === "skills" &&
              tabStatus === "ready" &&
              ((tabData.skills || []).length ? (
                <section className="panel detail-panel">
                  <h2>Key skills</h2>
                  <div className="tag-row">
                    {tabData.skills.map((s) => (
                      <span key={s.id}>
                        {s.name}
                        {s.importance === "required" && " *"}
                      </span>
                    ))}
                  </div>
                  <p className="muted" style={{ marginTop: 10 }}>
                    * required skill
                  </p>
                </section>
              ) : (
                <EmptyState
                  title="No skills listed yet"
                  text="This career guide doesn't have documented skills yet."
                />
              ))}
            {tab === "pathways" &&
              tabStatus === "ready" &&
              (c.origin === 'ai_generated' ? (
                <div className="listing-page" style={{ padding: 0 }}>
                  <div className="panel detail-panel">
                    <h2>AI Pathway Generation</h2>
                    <p className="muted">Generate a customized, step-by-step pathway for this AI-suggested career.</p>
                    <Link
                      className="btn primary"
                      to={`/pathway?career=${c.id}&title=${encodeURIComponent(c.title)}&type=${c.isAiProfile ? 'ai_profile' : 'catalogue'}&origin=${c.origin}&vstatus=${c.verificationStatus}`}
                    >
                      Generate AI Pathway <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ) : (tabData.pathways || []).length ? (
                <div className="listing-page" style={{ padding: 0 }}>
                  {tabData.pathways.map((p) => (
                    <div className="panel detail-panel" key={p.id}>
                      <h2>{p.title}</h2>
                      <p className="muted">{p.description}</p>
                      {p.verification_status === "verified" ? (
                        <Link
                          className="btn primary"
                          to={`/pathway?career=${c.id}&pathway=${p.id}&title=${encodeURIComponent(c.title)}&type=${c.isAiProfile ? 'ai_profile' : 'catalogue'}&origin=${c.origin}&vstatus=${c.verificationStatus}`}
                        >
                          Generate this pathway <ArrowRight size={15} />
                        </Link>
                      ) : (
                        <span
                          className="muted"
                          title="This pathway must be verified before it can be personalized."
                        >
                          Verification pending
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="listing-page" style={{ padding: 0 }}>
                  <div className="panel detail-panel" style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <h2 style={{ marginBottom: '12px' }}>Build your personalized career pathway</h2>
                    <p className="muted" style={{ marginBottom: '24px', maxWidth: '600px', margin: '0 auto 24px auto' }}>
                      AI will analyze your education, skills and this career to create two realistic routes.
                    </p>
                    <Link
                      className="btn primary large"
                      to={`/pathway?career=${c.id}&title=${encodeURIComponent(c.title)}&type=${c.isAiProfile ? 'ai_profile' : 'catalogue'}&origin=${c.origin}&vstatus=${c.verificationStatus}`}
                    >
                      Generate 2 AI Pathways <ArrowRight size={15} />
                    </Link>
                  </div>
                </div>
              ))}
            {tab === "courses" &&
              tabStatus === "ready" &&
              ((tabData.courses || []).length ? (
                <div className="institution-grid">
                  {tabData.courses.map((course) => (
                    <div className="institution-card" key={course.courseId || course.id} style={{ display: 'flex', flexDirection: 'column' }}>
                      <div className="institution-image">
                        <GraduationCap size={26} />
                      </div>
                      <span className="tag">
                        {course.level || course.course_type || course.qualification || "Course"}
                      </span>
                      <h2>{course.courseName || course.title}</h2>
                      {course.institutionName && (
                        <p>
                          <Building2 size={14} />
                          {course.institutionName}
                        </p>
                      )}
                      {course.location && (
                        <p style={{ marginTop: 4 }}>
                          <MapPin size={14} />
                          {course.location}
                        </p>
                      )}
                      <span className="muted" style={{ margin: '8px 0 16px 0' }}>
                        {course.duration || course.duration_text || course.mode || ""}
                      </span>
                      <div style={{ flex: 1 }}></div>
                      {course.institutionId && (
                        <Link to={`/institutions/${course.institutionId}`} className="btn outline full" style={{ marginBottom: 8 }}>
                          View institution <ArrowRight size={15} />
                        </Link>
                      )}
                      {course.officialWebsite && (
                        <a href={course.officialWebsite} target="_blank" rel="noopener noreferrer" className="btn full" style={{ background: 'var(--surface-sunken)', color: 'var(--text-main)', border: '1px solid var(--border)' }}>
                          Official website <ExternalLink size={15} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No matching study options are currently available."
                  text="We haven't matched specific local institutions for this career's requirements yet."
                />
              ))}
            {tab === "opportunities" &&
              tabStatus === "ready" &&
              ((tabData.opportunities || []).length ? (
                <div className="opportunity-list">
                  {tabData.opportunities.map((o) => (
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
                          <span
                            className={`status-pill ${(o.status || "").toLowerCase()}`}
                          >
                            {o.status}
                          </span>
                          <span>{o.opportunity_type}</span>
                        </div>
                        <h2>{o.title}</h2>
                        <p>
                          <Building2 size={14} />
                          {o.organization} · <MapPin size={14} />
                          {o.location}
                        </p>
                      </div>
                      <ArrowRight size={18} />
                    </Link>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No linked opportunities yet"
                  text="No current opportunity is linked to this career yet."
                />
              ))}
          </div>
          <aside className="eligibility-card">
            <div className="eligibility-icon">
              <ShieldCheck />
            </div>
            <h2>Is this career for you?</h2>
            <p>
              Compare your saved skills against what this career typically
              requires.
            </p>
            <div className="eligibility-checks">
              <span>
                <CheckCircle2 /> Uses your saved skills profile
              </span>
              <span>
                <CheckCircle2 /> Shows matched and missing skills
              </span>
            </div>
            <Link
              className="btn primary full"
              to={`/skill-gap?career=${c.id}&title=${encodeURIComponent(c.title)}&type=${c.isAiProfile ? 'ai_profile' : 'catalogue'}&origin=${c.origin}&vstatus=${c.verificationStatus}`}
            >
              Check my skill gap <ArrowRight size={16} />
            </Link>
            <small>
              Requirements should always be verified against the current
              official notice.
            </small>
          </aside>
        </div>
      </div>
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
  const [params] = useSearchParams();
  const careerId = params.get("career") || "";
  const careerTitle = params.get("title") || "this career";
  const origin = params.get("origin") || "";
  const type = params.get("type") || "";
  const vstatus = params.get("vstatus") || "";
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runCheck() {
    if (!careerId) return;
    if (!getToken()) {
      setError({
        status: 401,
        message: "Log in to compare your saved skills against a career.",
      });
      setStatus("error");
      return;
    }
    setStatus("loading");
    setError(null);
    try {
      if (careerId.startsWith("rec_")) {
        setError({ status: 400, message: "Skill gap analysis is not available for unverified AI recommendations." });
        setStatus("error");
        return;
      }
      // POST /skills/gap-analysis body: { target_career_id } - the real
      // backend capability behind "is this career for you?" (see
      // src/modules/skills/skill-intelligence.routes.js). There is no
      // generic career-eligibility endpoint.
      const res = type === 'ai_profile'
        ? await api.gapAnalysis({ target_ai_career_id: careerId })
        : await api.gapAnalysis({ target_career_id: careerId });
      setResult(unwrapObject(res));
      setStatus("ready");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  }

  useEffect(() => {
    runCheck(); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [careerId]);

  return (
    <AppShell>
      <div className="eligibility-page">
        <div className="breadcrumbs">
          {careerId ? (
            <Link to={`/careers/${careerId}`}>← Back to career</Link>
          ) : (
            <Link to="/careers">← Back to careers</Link>
          )}
        </div>
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">SKILL GAP</div>
            <h1 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              Your skill gap for {careerTitle}
              {(origin === 'ai_generated' || (vstatus && vstatus !== 'verified')) && (
                <AIBadge origin={origin} verificationStatus={vstatus} />
              )}
            </h1>
            <p>
              Comparing the skills saved on your profile with what this career
              typically needs.
            </p>
          </div>
        </div>
        <div className="eligibility-layout">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h2>Matched and missing skills</h2>
                <p>Based on your saved profile skills</p>
              </div>
              <button
                className="btn outline"
                onClick={runCheck}
                disabled={status === "loading" || !careerId}
              >
                {status === "loading" ? "Checking..." : "Re-run check"}
              </button>
            </div>
            {!careerId && (
              <p className="muted">
                Open this page from a career guide to check your skill gap for
                that career.
              </p>
            )}
            {status === "error" && (
              <ErrorState text={error?.message} status={error?.status} />
            )}
            {status === "loading" && (
              <LoadingState label="Comparing your skills..." />
            )}
            {status === "ready" && result && (
              <>
                {(result.matched_skills || []).map((s, i) => (
                  <div className="requirement" key={`m-${i}`}>
                    <div className="req-icon met">
                      <Check size={15} />
                    </div>
                    <div>
                      <b>{s.skill}</b>
                      <span>Level: {s.level}</span>
                    </div>
                    <em>Matched ({s.importance})</em>
                  </div>
                ))}
                {(result.missing_skills || []).map((s, i) => (
                  <div className="requirement" key={`x-${i}`}>
                    <div className="req-icon missing">
                      <X size={15} />
                    </div>
                    <div>
                      <b>{s.skill}</b>
                      <span>Not yet on your profile</span>
                    </div>
                    <em>Missing ({s.importance})</em>
                  </div>
                ))}
                {!(result.matched_skills || []).length &&
                  !(result.missing_skills || []).length && (
                    <p className="muted">
                      This career doesn't have documented required skills yet.
                    </p>
                  )}
              </>
            )}
          </div>
          <aside className="next-box">
            <div className="callout">
              <Lightbulb size={17} />
              <div>
                <b>Add skills to your profile</b>
                <span>
                  Missing skills shown here can be added from your profile page.
                </span>
              </div>
            </div>
            <Link className="btn outline full" to="/profile">
              Update my skills <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      </div>
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const careerId = params.get("career") || "";
  const templatePathwayId = params.get("pathway") || "";
  const careerTitle = params.get("title") || "";
  const origin = params.get("origin") || "";
  const type = params.get("type") || "";
  const vstatus = params.get("vstatus") || "";
  const [pathway, setPathway] = useState(null);
  const [existingPathways, setExistingPathways] = useState([]);
  const [generatedPathways, setGeneratedPathways] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savingStep, setSavingStep] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      setError(null);
      if (!getToken()) {
        if (active) setStatus("empty");
        return;
      }
      try {
        // BACKEND GAP: there is no endpoint that lists "all of the current
        // user's generated pathways" - only generate / fetch-by-id /
        // update-progress exist (see src/modules/pathways/pathway.routes.js).
        // The id of the last pathway generated for this career (or overall)
        // is remembered locally so refreshing this page doesn't silently
        // lose it or generate a duplicate.
        if (type === 'ai_profile' && careerId) {
          if (careerId.startsWith("rec_")) {
            if (active) setStatus("empty");
            return;
          }
          const res = unwrapObject(await api.aiCareerPathway(careerId));
          if (!active) return;
          if (!res || Object.keys(res).length === 0) {
            setStatus("empty"); return;
          }
          const mapped = { ...res };
          mapped.steps = (res.steps || []).map(s => ({
            ...s,
            id: s.order, // Use order as stepId for UI
            status: (res.progress || []).includes(s.order) ? "completed" : "pending"
          }));
          mapped.aiProgressRaw = res.progress || [];
          setPathway(mapped);
          setStatus("ready");

          api.myAiCareers().then(saves => {
            if (!active) return;
            const savedList = unwrapList(saves);
            if (savedList.find(c => c.ai_career_id === careerId)) {
              setSaved(true);
            }
          }).catch(() => { });
          return;
        }

        if (careerId) {
          const res = unwrapObject(await api.careerPathwaysList(careerId));
          if (!active) return;

          if (res.selected) {
            setPathway(res.selected);
            setStatus("ready");
          } else {
            setExistingPathways(res.existing || []);
            if (res.aiGenerated && res.aiGenerated.length > 0) {
              setGeneratedPathways(res.aiGenerated);
              setStatus("generated_selection");
            } else {
              setStatus("pre_generation");
            }
          }
        } else {
          const activeRes = unwrapList(await api.userPathways());
          if (!active) return;
          if (activeRes.length > 0) {
            const selected = unwrapObject(await api.userPathway(activeRes[0].id));
            if (!active) return;
            setPathway(selected);
            setStatus("ready");
          } else {
            setStatus("empty");
          }
        }
      } catch (err) {
        if (active) {
          setError(err);
          setStatus("error");
        }
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [careerId, type, user?.id]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const body = { career_id: careerId };
      const res = await api.generatePathway(body);
      setGeneratedPathways(res.data);
      setStatus("generated_selection");
    } catch (err) {
      setError(err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSelectPathway(userPathwayId) {
    try {
      await api.selectPathway(userPathwayId);
      navigate("/pathway");
    } catch (err) {
      alert("Failed to select pathway. Please try again.");
    }
  }

  async function handleSelectTemplatePathway(pathwayId) {
    try {
      await api.selectTemplatePathway(pathwayId);
      navigate("/pathway");
    } catch (err) {
      alert("Failed to select pathway. Please try again.");
    }
  }


  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      if (type === 'ai_profile' && careerId) {
        if (careerId.startsWith("rec_")) return;
        if (next) await api.saveAiCareer(careerId);
        else await api.unsaveAiCareer(careerId);
      } else {
        const templateId = pathway?.pathway_id;
        if (!templateId) return;
        if (next) await api.savePathway(templateId);
        else await api.unsavePathway(templateId);
      }
    } catch (err) {
      setSaved(!next);
    }
  }

  async function markStepComplete(stepId) {
    if (savingStep) return;

    if (type === 'ai_profile' && careerId) {
      if (careerId.startsWith("rec_")) return;
      setSavingStep(true);
      try {
        const order = pathway.steps.find(s => s.stepId === stepId || s.id === stepId)?.order;
        if (order === undefined) return;
        const newProgress = Array.from(new Set([...(pathway.aiProgressRaw || []), order]));
        const res = await api.updateAiCareerPathwayProgress(careerId, newProgress);
        setPathway(p => {
          const nextP = { ...p, aiProgressRaw: unwrapList(res) };
          nextP.steps = nextP.steps.map(s => ({
            ...s, status: nextP.aiProgressRaw.includes(s.order) ? "completed" : "pending"
          }));
          return nextP;
        });
      } catch (err) {
        setError(err);
      } finally {
        setSavingStep(false);
      }
      return;
    }

    const userPathwayId = pathway?.id;
    if (!userPathwayId) return;
    setSavingStep(true);
    try {
      const updated = unwrapObject(
        await api.updatePathwayProgress(userPathwayId, [
          { pathway_step_id: stepId, status: "completed" },
        ]),
      );
      setPathway((p) => ({
        ...p,
        status: updated.status,
        steps: updated.steps,
      }));
    } catch (err) {
      setError(err);
    } finally {
      setSavingStep(false);
    }
  }

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading your pathway..." />
      </AppShell>
    );
  if (status === "error")
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );
  if (status === "empty")
    return (
      <AppShell>
        <div className="pathway-page">
          <div className="page-heading-row">
            <div>
              <div className="section-kicker">CAREER PATHWAY</div>
              <h1>No pathway yet</h1>
              <p>
                Pick a career and generate a step-by-step pathway toward it.
              </p>
            </div>
          </div>
          <EmptyState
            title="You don't have a pathway yet"
            text={
              getToken()
                ? "Open a career guide and generate a pathway toward it."
                : "Log in, then open a career guide to generate a pathway toward it."
            }
            action="Explore careers"
            onAction={() => {
              window.location.href = "/careers";
            }}
          />
        </div>
      </AppShell>
    );

  const renderExistingPathways = () => {
    if (!existingPathways || existingPathways.length === 0) return null;
    return (
      <div style={{ marginBottom: 40 }}>
        <div className="section-title">
          <h2>EXISTING CAREER PATHWAYS</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {existingPathways.map(p => (
            <div key={p.id} className="panel detail-panel" style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, marginBottom: 8 }}>{p.title}</h3>
                  <p className="muted" style={{ fontSize: 14 }}>{p.description || "A standard reference pathway."}</p>
                </div>
                <button className="btn outline" onClick={() => handleSelectTemplatePathway(p.id)}>
                  View pathway
                </button>
              </div>

              {p.steps && p.steps.length > 0 && (
                <div style={{ marginTop: 24, padding: '16px', background: '#f8fafc', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {p.steps.map(s => s.title).join(' → ')}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (status === "pre_generation") {
    return (
      <AppShell>
        <div className="pathway-page">
          <div className="page-heading-row">
            <div>
              <div className="section-kicker">CAREER PATHWAY</div>
              <h1>Career Path for {careerTitle}</h1>
            </div>
          </div>

          {renderExistingPathways()}

          <div className="section-title">
            <h2>PERSONALIZED AI PATHWAYS</h2>
          </div>
          <div className="panel pathway-card" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 12 }}>Generate personalized pathways</h2>
            <p className="muted" style={{ marginBottom: 24 }}>
              Our AI will analyze your profile and current skills to generate two meaningfully different strategies tailored for you.
            </p>
            {error && <p style={{ color: "var(--red)", marginBottom: 16 }}>{error.message || "Failed to generate pathways right now."}</p>}
            <button className="btn primary large" onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? "Generating 2 pathways..." : "Generate 2 AI pathways"} <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (status === "generated_selection") {
    return (
      <AppShell>
        <div className="pathway-page">
          <div className="page-heading-row">
            <div>
              <div className="section-kicker">CAREER PATHWAY</div>
              <h1>Career Path for {careerTitle}</h1>
            </div>
          </div>

          {renderExistingPathways()}

          <div className="section-title">
            <h2>AI-GENERATED ALTERNATIVES</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {generatedPathways.map((p, idx) => {
              const ctx = p.generated_context || {};
              return (
                <div key={p.id} className="panel detail-panel" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ marginBottom: 16 }}>
                    <span className="label" style={{ color: 'var(--blue)' }}>AI PATHWAY {idx === 0 ? 'A' : 'B'}</span>
                    <h2 style={{ marginTop: 4 }}>{p.title}</h2>
                    <p className="muted" style={{ fontSize: 14 }}>{ctx.estimated_duration || "Estimated duration varies"}</p>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>Strategy</h3>
                    <p style={{ fontSize: 14, lineHeight: 1.5 }}>{ctx.strategy || "A strategic pathway to your goal."}</p>
                  </div>
                  <div style={{ marginBottom: 24, flex: 1 }}>
                    <h3 style={{ fontSize: 13, textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>Steps</h3>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {p.steps.slice(0, 5).map(s => (
                        <li key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#eef2ff', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 600, flex: 'none' }}>{s.step_order}</div>
                          <div>
                            <div style={{ fontWeight: 500, fontSize: 14 }}>{s.title}</div>
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{s.description}</div>
                          </div>
                        </li>
                      ))}
                      {p.steps.length > 5 && (
                        <li style={{ fontSize: 13, color: 'var(--muted)', paddingLeft: 36 }}>+ {p.steps.length - 5} more steps</li>
                      )}
                    </ul>
                  </div>
                  <button className="btn outline" onClick={() => handleSelectPathway(p.id)} style={{ width: '100%', justifyContent: 'center' }}>
                    Choose this path
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </AppShell>
    );
  }

  const steps = (pathway?.steps || []).map((s) => ({
    ...s,
    stepId: s.pathway_step_id ?? s.id,
  }));
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "completed").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const nextStep = steps.find((s) => s.status !== "completed");

  return (
    <AppShell>
      <div className="pathway-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">CAREER PATHWAY</div>
            <h1 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              {pathway?.career_title
                ? `Your pathway to ${pathway.career_title}`
                : "Your pathway"}
              {(origin === 'ai_generated' || (vstatus && vstatus !== 'verified')) && (
                <AIBadge origin={origin} verificationStatus={vstatus} />
              )}
            </h1>
            <p>A step-by-step plan based on your profile.</p>
          </div>
          {pathway?.pathway_id && (
            <button className="icon-save" onClick={toggleSave}>
              {saved ? <BookmarkCheck /> : <Bookmark />}{" "}
              <span>{saved ? "Saved" : "Save"}</span>
            </button>
          )}
        </div>
        {error && (
          <p style={{ color: "var(--red)", fontSize: 11 }}>{error.message}</p>
        )}
        <div className="pathway-layout">
          <div className="panel pathway-card">
            <div className="pathway-line" />
            {steps.length ? (
              steps.map((s, i) => (
                <div
                  className={`path-step ${s.status === "completed" ? "completed" : nextStep && s.stepId === nextStep.stepId ? "next" : ""}`}
                  key={s.stepId ?? i}
                >
                  <div className="path-num">
                    {s.status === "completed" ? <Check size={15} /> : i + 1}
                  </div>
                  <div className="path-copy">
                    <div className="path-title">
                      <h3>{s.title}</h3>
                      <span>
                        {s.status === "completed"
                          ? "Completed"
                          : s.status === "in_progress"
                            ? "In progress"
                            : "Not started"}
                      </span>
                    </div>
                    <p>{s.description}</p>
                    {s.status !== "completed" && (
                      <div className="next-actions">
                        <button
                          className="btn outline"
                          disabled={savingStep}
                          onClick={() => markStepComplete(s.stepId)}
                        >
                          {savingStep ? "Saving..." : "Mark complete"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No steps yet"
                text="This pathway doesn't have steps yet."
              />
            )}
          </div>
          <aside className="panel path-summary">
            <span className="label">YOUR PROGRESS</span>
            <div className="big-progress">
              <b>{pct}%</b>
              <span>
                {completed} of {total} steps
              </span>
            </div>
            <div className="progress large">
              <i style={{ width: `${pct}%` }} />
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

function Opportunities() {
  const [type, setType] = useState("All");
  const [locationFilter, setLocationFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [closingSoon, setClosingSoon] = useState(false);
  const [opportunities, setOpportunities] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    api
      .opportunities({
        search: search.trim() || undefined,
        opportunity_type: type !== "All" ? type : undefined,
        location: locationFilter !== "All" ? locationFilter : undefined,
      })
      .then((data) => {
        if (!active) return;
        setOpportunities(unwrapList(data).map(normalizeOpportunity));
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
  }, [search, type, locationFilter]);

  const filterBar = (
    <div className="opportunity-filter">
      <Search />
      <input
        aria-label="Search opportunities"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search opportunities"
      />
      <select
        aria-label="Opportunity type"
        value={type}
        onChange={(e) => setType(e.target.value)}
      >
        <option>All</option>
        <option>Government</option>
        <option>Internship</option>
        <option>Apprenticeship</option>
      </select>
      <select
        aria-label="Opportunity location"
        value={locationFilter}
        onChange={(e) => setLocationFilter(e.target.value)}
      >
        <option>All</option>
        <option>Goa</option>
        <option>Remote</option>
        <option>Pan India</option>
      </select>
    </div>
  );

  // "Closing soon" is a real client-side filter over real deadline data
  // (application_deadline), not a separate backend endpoint.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const visible = closingSoon
    ? opportunities.filter(
      (o) =>
        o.deadlineDate &&
        o.deadlineDate.getTime() - Date.now() <= THIRTY_DAYS_MS &&
        o.deadlineDate.getTime() - Date.now() >= 0,
    )
    : opportunities;

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
            className={closingSoon ? "" : "active"}
            onClick={() => setClosingSoon(false)}
            style={{ cursor: "pointer" }}
          >
            All opportunities
          </a>
          <a
            className={closingSoon ? "active" : ""}
            onClick={() => setClosingSoon(true)}
            style={{ cursor: "pointer" }}
          >
            Closing soon
          </a>
        </div>
        {filterBar}
        {status === "loading" && (
          <LoadingState label="Loading opportunities..." layout="list" />
        )}
        {status === "error" && (
          <ErrorState text={error?.message} status={error?.status} />
        )}
        {status === "ready" &&
          (visible.length ? (
            <div className="opportunity-list">
              {visible.map((o) => (
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
                      <span className={`status-pill ${o.status.toLowerCase()}`}>
                        {o.status}
                      </span>
                      <span>{o.type}</span>
                    </div>
                    <h2>{o.title}</h2>
                    <p>
                      <Building2 size={14} />
                      {o.org} · <MapPin size={14} />
                      {o.location}
                    </p>
                    <div className="opp-meta">
                      <span>
                        <CalendarDays /> Deadline: <b>{o.deadline}</b>
                      </span>
                    </div>
                  </div>
                  <ArrowRight size={18} />
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                closingSoon
                  ? "Nothing is closing in the next 30 days"
                  : "No verified opportunities are listed yet"
              }
              text="CareerGPS does not show example vacancies as if they are live. Check back when a source-backed listing is available."
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

  const deadline = o.application_deadline
    ? new Date(o.application_deadline).toLocaleDateString()
    : "Not specified";
  const requirements = o.requirements || [];
  const relatedCareers = o.related_careers || [];

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
            <div className="tag">{o.opportunity_type}</div>
            <h1>{o.title}</h1>
            <p>{o.description}</p>
            <div className="detail-meta">
              <span>
                <Building2 size={15} />
                {o.organization}
              </span>
              <span>
                <MapPin size={15} />
                {o.location}
              </span>
              <span>
                <CalendarDays size={15} />
                Deadline: {deadline}
              </span>
              <span className={`status-pill ${(o.status || "").toLowerCase()}`}>
                {o.status}
              </span>
            </div>
          </div>
        </div>
        <div className="detail-grid">
          <div>
            <section className="panel detail-panel">
              <h2>Requirements</h2>
              {requirements.length ? (
                requirements.map((r) => (
                  <div className="requirement" key={r.id}>
                    <div className="req-icon unknown">
                      <CircleHelp size={15} />
                    </div>
                    <div>
                      <b>{r.requirement_type}</b>
                      <span>{r.requirement_text}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted">
                  No structured requirements have been published for this
                  opportunity yet.
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
              Always verify requirements against the official notice.
            </small>
            {o.source_url && (
              <a
                href={o.source_url}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", marginTop: 12, fontSize: 11 }}
              >
                Official source <ExternalLink size={12} />
              </a>
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
            CareerGPS lists institutions for reference only. Confirm admissions,
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
            CareerGPS lists learning directions, not endorsements of individual
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

  useEffect(() => {
    if (!educationContext && !careerGoal) {
      setRecommendedSkills([]);
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
          if (err.name === 'AbortError' || err.code === 'TIMEOUT') return;
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
    setLoadingSearch(true);
    api.skills({ search: debouncedQuery, page, limit: 20 })
      .then(res => {
        const data = unwrapList(res);
        if (page === 1) setSearchSkills(data);
        else setSearchSkills(prev => [...prev, ...data]);
        setHasMore(res.pagination && page < res.pagination.total_pages);
      })
      .catch(() => { })
      .finally(() => setLoadingSearch(false));
  }, [debouncedQuery, page]);

  const displaySkills = debouncedQuery ? searchSkills : recommendedSkills;
  const isSearchMode = !!debouncedQuery;

  const uniqueDisplaySkills = Array.from(new Map(displaySkills.map(sk => [sk.id || sk.name, sk])).values());
  const groups = {};
  for (const sk of uniqueDisplaySkills) {
    const cat = sk.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(sk);
  }

  return (
    <div className="skill-picker-container" style={{ marginTop: 12 }}>
      <div className="search-bar" style={{ marginBottom: 16, position: 'relative' }}>
        <Search size={16} />
        <input
          placeholder="Search or add skills for your field..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        {(loadingRecs || loadingSearch) && <span className="muted" style={{ fontSize: 12, position: 'absolute', right: 12 }}>Loading...</span>}
      </div>

      {selectedSkills.length > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--bg-light)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Your Selected Skills
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
              </span>
            ))}
          </div>
        </div>
      )}


      {!isSearchMode && (careerGoal || educationContext) && uniqueDisplaySkills.length > 0 && !recsError && (
        <div style={{ marginBottom: 16, fontSize: 13, fontWeight: 500, color: 'var(--brand)' }}>
          Recommended Skills based on your profile
        </div>
      )}

      {recsError && !isSearchMode && (
        <div style={{ padding: 12, background: "rgba(255, 165, 0, 0.1)", borderRadius: 6, marginBottom: 16 }}>
          <p style={{ color: "var(--brand)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} /> {recsError}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Browse all skills below.
          </p>
        </div>
      )}

      {!isSearchMode && uniqueDisplaySkills.length === 0 && !loadingRecs && (
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          Type below to search for skills.
        </div>
      )}

      {Object.entries(groups).map(([cat, skills]) => (
        <div key={cat} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat}</div>
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

      {uniqueDisplaySkills.length === 0 && !loadingRecs && !loadingSearch && isSearchMode && (
        <p className="muted" style={{ fontSize: 14 }}>No skills found matching your search.</p>
      )}

      {isSearchMode && hasMore && (
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
    </div>
  );
}

function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  // All available skills from GET /skills (the database catalogue)
  const [allSkills, setAllSkills] = useState([]); // [{ id, name, description, category }]
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(null);
  // The user's currently saved skills from GET /skills/me (user_skills join table)
  // Each element: { id, name, level, years_experience, verified }
  const [userSkillIds, setUserSkillIds] = useState(new Set()); // Set of skill_id strings
  const [userSkillLevels, setUserSkillLevels] = useState({}); // { skill_id: level }
  const [customSkills, setCustomSkills] = useState([]); // [{ id, name, level }]

  const [careerInfo, setCareerInfo] = useState(null);

  const [validationData, setValidationData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [lastValidatedGoal, setLastValidatedGoal] = useState("");
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  useEffect(() => {
    if (form && (form.educationStage === "Higher Education" || form.educationLevel === "Undergraduate" || form.educationLevel === "Postgraduate")) {
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
  }, [form?.stream, form?.educationStage, form?.educationLevel]);

  function getCleanedEducation() {
    if (!form) return [];
    const edu = { ...form.fullEducation };
    if (form.educationStage === "Currently in 12th") {
      edu.education_stage = "SCHOOL_12";
      edu.school_12_status = "PURSUING";
      if (form.stream) {
        edu.school_12_stream = form.stream;
        edu.stream = form.stream;
      } else {
        delete edu.school_12_stream;
        delete edu.stream;
      }
      edu.status = "pursuing";
      edu.level = "12th / Higher Secondary";
      delete edu.current_program;
      delete edu.degree;
    } else if (form.educationStage === "Higher Education") {
      edu.education_stage = "HIGHER_EDUCATION";
      if (form.stream) {
        edu.school_12_stream = form.stream;
        edu.stream = form.stream;
      } else {
        delete edu.school_12_stream;
        delete edu.stream;
      }
      if (form.degree) {
        edu.current_program = form.degree;
        edu.degree = form.degree;
      } else {
        delete edu.current_program;
        delete edu.degree;
      }
      if (form.specialization) edu.specialization = form.specialization;
      if (form.currentYear && !isNaN(parseInt(form.currentYear))) {
        edu.year = parseInt(form.currentYear);
      }
      edu.status = (form.educationStatus || "pursuing").toLowerCase();
      edu.level = "Undergraduate";
    } else {
      edu.education_stage = "WORKING_PROFESSIONAL";
      edu.level = "Working Professional";
      delete edu.school_12_stream;
      delete edu.stream;
      delete edu.current_program;
      delete edu.degree;
    }
    return [edu];
  }

  function getCleanedExperience() {
    if (!form) return [];
    if (form.educationStage === "Working Professional") {
      const exp = {};
      if (form.industry) exp.industry = form.industry;
      if (form.currentRole) exp.role = form.currentRole;
      if (form.professionalExperience) exp.duration = form.professionalExperience;
      return Object.keys(exp).length > 0 ? [exp] : [];
    } else {
      return form.experienceText ? [{ description: form.experienceText }] : [];
    }
  }

  function handleEducationStageChange(e) {
    const newStage = e.target.value;
    const isPro = newStage === "Working Professional";
    const wasPro = form.educationStage === "Working Professional";
    const updates = { educationStage: newStage };
    if (isPro && !wasPro) {
      updates.stream = ""; updates.degree = ""; updates.specialization = ""; updates.diplomaField = ""; updates.currentYear = ""; updates.experienceText = "";
    } else if (!isPro && wasPro) {
      updates.industry = ""; updates.currentRole = ""; updates.professionalExperience = "";
    }
    setForm({ ...form, ...updates });
  }

  const currentProfileContextStr = JSON.stringify({
    education: getCleanedEducation(),
    experience: getCleanedExperience(),
    skills: Array.from(userSkillIds)
      .filter(id => !customSkills.some(cs => cs.id === id))
      .map(skill_id => ({
        skill_id,
        level: userSkillLevels[skill_id] || "beginner"
      }))
  });

  useEffect(() => {
    if (!form || !form.careerGoal || !form.careerGoal.trim()) {
      if (validationData) setValidationData(null);
      return;
    }
    const validationKey = `${form.careerGoal}::${currentProfileContextStr}`;
    if (validationKey === lastValidatedGoal) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsValidating(true);
      setValidationData(null);
      setError("");
      try {
        const valRes = await api.validateGoal(
          { goal: form.careerGoal, profileContext: JSON.parse(currentProfileContextStr) },
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setValidationData(unwrapObject(valRes));
          setLastValidatedGoal(validationKey);
        }
      } catch (err) {
        if (err.name === 'AbortError' || err.code === 'TIMEOUT') return;
        console.error("Live validation failed", err);
      } finally {
        if (!controller.signal.aborted) setIsValidating(false);
      }
    }, 800);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form?.careerGoal, currentProfileContextStr, lastValidatedGoal, validationData]);

  useEffect(() => {
    let active = true;
    // Load profile data, all skills, and user's own skills in parallel.
    Promise.allSettled([
      api.profile(),
      api.skills(),
      api.mySkills(),
      api.myCustomSkills()
    ]).then(([profileRes, allSkillsRes, mySkillsRes, myCustomSkillsRes]) => {
      if (!active) return;

      if (profileRes.status === "fulfilled") {
        const p = unwrapObject(profileRes.value);
        const edu = Array.isArray(p.education) && p.education.length ? p.education[0] : {};

        let eduStage = "Higher Education";
        if (edu.education_stage === "SCHOOL_12" || edu.level === "12th / Higher Secondary" || edu.level === "12th") {
          eduStage = "Currently in 12th";
        } else if (edu.education_stage === "WORKING_PROFESSIONAL" || edu.level === "Working Professional") {
          eduStage = "Working Professional";
        } else if (!edu.education_stage && !edu.level && !edu.degree) {
          eduStage = "Currently in 12th";
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

        setForm({
          localName: getLocalName(user?.id) || user?.name || user?.full_name || p.name || p.full_name || (user?.email ? user.email.split("@")[0].charAt(0).toUpperCase() + user.email.split("@")[0].slice(1) : ""),
          email: user?.email ?? "",
          educationStage: eduStage,
          stream: edu.school_12_stream || edu.stream || "",
          degree: edu.current_program || edu.degree || "",
          specialization: edu.specialization || "",
          diplomaField: edu.diplomaField || "",
          currentYear: edu.year ? String(edu.year) : "",
          educationStatus: edu.status ? (edu.status.charAt(0).toUpperCase() + edu.status.slice(1)) : "Pursuing",
          experienceText: exp,
          industry: ind,
          currentRole: role,
          professionalExperience: profExp,
          fullEducation: edu,
          careerGoal: p.career_goal ?? "",
          preferredLocations: Array.isArray(p.preferred_locations) && p.preferred_locations.length ? p.preferred_locations : ["Goa", "Remote"],
          interests: Array.isArray(p.interests) ? p.interests : [],
          careerId: p.career_id ?? null,
          constraints: p.constraints && typeof p.constraints === "object" ? p.constraints : {},
        });
        if (p.career_goal) setLastValidatedGoal(p.career_goal);

        if (p.career_id) {
          api.career(p.career_id)
            .then(res => setCareerInfo(unwrapObject(res)))
            .catch(() => {
              api.aiCareer(p.career_id)
                .then(res => setCareerInfo(unwrapObject(res)))
                .catch(() => setCareerInfo(null));
            });
        }

        setStatus("ready");
      } else {
        setError(profileRes.reason);
        setStatus("error");
      }

      if (allSkillsRes.status === "fulfilled") {
        setAllSkills(unwrapList(allSkillsRes.value));
        setSkillsError(null);
      } else {
        setSkillsError(
          allSkillsRes.reason?.message || "Could not load skill catalogue.",
        );
      }
      setSkillsLoading(false);

      if (mySkillsRes.status === "fulfilled") {
        const mySkills = unwrapList(mySkillsRes.value);
        let myCustoms = [];
        if (myCustomSkillsRes.status === "fulfilled") {
          myCustoms = unwrapList(myCustomSkillsRes.value);
          setCustomSkills(myCustoms);
        }

        setUserSkillIds(new Set([...mySkills.map((s) => s.id), ...myCustoms.map((s) => s.id)]));
        const levels = {};
        mySkills.forEach((s) => {
          levels[s.id] = s.level || "beginner";
        });
        myCustoms.forEach((s) => {
          levels[s.id] = s.level || "beginner";
        });
        setUserSkillLevels(levels);
      }
    });
    return () => {
      active = false;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (isValidating) {
      setError("Please wait for career goal validation to complete.");
      return;
    }

    let currentValidation = validationData;
    const validationKey = `${form.careerGoal}::${currentProfileContextStr}`;

    if (form.careerGoal?.trim() && validationKey !== lastValidatedGoal) {
      setIsValidating(true);
      setValidationData(null);
      setError("");
      try {
        const valRes = await api.validateGoal({
          goal: form.careerGoal,
          profileContext: JSON.parse(currentProfileContextStr)
        });
        currentValidation = unwrapObject(valRes);
        setValidationData(currentValidation);
        setLastValidatedGoal(validationKey);
      } catch (err) {
        setError(err.message || "Failed to validate goal.");
        setIsValidating(false);
        return;
      }
      setIsValidating(false);
    }

    if (currentValidation && currentValidation.classification === 'RED') {
      setError("Please fix your career goal before saving. Your current profile does not satisfy formal requirements.");
      return;
    }

    setSaving(true);
    setSavedMsg("");
    setError(null);
    try {
      // 1. Save profile fields via PUT /profiles/me
      await api.updateProfile({
        education: getCleanedEducation(),
        experience: getCleanedExperience(),
        interests: form.interests,
        preferred_locations: form.preferredLocations,
        career_goal: form.careerGoal || null,
        career_id: currentValidation?.career_id || null,
        constraints: form.constraints,
      });
      // 2. Save user_skills via PUT /skills/me with proper skill_id UUIDs.
      //    This writes to the user_skills join table and is the canonical
      //    way to persist a user's skills for gap analysis and recommendations.
      await api.updateMySkills({
        skills: Array.from(userSkillIds)
          .filter(id => !customSkills.some(cs => cs.id === id)) // Exclude custom skills
          .map((skill_id) => ({
            skill_id,
            level: userSkillLevels[skill_id] || "beginner",
          })),
      });
      setLocalName(user?.id, form.localName);
      await refreshUser();
      setSavedMsg("Profile and skills saved.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function toggleSkill(skillObj) {
    const isCustom = skillObj.origin === 'ai_generated' || skillObj.is_custom;
    const skillId = skillObj.id;

    if (isCustom) {
      const isSelected = userSkillIds.has(skillId);
      if (isSelected) {
        if (!skillObj.is_new_ai) {
          try {
            await api.deleteCustomSkill(skillId);
            setCustomSkills(prev => prev.filter(s => s.id !== skillId));
          } catch (err) { }
        }
        setUserSkillIds(prev => { const n = new Set(prev); n.delete(skillId); return n; });
      } else {
        try {
          const added = unwrapObject(await api.addCustomSkill({ name: skillObj.name, level: "beginner" }));
          setCustomSkills(prev => [...prev, added]);
          setUserSkillIds(prev => { const n = new Set(prev); n.add(added.id); return n; });
        } catch (err) { }
      }
      return;
    }

    setUserSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
        if (!userSkillLevels[skillId]) {
          setUserSkillLevels((lv) => ({ ...lv, [skillId]: "beginner" }));
        }
      }
      return next;
    });
  }

  if (status === "loading")
    return (
      <AppShell>
        <LoadingState label="Loading your profile..." layout="profile" />
      </AppShell>
    );
  if (status === "error" || !form)
    return (
      <AppShell>
        <ErrorState text={error?.message} status={error?.status} />
      </AppShell>
    );

  return (
    <AppShell>
      <div className="profile-page">
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">PROFILE</div>
            <h1>Your career profile</h1>
            <p>
              Keep your information up to date so recommendations stay relevant.
            </p>
          </div>
          <button
            className="btn primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
        {error && (
          <p style={{ color: "var(--red)", fontSize: 12 }}>{error.message}</p>
        )}
        {savedMsg && (
          <p style={{ color: "var(--green)", fontSize: 12 }}>{savedMsg}</p>
        )}
        <div className="profile-layout" style={{ maxWidth: '1200px', margin: '0 auto', paddingBottom: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div className="avatar large" style={{ width: 64, height: 64, fontSize: 24 }}>
                  {(form.localName || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 style={{ fontSize: 20, margin: '0 0 6px 0', fontWeight: 600 }}>{form.localName || "Your name"}</h2>
                  <p style={{ margin: 0, fontSize: 14, color: 'var(--text-muted)' }}>
                    {form.educationStage === "Currently in 12th" ? (
                      <>12th / Higher Secondary{form.stream ? ` · ${form.stream}` : ""} · {form.educationStatus}</>
                    ) : form.educationStage === "Higher Education" ? (
                      <>Higher Education{form.degree ? ` · ${form.degree}` : ""} · {form.educationStatus}</>
                    ) : (
                      <>{form.currentRole || "Working Professional"}{form.industry ? ` · ${form.industry}` : ""}</>
                    )} <br />
                    <span style={{ display: 'inline-block', marginTop: 4 }}>{joinLocations(form.preferredLocations)}</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>CAREER GOAL</div>
              <h3 style={{ fontSize: 18, marginBottom: 12, marginTop: 0, fontWeight: 600 }}>{form.careerGoal || "Not set"}</h3>

              {form.careerGoal && !careerInfo && (
                <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Career details are not yet available.</p>
              )}

              {careerInfo?.description && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: 'var(--text)' }}>{careerInfo.description}</p>
                </div>
              )}

              {careerInfo?.qualifications && careerInfo.qualifications.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Required education:</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14, color: 'var(--text-muted)' }}>
                    {careerInfo.qualifications.map((q, i) => <li key={i} style={{ marginBottom: 4 }}>{q}</li>)}
                  </ul>
                </div>
              )}

              {isValidating && (
                <div style={{ fontSize: 13, color: "var(--brand)", marginTop: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="loading-pulse"><CircleHelp size={14} /></div> Checking career compatibility...
                </div>
              )}

              {validationData && !isValidating && (
                <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--line)' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 12, textTransform: 'uppercase' }}>COMPATIBILITY STATUS</div>

                  <div style={{
                    padding: '8px 12px',
                    borderRadius: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 12,
                    fontSize: 13,
                    fontWeight: 600,
                    border: `1px solid ${['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'var(--red)' : validationData.classification === 'YELLOW' ? '#eab308' : validationData.classification === 'GREEN' ? 'var(--green)' : 'var(--text-muted)'}`,
                    background: ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'rgba(255,0,0,0.05)' : validationData.classification === 'YELLOW' ? 'rgba(234,179,8,0.05)' : validationData.classification === 'GREEN' ? 'rgba(0,128,0,0.05)' : 'rgba(0,0,0,0.05)',
                    color: ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? 'var(--red)' : validationData.classification === 'YELLOW' ? '#ca8a04' : validationData.classification === 'GREEN' ? 'var(--green)' : 'var(--text-muted)'
                  }}>
                    {validationData.classification === 'INVALID_GOAL' ? <><XCircle size={16} /> Invalid Goal</> :
                        ['RED', 'INVALID_GOAL'].includes(validationData.classification) ? <><XCircle size={16} /> Career Conflict</> :
                          validationData.classification === 'YELLOW' ? <><CheckCircle size={16} /> Challenging path, but achievable</> :
                            validationData.classification === 'NOT_FOUND' ? <><HelpCircle size={16} /> Career not found</> :
                              validationData.classification === 'UNKNOWN' ? <><HelpCircle size={16} /> Career requirements unavailable</> :
                                <><CheckCircle size={16} /> Highly aligned</>}
                  </div>

                  <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>
                    {validationData.classification === 'GREEN' && (
                      <p style={{ margin: 0 }}>{validationData.reason || "Your education provides a strong foundation for this career."}</p>
                    )}
                    {validationData.classification === 'YELLOW' && (
                      <>
                        <p style={{ margin: '0 0 12px 0' }}>{validationData.reason || "Your current education is not the standard route, but this career can still be pursued with additional preparation."}</p>
                        {validationData.missing_requirements?.length > 0 && (
                          <div>
                            <strong style={{ fontSize: 13, fontWeight: 600 }}>Your next steps:</strong>
                            <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                              {validationData.missing_requirements.map((req, idx) => <li style={{ marginBottom: 4 }} key={`req-${idx}`}>{req}</li>)}
                              {validationData.skill_gaps?.map((gap, idx) => <li style={{ marginBottom: 4 }} key={`gap-${idx}`}>{gap}</li>)}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    {validationData.classification === 'INVALID_GOAL' && (
                      <p style={{ margin: 0 }}>{validationData.reason || "Please enter a valid career or occupation."}</p>
                    )}
                    {validationData.classification === 'RED' && (
                      <>
                        <p style={{ margin: '0 0 12px 0' }}>{validationData.reason || "Your current educational background does not satisfy the formal prerequisites for this career."}</p>
                        {validationData.formal_barriers?.length > 0 && (
                          <div>
                            <strong style={{ fontSize: 13, fontWeight: 600 }}>Required education:</strong>
                            <ul style={{ margin: '6px 0 0 0', paddingLeft: 20, color: 'var(--text-muted)' }}>
                              {validationData.formal_barriers.map((bar, idx) => <li style={{ marginBottom: 4 }} key={`bar-${idx}`}>{bar}</li>)}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                    {validationData.classification === 'UNKNOWN' && (
                      <p style={{ margin: 0 }}>This appears to be a recognized career, but we don't have detailed prerequisite rules for it yet.</p>
                    )}
                    {validationData.classification === 'NOT_FOUND' && (
                      <p style={{ margin: 0 }}>We couldn't find this career in the CareerGPS career catalogue.</p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="panel" style={{ padding: '24px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: 20, textTransform: 'uppercase' }}>PROFILE INFORMATION</div>

              <div className="form-grid">
                <label>
                  Full name
                  <input
                    value={form.localName}
                    onChange={(e) =>
                      setForm({ ...form, localName: e.target.value })
                    }
                  />
                </label>
                <label>
                  Email
                  <input value={form.email} readOnly style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-muted)' }} />
                </label>

                <label>
                  What best describes you?
                  <select value={form.educationStage} onChange={handleEducationStageChange}>
                    <option>Currently in 12th</option>
                    <option>Higher Education</option>
                    <option>Working Professional</option>
                  </select>
                </label>

                {form.educationStage === "Working Professional" ? (
                  <>
                    <label>
                      Industry / Field
                      <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
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
                      <input placeholder="e.g. Software Developer" value={form.currentRole} onChange={(e) => setForm({ ...form, currentRole: e.target.value })} />
                    </label>
                    <label>
                      Years of Experience
                      <select value={form.professionalExperience} onChange={(e) => setForm({ ...form, professionalExperience: e.target.value })}>
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
                      <select value={form.stream} onChange={(e) => setForm({ ...form, stream: e.target.value })}>
                        <option value="">Select Stream</option>
                        <option>Science</option>
                        <option>Science — PCM</option>
                        <option>Science — PCB</option>
                        <option>Science — PCMB</option>
                        <option>Commerce</option>
                        <option>Arts / Humanities</option>
                        <option>Vocational</option>
                      </select>
                    </label>

                    {form.educationStage === "Higher Education" && (
                      <>
                        <label>
                          Current Education / Program
                          {programsLoading ? (
                            <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 14, background: 'var(--bg-light)', borderRadius: 6, border: '1px solid var(--line)' }}>Loading programs...</div>
                          ) : (
                            <select value={form.degree} onChange={(e) => setForm({ ...form, degree: e.target.value })}>
                              <option value="">Select Program</option>
                              {availablePrograms.map(p => <option key={p} value={p}>{p}</option>)}
                              {availablePrograms.length === 0 && !form.stream && <option disabled>Select 12th Stream first</option>}
                              {availablePrograms.length === 0 && form.stream && <option disabled>No eligible bachelor's programs found for the selected subjects.</option>}
                            </select>
                          )}
                        </label>
                        <label>
                          Status
                          <select value={form.educationStatus} onChange={(e) => setForm({ ...form, educationStatus: e.target.value })}>
                            <option>Pursuing</option>
                            <option>Completed</option>
                          </select>
                        </label>
                      </>
                    )}
                  </>
                )}

                <label style={{ gridColumn: '1 / -1' }}>
                  Experience
                  <textarea
                    value={form.experienceText}
                    onChange={(e) => setForm({ ...form, experienceText: e.target.value })}
                    placeholder="Projects, internships, work experience..."
                    style={{ minHeight: '100px', resize: 'vertical' }}
                  />
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  Career goal
                  <input
                    value={form.careerGoal}
                    onChange={(e) => {
                      setForm({ ...form, careerGoal: e.target.value, careerId: null });
                      if (validationData) setValidationData(null);
                      setCareerInfo(null);
                    }}
                    placeholder="e.g. Software Engineer"
                  />
                </label>

                <label style={{ gridColumn: '1 / -1' }}>
                  Preferred location
                  <select
                    value={joinLocations(form.preferredLocations)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        preferredLocations: parseLocations(e.target.value),
                      })
                    }
                  >
                    <option>Goa + Remote</option>
                    <option>Goa</option>
                    <option>Pan India</option>
                    <option>Remote</option>
                  </select>
                </label>

                <div style={{ gridColumn: '1 / -1', marginTop: '16px' }} className="mobile-only-save">
                  <button className="btn primary" onClick={handleSave} disabled={saving} style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
                    {saving ? "Saving..." : "Save changes"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel" style={{ height: 'fit-content', padding: '24px' }}>
            <h2 style={{ fontSize: 16, margin: '0 0 16px 0' }}>Skills &amp; interests</h2>
            {skillsLoading && <LoadingState label="Loading skills..." />}
            {skillsError && !skillsLoading && (
              <p style={{ color: "var(--red)", fontSize: 12 }}>
                Could not load skill catalogue: {skillsError}
              </p>
            )}
            {!skillsLoading && !skillsError && allSkills.length === 0 && (
              <p className="muted" style={{ fontSize: 14 }}>
                No skills are published in the CareerGPS database yet.
              </p>
            )}
            {!skillsLoading && allSkills.length > 0 && (
              <div>
                <SkillPicker
                  userSkillIds={userSkillIds}
                  selectedSkills={Array.from(userSkillIds).map(id => allSkills.find(s => s.id === id) || customSkills.find(s => s.id === id)).filter(Boolean)}
                  toggleSkill={(sk) => toggleSkill(sk)}
                  careerGoal={form.careerGoal}
                  educationContext={form.educationStage + (form.degree ? ` ${form.degree}` : '')}
                />
              </div>
            )}
          </div>
        </div>

      </div>
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
      console.debug("[CareerGPS Assistant]", {
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
      console.debug("[CareerGPS Assistant]", {
        conversationId,
        requestStatus: "error",
        responseStatus: err.status || "network",
      });
      let msg = "Unable to connect to the CareerGPS backend.";
      if (err.status === 401)
        msg = "Your session has expired. Please log in again.";
      else if (err.status === 403)
        msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429)
        msg = "Too many requests. Please try again shortly.";
      else if (err.status >= 500)
        msg = "CareerGPS couldn't process that request. Please try again.";
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
            <h1>CareerGPS Assistant</h1>
            <p>
              Ask about careers, pathways, courses and opportunities in Goa.
              Answers are grounded in CareerGPS data.
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
                    available through CareerGPS. I'll use CareerGPS data rather
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
              <input
                style={{
                  flex: 1,
                  border: "1px solid var(--line)",
                  borderRadius: 20,
                  padding: "10px 16px",
                  fontSize: 13,
                  outline: "none",
                }}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Ask something..."
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
const BRAND = "CareerGPS";
const DEFAULT_DESCRIPTION =
  "CareerGPS helps people in Goa explore careers, understand requirements, find learning pathways and discover opportunities using structured, source-backed career information.";

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
      "CareerGPS logo with the Explore, Plan, Learn, Grow tagline",
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
        logo: new URL("/careergps-logo.jpg", SITE_URL).href,
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
      title: "CareerGPS | Explore, Plan, Learn, Grow in Goa",
      description: DEFAULT_DESCRIPTION,
      path: "/",
    },
    "/signup": {
      title: "Create Your CareerGPS Account | Goa Career Platform",
      description:
        "Create a CareerGPS account to build your profile and explore career pathways, skills and opportunities.",
      path,
    },
    "/login": {
      title: "Log In | CareerGPS",
      description:
        "Log in to your CareerGPS account and continue your career pathway.",
      path,
    },
    "/onboarding": {
      title: "Set Up Your Career Profile | CareerGPS",
      description:
        "Set up your education, skills, interests and career preferences for a personalized CareerGPS experience.",
      path,
    },
    "/dashboard": {
      title: "Career Dashboard | CareerGPS",
      description:
        "Review your career goal, pathway progress, saved careers and recommended next steps.",
      path,
    },
    "/careers": {
      title: "Explore Careers in Goa | CareerGPS",
      description:
        "Search careers by keyword, then explore pathways, skills and requirements.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Careers", path: "/careers" },
      ],
    },
    "/skill-gap": {
      title: "Skill Gap Check | CareerGPS",
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
      title: "Opportunity Eligibility Check | CareerGPS",
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
      title: "Personal Career Pathway | CareerGPS",
      description:
        "Follow a step-by-step learning and experience pathway toward a target career.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "My Plan", path },
      ],
    },
    "/opportunities": {
      title: "Jobs, Internships & Programmes in Goa | CareerGPS",
      description:
        "Explore career opportunities and review requirements and source information before applying.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Opportunities", path },
      ],
    },
    "/institutions": {
      title: "Institutions & Courses in Goa | CareerGPS",
      description:
        "Explore institutions and courses that can help close career skill and qualification gaps.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Institutions", path },
      ],
    },
    "/learn": {
      title: "Learning Resources & Courses | CareerGPS",
      description:
        "Find learning options connected to career pathways and skill development.",
      path,
      breadcrumbs: [
        { name: "Home", path: "/" },
        { name: "Learn", path },
      ],
    },
    "/profile": {
      title: "Career Profile | CareerGPS",
      description:
        "Manage your education, skills, interests and career preferences.",
      path,
    },
    "/saved": {
      title: "Saved Careers | CareerGPS",
      description:
        "Review careers you saved for later and continue exploring their pathways.",
      path,
    },
  }[path] || {
    title: "Page Not Found | CareerGPS",
    description: "The CareerGPS page you requested could not be found.",
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
            Go to CareerGPS home <ArrowRight size={16} />
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
