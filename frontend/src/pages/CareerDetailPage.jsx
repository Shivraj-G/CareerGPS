import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate, Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  Layers,
  Award,
  Route as RouteIcon,
  Compass,
  FileCheck2
} from 'lucide-react';
import { api, getToken } from '../api/client.js';
import CareerHero from '../components/career/CareerHero.jsx';
import CareerTabs from '../components/career/CareerTabs.jsx';
import SkillGapSection from '../components/career/SkillGapSection.jsx';
import RelatedCareersSection from '../components/career/RelatedCareersSection.jsx';

function unwrapObject(data) {
  if (data && typeof data === 'object' && 'data' in data) {
    return data.data;
  }
  return data ?? {};
}

function unwrapList(data) {
  if (data && Array.isArray(data.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function normalizeCareer(c) {
  if (!c) return null;
  const careerId = c.ai_career_id ?? c.career_id ?? c.id ?? '';
  return {
    id: careerId,
    career_id: careerId,
    isAiProfile: !!c.ai_career_id,
    title: c.title ?? 'Untitled career',
    description: c.description ?? '',
    responsibilities: Array.isArray(c.responsibilities) ? c.responsibilities : [],
    qualifications: Array.isArray(c.qualifications) ? c.qualifications : [],
    entryRoutes: Array.isArray(c.entry_routes) ? c.entry_routes : [],
    skills: Array.isArray(c.skills) ? c.skills : [],
    verificationStatus: c.verification_status ?? 'needs_review',
    origin: c.origin ?? 'curated',
    sourceUrl: c.source_url ?? null,
    sourceDocumentUrl: c.source_document_url ?? null,
    sourceLastCheckedAt: c.source_last_checked_at ?? null,
    verifiedAt: c.verified_at ?? null,
    disclaimer: c.disclaimer ?? null,
    keyInformation: c.keyInformation ?? c.key_information ?? null,
    contentSource: c.contentSource ?? null,
    domainInfo: c.domainInfo ?? null,
    progressionLadder: Array.isArray(c.progressionLadder) ? c.progressionLadder : [],
    regulatoryGuidance: c.regulatoryGuidance ?? null,
  };
}

export default function CareerDetailPage({ user = null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const id = params.id || location.pathname.split('/').filter(Boolean).pop() || '';
  const searchParams = new URLSearchParams(location.search);
  const type = searchParams.get('type');

  const [career, setCareer] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | notfound | error
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [tabData, setTabData] = useState({});
  const [tabStatus, setTabStatus] = useState('idle');
  const [saved, setSaved] = useState(false);

  // Read saved state from localStorage
  useEffect(() => {
    if (!user || !id) return;
    const key = `careergps_saved_careers_${user.id}`;
    try {
      const savedIds = JSON.parse(localStorage.getItem(key) || '[]');
      setSaved(savedIds.includes(id));
    } catch {}
  }, [id, user]);

  function toggleSave() {
    if (!user) {
      alert('Please log in to save careers to your personal shortlist.');
      return;
    }
    const key = `careergps_saved_careers_${user.id}`;
    let savedIds = [];
    try {
      savedIds = JSON.parse(localStorage.getItem(key) || '[]');
    } catch {}

    let nextIds;
    if (saved) {
      nextIds = savedIds.filter((savedId) => savedId !== id);
    } else {
      nextIds = Array.from(new Set([...savedIds, id]));
    }
    localStorage.setItem(key, JSON.stringify(nextIds));
    setSaved(!saved);
  }

  // Load Career Data
  useEffect(() => {
    let active = true;
    setStatus('loading');
    let fetcher;

    if (id.startsWith('rec_')) {
      const parts = id.split('_');
      const recId = parts[1];
      const title = decodeURIComponent(parts.slice(2).join('_'));

      fetcher = api.exploreCareer({ query: title }).then((explored) => {
        const res = unwrapObject(explored);
        const realId = res.ai_career_id || res.id;
        if (realId) {
          const realType = res.ai_career_id ? 'ai_profile' : 'catalogue';
          if (active) {
            navigate(`/careers/${realId}?type=${realType}`, { replace: true });
            return new Promise(() => {}); // unmounts
          }
        }
        throw { status: 404, message: 'Could not generate AI career profile.' };
      }).catch((err) => {
        console.error('Explore failed, falling back to recommendation item', err);
        return api.recommendation(recId).then((data) => {
          const rec = unwrapObject(data);
          const item = rec.results?.find((x) => x.title === title);
          if (!item) throw { status: 404, message: 'Recommendation not found' };
          return {
            data: {
              id,
              title: item.title,
              description: item.reasoning,
              responsibilities: [],
              qualifications: [],
              entry_routes: [],
              skills: item.missingSkills ? item.missingSkills.map((s) => ({
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
        setCareer(normalizeCareer(unwrapObject(data)));
        setStatus('ready');
      })
      .catch((err) => {
        if (!active) return;
        setError(err);
        setStatus(err.status === 404 ? 'notfound' : 'error');
      });

    return () => {
      active = false;
    };
  }, [id, type]);

  // Load Tab Specific Data
  useEffect(() => {
    if (tab === 'overview' || tabData[tab] || !id) return;
    let active = true;
    setTabStatus('loading');

    if (id.startsWith('rec_')) {
      if (tab === 'skills' && career?.skills) {
        setTabData((d) => ({ ...d, [tab]: career.skills }));
      } else {
        setTabData((d) => ({ ...d, [tab]: [] }));
      }
      setTabStatus('ready');
      return;
    }

    const fetchers = {
      skills: () => api.careerSkills(id),
      pathways: () => api.careerPathways(id),
      courses: () => api.careerCourses(id),
      opportunities: () => api.careerOpportunities(id),
    };

    if (fetchers[tab]) {
      fetchers[tab]()
        .then((res) => {
          if (!active) return;
          setTabData((d) => ({ ...d, [tab]: unwrapList(res) }));
          setTabStatus('ready');
        })
        .catch(() => {
          if (active) setTabStatus('error');
        });
    }

    return () => {
      active = false;
    };
  }, [tab, id]);

  if (status === 'loading') {
    return (
      <div className="career-detail-loading-wrapper">
        <div className="spinner-pulse large" />
        <p>Loading career intelligence guide...</p>
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="career-not-found-wrapper">
        <Compass size={40} className="not-found-icon" />
        <h2>Career Not Found</h2>
        <p>The requested career profile does not exist or may have been unlisted from the catalogue.</p>
        <Link to="/careers" className="btn primary">
          Explore All Careers <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  if (status === 'error' || !career) {
    return (
      <div className="career-error-wrapper">
        <h2>Unable to load career profile</h2>
        <p>{error?.message || 'A network error occurred while retrieving career intelligence.'}</p>
        <Link to="/careers" className="btn outline">
          Return to Careers
        </Link>
      </div>
    );
  }

  return (
    <div className="career-intelligence-dashboard">
      {/* 1. CAREER HERO SECTION */}
      <CareerHero
        career={career}
        saved={saved}
        onToggleSave={toggleSave}
        user={user}
      />

      {/* MAIN TWO-COLUMN / SINGLE-COLUMN RESPONSIVE LAYOUT */}
      <div className="career-intelligence-body">
        <div className="career-primary-column">
          {/* 1. CAREER DETAILS AND OVERVIEW TABS */}
          <CareerTabs
            career={career}
            activeTab={tab}
            onTabChange={setTab}
            tabData={tabData}
            tabStatus={tabStatus}
            user={user}
          />

          {/* 2. SKILL GAP ANALYSIS (MANDATORY IN ORDER: STEP 2) */}
          <SkillGapSection
            careerId={career.id}
            careerTitle={career.title}
            isAiProfile={career.isAiProfile}
            user={user}
          />

          {/* 3. RELATED CAREERS (MANDATORY IN ORDER: STEP 3 - IMMEDIATELY BELOW SKILL GAP) */}
          <RelatedCareersSection
            careerId={career.id}
            currentTitle={career.title}
            user={user}
          />
        </div>

        {/* SIDEBAR NAVIGATION & QUICK ACTIONS */}
        <aside className="career-side-column" aria-label="Career Quick Context">
          {/* Quick Context Card */}
          <div className="side-quick-card">
            <h3 className="side-card-title">Career Intelligence Context</h3>
            <p className="side-card-desc">
              Structured catalogue record verified against market frameworks.
            </p>

            <div className="side-spec-rows">
              <div className="side-spec-row">
                <span className="spec-label">Catalogue Identity:</span>
                <span className="spec-value mono">{career.id.slice(0, 8)}...</span>
              </div>
              <div className="side-spec-row">
                <span className="spec-label">Record Status:</span>
                <span className="spec-value status-tag">{career.verificationStatus}</span>
              </div>
              <div className="side-spec-row">
                <span className="spec-label">Data Origin:</span>
                <span className="spec-value">{career.origin === 'ai_generated' ? 'AI Synthesized' : 'Curated Catalogue'}</span>
              </div>
            </div>

            <a href="#skill-gap-assessment" className="btn primary full small" style={{ marginTop: 14 }}>
              Assess Skill Gap <ArrowRight size={13} />
            </a>

            <a href="#related-careers" className="btn outline full small" style={{ marginTop: 8 }}>
              View Related Careers <ArrowRight size={13} />
            </a>
          </div>

          {/* Current Goal Indicator if user has a different goal */}
          {user && (
            <div className="side-goal-advisory-card">
              <div className="advisory-icon-wrap">
                <Award size={18} />
              </div>
              <h4>Goal Awareness</h4>
              <p>
                Browsing related careers lets you explore adjacent skills without changing your saved Current Goal in your profile.
              </p>
              <Link to="/profile" className="advisory-link">
                View My Profile & Current Goal →
              </Link>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
