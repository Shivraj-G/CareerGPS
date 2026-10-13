import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  Sparkles,
  Layers,
  ChevronDown,
  ChevronUp,
  BriefcaseBusiness,
  CheckCircle2,
  GitBranch,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  Info
} from 'lucide-react';
import { api } from '../../api/client.js';

export default function RelatedCareersSection({
  careerId,
  currentTitle = 'this career',
  user = null
}) {
  const [relatedCareers, setRelatedCareers] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    if (!careerId) return;

    setLoading(true);
    setError(null);

    api.careerRelated(careerId)
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        setRelatedCareers(list);
        setMeta(res?.meta || {});
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[RelatedCareersSection] Error loading related careers:', err);
        setError('Unable to load related careers at this time.');
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [careerId, user?.id]);

  if (loading) {
    return (
      <section className="related-careers-section" id="related-careers">
        <div className="section-header-row">
          <div>
            <span className="section-eyebrow">STEP 3 OF 4 · CAREER EXPLORATION</span>
            <h2 className="section-title">Related Careers</h2>
            <p className="section-subtitle">Evaluating occupational domains and database-backed competencies...</p>
          </div>
        </div>
        <div className="related-careers-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="related-career-card skeleton-card">
              <div className="skeleton skel-title" style={{ width: '60%', height: 20 }}></div>
              <div className="skeleton skel-text" style={{ width: '90%', marginTop: 8 }}></div>
              <div className="skeleton skel-text" style={{ width: '80%' }}></div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="related-careers-section" id="related-careers">
        <div className="related-empty-card">
          <AlertCircle size={20} className="text-amber" />
          <p>{error}</p>
        </div>
      </section>
    );
  }

  if (relatedCareers.length === 0) {
    return (
      <section className="related-careers-section" id="related-careers">
        <div className="section-header-row">
          <div>
            <span className="section-eyebrow">STEP 3 OF 4 · CAREER EXPLORATION</span>
            <h2 className="section-title">Related Careers</h2>
            <p className="section-subtitle">No closely aligned alternative roles catalogued in PostgreSQL for this profile yet.</p>
          </div>
        </div>
        <div className="related-empty-card">
          <Compass size={24} />
          <p>
            The NaviGoa catalogue currently has limited indexed adjacent roles directly connected to <strong>{currentTitle}</strong>. We only display validated careers from our verified database rather than suggesting unrelated occupations.
          </p>
          <Link to="/careers" className="btn outline small">
            Browse All Catalogue Careers <ArrowRight size={14} />
          </Link>
        </div>
      </section>
    );
  }

  const initialLimit = 4;
  const displayItems = showAll ? relatedCareers : relatedCareers.slice(0, initialLimit);
  const hasMore = relatedCareers.length > initialLimit;

  return (
    <section className="related-careers-section" id="related-careers">
      {/* Header */}
      <div className="section-header-row">
        <div>
          <span className="section-eyebrow">STEP 3 OF 4 · CAREER EXPLORATION</span>
          <h2 className="section-title">Related Careers</h2>
          <p className="section-subtitle">
            Database-backed roles sharing occupational domain standards, specialized competencies, and transferable workflows with <strong>{currentTitle}</strong>.
          </p>
        </div>
        <span className="related-count-badge">
          {relatedCareers.length} Matching {relatedCareers.length === 1 ? 'Career' : 'Careers'}
        </span>
      </div>

      {/* Catalogue Scope / Truth in Data Notice */}
      {meta.catalogue_note && (
        <div className="catalogue-scope-notice">
          <ShieldCheck size={16} className="scope-icon text-blue" />
          <span>{meta.catalogue_note}</span>
        </div>
      )}

      {/* Cards Grid */}
      <div className="related-careers-grid">
        {displayItems.map((rc) => {
          const sharedSkills = Array.isArray(rc.shared_skills) ? rc.shared_skills : [];
          const transitionLevel = rc.transition_level || 'Closely Related';
          const levelClass = transitionLevel.toLowerCase().replace(/\s+/g, '-');

          return (
            <article key={rc.id} className="related-career-card">
              {/* Card Top: Title & Transition Badge */}
              <div className="card-top-row">
                <h3 className="related-career-title">
                  <Link to={`/careers/${rc.id}`} className="career-title-link">
                    {rc.title}
                  </Link>
                </h3>
                <span
                  className={`transition-badge ${levelClass}`}
                  title={rc.transition_description || ''}
                >
                  {transitionLevel}
                </span>
              </div>

              {/* Description */}
              <p className="related-career-desc">
                {rc.description
                  ? (rc.description.length > 130 ? rc.description.slice(0, 130) + '...' : rc.description)
                  : 'Professional career path with documented domain competencies.'}
              </p>

              {/* Why it is related */}
              {rc.relation_reason && (
                <div className="why-related-box">
                  <GitBranch size={13} className="branch-icon" />
                  <span className="why-related-text">{rc.relation_reason}</span>
                </div>
              )}

              {/* Shared Skills Tags */}
              {sharedSkills.length > 0 && (
                <div className="shared-skills-row">
                  <span className="shared-skills-label">Shared Competencies:</span>
                  <div className="shared-chips">
                    {sharedSkills.slice(0, 3).map((sk, idx) => (
                      <span key={idx} className="shared-skill-chip">{sk}</span>
                    ))}
                    {sharedSkills.length > 3 && (
                      <span className="shared-more-chip">+{sharedSkills.length - 3} more</span>
                    )}
                  </div>
                </div>
              )}

              {/* Key Distinction */}
              {rc.distinction && (
                <div className="distinction-note">
                  <span className="distinction-label">Role Focus:</span>
                  <span className="distinction-text">{rc.distinction}</span>
                </div>
              )}

              {/* User Profile Skill Match Indicator (if available) */}
              {rc.user_transition_label && (
                <div className="user-profile-match-pill">
                  <TrendingUp size={12} />
                  <span>{rc.user_transition_label}</span>
                </div>
              )}

              {/* Card Action */}
              <div className="card-footer-action">
                <Link to={`/careers/${rc.id}`} className="btn-view-career">
                  <span>View Career Guide</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </article>
          );
        })}
      </div>

      {/* View More / View Fewer Toggle */}
      {hasMore && (
        <div className="related-toggle-row">
          <button
            type="button"
            className="btn outline small"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? (
              <>Show fewer related careers <ChevronUp size={14} /></>
            ) : (
              <>View {relatedCareers.length - initialLimit} more related careers <ChevronDown size={14} /></>
            )}
          </button>
        </div>
      )}
    </section>
  );
}
