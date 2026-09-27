import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate, useSearchParams, useParams } from "react-router-dom";
import {
  ArrowRight, ArrowLeft, Search, MapPin, UserRound, Menu, X, ChevronDown,
  Check, CheckCircle2, Circle, BookOpen, BriefcaseBusiness, GraduationCap,
  Building2, Bookmark, BookmarkCheck, Sparkles, SlidersHorizontal, Clock3,
  ExternalLink, ShieldCheck, Target, TrendingUp, MoreHorizontal, Plus,
  LayoutDashboard, Compass, Route as RouteIcon, CalendarDays, UserCog,
  Lightbulb, LockKeyhole, Mail, Eye, EyeOff, Bell, MessageCircle, Bot,
  FileCheck2, Award, Zap, CircleHelp, Send, Trash2
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
  if (data && typeof data === "object" && data.data && typeof data.data === "object" && !Array.isArray(data.data)) {
    return data.data;
  }
  return data ?? {};
}

// The backend has no "full name" field anywhere in its contract (register,
// /users/me and the profile schema are all name-less), so any display name
// is client-side only.
const LOCAL_NAME_KEY = "careerpath_display_name";
function getLocalName(userId) { return userId ? (localStorage.getItem(`${LOCAL_NAME_KEY}_${userId}`) || "") : ""; }
function setLocalName(userId, name) {
  if (!userId) return;
  if (name) localStorage.setItem(`${LOCAL_NAME_KEY}_${userId}`, name);
  else localStorage.removeItem(`${LOCAL_NAME_KEY}_${userId}`);
}

// BACKEND GAP: there is no GET endpoint that lists "the current user's
// generated pathways" - only POST /pathways/generate (create one),
// GET /pathways/generated/:userPathwayId (fetch one you already know the
// id of), and GET|POST /pathways/:pathwayId/progress (which also accepts
// either id). So the id of the most recently generated pathway is kept
// here, scoped to the logged-in user + career, purely so the app can find
// it again after a refresh without re-generating a duplicate. This is a
// client-side convenience, not a substitute backend route.
const LAST_PATHWAY_KEY_PREFIX = "careergps_last_pathway";
function lastPathwayStorageKey(userId) { return `${LAST_PATHWAY_KEY_PREFIX}:${userId || "anon"}`; }
function getLastPathwayId(userId, careerId) {
  try {
    const map = JSON.parse(localStorage.getItem(lastPathwayStorageKey(userId)) || "{}");
    return careerId ? (map[careerId] || null) : (map.__latest || null);
  } catch { return null; }
}
function setLastPathwayId(userId, careerId, userPathwayId) {
  try {
    const key = lastPathwayStorageKey(userId);
    const map = JSON.parse(localStorage.getItem(key) || "{}");
    if (careerId) map[careerId] = userPathwayId;
    map.__latest = userPathwayId;
    localStorage.setItem(key, JSON.stringify(map));
  } catch { /* localStorage unavailable - pathway just won't be remembered */ }
}

// "Goa + Remote" <-> ["Goa", "Remote"] for the preferred_locations array field.
function parseLocations(str) {
  return String(str || "").split(/\+|,/).map(s => s.trim()).filter(Boolean);
}
function joinLocations(arr) {
  return (Array.isArray(arr) && arr.length ? arr : ["Goa", "Remote"]).join(" + ");
}

const STUDY_MODE_MAP = {
  "Online / Part-time": ["online", "part-time"],
  "Offline": ["offline"],
  "Hybrid": ["hybrid"]
};

function normalizeCareer(c) {
  if (!c) return c;
  return {
    id: c.id ?? "",
    title: c.title ?? "Untitled career",
    description: c.description ?? "",
    responsibilities: Array.isArray(c.responsibilities) ? c.responsibilities : [],
    qualifications: Array.isArray(c.qualifications) ? c.qualifications : [],
    entryRoutes: Array.isArray(c.entry_routes) ? c.entry_routes : [],
    verificationStatus: c.verification_status ?? "needs_review",
    sourceUrl: c.source_url ?? null
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
    deadline: o.application_deadline ? new Date(o.application_deadline).toLocaleDateString() : "Not specified",
    deadlineDate: o.application_deadline ? new Date(o.application_deadline) : null,
    vacancies: o.vacancies_total ?? null,
    description: o.description ?? "",
    advertisementNumber: o.advertisement_number ?? null,
    sourceUrl: o.source_url ?? null,
    verificationStatus: o.verification_status ?? "needs_review",
    requirements: Array.isArray(o.requirements) ? o.requirements : [],
    relatedCareers: Array.isArray(o.related_careers) ? o.related_careers : []
  };
}

/* ---------------------------------------------------------------------
 * Auth context - wraps GET /users/me so any page can read the logged
 * in user without re-fetching, and clears the token on a 401.
 * ------------------------------------------------------------------- */
const AuthContext = React.createContext({ user: null, loading: true, refreshUser: async () => {}, logout: () => {} });
function useAuth() { return React.useContext(AuthContext); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const navigate = useNavigate();

  async function refreshUser() {
    if (!getToken()) { setUser(null); setLoading(false); return; }
    setLoading(true);
    try {
      const data = await api.me();
      setUser(unwrapObject(data));
    } catch (err) {
      if (err.status === 401) { clearToken(); setUser(null); }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    setUser(null);
    navigate("/login");
  }

  useEffect(() => { refreshUser(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return <AuthContext.Provider value={{ user, loading, refreshUser, logout }}>{children}</AuthContext.Provider>;
}

/* ---------------------------------------------------------------------
 * Shared loading / error states
 * ------------------------------------------------------------------- */
function LoadingState({ label = "Loading..." }) {
  return <div className="empty-state"><Clock3 size={24}/><h2>{label}</h2></div>;
}
// Central error-state rendering: every major API-driven page in this file
// funnels its caught ApiError into this one component, so the copy for
// each status code only needs to be right in one place.
function ErrorState({ text = "Something went wrong. Please try again.", status, onRetry }) {
  if (status === 401) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>Please log in</h2><p>You need to be logged in to see this.</p><Link className="btn outline" to="/login">Log in</Link></div>;
  }
  if (status === 403) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>You don't have permission</h2><p>{text}</p></div>;
  }
  if (status === 404) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>Not found</h2><p>{text}</p>{onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}</div>;
  }
  if (status === 409) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>This can't be done right now</h2><p>{text}</p>{onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}</div>;
  }
  if (status === 400 || status === 422) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>Please check the form</h2><p>{text}</p></div>;
  }
  if (status === 503) {
    return <div className="empty-state"><Sparkles size={24}/><h2>AI service is temporarily unavailable</h2><p>{text} Everything else in CareerGPS (career search, pathways, opportunities) keeps working normally without it.</p>{onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}</div>;
  }
  if (status === 429) {
    return <div className="empty-state"><CircleHelp size={24}/><h2>Too many requests</h2><p>{text}</p>{onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}</div>;
  }
  return <div className="empty-state"><CircleHelp size={24}/><h2>Something went wrong</h2><p>{text}</p>{onRetry && <button className="btn outline" onClick={onRetry}>Try again</button>}</div>;
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
    api.assistantConversations().then(res => setConversations(unwrapList(res)))
      .catch(() => { /* history list failing shouldn't block chatting */ })
      .finally(() => setLoadingList(false));
  }

  function openConversation(id) {
    setLoadingConvo(true);
    setError(null);
    api.assistantConversation(id).then(res => {
      const data = unwrapObject(res);
      setConversationId(data.id);
      setMessages(data.messages || []);
      setShowHistory(false);
    }).catch(err => setError(err)).finally(() => setLoadingConvo(false));
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
      setMessages(m => [...m, { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() }]);
    }
    setLastMessageText(text);
    setError(null);
    setSending(true);
    try {
      const res = await api.assistantChat({ conversation_id: conversationId || undefined, message: text });
      const data = unwrapObject(res);
      console.debug("[CareerGPS Assistant]", { conversationId: data.conversation_id, requestStatus: "success" });
      setConversationId(data.conversation_id);
      setMessages(m => [...m, data.message]);
      loadConversations();
    } catch (err) {
      console.debug("[CareerGPS Assistant]", { conversationId, requestStatus: "error", responseStatus: err.status || "network" });
      let msg = "Unable to connect to the CareerGPS backend.";
      if (err.status === 401) msg = "Your session has expired. Please log in again.";
      else if (err.status === 403) msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429) msg = "Too many requests. Please try again shortly.";
      else if (err.status >= 500) msg = "CareerGPS couldn't process that request. Please try again.";
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
      setConversations(c => c.filter(x => x.id !== id));
      if (conversationId === id) startNew();
    } catch { /* leave it in the list so the user can try again */ }
  }

  return <>
    <button className="assistant-fab" onClick={() => setOpen(o => !o)} aria-label={open ? "Close AI assistant" : "Open AI assistant"}>{open ? <X size={22}/> : <Bot size={22}/>}</button>
    {open && <div className="assistant-panel">
      <div className="assistant-head">
        <div className="assistant-head-title"><Bot size={18}/><b>CareerGPS Assistant</b></div>
        <div className="assistant-head-actions">
          {loggedIn && <button className="icon-btn" onClick={() => setShowHistory(s => !s)} title="Conversations"><MessageCircle size={16}/></button>}
          {loggedIn && <button className="icon-btn" onClick={startNew} title="New conversation"><Plus size={16}/></button>}
          <button className="icon-btn" onClick={() => setOpen(false)} title="Close"><X size={16}/></button>
        </div>
      </div>
      {!loggedIn ? (
        <div className="assistant-body assistant-empty"><CircleHelp size={22}/><p>Log in to use the assistant - your conversations are saved to your account.</p><Link className="btn outline" to="/login" onClick={() => setOpen(false)}>Log in</Link></div>
      ) : showHistory ? (
        <div className="assistant-body assistant-history">
          {loadingList && <LoadingState label="Loading conversations..."/>}
          {!loadingList && conversations.length === 0 && <p className="muted" style={{ padding: 16 }}>No conversations yet.</p>}
          {conversations.map(c => (
            <div className={`assistant-convo-row ${c.id === conversationId ? "active" : ""}`} key={c.id} onClick={() => openConversation(c.id)}>
              <span>{c.title || "Untitled conversation"}</span>
              <button className="icon-btn" onClick={(e) => removeConversation(c.id, e)} title="Delete conversation"><Trash2 size={14}/></button>
            </div>
          ))}
        </div>
      ) : (<>
        <div className="assistant-body assistant-messages">
          {loadingConvo && <LoadingState label="Loading conversation..."/>}
          {!loadingConvo && messages.length === 0 && <div className="assistant-empty"><Sparkles size={20}/><p>Ask about careers, pathways, courses or opportunities in Goa. Answers are grounded in CareerGPS's own data - if something isn't known, the assistant will say so instead of guessing.</p></div>}
          {messages.map((m, i) => (
            <div className={`assistant-msg ${m.role}`} key={m.id ?? i}>
              <div className="assistant-bubble">{m.content}</div>
              {import.meta.env.DEV && m.content?.includes("assistant service is currently unavailable") && (
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Dev Diagnostic: Backend reached, but the AI service did not return a generated response.</div>
              )}
              {Array.isArray(m.citations) && m.citations.length > 0 && (
                <div className="assistant-citations">{m.citations.map((c, ci) => {
                  const label = typeof c === "string" ? c : (c.title || c.source_url || c.url || "Source");
                  const url = typeof c === "object" && c ? (c.source_url || c.url) : null;
                  return url ? <a key={ci} href={url} target="_blank" rel="noreferrer">{label} <ExternalLink size={11}/></a> : <span key={ci}>{label}</span>;
                })}</div>
              )}
            </div>
          ))}
          {sending && <div className="assistant-msg assistant"><div className="assistant-bubble typing"><span/><span/><span/></div></div>}
        </div>
        {error && <div className="assistant-error"><p>{error.message}</p><button className="btn outline" onClick={() => send(lastMessageText)}>Retry</button></div>}
        <div className="assistant-input-row">
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask something..." disabled={sending}/>
          <button className="assistant-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send"><Send size={16}/></button>
        </div>
      </>)}
    </div>}
  </>;
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
    website_url: i.website_url ?? ""
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
    institution_name: c.institution_name ?? ""
  };
}

function AppShell({ children }) {
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const { user, loading, logout } = useAuth();
  const nav = [
    ["/dashboard", "Home", LayoutDashboard],
    ["/careers", "Explore Careers", Compass],
    ["/pathway", "My Plan", RouteIcon],
    ["/saved", "Saved Careers", Bookmark],
    ["/opportunities", "Opportunities", BriefcaseBusiness],
    ["/profile", "Profile", UserCog],
  ];
  const publicPage = ["/", "/signup", "/login", "/onboarding"].includes(location.pathname);

  if (publicPage) return <>{children}</>;
  
  if (loading) return <div className="app-shell"><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LoadingState label="Loading your account..."/></main></div>;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "open" : ""}`}>
        <Logo/>
        <div className="side-section-label">YOUR JOURNEY</div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <Link key={to} to={to} className={location.pathname === to ? "active" : ""} onClick={() => setMobile(false)}>
              <Icon size={18}/><span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-help">
            <div className="help-icon"><Sparkles size={16}/></div>
            <div>
              <strong>Need guidance?</strong>
              <span>Ask Career AI</span>
            </div>
            <ArrowRight size={15}/>
          </div>
          <button className="side-user" onClick={logout} title="Log out" style={{ border: 0, width: "100%", textAlign: "left", cursor: "pointer", background: "transparent" }}>
            <div className="avatar">{(getLocalName(user?.id) || user?.email || "?").charAt(0).toUpperCase()}</div>
            <div><strong>{getLocalName(user?.id) || user?.email || "Guest"}</strong><span>{user?.role || "Log out"}</span></div>
            <MoreHorizontal size={17}/>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobile(v => !v)}>
            {mobile ? <X/> : <Menu/>}
          </button>
          <div className="top-links">
            <Link to="/careers">Careers</Link>
            <Link to="/learn">Learn</Link>
            <Link to="/institutions">Institutions</Link>
            <Link to="/opportunities">Opportunities</Link>
          </div>
          <div className="top-actions">
            <button className="icon-btn"><Search size={18}/></button>
            <button className="icon-btn"><Bell size={18}/></button>
            <div className="avatar small">{(getLocalName(user?.id) || user?.email || "?").charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <main className="page-content">{children}</main><SiteFooter/>
      </div>
      <AssistantWidget/>
    </div>
  );
}

function Logo() {
  return <div className="brand landing-brand"><img className="brand-image" src="/careergps-logo.jpg" alt="CareerGPS — Explore, Plan, Learn, Grow" /></div>
}

function Landing() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo/>
        <nav className="landing-links" aria-label="Primary navigation">
          <Link to="/careers">Careers</Link><Link to="/learn">Learn</Link><Link to="/institutions">Institutions</Link><Link to="/opportunities">Opportunities</Link>
        </nav>
        <div className="landing-auth"><Link to="/login">Login</Link><Link className="btn primary small" to="/signup">Sign Up</Link></div>
      </header>
      <section className="hero">
        <img className="hero-goa-image" src="/goa-hero.jpg" alt="Goa coastline with palm trees and Arabian Sea" />
        <div className="hero-overlay"/>
        <div className="hero-content">
          <div className="eyebrow"><Sparkles size={14}/> Career discovery, built for Goa</div>
          <h1>Where can your<br/><span>career go next?</span></h1>
          <p>Discover real opportunities based on where you are today — and what you want to achieve.</p>
          <div className="hero-search">
            <Search size={19}/>
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a career (e.g. Data Analyst, Police Constable, Chef)" onKeyDown={e => e.key === "Enter" && navigate("/careers?search=" + query)}/>
            <button onClick={() => navigate("/careers?search=" + query)}><ArrowRight size={19}/></button>
          </div>
          <div className="hero-cards">
            <button onClick={() => navigate("/signup")}><GraduationCap/><span><b>Start my<br/>career</b><small>For students</small></span></button>
            <button onClick={() => navigate("/careers")}><TrendingUp/><span><b>Upgrade my<br/>career</b><small>For working professionals</small></span></button>
            <button onClick={() => navigate("/careers")}><RouteIcon/><span><b>Change my<br/>career</b><small>Explore new fields</small></span></button>
          </div>
        </div>
        <div className="hero-location"><MapPin size={15}/> Goa-first career intelligence</div>
      </section>
      <section className="landing-trust">
        <div><ShieldCheck/> <span><b>Source-backed</b><small>Requirements linked to official sources</small></span></div>
        <div><Target/> <span><b>Pathway intelligence</b><small>Know your next practical step</small></span></div>
        <div><FileCheck2/> <span><b>Eligibility checks</b><small>Structured rules, not AI guesses</small></span></div>
      </section>
      <section className="landing-journey" aria-labelledby="journey-title">
        <div><div className="section-kicker">A CLEARER NEXT STEP</div><h2 id="journey-title">Plan a career journey that fits where you are now.</h2></div>
        <div className="journey-grid">
          <Link id="careers" to="/careers"><Compass/><h3>Explore careers</h3><p>Search practical career directions by title, skill or field.</p><span>Explore careers <ArrowRight size={15}/></span></Link>
          <Link id="eligibility" to="/eligibility"><ShieldCheck/><h3>Check eligibility</h3><p>See what is met, what needs verification, and what is missing.</p><span>Check a profile <ArrowRight size={15}/></span></Link>
          <Link id="pathway" to="/pathway"><RouteIcon/><h3>Build your pathway</h3><p>Turn a target role into education, skills and experience steps.</p><span>View pathway <ArrowRight size={15}/></span></Link>
          <Link id="opportunities" to="/opportunities"><BriefcaseBusiness/><h3>Find opportunities</h3><p>Review sourced openings when they are available to CareerGPS.</p><span>View opportunities <ArrowRight size={15}/></span></Link>
          <Link id="institutions" to="/institutions"><GraduationCap/><h3>Discover learning</h3><p>Find institutions and learning routes relevant to your direction.</p><span>Find learning options <ArrowRight size={15}/></span></Link>
        </div>
      </section>
      <SiteFooter/>
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
      const res = await api.register({ email: form.email, password: form.password });
      // Confirmed against backend src/modules/auth/auth.service.js:
      // register() returns { user, accessToken } directly (no data wrapper).
      let token = res?.accessToken;
      if (!token) {
        // Some backends don't log the user in on register - fall back to login.
        const loginRes = await api.login({ email: form.email, password: form.password });
        token = loginRes?.accessToken;
      }
      if (!token) throw new Error("Account created, but no access token was returned. Please log in.");
      setToken(token);
      const u = await api.me();
      setLocalName(unwrapObject(u).id, form.name);
      await refreshUser();
      navigate("/onboarding");
    } catch (err) {
      setError(err.message || "Could not create your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand"><Logo/></div>
      <div className="auth-card">
        <div className="auth-heading"><div className="auth-icon"><Compass/></div><h1>Create your account</h1><p>Start your career journey</p></div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>Full name<input required placeholder="Aldrich Fernandes" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></label>
          <label>Email address<input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
          <label>Password<div className="password"><input required type={show ? "text" : "password"} placeholder="Create a password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/><button type="button" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></label>
          {error && <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }}>{error}</p>}
          <button className="btn primary full" type="submit" disabled={submitting}>{submitting ? "Creating account..." : "Sign Up"}</button>
        </form>
        <div className="or"><span>or continue with</span></div>
        <div className="socials"><button type="button"><span className="google">G</span> Continue with Google</button><button type="button"><span className="ms">▦</span> Continue with Microsoft</button></div>
        <p className="auth-footer">Already have an account? <Link to="/login">Log in</Link></p>
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
      const res = await api.login({ email: form.email, password: form.password });
      // Confirmed against backend: login() returns { user, accessToken } directly.
      const token = res?.accessToken;
      if (!token) throw new Error("Login succeeded but no access token was returned.");
      setToken(token);
      await refreshUser();
      navigate("/dashboard");
    } catch (err) {
      setError(err.status === 401 ? "Incorrect email or password." : (err.message || "Login failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-brand"><Logo/></div>
      <div className="auth-card">
        <div className="auth-heading"><div className="auth-icon"><LockKeyhole/></div><h1>Welcome back</h1><p>Continue your CareerGPS journey</p></div>
        <form className="form-stack" onSubmit={handleSubmit}>
          <label>Email address<input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></label>
          <label>Password<input required type="password" placeholder="Your password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/></label>
          {error && <p style={{ color: "var(--red)", fontSize: 11, margin: 0 }}>{error}</p>}
          <button className="btn primary full" type="submit" disabled={submitting}>{submitting ? "Logging in..." : "Log In"}</button>
        </form>
        <div className="or"><span>or continue with</span></div>
        <div className="socials"><button type="button"><span className="google">G</span> Continue with Google</button><button type="button"><span className="ms">▦</span> Continue with Microsoft</button></div>
        <p className="auth-footer">New to CareerGPS? <Link to="/signup">Create an account</Link></p>
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
    education: "BCA (Bachelor of Computer Applications)",
    location: "Goa",
    educationStatus: "Pursuing",
    experience: "",
    // skills is now an array of { skill_id, name, level } objects from the backend
    skills: [],
    preferredLocation: "Goa + Remote",
    careerGoal: "",
    studyPreference: "Online / Part-time"
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const steps = ["Basic Information", "Education / Experience", "Skills & Interests", "Location & Preferences", "Complete"];

  // Real skills from GET /skills — loaded when the user reaches step 3 so
  // we only make the request when it's actually needed.
  const [allSkills, setAllSkills] = useState([]);  // [{ id, name, description, category }]
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsError, setSkillsError] = useState(null);

  function loadSkills() {
    if (allSkills.length > 0 || skillsLoading) return; // already loaded or loading
    setSkillsLoading(true);
    setSkillsError(null);
    api.skills().then(res => {
      setAllSkills(unwrapList(res));
    }).catch(err => {
      setSkillsError(err.message || "Could not load skills from the server.");
    }).finally(() => setSkillsLoading(false));
  }

  function handleStepForward() {
    if (step === 2) loadSkills(); // pre-load before step 3 renders
    setStep(s => s + 1);
  }

  function toggleSkill(skill) {
    // skill is { id, name, description, category } from the backend
    setForm(f => {
      const already = f.skills.some(s => s.skill_id === skill.id);
      return {
        ...f,
        skills: already
          ? f.skills.filter(s => s.skill_id !== skill.id)
          : [...f.skills, { skill_id: skill.id, name: skill.name, level: "beginner" }]
      };
    });
  }

  async function finish() {
    setError("");
    setSubmitting(true);
    try {
      // 1. Save profile fields (education, experience, locations, goal).
      //    PUT /profiles/me accepts skills as [{ name, level }] name-strings, but
      //    for proper user_skills persistence we use PUT /skills/me with real IDs.
      await api.updateProfile({
        education: [
          { qualification: form.education, status: (form.educationStatus || "pursuing").toLowerCase() }
        ],
        experience: form.experience ? [{ description: form.experience }] : [],
        interests: [],
        preferred_locations: parseLocations(form.preferredLocation),
        career_goal: form.careerGoal || null,
        constraints: { study_mode: STUDY_MODE_MAP[form.studyPreference] || [] }
      });
      // 2. Save user_skills via PUT /skills/me with proper skill_id UUIDs.
      //    This is the correct endpoint that writes to the user_skills join table.
      if (form.skills.length > 0) {
        await api.updateMySkills({
          skills: form.skills.map(s => ({ skill_id: s.skill_id, level: s.level || "beginner" }))
        });
      }
      await refreshUser();
    } catch (err) {
      setError(err.message || "Could not save your profile — you can update it later from the profile page.");
    } finally {
      setSubmitting(false);
      setStep(5);
    }
  }

  return (
    <div className="onboarding-page">
      <div className="onboarding-top"><Logo/><span>Step {Math.min(step, 5)} of 5</span></div>
      <div className="onboarding-grid">
        <div className="stepper">
          {steps.map((s, i) => <div className={`step ${step === i + 1 ? "current" : step > i + 1 ? "done" : ""}`} key={s}><div className="step-circle">{step > i + 1 ? <Check size={14}/> : i + 1}</div><span>{s}</span></div>)}
        </div>
        <div className="onboard-card">
          {step < 5 ? <>
            <div className="section-kicker">PROFILE SETUP</div>
            <h1>{step === 1 ? "Tell us about yourself" : step === 2 ? "Your education and experience" : step === 3 ? "What are you good at?" : "Where do you want to build your career?"}</h1>
            <p className="muted">This helps us show you relevant career options.</p>
            {step === 1 && <div className="form-stack">
              <label>I am a<select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option>College Student</option><option>Working Professional</option><option>Recent Graduate</option><option>Career Switcher</option></select></label>
              <label>Current education level<select value={form.education} onChange={e => setForm({ ...form, education: e.target.value })}><option>BCA (Bachelor of Computer Applications)</option><option>12th Pass</option><option>Diploma</option><option>Graduate</option></select></label>
              <label>Location<select value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}><option>Goa</option><option>Remote</option><option>Other state</option></select></label>
            </div>}
            {step === 2 && <div className="form-stack"><label>Education status<select value={form.educationStatus} onChange={e => setForm({ ...form, educationStatus: e.target.value })}><option>Pursuing</option><option>Completed</option></select></label><label>Experience<textarea value={form.experience} onChange={e => setForm({ ...form, experience: e.target.value })} placeholder="Projects, internships, work experience..."/></label></div>}
            {step === 3 && (
              skillsLoading ? <LoadingState label="Loading skills from CareerGPS..."/> :
              skillsError ? <div className="empty-state"><CircleHelp size={20}/><h2>Could not load skills</h2><p>{skillsError}</p><button className="btn outline" onClick={loadSkills}>Try again</button></div> :
              allSkills.length === 0 ? <p className="muted">No skills are published in the CareerGPS database yet. You can add skills from the Profile page after setup.</p> :
              <div className="chip-picker">{allSkills.map(sk => {
                const selected = form.skills.some(s => s.skill_id === sk.id);
                return <button type="button" key={sk.id} className={`chip ${selected ? "active" : ""}`} onClick={() => toggleSkill(sk)}>{sk.name}{selected && <Check size={14}/>}</button>;
              })}</div>
            )}
            {step === 4 && <div className="form-stack"><label>Preferred locations<select value={form.preferredLocation} onChange={e => setForm({ ...form, preferredLocation: e.target.value })}><option>Goa + Remote</option><option>Goa</option><option>Pan India</option><option>Remote</option></select></label><label>Career goal<input value={form.careerGoal} onChange={e => setForm({ ...form, careerGoal: e.target.value })} placeholder="e.g. Backend Developer"/></label><label>Study preference<select value={form.studyPreference} onChange={e => setForm({ ...form, studyPreference: e.target.value })}><option>Online / Part-time</option><option>Offline</option><option>Hybrid</option></select></label></div>}
            <div className="form-actions"><button className="btn ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}><ArrowLeft/> Back</button><button className="btn primary" disabled={submitting || (step === 3 && skillsLoading)} onClick={() => step === 4 ? finish() : handleStepForward()}>{step === 4 ? (submitting ? "Saving..." : "Finish") : "Next"} <ArrowRight/></button></div>
          </> : <div className="complete-state">
            <div className="success-orb"><CheckCircle2 size={42}/></div>
            <h1>Your profile is ready.</h1>
            <p>We can now personalize careers, skill gaps and pathways around your goals.</p>
            {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error}</p>}
            <button className="btn primary" onClick={() => navigate("/dashboard")}>Go to my dashboard <ArrowRight/></button>
          </div>}
        </div>
      </div>
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
    Promise.allSettled([api.profile(), api.careers({ limit: 3 })]).then(([profileRes, careersRes]) => {
      if (!active) return;
      setProfile(profileRes.status === "fulfilled" ? unwrapObject(profileRes.value) : null);
      setCareers(careersRes.status === "fulfilled" ? unwrapList(careersRes.value).map(normalizeCareer) : []);

      const lastPathwayId = getLastPathwayId(user?.id, null);
      if (lastPathwayId) {
        api.pathwayProgress(lastPathwayId).then(res => {
          if (!active) return;
          const p = unwrapObject(res);
          setPathwaySummary({ title: "Your active pathway", status: p.status, steps: p.steps || [] });
        }).catch(() => { /* the remembered id is stale (e.g. different backend/db) - just show "no pathway yet" */ });
      }
      setStatus("ready");
    });
    return () => { active = false; };
  }, [user?.id]);

  if (status === "loading") return <AppShell><LoadingState label="Loading your dashboard..."/></AppShell>;

  const goalText = profile?.career_goal;

  return (
    <AppShell><div className="dashboard">
      <div className="page-heading-row"><div><div className="section-kicker">DASHBOARD</div><h1>Good morning{getLocalName(user?.id) ? `, ${getLocalName(user?.id).split(" ")[0]}` : ""} <span>👋</span></h1><p>Here's a quick overview of your career journey.</p></div><button className="btn outline" onClick={() => navigate("/profile")}><UserRound size={16}/> Edit Profile</button></div>
      {goalText ? (
        <div className="goal-card"><div><span className="label">YOUR CURRENT GOAL</span><h2>{goalText}</h2><Link to="/careers">Explore matching careers <ArrowRight size={14}/></Link></div></div>
      ) : (
        <div className="goal-card"><div><span className="label">YOUR CURRENT GOAL</span><h2>Not set yet</h2><Link to="/profile">Set a career goal <ArrowRight size={14}/></Link></div></div>
      )}
      <div className="section-title"><h2>Quick actions</h2></div>
      <div className="quick-grid">
        <ActionCard icon={Compass} title="Explore Careers" text="Find careers based on your profile." to="/careers"/>
        <ActionCard icon={RouteIcon} title="Continue Learning Plan" text="See your next steps." to="/pathway"/>
        <ActionCard icon={BriefcaseBusiness} title="Find Opportunities" text="Jobs, exams and training programmes." to="/opportunities"/>
      </div>
      <div className="two-col">
        <div className="panel">
          <div className="panel-head"><div><span className="label">YOUR PATHWAY</span><h2>{pathwaySummary?.title ?? "No pathway yet"}</h2></div><Link to="/pathway">View all</Link></div>
          {pathwaySummary?.steps?.length ? <div className="mini-path">{pathwaySummary.steps.slice(0, 4).map((s, i) => <div className={`mini-step ${(s.status ?? "not_started").toLowerCase()}`} key={s.id ?? i}><div className="mini-dot">{s.status === "completed" ? <Check size={13}/> : i + 1}</div><div><b>{s.title}</b><span>{s.description}</span></div></div>)}</div> : <p className="muted">Generate a pathway from a career guide to see it here.</p>}
        </div>
        <div className="panel">
          <div className="panel-head"><div><span className="label">EXPLORE CAREERS</span><h2>Careers to explore</h2></div><Link to="/careers">See all</Link></div>
          <div className="rec-list">{careers.map(c => <Link className="rec-item" to={`/careers/${c.id}`} key={c.id}><div className="career-thumb"><BriefcaseBusiness size={17}/></div><div><b>{c.title}</b><span>{c.description?.slice(0, 60) || "View career guide"}</span></div><ArrowRight size={16}/></Link>)}</div>
        </div>
      </div>
    </div></AppShell>
  );
}

function ActionCard({ icon: Icon, title, text, to }) {
  return <Link className="action-card" to={to}><div className="action-icon"><Icon size={20}/></div><div><b>{title}</b><span>{text}</span></div><ArrowRight size={17}/></Link>
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
    title: r.title ?? r.career_title ?? r.name ?? "Recommended career",
    reasoning: r.reasoning ?? r.explanation ?? r.why ?? "",
    matchScore: r.match_score ?? r.matchScore ?? r.score ?? null,
    missingSkills: r.missing_skills ?? r.skill_gaps ?? r.gaps ?? []
  };
}

function Careers() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [careers, setCareers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  const [recommending, setRecommending] = useState(false);
  const [recommendation, setRecommendation] = useState(null); // { id, results }
  const [recError, setRecError] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});

  function load(search) {
    let active = true;
    setStatus("loading");
    setError(null);
    api.careers(search ? { search } : {}).then(data => {
      if (!active) return;
      setCareers(unwrapList(data).map(normalizeCareer));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus("error");
    });
    return () => { active = false; };
  }
  useEffect(() => load(searchParams.get("search") || ""), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setSearchParams(next.trim() ? { search: next } : {});
    load(next);
  }

  // Real integration for POST /recommendations/careers (auth required).
  // Uses the user's saved profile (goal + preferred locations) - the
  // backend fills in anything omitted from the profile itself, so no
  // extra form is needed here.
  async function findCareersForMe() {
    if (!getToken()) { setRecError({ status: 401, message: "Log in to get recommendations based on your profile." }); return; }
    setRecommending(true);
    setRecError(null);
    try {
      const res = await api.recommendCareers({});
      const data = unwrapObject(res);
      setRecommendation({ id: data.recommendation_id, results: (data.results || []).map(normalizeRecommendationResult) });
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
      setFeedbackGiven(f => ({ ...f, [recommendation.id]: rating }));
    } catch { /* non-critical - feedback failing shouldn't block the page */ }
  }

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">CAREER DISCOVERY</div><h1>Explore careers</h1><p>Browse career directions and understand what it takes to get there.</p></div><button className="btn primary" onClick={findCareersForMe} disabled={recommending}><Sparkles size={16}/> {recommending ? "Finding careers..." : "Find careers for me"}</button></div>
    <div className="search-bar"><Search/><input aria-label="Search careers" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(query)} placeholder="Search careers by title, skill or keyword"/><button type="button" onClick={() => runSearch(query)}>Search</button></div>

    {recError && <ErrorState text={recError.message} status={recError.status} onRetry={findCareersForMe}/>}
    {recommendation && (
      <div className="panel" style={{ marginBottom: 18 }}>
        <div className="panel-head"><div><span className="label">RECOMMENDED FOR YOU</span><h2>Based on your profile</h2></div>
          {recommendation.id && !feedbackGiven[recommendation.id] && <div style={{ display: "flex", gap: 8 }}>
            <button className="btn outline" onClick={() => sendFeedback("helpful")}>Helpful</button>
            <button className="btn outline" onClick={() => sendFeedback("not_helpful")}>Not helpful</button>
          </div>}
          {recommendation.id && feedbackGiven[recommendation.id] && <span className="muted">Thanks for the feedback.</span>}
        </div>
        {recommendation.results.length ? recommendation.results.map((r, i) => (
          <div className="rec-item" key={r.careerId ?? i}>
            <div className="career-thumb"><Sparkles size={17}/></div>
            <div><b>{r.title}</b>{r.reasoning && <span>{r.reasoning}</span>}{r.missingSkills?.length > 0 && <span>Skills to build: {r.missingSkills.map(s => s.skill ?? s.name ?? s).join(", ")}</span>}</div>
            {r.careerId && <Link className="btn outline" to={`/careers/${r.careerId}`}>View <ArrowRight size={14}/></Link>}
          </div>
        )) : <p className="muted">The recommendation service didn't return any specific careers this time.</p>}
      </div>
    )}

    <div className="listing-layout">
      <aside className="filters">
        <div className="filter-head">Filters</div>
        <div className="source-note learn-note"><ShieldCheck size={15}/><span>The careers API only supports keyword search right now - it has no industry, education, location or career-type fields to filter on, so those facets aren't shown here rather than faking them.</span></div>
      </aside>
      <div className="results">
        {status === "ready" && <div className="results-top"><span>Showing <b>{careers.length}</b> careers</span></div>}
        {status === "loading" && <LoadingState label="Loading careers..."/>}
        {status === "error" && <ErrorState text={error?.message} status={error?.status} onRetry={() => load(query)}/>}
        {status === "ready" && (careers.length ? careers.map(c => <CareerRow c={c} key={c.id}/>) : <EmptyState title="No careers matched that search" text="Try a career title or a skill such as SQL or Python." action="Clear search" onAction={() => runSearch("")}/>)}
      </div>
    </div>
  </div></AppShell>
}

function CareerRow({ c }) {
  return <Link className="career-row" to={`/careers/${c.id}`}><div className="career-image"><BriefcaseBusiness size={21}/></div><div className="career-row-main"><h3>{c.title}</h3><p>{c.description}</p></div><ArrowRight className="row-arrow" size={19}/></Link>
}

function EmptyState({ title, text, action, onAction }) {
  return <div className="empty-state"><Search size={24}/><h2>{title}</h2><p>{text}</p>{action && <button className="btn outline" onClick={onAction}>{action}</button>}</div>;
}

function CareerDetail() {
  const { user } = useAuth();
  const location = useLocation();
  const params = useParams();
  const id = params.id || location.pathname.split("/").filter(Boolean).pop() || "";
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
      nextIds = savedIds.filter(savedId => savedId !== id);
    } else {
      nextIds = Array.from(new Set([...savedIds, id]));
    }
    localStorage.setItem(key, JSON.stringify(nextIds));
    setSaved(!saved);
  }

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.career(id).then(data => {
      if (!active) return;
      setC(normalizeCareer(unwrapObject(data)));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus(err.status === 404 ? "notfound" : "error");
    });
    return () => { active = false; };
  }, [id]);

  const TABS = [
    { key: "overview", label: "Overview" },
    { key: "skills", label: "Skills" },
    { key: "pathways", label: "Career Path" },
    { key: "courses", label: "Courses" },
    { key: "opportunities", label: "Opportunities" }
  ];

  useEffect(() => {
    if (tab === "overview" || tabData[tab] || !id) return;
    let active = true;
    setTabStatus("loading");
    const fetchers = {
      skills: () => api.careerSkills(id),
      pathways: () => api.careerPathways(id),
      courses: () => api.careerCourses(id),
      opportunities: () => api.careerOpportunities(id)
    };
    fetchers[tab]().then(res => {
      if (!active) return;
      setTabData(d => ({ ...d, [tab]: unwrapList(res) }));
      setTabStatus("ready");
    }).catch(err => { if (active) setTabStatus("error"); });
    return () => { active = false; };
  }, [tab, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading") return <AppShell><LoadingState label="Loading career..."/></AppShell>;
  if (status === "notfound") return <NotFound/>;
  if (status === "error" || !c) return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  return <AppShell><div className="detail-page">
    <Seo title={`${c.title} Career Guide | CareerGPS`} description={`${c.description} Explore skills, qualifications, pathways and related opportunities with CareerGPS.`} path={location.pathname} breadcrumbs={[{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }, { name: c.title, path: location.pathname }]}/>
    <div className="breadcrumbs"><Link to="/careers">Careers</Link><span>/</span><b>{c.title}</b></div>
    <div className="detail-hero"><div className="detail-image"><BriefcaseBusiness size={42}/></div><div className="detail-title"><div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}><h1>{c.title}</h1><button className="icon-save" onClick={toggleSave} style={{ whiteSpace: "nowrap" }}>{saved ? <BookmarkCheck/> : <Bookmark/>} <span>{saved ? "Saved" : "Save"}</span></button></div><p>{c.description}</p>{c.verificationStatus === "verified" && <div className="detail-meta"><span><ShieldCheck size={15}/>Verified information</span></div>}</div></div>
    <div className="tabs">{TABS.map(t => <a key={t.key} className={tab === t.key ? "active" : ""} onClick={() => setTab(t.key)} style={{ cursor: "pointer" }}>{t.label}</a>)}</div>
    <div className="detail-grid"><div>
      {tab === "overview" && <>
        <section className="panel detail-panel"><h2>Key information</h2><div className="info-grid">
          <Info label="Typical qualification" value={c.qualifications[0]}/>
          <Info label="Entry route" value={c.entryRoutes[0]}/>
        </div></section>
        {c.responsibilities.length > 0 && <section className="panel detail-panel"><h2>Typical responsibilities</h2><ul className="check-list">{c.responsibilities.map((r, i) => <li key={i}>{r}</li>)}</ul></section>}
        {c.qualifications.length > 1 && <section className="panel detail-panel"><h2>Qualifications</h2><ul className="check-list">{c.qualifications.map((q, i) => <li key={i}>{q}</li>)}</ul></section>}
      </>}
      {tab !== "overview" && tabStatus === "loading" && <LoadingState label={`Loading ${tab}...`}/>}
      {tab !== "overview" && tabStatus === "error" && <ErrorState text="Could not load this section."/>}
      {tab === "skills" && tabStatus === "ready" && (
        (tabData.skills || []).length
          ? <section className="panel detail-panel"><h2>Key skills</h2><div className="tag-row">{tabData.skills.map(s => <span key={s.id}>{s.name}{s.importance === "required" && " *"}</span>)}</div><p className="muted" style={{ marginTop: 10 }}>* required skill</p></section>
          : <EmptyState title="No skills listed yet" text="This career guide doesn't have documented skills yet."/>
      )}
      {tab === "pathways" && tabStatus === "ready" && (
        (tabData.pathways || []).length
          ? <div className="listing-page" style={{ padding: 0 }}>{tabData.pathways.map(p => <div className="panel detail-panel" key={p.id}><h2>{p.title}</h2><p className="muted">{p.description}</p>{p.verification_status === "verified"
  ? <Link className="btn primary" to={`/pathway?career=${c.id}&pathway=${p.id}`}>Generate this pathway <ArrowRight size={15}/></Link>
  : <span className="muted" title="This pathway must be verified before it can be personalized.">Verification pending</span>}</div>)}</div>
          : <EmptyState title="No pathway template yet" text="A step-by-step pathway hasn't been published for this career yet."/>
      )}
      {tab === "courses" && tabStatus === "ready" && (
        (tabData.courses || []).length
          ? <div className="institution-grid">{tabData.courses.map(course => <div className="institution-card" key={course.id}><div className="institution-image"><GraduationCap size={26}/></div><span className="tag">{course.course_type || course.qualification || "Course"}</span><h2>{course.title}</h2>{course.institution_name && <p><Building2 size={14}/>{course.institution_name}</p>}<span className="muted">{course.duration_text || course.mode || ""}</span></div>)}</div>
          : <EmptyState title="No courses linked yet" text="No institution or course has been linked to this career yet."/>
      )}
      {tab === "opportunities" && tabStatus === "ready" && (
        (tabData.opportunities || []).length
          ? <div className="opportunity-list">{tabData.opportunities.map(o => <Link className="opportunity-card" to={`/opportunities/${o.id}`} key={o.id}><div className="opp-logo"><Building2/></div><div className="opp-main"><div className="opp-top"><span className={`status-pill ${(o.status || "").toLowerCase()}`}>{o.status}</span><span>{o.opportunity_type}</span></div><h2>{o.title}</h2><p><Building2 size={14}/>{o.organization} · <MapPin size={14}/>{o.location}</p></div><ArrowRight size={18}/></Link>)}</div>
          : <EmptyState title="No linked opportunities yet" text="No current opportunity is linked to this career yet."/>
      )}
    </div>
    <aside className="eligibility-card"><div className="eligibility-icon"><ShieldCheck/></div><h2>Is this career for you?</h2><p>Compare your saved skills against what this career typically requires.</p><div className="eligibility-checks"><span><CheckCircle2/> Uses your saved skills profile</span><span><CheckCircle2/> Shows matched and missing skills</span></div><Link className="btn primary full" to={`/skill-gap?career=${c.id}&title=${encodeURIComponent(c.title)}`}>Check my skill gap <ArrowRight size={16}/></Link><small>Requirements should always be verified against the current official notice.</small></aside></div>
  </div></AppShell>
}

function Info({ label, value }) { return <div><span>{label}</span><b>{value || "—"}</b></div> }

function SkillGap() {
  const [params] = useSearchParams();
  const careerId = params.get("career") || "";
  const careerTitle = params.get("title") || "this career";
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function runCheck() {
    if (!careerId) return;
    if (!getToken()) { setError({ status: 401, message: "Log in to compare your saved skills against a career." }); setStatus("error"); return; }
    setStatus("loading");
    setError(null);
    try {
      // POST /skills/gap-analysis body: { target_career_id } - the real
      // backend capability behind "is this career for you?" (see
      // src/modules/skills/skill-intelligence.routes.js). There is no
      // generic career-eligibility endpoint.
      const res = await api.gapAnalysis({ target_career_id: careerId });
      setResult(unwrapObject(res));
      setStatus("ready");
    } catch (err) {
      setError(err);
      setStatus("error");
    }
  }

  useEffect(() => { runCheck(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [careerId]);

  return <AppShell><div className="eligibility-page">
    <div className="breadcrumbs">{careerId ? <Link to={`/careers/${careerId}`}>← Back to career</Link> : <Link to="/careers">← Back to careers</Link>}</div>
    <div className="page-heading-row"><div><div className="section-kicker">SKILL GAP</div><h1>Your skill gap for {careerTitle}</h1><p>Comparing the skills saved on your profile with what this career typically needs.</p></div></div>
    <div className="eligibility-layout"><div className="panel">
      <div className="panel-head"><div><h2>Matched and missing skills</h2><p>Based on your saved profile skills</p></div><button className="btn outline" onClick={runCheck} disabled={status === "loading" || !careerId}>{status === "loading" ? "Checking..." : "Re-run check"}</button></div>
      {!careerId && <p className="muted">Open this page from a career guide to check your skill gap for that career.</p>}
      {status === "error" && <ErrorState text={error?.message} status={error?.status}/>}
      {status === "loading" && <LoadingState label="Comparing your skills..."/>}
      {status === "ready" && result && <>
        {(result.matched_skills || []).map((s, i) => (
          <div className="requirement" key={`m-${i}`}><div className="req-icon met"><Check size={15}/></div><div><b>{s.skill}</b><span>Level: {s.level}</span></div><em>Matched ({s.importance})</em></div>
        ))}
        {(result.missing_skills || []).map((s, i) => (
          <div className="requirement" key={`x-${i}`}><div className="req-icon missing"><X size={15}/></div><div><b>{s.skill}</b><span>Not yet on your profile</span></div><em>Missing ({s.importance})</em></div>
        ))}
        {!(result.matched_skills || []).length && !(result.missing_skills || []).length && <p className="muted">This career doesn't have documented required skills yet.</p>}
      </>}
    </div><aside className="next-box"><div className="callout"><Lightbulb size={17}/><div><b>Add skills to your profile</b><span>Missing skills shown here can be added from your profile page.</span></div></div><Link className="btn outline full" to="/profile">Update my skills <ArrowRight size={15}/></Link></aside></div>
  </div></AppShell>
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
    if (!getToken()) { setError({ status: 401, message: "Log in to check your eligibility." }); return; }
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

  useEffect(() => { if (opportunityId) runCheck(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [opportunityId]);

  const outcome = result?.outcome;
  const requirements = result?.results || [];
  const outcomeCopy = {
    meets_listed_requirements: { label: "Meets listed requirements", pillClass: "open", icon: <CheckCircle2 size={15}/> },
    does_not_meet_listed_requirements: { label: "Does not meet listed requirements", pillClass: "warning", icon: <X size={15}/> },
    unable_to_determine: { label: "Unable to determine", pillClass: "warning", icon: <CircleHelp size={15}/> }
  }[outcome];

  return <AppShell><div className="eligibility-page">
    <div className="breadcrumbs">{opportunityId ? <Link to={`/opportunities/${opportunityId}`}>← Back to opportunity</Link> : <Link to="/opportunities">← Back to opportunities</Link>}</div>
    <div className="page-heading-row"><div><div className="section-kicker">ELIGIBILITY CHECK</div><h1>Eligibility for {opportunityTitle}</h1><p>Compares your saved profile with this opportunity's structured requirements.</p></div>{outcomeCopy && <span className={`status-pill ${outcomeCopy.pillClass}`}>{outcomeCopy.icon} {outcomeCopy.label}</span>}</div>
    <div className="eligibility-layout"><div className="panel">
      <div className="panel-head"><div><h2>Your eligibility</h2><p>Based on your saved profile</p></div><button className="btn outline" onClick={runCheck} disabled={checking || !opportunityId}>{checking ? "Checking..." : "Re-run check"}</button></div>
      {!opportunityId && <p className="muted">Open this page from an opportunity to check eligibility for it.</p>}
      {error && <ErrorState text={error.message} status={error.status}/>}
      {checking && <LoadingState label="Checking eligibility..."/>}
      {!checking && !error && requirements.map((r, i) => (
        <div className="requirement" key={r.requirement_id ?? i}>
          <div className={`req-icon ${r.status === "satisfied" ? "met" : r.status === "not_satisfied" ? "missing" : "unknown"}`}>{r.status === "satisfied" ? <Check size={15}/> : r.status === "not_satisfied" ? <X size={15}/> : <CircleHelp size={15}/>}</div>
          <div><b>{r.requirement_type}</b><span>{r.requirement_text}</span>{r.reason && <small>{r.reason}</small>}</div>
          <em>{r.status === "satisfied" ? "Meets" : r.status === "not_satisfied" ? "Missing" : "Needs verification"}</em>
        </div>
      ))}
      {!checking && !error && opportunityId && requirements.length === 0 && <p className="muted">No structured requirements have been published for this opportunity yet, so an overall outcome couldn't be produced.</p>}
      {!checking && !error && result?.explanation && <div className="callout" style={{ marginTop: 14 }}><Lightbulb size={17}/><div><b>AI explanation</b><span>{result.explanation}</span></div></div>}
    </div><aside className="next-box"><div className="callout"><Lightbulb size={17}/><div><b>Always verify official sources.</b><span>This result reflects listed requirements only.</span></div></div><div className="source-note"><ShieldCheck size={15}/><span>Always verify the current official recruitment notice before applying.</span></div></aside></div>
  </div></AppShell>
}

function Pathway() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const careerId = params.get("career") || "";
  const templatePathwayId = params.get("pathway") || "";
  const [pathway, setPathway] = useState(null); // full object from GET /pathways/generated/:id or POST /pathways/generate
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [savingStep, setSavingStep] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      setStatus("loading");
      setError(null);
      if (!getToken()) { if (active) setStatus("empty"); return; }
      try {
        // BACKEND GAP: there is no endpoint that lists "all of the current
        // user's generated pathways" - only generate / fetch-by-id /
        // update-progress exist (see src/modules/pathways/pathway.routes.js).
        // The id of the last pathway generated for this career (or overall)
        // is remembered locally so refreshing this page doesn't silently
        // lose it or generate a duplicate.
        const rememberedId = getLastPathwayId(user?.id, careerId || null);
        let data = null;
        if (rememberedId) {
          try { data = unwrapObject(await api.userPathway(rememberedId)); }
          catch (err) { if (err.status !== 404) throw err; /* stale id - fall through to generate */ }
        }
        if (!data && (careerId || templatePathwayId)) {
          const body = templatePathwayId ? { pathway_id: templatePathwayId } : { career_id: careerId };
          const generated = unwrapObject(await api.generatePathway(body));
          setLastPathwayId(user?.id, careerId || null, generated.id);
          data = generated;
        }
        if (!active) return;
        if (!data) { setStatus("empty"); return; }
        setPathway(data);
        setStatus("ready");
      } catch (err) {
        if (active) { setError(err); setStatus("error"); }
      }
    }
    load();
    return () => { active = false; };
  }, [careerId, templatePathwayId, user?.id]);

  async function toggleSave() {
    const templateId = pathway?.pathway_id;
    if (!templateId) return;
    const next = !saved;
    setSaved(next); // optimistic - the backend has no GET that reports "is this saved", only save/unsave actions
    try {
      if (next) await api.savePathway(templateId);
      else await api.unsavePathway(templateId);
    } catch (err) {
      setSaved(!next);
    }
  }

  async function markStepComplete(stepId) {
    const userPathwayId = pathway?.id;
    if (!userPathwayId || savingStep) return;
    setSavingStep(true);
    try {
      const updated = unwrapObject(await api.updatePathwayProgress(userPathwayId, [{ pathway_step_id: stepId, status: "completed" }]));
      setPathway(p => ({ ...p, status: updated.status, steps: updated.steps }));
    } catch (err) {
      setError(err);
    } finally {
      setSavingStep(false);
    }
  }

  if (status === "loading") return <AppShell><LoadingState label="Loading your pathway..."/></AppShell>;
  if (status === "error") return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;
  if (status === "empty") return <AppShell><div className="pathway-page"><div className="page-heading-row"><div><div className="section-kicker">CAREER PATHWAY</div><h1>No pathway yet</h1><p>Pick a career and generate a step-by-step pathway toward it.</p></div></div><EmptyState title="You don't have a pathway yet" text={getToken() ? "Open a career guide and generate a pathway toward it." : "Log in, then open a career guide to generate a pathway toward it."} action="Explore careers" onAction={() => { window.location.href = "/careers"; }}/></div></AppShell>;

  const steps = (pathway?.steps || []).map(s => ({ ...s, stepId: s.pathway_step_id ?? s.id }));
  const total = steps.length;
  const completed = steps.filter(s => s.status === "completed").length;
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const nextStep = steps.find(s => s.status !== "completed");

  return <AppShell><div className="pathway-page">
    <div className="page-heading-row"><div><div className="section-kicker">CAREER PATHWAY</div><h1>{pathway?.career_title ? `Your pathway to ${pathway.career_title}` : "Your pathway"}</h1><p>A step-by-step plan based on your profile.</p></div>
      {pathway?.pathway_id && <button className="icon-save" onClick={toggleSave}>{saved ? <BookmarkCheck/> : <Bookmark/>} <span>{saved ? "Saved" : "Save"}</span></button>}
    </div>
    {error && <p style={{ color: "var(--red)", fontSize: 11 }}>{error.message}</p>}
    <div className="pathway-layout"><div className="panel pathway-card"><div className="pathway-line"/>
      {steps.length ? steps.map((s, i) => (
        <div className={`path-step ${s.status === "completed" ? "completed" : (nextStep && s.stepId === nextStep.stepId ? "next" : "")}`} key={s.stepId ?? i}>
          <div className="path-num">{s.status === "completed" ? <Check size={15}/> : i + 1}</div>
          <div className="path-copy">
            <div className="path-title"><h3>{s.title}</h3><span>{s.status === "completed" ? "Completed" : s.status === "in_progress" ? "In progress" : "Not started"}</span></div>
            <p>{s.description}</p>
            {s.status !== "completed" && <div className="next-actions"><button className="btn outline" disabled={savingStep} onClick={() => markStepComplete(s.stepId)}>{savingStep ? "Saving..." : "Mark complete"}</button></div>}
          </div>
        </div>
      )) : <EmptyState title="No steps yet" text="This pathway doesn't have steps yet."/>}
    </div><aside className="panel path-summary"><span className="label">YOUR PROGRESS</span><div className="big-progress"><b>{pct}%</b><span>{completed} of {total} steps</span></div><div className="progress large"><i style={{ width: `${pct}%` }}/></div></aside></div>
  </div></AppShell>
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
    api.opportunities({
      search: search.trim() || undefined,
      opportunity_type: type !== "All" ? type : undefined,
      location: locationFilter !== "All" ? locationFilter : undefined
    }).then(data => {
      if (!active) return;
      setOpportunities(unwrapList(data).map(normalizeOpportunity));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus("error");
    });
    return () => { active = false; };
  }, [search, type, locationFilter]);

  const filterBar = <div className="opportunity-filter"><Search/><input aria-label="Search opportunities" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search opportunities"/><select aria-label="Opportunity type" value={type} onChange={e => setType(e.target.value)}><option>All</option><option>Government</option><option>Internship</option><option>Apprenticeship</option></select><select aria-label="Opportunity location" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}><option>All</option><option>Goa</option><option>Remote</option><option>Pan India</option></select></div>;

  // "Closing soon" is a real client-side filter over real deadline data
  // (application_deadline), not a separate backend endpoint.
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const visible = closingSoon
    ? opportunities.filter(o => o.deadlineDate && (o.deadlineDate.getTime() - Date.now()) <= THIRTY_DAYS_MS && (o.deadlineDate.getTime() - Date.now()) >= 0)
    : opportunities;

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">OPPORTUNITIES</div><h1>Jobs, internships & programmes</h1><p>Explore opportunities and verify the official notice before applying.</p></div></div>
    <div className="tabs opportunity-tabs"><a className={closingSoon ? "" : "active"} onClick={() => setClosingSoon(false)} style={{ cursor: "pointer" }}>All opportunities</a><a className={closingSoon ? "active" : ""} onClick={() => setClosingSoon(true)} style={{ cursor: "pointer" }}>Closing soon</a></div>
    {filterBar}
    {status === "loading" && <LoadingState label="Loading opportunities..."/>}
    {status === "error" && <ErrorState text={error?.message} status={error?.status}/>}
    {status === "ready" && (visible.length
      ? <div className="opportunity-list">{visible.map(o => <Link className="opportunity-card" to={`/opportunities/${o.id}`} key={o.id}><div className="opp-logo"><Building2/></div><div className="opp-main"><div className="opp-top"><span className={`status-pill ${o.status.toLowerCase()}`}>{o.status}</span><span>{o.type}</span></div><h2>{o.title}</h2><p><Building2 size={14}/>{o.org} · <MapPin size={14}/>{o.location}</p><div className="opp-meta"><span><CalendarDays/> Deadline: <b>{o.deadline}</b></span></div></div><ArrowRight size={18}/></Link>)}</div>
      : <EmptyState title={closingSoon ? "Nothing is closing in the next 30 days" : "No verified opportunities are listed yet"} text="CareerGPS does not show example vacancies as if they are live. Check back when a source-backed listing is available."/>)}
  </div></AppShell>;
}

function OpportunityDetail() {
  const location = useLocation();
  const params = useParams();
  const id = params.id || location.pathname.split("/").filter(Boolean).pop() || "";
  const [o, setO] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.opportunity(id).then(data => {
      if (!active) return;
      setO(unwrapObject(data));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus(err.status === 404 ? "notfound" : "error");
    });
    return () => { active = false; };
  }, [id]);

  if (status === "loading") return <AppShell><LoadingState label="Loading opportunity..."/></AppShell>;
  if (status === "notfound") return <NotFound/>;
  if (status === "error" || !o) return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  const deadline = o.application_deadline ? new Date(o.application_deadline).toLocaleDateString() : "Not specified";
  const requirements = o.requirements || [];
  const relatedCareers = o.related_careers || [];

  return <AppShell><div className="detail-page">
    <div className="breadcrumbs"><Link to="/opportunities">Opportunities</Link><span>/</span><b>{o.title}</b></div>
    <div className="detail-hero"><div className="detail-image"><Building2 size={42}/></div><div className="detail-title"><div className="tag">{o.opportunity_type}</div><h1>{o.title}</h1><p>{o.description}</p><div className="detail-meta"><span><Building2 size={15}/>{o.organization}</span><span><MapPin size={15}/>{o.location}</span><span><CalendarDays size={15}/>Deadline: {deadline}</span><span className={`status-pill ${(o.status || "").toLowerCase()}`}>{o.status}</span></div></div></div>
    <div className="detail-grid"><div>
      <section className="panel detail-panel"><h2>Requirements</h2>
        {requirements.length ? requirements.map(r => <div className="requirement" key={r.id}><div className="req-icon unknown"><CircleHelp size={15}/></div><div><b>{r.requirement_type}</b><span>{r.requirement_text}</span></div></div>) : <p className="muted">No structured requirements have been published for this opportunity yet.</p>}
      </section>
      {relatedCareers.length > 0 && <section className="panel detail-panel"><h2>Related careers</h2><div className="tag-row">{relatedCareers.map(c => <Link key={c.career_id} to={`/careers/${c.career_id}`}>{c.title}</Link>)}</div></section>}
    </div>
    <aside className="eligibility-card"><div className="eligibility-icon"><ShieldCheck/></div><h2>Are you eligible?</h2><p>Compare your saved profile with this opportunity's structured requirements.</p><Link className="btn primary full" to={`/eligibility?opportunity=${o.id}&title=${encodeURIComponent(o.title)}`}>Check my eligibility <ArrowRight size={16}/></Link><small>Always verify requirements against the official notice.</small>{o.source_url && <a href={o.source_url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: 12, fontSize: 11 }}>Official source <ExternalLink size={12}/></a>}</aside>
    </div>
  </div></AppShell>;
}

function Institutions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("search") || "");
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  function load(search) {
    let active = true;
    setStatus("loading");
    setError(null);
    api.institutions(search ? { search } : {}).then(data => {
      if (!active) return;
      setItems(unwrapList(data).map(normalizeInstitution));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus("error");
    });
    return () => { active = false; };
  }
  useEffect(() => load(searchParams.get("search") || ""), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setSearchParams(next.trim() ? { search: next } : {});
    load(next);
  }

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">LEARN</div><h1>Institutions & courses</h1><p>Find institutions that can help you close your skill or qualification gaps.</p></div></div>
    <div className="search-bar"><Search/><input aria-label="Search institutions" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(query)} placeholder="Search institutions by name or location"/><button type="button" onClick={() => runSearch(query)}>Search</button></div>
    {status === "loading" && <LoadingState label="Loading institutions..."/>}
    {status === "error" && <ErrorState text={error?.message} status={error?.status} onRetry={() => load(query)}/>}
    {status === "ready" && (items.length
      ? <div className="institution-grid">{items.map(i => <Link className="institution-card" to={`/institutions/${i.id}`} key={i.id}><div className="institution-image"><Building2 size={26}/></div><h2>{i.name}</h2>{i.location && <p><MapPin size={14}/>{i.location}</p>}<span className="btn outline full">View institution <ArrowRight size={15}/></span></Link>)}</div>
      : <EmptyState title="No institutions matched that search" text="Try a different name or location." action="Clear search" onAction={() => runSearch("")}/>)}
    <div className="source-note learn-note"><ShieldCheck size={15}/><span>CareerGPS lists institutions for reference only. Confirm admissions, fees and recognition directly with the institution.</span></div>
  </div></AppShell>;
}

function InstitutionDetail() {
  const location = useLocation();
  const params = useParams();
  const id = params.id || location.pathname.split("/").filter(Boolean).pop() || "";
  const [inst, setInst] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    api.institution(id).then(data => {
      if (!active) return;
      setInst(normalizeInstitution(unwrapObject(data)));
      setStatus("ready");
    }).catch(err => {
      if (!active) return;
      setError(err);
      setStatus(err.status === 404 ? "notfound" : "error");
    });
    return () => { active = false; };
  }, [id]);

  if (status === "loading") return <AppShell><LoadingState label="Loading institution..."/></AppShell>;
  if (status === "notfound") return <NotFound/>;
  if (status === "error" || !inst) return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  return <AppShell><div className="detail-page">
    <div className="breadcrumbs"><Link to="/institutions">Institutions</Link><span>/</span><b>{inst.name}</b></div>
    <div className="detail-hero"><div className="detail-image"><Building2 size={42}/></div><div className="detail-title"><h1>{inst.name}</h1><p>{inst.description}</p>{inst.location && <div className="detail-meta"><span><MapPin size={15}/>{inst.location}</span></div>}</div></div>
    {inst.website_url && <section className="panel detail-panel"><h2>Website</h2><a href={inst.website_url} target="_blank" rel="noreferrer">{inst.website_url} <ExternalLink size={13}/></a></section>}
  </div></AppShell>;
}

function Learn() {
  const [careers, setCareers] = useState([]);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let active = true;
    api.careers().then(data => {
      if (!active) return;
      setCareers(unwrapList(data).map(normalizeCareer).slice(0, 4));
      setStatus("ready");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, []);

  return <AppShell><div className="listing-page"><div className="page-heading-row"><div><div className="section-kicker">LEARNING</div><h1>Build skills for your next step</h1><p>Start with the skills and qualifications listed on each career guide, then use the institution directory to compare learning options.</p></div><Link className="btn primary" to="/careers">Explore career guides <ArrowRight size={16}/></Link></div>
    {status === "loading" && <LoadingState label="Loading career guides..."/>}
    {status === "error" && <ErrorState text="Could not load career guides."/>}
    {status === "ready" && <div className="learning-grid">{careers.map(c => <Link className="learning-card" key={c.id} to={`/careers/${c.id}`}><BookOpen/><h2>{c.title}</h2><p>{c.qualifications[0] ? `Typical qualification: ${c.qualifications[0]}` : c.description}</p><span>View career guide <ArrowRight size={15}/></span></Link>)}</div>}
    <div className="source-note learn-note"><ShieldCheck size={15}/><span>CareerGPS lists learning directions, not endorsements of individual courses. Confirm curriculum, eligibility, fees and recognition directly with the provider.</span></div>
  </div></AppShell>;
}

function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState(null);
  const [status, setStatus] = useState("loading");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  // All available skills from GET /skills (the database catalogue)
  const [allSkills, setAllSkills] = useState([]);     // [{ id, name, description, category }]
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(null);
  // The user's currently saved skills from GET /skills/me (user_skills join table)
  // Each element: { id, name, level, years_experience, verified }
  const [userSkillIds, setUserSkillIds] = useState(new Set()); // Set of skill_id strings
  const [userSkillLevels, setUserSkillLevels] = useState({});  // { skill_id: level }

  useEffect(() => {
    let active = true;
    // Load profile data, all skills, and user's own skills in parallel.
    Promise.allSettled([
      api.profile(),
      api.skills(),        // GET /skills — all published skills in the database
      api.mySkills()       // GET /skills/me — this user's saved user_skills rows
    ]).then(([profileRes, allSkillsRes, mySkillsRes]) => {
      if (!active) return;

      if (profileRes.status === "fulfilled") {
        const p = unwrapObject(profileRes.value);
        const edu = Array.isArray(p.education) && p.education.length ? p.education[0] : {};
        setForm({
          localName: getLocalName(),
          email: user?.email ?? "",
          qualification: edu.qualification ?? "BCA",
          educationStatus: edu.status ? edu.status.charAt(0).toUpperCase() + edu.status.slice(1) : "Pursuing",
          careerGoal: p.career_goal ?? "",
          preferredLocations: Array.isArray(p.preferred_locations) && p.preferred_locations.length ? p.preferred_locations : ["Goa", "Remote"],
          interests: Array.isArray(p.interests) ? p.interests : [],
          experience: Array.isArray(p.experience) ? p.experience : [],
          constraints: p.constraints && typeof p.constraints === "object" ? p.constraints : {}
        });
        setStatus("ready");
      } else {
        setError(profileRes.reason);
        setStatus("error");
      }

      if (allSkillsRes.status === "fulfilled") {
        setAllSkills(unwrapList(allSkillsRes.value));
        setSkillsError(null);
      } else {
        setSkillsError(allSkillsRes.reason?.message || "Could not load skill catalogue.");
      }
      setSkillsLoading(false);

      if (mySkillsRes.status === "fulfilled") {
        const mySkills = unwrapList(mySkillsRes.value);
        setUserSkillIds(new Set(mySkills.map(s => s.id)));
        const levels = {};
        mySkills.forEach(s => { levels[s.id] = s.level || "beginner"; });
        setUserSkillLevels(levels);
      }
    });
    return () => { active = false; };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    setSaving(true);
    setSavedMsg("");
    setError(null);
    try {
      // 1. Save profile fields via PUT /profiles/me
      await api.updateProfile({
        education: [
          { qualification: form.qualification, status: (form.educationStatus || "pursuing").toLowerCase() }
        ],
        experience: form.experience,
        interests: form.interests,
        preferred_locations: form.preferredLocations,
        career_goal: form.careerGoal || null,
        constraints: form.constraints
      });
      // 2. Save user_skills via PUT /skills/me with proper skill_id UUIDs.
      //    This writes to the user_skills join table and is the canonical
      //    way to persist a user's skills for gap analysis and recommendations.
      await api.updateMySkills({
        skills: Array.from(userSkillIds).map(skill_id => ({
          skill_id,
          level: userSkillLevels[skill_id] || "beginner"
        }))
      });
      setLocalName(form.localName);
      await refreshUser();
      setSavedMsg("Profile and skills saved.");
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  function toggleSkill(skillId) {
    setUserSkillIds(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
        // Default level when selecting a new skill
        if (!userSkillLevels[skillId]) {
          setUserSkillLevels(lv => ({ ...lv, [skillId]: "beginner" }));
        }
      }
      return next;
    });
  }

  if (status === "loading") return <AppShell><LoadingState label="Loading your profile..."/></AppShell>;
  if (status === "error" || !form) return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  return <AppShell><div className="profile-page">
    <div className="page-heading-row"><div><div className="section-kicker">PROFILE</div><h1>Your career profile</h1><p>Keep your information up to date so recommendations stay relevant.</p></div><button className="btn primary" onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save changes"}</button></div>
    {error && <p style={{ color: "var(--red)", fontSize: 12 }}>{error.message}</p>}
    {savedMsg && <p style={{ color: "var(--green)", fontSize: 12 }}>{savedMsg}</p>}
    <div className="profile-grid">
      <div className="panel">
        <div className="profile-head"><div className="avatar large">{(form.localName || "?").charAt(0).toUpperCase()}</div><div><h2>{form.localName || "Your name"}</h2><p>{form.educationStatus} · {joinLocations(form.preferredLocations)}</p></div></div>
        <div className="form-grid">
          <label>Full name<input value={form.localName} onChange={e => setForm({ ...form, localName: e.target.value })}/></label>
          <label>Email<input value={form.email} readOnly/></label>
          <label>Education<select value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })}><option>BCA</option><option>B.Tech</option><option>Diploma</option><option>12th Pass</option><option>Graduate</option></select></label>
          <label>Status<select value={form.educationStatus} onChange={e => setForm({ ...form, educationStatus: e.target.value })}><option>Pursuing</option><option>Completed</option></select></label>
        </div>
      </div>
      <div className="panel">
        <h2>Skills &amp; interests</h2>
        {skillsLoading && <LoadingState label="Loading skills..."/>}
        {skillsError && !skillsLoading && <p style={{ color: "var(--red)", fontSize: 11 }}>Could not load skill catalogue: {skillsError}</p>}
        {!skillsLoading && !skillsError && allSkills.length === 0 && <p className="muted">No skills are published in the CareerGPS database yet.</p>}
        {!skillsLoading && allSkills.length > 0 && (
          <div className="chip-picker compact">
            {allSkills.map(sk => {
              const selected = userSkillIds.has(sk.id);
              return (
                <span
                  key={sk.id}
                  className={`chip ${selected ? "active" : ""}`}
                  onClick={() => toggleSkill(sk.id)}
                  style={{ cursor: "pointer" }}
                  title={sk.description || sk.name}
                >
                  {sk.name}{selected && <Check size={14}/>}
                </span>
              );
            })}
          </div>
        )}
        <div className="form-stack"><label>Career goal<input value={form.careerGoal} onChange={e => setForm({ ...form, careerGoal: e.target.value })}/></label><label>Preferred location<select value={joinLocations(form.preferredLocations)} onChange={e => setForm({ ...form, preferredLocations: parseLocations(e.target.value) })}><option>Goa + Remote</option><option>Goa</option><option>Pan India</option><option>Remote</option></select></label></div>
      </div>
    </div>
  </div></AppShell>;
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
      api.assistantConversations().then(res => setConversations(unwrapList(res)))
        .catch(() => {})
        .finally(() => setLoadingList(false));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startNew() { setConversationId(null); setMessages([]); setError(null); setLastMessageText(null); setShowHistory(false); }

  function openConversation(id) {
    setLoadingConvo(true); setError(null);
    api.assistantConversation(id).then(res => {
      const data = unwrapObject(res);
      setConversationId(data.id);
      setMessages(data.messages || []);
      setShowHistory(false);
    }).catch(err => setError(err)).finally(() => setLoadingConvo(false));
  }

  async function send(retryText) {
    const text = retryText ?? input.trim();
    if (!text || sending) return;
    if (!retryText) {
      setInput("");
      setMessages(m => [...m, { id: `local-${Date.now()}`, role: "user", content: text, created_at: new Date().toISOString() }]);
    }
    setLastMessageText(text); setError(null); setSending(true);
    try {
      const res = await api.assistantChat({ conversation_id: conversationId || undefined, message: text });
      const data = unwrapObject(res);
      console.debug("[CareerGPS Assistant]", { conversationId: data.conversation_id, requestStatus: "success" });
      setConversationId(data.conversation_id);
      setMessages(m => [...m, data.message]);
      api.assistantConversations().then(r => setConversations(unwrapList(r))).catch(() => {});
    } catch (err) {
      console.debug("[CareerGPS Assistant]", { conversationId, requestStatus: "error", responseStatus: err.status || "network" });
      let msg = "Unable to connect to the CareerGPS backend.";
      if (err.status === 401) msg = "Your session has expired. Please log in again.";
      else if (err.status === 403) msg = "You don't have permission to use the assistant.";
      else if (err.status === 404) msg = "Conversation not found.";
      else if (err.status === 429) msg = "Too many requests. Please try again shortly.";
      else if (err.status >= 500) msg = "CareerGPS couldn't process that request. Please try again.";
      else if (err.message) msg = err.message;
      setError(new Error(msg));
    } finally {
      setSending(false);
    }
  }

  async function removeConversation(id, e) {
    e.stopPropagation();
    try { await api.deleteAssistantConversation(id); setConversations(c => c.filter(x => x.id !== id)); if (conversationId === id) startNew(); } catch {}
  }

  return <AppShell><div className="listing-page">
    <div className="page-heading-row">
      <div><div className="section-kicker">AI ASSISTANT</div><h1>CareerGPS Assistant</h1><p>Ask about careers, pathways, courses and opportunities in Goa. Answers are grounded in CareerGPS data.</p></div>
      <div style={{ display: "flex", gap: 8 }}>
        {loggedIn && <button className="btn outline" onClick={() => setShowHistory(s => !s)}><MessageCircle size={16}/> {showHistory ? "Back to chat" : "History"}</button>}
        {loggedIn && <button className="btn outline" onClick={startNew}><Plus size={16}/> New chat</button>}
      </div>
    </div>
    {!loggedIn ? (
      <div className="empty-state"><Bot size={24}/><h2>Log in to use the assistant</h2><p>Your conversations are saved to your account so you can continue them later.</p><Link className="btn primary" to="/login">Log in <ArrowRight size={15}/></Link></div>
    ) : showHistory ? (
      <div className="panel" style={{ padding: 16 }}>
        <h2 style={{ fontSize: 15, marginBottom: 16 }}>Conversation history</h2>
        {loadingList && <LoadingState label="Loading conversations..."/>}
        {!loadingList && conversations.length === 0 && <p className="muted">No conversations yet. Start a new chat.</p>}
        {conversations.map(c => (
          <div className="assistant-convo-row" key={c.id} onClick={() => openConversation(c.id)} style={{ padding: "12px 10px", fontSize: 13 }}>
            <span>{c.title || "Untitled conversation"}</span>
            <button className="icon-btn" onClick={(e) => removeConversation(c.id, e)} title="Delete conversation"><Trash2 size={14}/></button>
          </div>
        ))}
      </div>
    ) : (
      <div className="panel" style={{ display: "flex", flexDirection: "column", minHeight: 520, maxHeight: "70vh", padding: 0 }}>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {loadingConvo && <LoadingState label="Loading conversation..."/>}
          {!loadingConvo && messages.length === 0 && <div className="assistant-empty" style={{ marginTop: "auto", marginBottom: "auto" }}><Sparkles size={22}/><p>Ask me about careers, courses, pathways or opportunities available through CareerGPS. I'll use CareerGPS data rather than guessing.</p></div>}
          {messages.map((m, i) => (
            <div className={`assistant-msg ${m.role}`} key={m.id ?? i}>
              <div className="assistant-bubble">{m.content}</div>
              {Array.isArray(m.citations) && m.citations.length > 0 && (
                <div className="assistant-citations">{m.citations.map((c, ci) => { const label = typeof c === "string" ? c : (c.title || c.source_url || "Source"); const url = typeof c === "object" && c ? (c.source_url || c.url) : null; return url ? <a key={ci} href={url} target="_blank" rel="noreferrer">{label} <ExternalLink size={11}/></a> : <span key={ci}>{label}</span>; })}</div>
              )}
            </div>
          ))}
          {sending && <div className="assistant-msg assistant"><div className="assistant-bubble typing"><span/><span/><span/></div></div>}
        </div>
        {error && <div className="assistant-error"><p>{error.message}</p><button className="btn outline" onClick={() => send(lastMessageText)}>Retry</button></div>}
        <div className="assistant-input-row" style={{ borderTop: "1px solid var(--line)", padding: 12, display: "flex", gap: 8 }}>
          <input style={{ flex: 1, border: "1px solid var(--line)", borderRadius: 20, padding: "10px 16px", fontSize: 13, outline: "none" }} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Ask something..." disabled={sending}/>
          <button className="assistant-send" onClick={() => send()} disabled={sending || !input.trim()} aria-label="Send"><Send size={16}/></button>
        </div>
      </div>
    )}
  </div></AppShell>;
}

// Dedicated /recommendations page
function RecommendationsPage() {
  const [status, setStatus] = useState("idle");
  const [recommendation, setRecommendation] = useState(null);
  const [feedbackGiven, setFeedbackGiven] = useState({});
  const [error, setError] = useState(null);

  async function run() {
    if (!getToken()) { setError({ status: 401, message: "Log in to get AI career recommendations based on your profile." }); return; }
    setStatus("loading");
    setError(null);
    try {
      const res = await api.recommendCareers({});
      const data = unwrapObject(res);
      setRecommendation({ id: data.recommendation_id, results: (data.results || []).map(normalizeRecommendationResult) });
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
      setFeedbackGiven(f => ({ ...f, [recommendation.id]: rating }));
    } catch { /* non-critical */ }
  }

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">AI RECOMMENDATIONS</div><h1>Find careers for you</h1><p>Get AI-powered career recommendations based on your profile, skills and goals.</p></div>
      <button className="btn primary" onClick={run} disabled={status === "loading"}><Sparkles size={16}/> {status === "loading" ? "Finding careers..." : "Get recommendations"}</button>
    </div>
    {error && <ErrorState text={error.message} status={error.status} onRetry={run}/>}
    {status === "idle" && !error && <div className="empty-state"><Sparkles size={24}/><h2>Ready when you are</h2><p>Click "Get recommendations" to run AI-powered career matching based on your saved profile, skills and career goal.</p></div>}
    {status === "ready" && recommendation && (
      <div className="panel" style={{ padding: 20 }}>
        <div className="panel-head"><div><span className="label">RECOMMENDED FOR YOU</span><h2>Based on your profile</h2></div>
          {recommendation.id && !feedbackGiven[recommendation.id] && <div style={{ display: "flex", gap: 8 }}>
            <button className="btn outline" onClick={() => sendFeedback("helpful")}>Helpful</button>
            <button className="btn outline" onClick={() => sendFeedback("not_helpful")}>Not helpful</button>
          </div>}
          {recommendation.id && feedbackGiven[recommendation.id] && <span className="muted">Thanks for the feedback.</span>}
        </div>
        {recommendation.results.length ? recommendation.results.map((r, i) => (
          <div className="rec-item" key={r.careerId ?? i}>
            <div className="career-thumb"><Sparkles size={17}/></div>
            <div><b>{r.title}</b>{r.reasoning && <span>{r.reasoning}</span>}{r.missingSkills?.length > 0 && <span>Skills to build: {r.missingSkills.map(s => s.skill ?? s.name ?? s).join(", ")}</span>}</div>
            {r.careerId && <Link className="btn outline" to={`/careers/${r.careerId}`}>View <ArrowRight size={14}/></Link>}
          </div>
        )) : <p className="muted">No specific careers were returned this time. Try again or update your profile.</p>}
      </div>
    )}
  </div></AppShell>;
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
    api.courses({ search: search || undefined, mode: modeVal || undefined, location: locationVal || undefined })
      .then(data => {
        if (!active) return;
        setItems(unwrapList(data).map(normalizeCourse));
        setStatus("ready");
      }).catch(err => {
        if (!active) return;
        setError(err);
        setStatus("error");
      });
    return () => { active = false; };
  }
  useEffect(() => load(searchParams.get("search") || "", "", ""), []); // eslint-disable-line react-hooks/exhaustive-deps

  function runSearch(next) {
    setQuery(next);
    setSearchParams(next.trim() ? { search: next } : {});
    load(next, mode, locFilter);
  }

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">COURSES</div><h1>Browse courses</h1><p>Find courses by keyword, delivery mode or location.</p></div></div>
    <div className="search-bar"><Search/><input aria-label="Search courses" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && runSearch(query)} placeholder="Search courses by title or subject"/><button type="button" onClick={() => runSearch(query)}>Search</button></div>
    <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
      <select aria-label="Delivery mode" value={mode} onChange={e => { setMode(e.target.value); load(query, e.target.value, locFilter); }} style={{ border: "1px solid #dfe4eb", borderRadius: 6, padding: "7px 9px", fontSize: 11, background: "#fff" }}>
        <option value="">All modes</option>
        <option value="online">Online</option>
        <option value="offline">Offline</option>
        <option value="hybrid">Hybrid</option>
      </select>
      <input aria-label="Location filter" value={locFilter} onChange={e => { setLocFilter(e.target.value); load(query, mode, e.target.value); }} placeholder="Filter by location" style={{ border: "1px solid #dfe4eb", borderRadius: 6, padding: "7px 9px", fontSize: 11, background: "#fff" }}/>
    </div>
    {status === "loading" && <LoadingState label="Loading courses..."/>}
    {status === "error" && <ErrorState text={error?.message} status={error?.status} onRetry={() => load(query, mode, locFilter)}/>}
    {status === "ready" && (items.length
      ? <div className="institution-grid">{items.map(c => <Link className="institution-card" to={`/courses/${c.id}`} key={c.id}><div className="institution-image"><GraduationCap size={26}/></div><span className="tag">{c.course_type || c.mode || "Course"}</span><h2>{c.title}</h2>{c.institution_name && <p><Building2 size={14}/>{c.institution_name}</p>}<span className="muted">{c.duration || c.locFilter || ""}</span></Link>)}</div>
      : <EmptyState title="No courses matched" text="Try a different search or filter." action="Clear" onAction={() => { setQuery(""); setMode(""); setLocFilter(""); load("", "", ""); }}/>
    )}
    <div className="source-note learn-note"><ShieldCheck size={15}/><span>Confirm curriculum, fees, eligibility and recognition directly with the institution.</span></div>
  </div></AppShell>;
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
    Promise.allSettled([api.course(id), api.courseEligibility(id)]).then(([cRes, eRes]) => {
      if (!active) return;
      if (cRes.status === "rejected") { setError(cRes.reason); setStatus(cRes.reason?.status === 404 ? "notfound" : "error"); return; }
      setCourse(normalizeCourse(unwrapObject(cRes.value)));
      setEligibility(eRes.status === "fulfilled" ? unwrapList(eRes.value) : []);
      setStatus("ready");
    });
    return () => { active = false; };
  }, [id]);

  if (status === "loading") return <AppShell><LoadingState label="Loading course..."/></AppShell>;
  if (status === "notfound") return <NotFound/>;
  if (status === "error" || !course) return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  return <AppShell><div className="detail-page">
    <div className="breadcrumbs"><Link to="/courses">Courses</Link><span>/</span><b>{course.title}</b></div>
    <div className="detail-hero"><div className="detail-image"><GraduationCap size={42}/></div><div className="detail-title">
      {course.course_type && <div className="tag">{course.course_type}</div>}
      <h1>{course.title}</h1>
      {course.institution_name && <p><Building2 size={14}/> {course.institution_name}</p>}
      <div className="detail-meta">
        {course.mode && <span>{course.mode}</span>}
        {course.location && <span><MapPin size={15}/>{course.location}</span>}
        {course.duration && <span>{course.duration}</span>}
        {course.fees && <span>{course.fees}</span>}
      </div>
    </div></div>
    <div className="detail-grid"><div>
      {eligibility.length > 0 && <section className="panel detail-panel"><h2>Eligibility rules</h2>
        {eligibility.map((e, i) => <div className="requirement" key={e.id ?? i}><div className="req-icon unknown"><CircleHelp size={15}/></div><div><b>{e.rule_type}</b><span>{JSON.stringify(e.rule_data)}</span></div></div>)}
      </section>}
      {eligibility.length === 0 && <section className="panel detail-panel"><h2>Eligibility</h2><p className="muted">No structured eligibility rules have been published for this course yet.</p></section>}
    </div>
    <aside className="eligibility-card"><div className="eligibility-icon"><GraduationCap/></div><h2>More options</h2><p>Find similar courses or view what careers this qualification supports.</p><Link className="btn outline full" to="/courses">Browse all courses <ArrowRight size={15}/></Link><Link className="btn outline full" style={{ marginTop: 8 }} to="/careers">Explore careers <ArrowRight size={15}/></Link></aside>
    </div>
  </div></AppShell>;
}

function Saved() {
  const { user } = useAuth();
  const [savedCareers, setSavedCareers] = useState([]);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      if (active) { setStatus("ready"); setSavedCareers([]); }
      return;
    }

    const key = `careergps_saved_careers_${user.id}`;
    let savedIds = [];
    try { savedIds = JSON.parse(localStorage.getItem(key) || "[]"); } catch { }
    
    if (savedIds.length === 0) {
      if (active) { setStatus("ready"); setSavedCareers([]); }
      return;
    }

    setStatus("loading");
    Promise.allSettled(savedIds.map(id => api.career(id))).then(results => {
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
          const nextIds = currentIds.filter(cid => !staleIds.includes(cid));
          localStorage.setItem(key, JSON.stringify(nextIds));
        } catch {}
      }
      setSavedCareers(validCareers);
      setStatus("ready");
    }).catch(err => {
      if (active) { setError(err); setStatus("error"); }
    });

    return () => { active = false; };
  }, [user]);

  function removeCareer(id) {
    if (!user) return;
    const key = `careergps_saved_careers_${user.id}`;
    try {
      const currentIds = JSON.parse(localStorage.getItem(key) || "[]");
      const nextIds = currentIds.filter(cid => cid !== id);
      localStorage.setItem(key, JSON.stringify(nextIds));
      setSavedCareers(prev => prev.filter(c => c.id !== id));
    } catch { }
  }

  if (status === "loading") return <AppShell><LoadingState label="Loading saved careers..."/></AppShell>;
  if (status === "error") return <AppShell><ErrorState text={error?.message} status={error?.status}/></AppShell>;

  return <AppShell><div className="listing-page">
    <div className="page-heading-row"><div><div className="section-kicker">SAVED</div><h1>Saved careers</h1><p>Keep career options and pathways you want to revisit.</p></div></div>
    {!user ? (
      <div className="empty-state">
        <Bookmark size={24}/>
        <h2>Log in to save careers</h2>
        <p>Your saved careers are stored on your device and linked to your account.</p>
        <Link className="btn primary" to="/login">Log in <ArrowRight size={15}/></Link>
      </div>
    ) : savedCareers.length === 0 ? (
      <div className="empty-state">
        <Bookmark size={24}/>
        <h2>No saved careers yet.</h2>
        <p>Explore career guides and save careers you want to revisit.</p>
        <Link className="btn outline" to="/careers">Explore careers <ArrowRight size={15}/></Link>
      </div>
    ) : (
      <>
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 12 }}>
          {savedCareers.map(c => (
            <div className="panel" key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20 }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
                <div style={{ width: 48, height: 48, borderRadius: 8, background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)" }}><BriefcaseBusiness size={24}/></div>
                <div>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 16 }}>{c.title} {c.verificationStatus === "verified" && <ShieldCheck size={14} style={{ color: "var(--primary)", verticalAlign: "middle" }} title="Verified information"/>}</h3>
                  <p style={{ margin: 0, color: "var(--muted)", fontSize: 13 }}>{c.description}</p>
                  {c.qualifications && c.qualifications[0] && <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "var(--muted)" }}>Typical qualification: {c.qualifications[0]}</p>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button className="btn outline" onClick={() => removeCareer(c.id)}>Remove</button>
                <Link className="btn primary" to={`/careers/${c.id}`}>View career</Link>
              </div>
            </div>
          ))}
        </div>
        <p className="muted" style={{ fontSize: 12, textAlign: "center", marginTop: 32 }}>Saved careers are stored on this device.</p>
      </>
    )}
  </div></AppShell>;
}

const SITE_URL = import.meta.env.VITE_SITE_URL || "https://careergpsgoa.in";
const BRAND = "CareerGPS";
const DEFAULT_DESCRIPTION = "CareerGPS helps people in Goa explore careers, understand requirements, find learning pathways and discover opportunities using structured, source-backed career information.";

function Seo({ title, description = DEFAULT_DESCRIPTION, path = "/", breadcrumbs = [], type = "website" }) {
  useEffect(() => {
    const canonical = new URL(path, SITE_URL).href;
    document.title = title;
    const setMeta = (name, content, property = false) => {
      const attr = property ? "property" : "name";
      let el = document.head.querySelector(`meta[${attr}="${name}"]`);
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, name); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta("description", description);
    const privatePath = ["/signup", "/login", "/onboarding", "/dashboard", "/profile", "/saved", "/eligibility", "/pathway"].includes(path);
    setMeta("robots", privatePath ? "noindex,nofollow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
    setMeta("og:title", title, true);
    setMeta("og:description", description, true);
    setMeta("og:url", canonical, true);
    setMeta("og:type", type, true);
    setMeta("og:site_name", BRAND, true);
    setMeta("og:image", new URL("/og-image.jpg", SITE_URL).href, true);
    setMeta("og:image:alt", "CareerGPS logo with the Explore, Plan, Learn, Grow tagline", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", title);
    setMeta("twitter:description", description);
    setMeta("twitter:image", new URL("/og-image.jpg", SITE_URL).href);
    let link = document.head.querySelector('link[rel="canonical"]');
    if (!link) { link = document.createElement("link"); link.rel = "canonical"; document.head.appendChild(link); }
    link.href = canonical;

    const graph = [
      { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: BRAND, url: SITE_URL, logo: new URL("/careergps-logo.jpg", SITE_URL).href, areaServed: { "@type": "AdministrativeArea", name: "Goa, India" } },
      { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: BRAND, publisher: { "@id": `${SITE_URL}/#organization` } }
    ];
    if (breadcrumbs.length) {
      graph.push({ "@type": "BreadcrumbList", itemListElement: breadcrumbs.map((item, i) => ({ "@type": "ListItem", position: i + 1, name: item.name, item: new URL(item.path, SITE_URL).href })) });
    }
    let ld = document.head.querySelector('script[data-seo-ld="true"]');
    if (!ld) { ld = document.createElement("script"); ld.type = "application/ld+json"; ld.dataset.seoLd = "true"; document.head.appendChild(ld); }
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }, [title, description, path, JSON.stringify(breadcrumbs), type]);
  return null;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="footer-brand"><Logo/><p>Explore, plan, learn and grow with Goa-first career intelligence.</p></div><div className="footer-links"><div><b>Explore</b><Link to="/careers">Careers</Link><Link to="/opportunities">Opportunities</Link></div><div><b>Learn</b><Link to="/institutions">Institutions</Link><Link to="/learn">Learning</Link><Link to="/pathway">Career pathways</Link></div><div><b>Account</b><Link to="/signup">Create account</Link><Link to="/login">Log in</Link></div></div></footer>;
}

function SeoRouter() {
  const location = useLocation();
  const path = location.pathname;
  // Career/opportunity/institution detail pages set their own <Seo/> once
  // real data has loaded, since titles/descriptions come from the backend.
  const isDetailPage = /^\/(careers|opportunities|institutions)\/[^/]+$/.test(path);
  if (isDetailPage) return null;
  const data = ({
    "/": { title: "CareerGPS | Explore, Plan, Learn, Grow in Goa", description: DEFAULT_DESCRIPTION, path: "/" },
    "/signup": { title: "Create Your CareerGPS Account | Goa Career Platform", description: "Create a CareerGPS account to build your profile and explore career pathways, skills and opportunities.", path },
    "/login": { title: "Log In | CareerGPS", description: "Log in to your CareerGPS account and continue your career pathway.", path },
    "/onboarding": { title: "Set Up Your Career Profile | CareerGPS", description: "Set up your education, skills, interests and career preferences for a personalized CareerGPS experience.", path },
    "/dashboard": { title: "Career Dashboard | CareerGPS", description: "Review your career goal, pathway progress, saved careers and recommended next steps.", path },
    "/careers": { title: "Explore Careers in Goa | CareerGPS", description: "Search careers by keyword, then explore pathways, skills and requirements.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }] },
    "/skill-gap": { title: "Skill Gap Check | CareerGPS", description: "Compare your saved skills profile with what a career typically requires.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Careers", path: "/careers" }, { name: "Skill gap", path }] },
    "/eligibility": { title: "Opportunity Eligibility Check | CareerGPS", description: "Compare your profile with an opportunity's structured requirements and identify items that need verification.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Opportunities", path: "/opportunities" }, { name: "Eligibility", path }] },
    "/pathway": { title: "Personal Career Pathway | CareerGPS", description: "Follow a step-by-step learning and experience pathway toward a target career.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "My Plan", path }] },
    "/opportunities": { title: "Jobs, Internships & Programmes in Goa | CareerGPS", description: "Explore career opportunities and review requirements and source information before applying.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Opportunities", path }] },
    "/institutions": { title: "Institutions & Courses in Goa | CareerGPS", description: "Explore institutions and courses that can help close career skill and qualification gaps.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Institutions", path }] },
    "/learn": { title: "Learning Resources & Courses | CareerGPS", description: "Find learning options connected to career pathways and skill development.", path, breadcrumbs: [{ name: "Home", path: "/" }, { name: "Learn", path }] },
    "/profile": { title: "Career Profile | CareerGPS", description: "Manage your education, skills, interests and career preferences.", path },
    "/saved": { title: "Saved Careers | CareerGPS", description: "Review careers you saved for later and continue exploring their pathways.", path }
  }[path] || { title: "Page Not Found | CareerGPS", description: "The CareerGPS page you requested could not be found.", path, breadcrumbs: [{ name: "Home", path: "/" }] });
  return <Seo {...data}/>;
}

function NotFound() {
  return <div className="not-found"><Logo/><div className="not-found-card"><span className="not-found-code">404</span><h1>We couldn't find that page.</h1><p>The page may have moved or the address may be incorrect.</p><div className="not-found-actions"><Link className="btn primary" to="/">Go to CareerGPS home <ArrowRight size={16}/></Link><Link className="btn outline" to="/careers">Explore careers</Link></div></div></div>
}

function App() {
  return <BrowserRouter><AuthProvider><SeoRouter/><Routes>
    <Route path="/" element={<Landing/>}/>
    <Route path="/signup" element={<Signup/>}/>
    <Route path="/login" element={<Login/>}/>
    <Route path="/onboarding" element={<Onboarding/>}/>
    <Route path="/dashboard" element={<Dashboard/>}/>
    <Route path="/careers" element={<Careers/>}/>
    <Route path="/careers/:id" element={<CareerDetail/>}/>
    <Route path="/skill-gap" element={<SkillGap/>}/>
    <Route path="/eligibility" element={<Eligibility/>}/>
    <Route path="/pathway" element={<Pathway/>}/>
    <Route path="/opportunities" element={<Opportunities/>}/>
    <Route path="/opportunities/:id" element={<OpportunityDetail/>}/>
    <Route path="/institutions" element={<Institutions/>}/>
    <Route path="/institutions/:id" element={<InstitutionDetail/>}/>
    <Route path="/courses" element={<Courses/>}/>
    <Route path="/courses/:id" element={<CourseDetail/>}/>
    <Route path="/learn" element={<Learn/>}/>
    <Route path="/profile" element={<Profile/>}/>
    <Route path="/saved" element={<Saved/>}/>
    <Route path="/recommendations" element={<RecommendationsPage/>}/>
    <Route path="/assistant" element={<AssistantPage/>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></AuthProvider></BrowserRouter>
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
