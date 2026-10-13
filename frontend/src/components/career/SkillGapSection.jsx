import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  ArrowRight,
  RotateCw,
  Sparkles,
  TrendingUp,
  Target,
  ShieldAlert,
  ShieldCheck,
  Award,
  Layers,
  Info
} from 'lucide-react';
import { api, getToken } from '../../api/client.js';

export default function SkillGapSection({
  careerId,
  careerTitle = 'this career',
  isAiProfile = false,
  user = null
}) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [error, setError] = useState(null);
  const [showFormula, setShowFormula] = useState(false);

  async function loadGapAnalysis() {
    if (!careerId) return;
    if (!getToken()) {
      setStatus('unauthenticated');
      return;
    }

    setStatus('loading');
    setError(null);
    try {
      const payload = isAiProfile
        ? { target_ai_career_id: careerId }
        : { target_career_id: careerId };

      const res = await api.gapAnalysis(payload);
      const raw = res?.data || res;
      setData(raw);
      setStatus('ready');
    } catch (err) {
      console.error('[SkillGapSection] Error fetching gap analysis:', err);
      setError(err?.message || 'Could not evaluate skill gap.');
      setStatus('error');
    }
  }

  useEffect(() => {
    loadGapAnalysis();
  }, [careerId, isAiProfile, user?.id]);

  // Unauthenticated visitor view
  if (status === 'unauthenticated' || !user) {
    return (
      <section className="skill-gap-section-card unauth" id="skill-gap-assessment">
        <div className="skill-gap-unauth-content">
          <div className="skill-gap-unauth-icon">
            <Target size={28} />
          </div>
          <div className="skill-gap-unauth-text">
            <span className="section-eyebrow">CAREER INTELLIGENCE</span>
            <h2 className="skill-gap-title">Skill Gap Analysis for {careerTitle}</h2>
            <p className="skill-gap-subtitle">
              Log in to compare your saved skills against this career's verified requirements, receive a transparent alignment score, and unlock tailored learning milestones.
            </p>
          </div>
          <Link to={`/login?redirect=/careers/${careerId}`} className="btn primary">
            Log In to Assess Skill Gap <ArrowRight size={15} />
          </Link>
        </div>
      </section>
    );
  }

  // Loading state
  if (status === 'loading') {
    return (
      <section className="skill-gap-section-card" id="skill-gap-assessment">
        <div className="skill-gap-loading">
          <RotateCw size={24} className="spin-icon" />
          <p>Evaluating profile competencies against career requirements...</p>
        </div>
      </section>
    );
  }

  // Error state
  if (status === 'error' && !data) {
    return (
      <section className="skill-gap-section-card" id="skill-gap-assessment">
        <div className="skill-gap-error">
          <AlertCircle size={22} className="error-icon" />
          <p>{error || 'Unable to complete skill gap analysis at this time.'}</p>
          <button type="button" className="btn outline small" onClick={loadGapAnalysis}>
            Retry Assessment
          </button>
        </div>
      </section>
    );
  }

  // Ready state data extraction
  const presentSkills = data?.skills_present || (data?.matched_skills || []).map(s => ({
    skill_id: s.skill_id,
    skill: s.skill,
    level: s.level || 'intermediate',
    importance: s.importance || 'important',
    verified: false,
    status: 'sufficient'
  }));

  const devSkills = data?.skills_needing_development || (data?.missing_skills || []).map(s => ({
    skill_id: s.skill_id,
    skill: s.skill,
    importance: s.importance || 'important',
    evidence_status: 'not_reported',
    reason: s.importance === 'required' ? 'Core qualification requirement.' : 'Valued competence.'
  }));

  const unverifiedSkills = data?.unverified_skills || [];
  const prioritySkills = data?.priority_skills || devSkills.slice(0, 3);
  const matchScore = typeof data?.match_score === 'number' ? data.match_score : 0;
  const readinessLevel = data?.readiness_level || (matchScore >= 70 ? 'High Alignment' : matchScore >= 40 ? 'Moderate Alignment' : 'Emerging Foundation');
  const scoreExplanation = data?.score_explanation || 'Calculated as: (Demonstrated Skill Points / Total Career Skill Points) × 100. Weights: Required (3x), Important (2x), Useful (1x). Represents curriculum alignment, not an employment guarantee.';
  const recommendedNextAction = data?.recommended_next_action || 'Complete a focused project to develop practical proficiency in core role prerequisites.';
  const learningMilestones = Array.isArray(data?.learning_milestones) ? data.learning_milestones : [];

  return (
    <section className="skill-gap-section-card" id="skill-gap-assessment">
      {/* Header Row */}
      <div className="skill-gap-header-row">
        <div>
          <span className="section-eyebrow">STEP 2 OF 4 · CAREER INTELLIGENCE</span>
          <h2 className="skill-gap-title">Personalized Skill Gap Analysis</h2>
          <p className="skill-gap-subtitle">
            Evaluating your saved profile skills against documented competencies for <strong>{careerTitle}</strong>.
          </p>
        </div>
        <button
          type="button"
          className="btn-refresh-analysis"
          onClick={loadGapAnalysis}
          title="Re-run assessment with latest profile skills"
        >
          <RotateCw size={14} />
          <span>Re-run Assessment</span>
        </button>
      </div>

      {/* Alignment Gauge Card */}
      <div className="alignment-score-card">
        <div className="alignment-score-badge">
          <div className="score-number-circle">
            <span className="score-val">{matchScore}%</span>
            <span className="score-sub">Alignment</span>
          </div>
        </div>

        <div className="alignment-details">
          <div className="alignment-status-strip">
            <span className={`readiness-pill ${readinessLevel.toLowerCase().replace(/\s+/g, '-')}`}>
              <TrendingUp size={14} />
              {readinessLevel}
            </span>
            <span className="coverage-counter">
              {presentSkills.length} of {presentSkills.length + devSkills.length} competencies demonstrated
            </span>
          </div>

          <p className="alignment-text">
            {matchScore >= 70
              ? 'Your profile strongly covers the core foundational tools and analytical practices required for this role.'
              : matchScore >= 40
              ? 'You possess key complementary competencies, but several essential role-specific technical skills need development.'
              : 'This career represents an exploratory transition requiring foundational development in core industry competencies.'}
          </p>

          <div className="score-formula-disclaimer">
            <button
              type="button"
              className="btn-formula-toggle"
              onClick={() => setShowFormula(!showFormula)}
            >
              <Info size={13} />
              <span>{showFormula ? 'Hide calculation details' : 'How is this score calculated?'}</span>
            </button>
            {showFormula && (
              <div className="formula-explanation-box">
                <p>{scoreExplanation}</p>
                <small className="muted">Note: Profile match evaluates syllabus alignment and does not constitute a legal or contractual guarantee of hiring eligibility.</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Four Distinct Groups Grid */}
      <div className="gap-groups-grid">
        {/* GROUP 1: Skills Already Present */}
        <div className="gap-group-panel present">
          <div className="group-header">
            <div className="group-title-wrap">
              <CheckCircle2 size={16} className="text-green" />
              <h3>Skills Already Present</h3>
            </div>
            <span className="group-count-pill">{presentSkills.length}</span>
          </div>
          <p className="group-desc">Relevant competencies recorded on your profile</p>

          {presentSkills.length > 0 ? (
            <div className="group-items-list">
              {presentSkills.map((s, idx) => (
                <div key={s.skill_id || idx} className="gap-item-card present">
                  <div className="gap-item-header">
                    <span className="skill-name">{s.skill}</span>
                    <span className={`level-pill ${(s.level || 'intermediate').toLowerCase()}`}>
                      {s.level || 'Intermediate'}
                    </span>
                  </div>
                  <div className="gap-item-footer">
                    <span className="importance-meta">{s.importance}</span>
                    {s.status === 'needs_proficiency_boost' && (
                      <span className="warning-text">Needs applied proficiency</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="group-empty-state">
              <p>No matching competencies currently found on your profile.</p>
            </div>
          )}
        </div>

        {/* GROUP 2: Skills Needing Development */}
        <div className="gap-group-panel development">
          <div className="group-header">
            <div className="group-title-wrap">
              <XCircle size={16} className="text-amber" />
              <h3>Skills Needing Development</h3>
            </div>
            <span className="group-count-pill">{devSkills.length}</span>
          </div>
          <p className="group-desc">Career requirements not yet demonstrated on your profile</p>

          {devSkills.length > 0 ? (
            <div className="group-items-list">
              {devSkills.map((s, idx) => (
                <div key={s.skill_id || idx} className="gap-item-card development">
                  <div className="gap-item-header">
                    <span className="skill-name">{s.skill}</span>
                    <span className={`importance-tag ${(s.importance || 'useful').toLowerCase()}`}>
                      {s.importance === 'required' ? 'Required' : 'Important'}
                    </span>
                  </div>
                  <div className="gap-item-footer">
                    <span className="evidence-status-pill not-reported" title="This competency is not recorded on your profile. Confirmed absence cannot be assumed without formal assessment.">
                      Not reported on profile
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="group-empty-state">
              <p>Outstanding! Your profile covers all documented competencies.</p>
            </div>
          )}
        </div>
      </div>

      {/* GROUP 3: Unverified / Pending Skills Callout */}
      {unverifiedSkills.length > 0 && (
        <div className="unverified-skills-callout">
          <div className="callout-header">
            <ShieldAlert size={16} />
            <h4>Unverified Skills ({unverifiedSkills.length})</h4>
          </div>
          <p className="callout-sub">
            The following competencies are self-reported on your profile without external credential or project verification:
          </p>
          <div className="unverified-tags-row">
            {unverifiedSkills.map((u, i) => (
              <span key={i} className="unverified-tag">
                {u.skill} ({u.level || 'Self-Reported'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* GROUP 4: Priority Skills */}
      {prioritySkills.length > 0 && (
        <div className="priority-skills-container">
          <div className="priority-header">
            <Target size={16} />
            <h3>Priority Competencies to Focus On First</h3>
            <span className="priority-badge">Recommended Sequence</span>
          </div>
          <p className="priority-intro">
            Based on prerequisite hierarchies and daily role responsibilities, developing these competencies provides the highest career progression impact:
          </p>
          <div className="priority-grid">
            {prioritySkills.map((ps, idx) => (
              <div key={ps.skill_id || idx} className="priority-card">
                <div className="priority-order-num">{idx + 1}</div>
                <div className="priority-card-content">
                  <span className="priority-skill-title">{ps.skill}</span>
                  <span className="priority-reason">
                    {ps.importance === 'required'
                      ? 'Core prerequisite for day-to-day role execution'
                      : 'High-value analytical competency expected in workflows'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concrete Next Action Banner */}
      <div className="recommended-action-banner">
        <div className="action-icon-wrap">
          <Lightbulb size={22} />
        </div>
        <div className="action-content">
          <span className="action-kicker">RECOMMENDED NEXT ACTION</span>
          <p className="action-text">{recommendedNextAction}</p>
        </div>
        <Link to="/profile" className="btn outline small">
          Update Skills Profile <ArrowRight size={14} />
        </Link>
      </div>

      {/* Structured Milestones Progression */}
      {learningMilestones.length > 0 && (
        <div className="milestones-progression-block">
          <h4 className="milestones-heading">Learning & Project Milestones</h4>
          <div className="milestones-timeline">
            {learningMilestones.map((m) => (
              <div key={m.step} className="milestone-step-item">
                <div className="milestone-step-marker">{m.step}</div>
                <div className="milestone-step-body">
                  <h5 className="milestone-title">{m.title}</h5>
                  <p className="milestone-desc">{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
