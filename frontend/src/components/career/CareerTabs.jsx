import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle2,
  GraduationCap,
  Building2,
  MapPin,
  ExternalLink,
  ArrowRight,
  BookOpen,
  Route as PathwayIcon,
  Briefcase,
  Sparkles,
  Award,
  CalendarDays,
  Target,
  Scale,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  AlertCircle,
  Layers,
  Info,
  Clock,
  Compass
} from 'lucide-react';
import SkillDetailDrawer from './SkillDetailDrawer.jsx';

function safeString(item) {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') {
    return item.title || item.name || item.description || item.level || JSON.stringify(item);
  }
  return String(item);
}

export default function CareerTabs({
  career,
  activeTab,
  onTabChange,
  tabData,
  tabStatus,
  user = null
}) {
  const [showFullDetails, setShowFullDetails] = useState(false);
  const [selectedDifficultyLevel, setSelectedDifficultyLevel] = useState('all');
  const [activeSkillForDrawer, setActiveSkillForDrawer] = useState(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  function handleOpenSkillDetail(skill) {
    setActiveSkillForDrawer(skill);
    setIsDrawerOpen(true);
  }

  function handleCloseSkillDetail() {
    setIsDrawerOpen(false);
    setActiveSkillForDrawer(null);
  }

  const tabs = [
    { key: 'overview', label: 'Overview', icon: BookOpen },
    { key: 'skills', label: 'Skills', icon: Award, count: tabData.skills?.length },
    { key: 'pathways', label: 'Career Path', icon: PathwayIcon, count: tabData.pathways?.length },
    { key: 'courses', label: 'Courses', icon: GraduationCap, count: tabData.courses?.length },
    { key: 'opportunities', label: 'Opportunities', icon: Briefcase, count: tabData.opportunities?.length },
  ];

  const responsibilities = Array.isArray(career.responsibilities) ? career.responsibilities : [];
  const qualifications = Array.isArray(career.qualifications) ? career.qualifications : [];
  const entryRoutes = Array.isArray(career.entryRoutes) ? career.entryRoutes : [];
  const progression = Array.isArray(career.progressionLadder) && career.progressionLadder.length > 0
    ? career.progressionLadder
    : [];
  const guidance = career.regulatoryGuidance;

  const mandatory = guidance?.mandatory?.length > 0 ? guidance.mandatory : (qualifications.length > 0 ? [qualifications[0]] : ['Relevant Bachelor degree / diploma']);
  const preferred = guidance?.preferred?.length > 0 ? guidance.preferred : qualifications.slice(1);
  const nextAction = guidance?.recommendedNextAction;

  return (
    <section className="career-tabs-container">
      {/* Tab Navigation Bar */}
      <div className="career-tab-bar" role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`career-tab-btn ${isActive ? 'active' : ''}`}
              onClick={() => onTabChange(t.key)}
            >
              <Icon size={16} />
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && (
                <span className="tab-count-badge">{t.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div className="career-tab-content">
        {/* OVERVIEW TAB: FIRST SCREEN WITH THE 5 ESSENTIAL USER QUESTIONS */}
        {activeTab === 'overview' && (
          <div className="overview-tab-grid">
            {/* 1. AT A GLANCE: 5 ESSENTIAL QUESTIONS ANSWERED DIRECTLY */}
            <div className="essential-qa-grid">
              {/* Question 1: What is this career? */}
              <div className="qa-card highlight">
                <span className="qa-step-num">1. ROLE IDENTITY</span>
                <h4 className="qa-card-title">What is this career?</h4>
                <p className="qa-card-desc">
                  {career.description
                    ? (career.description.length > 200 ? career.description.slice(0, 200) + '...' : career.description)
                    : 'A professional specialized role operating within verified market workflows.'}
                </p>
              </div>

              {/* Question 2: What work does the person actually do? */}
              <div className="qa-card">
                <span className="qa-step-num">2. EVERYDAY WORK</span>
                <h4 className="qa-card-title">What work is done daily?</h4>
                <p className="qa-card-desc">
                  {responsibilities.length > 0
                    ? `${safeString(responsibilities[0])}${responsibilities.length > 1 ? `; and ${safeString(responsibilities[1])}` : ''}.`
                    : 'Coordinates specialized domain tasks, analytical documentation, and stakeholder execution.'}
                </p>
              </div>

              {/* Question 3: What skills are needed? */}
              <div className="qa-card">
                <span className="qa-step-num">3. SKILL REQUIREMENTS</span>
                <h4 className="qa-card-title">What skills are needed?</h4>
                <p className="qa-card-desc">
                  Requires core technical competency combined with analytical problem-solving and structured communication.
                </p>
                <button
                  type="button"
                  className="qa-inline-link"
                  onClick={() => onTabChange('skills')}
                >
                  View all documented skills →
                </button>
              </div>

              {/* Question 4: How can someone enter this career? */}
              <div className="qa-card">
                <span className="qa-step-num">4. ENTRY GATES</span>
                <h4 className="qa-card-title">How do you enter this role?</h4>
                <p className="qa-card-desc">
                  {mandatory.length > 0
                    ? safeString(mandatory[0])
                    : 'Structured academic degree or certified vocational apprenticeship.'}
                </p>
              </div>
            </div>

            {/* Question 5: What should I do next? (RECOMMENDED NEXT ACTION CALLOUT) */}
            {nextAction && (
              <div className="recommended-next-action-card">
                <div className="action-card-header">
                  <div className="action-icon-wrap">
                    <Target size={20} />
                  </div>
                  <div>
                    <span className="action-tag">5. RECOMMENDED NEXT ACTION</span>
                    <h3 className="action-title">{nextAction.title}</h3>
                  </div>
                </div>
                <p className="action-description">{nextAction.action}</p>
                <div className="action-buttons-row">
                  <a href="#skill-gap-assessment" className="btn primary small">
                    Assess My Skill Gap for This Role <ArrowRight size={14} />
                  </a>
                </div>
              </div>
            )}

            {/* REALISTIC CAREER PROGRESSION LADDER */}
            {progression.length > 0 && (
              <div className="content-panel progression-panel">
                <div className="panel-header-row">
                  <div>
                    <h3 className="panel-title">Realistic Career Progression</h3>
                    <p className="panel-subtitle">Standard advancement milestones along this professional ladder</p>
                  </div>
                  <span className="progression-badge">
                    <TrendingUp size={14} /> Career Ladder
                  </span>
                </div>

                <div className="progression-ladder-flow">
                  {progression.map((step, idx) => (
                    <div
                      key={idx}
                      className={`progression-step-card ${step.current ? 'current-step' : ''}`}
                    >
                      <div className="step-badge-row">
                        <span className="step-level-label">{step.level}</span>
                        {step.current && <span className="step-current-tag">This Role</span>}
                      </div>
                      <h4 className="step-role-title">{step.role}</h4>
                      <p className="step-role-desc">{step.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TYPICAL RESPONSIBILITIES (4-6 PRACTICAL BULLETS) */}
            {responsibilities.length > 0 && (
              <div className="content-panel">
                <h3 className="panel-title">Typical Responsibilities</h3>
                <p className="panel-subtitle">Everyday tasks and core responsibilities for this position</p>
                <ul className="bullet-feature-list">
                  {responsibilities.slice(0, 6).map((r, i) => (
                    <li key={i} className="bullet-feature-item">
                      <CheckCircle2 size={16} className="bullet-icon" />
                      <span>{safeString(r)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* EDUCATION AND ENTRY ROUTES (MANDATORY VS PREFERRED SEPARATED) */}
            <div className="content-panel-two-col">
              {/* Mandatory / Gateway Requirements */}
              <div className="content-panel sub">
                <div className="panel-sub-header">
                  <Scale size={18} className="text-blue" />
                  <h3 className="panel-title">Mandatory / Statutory Requirements</h3>
                </div>
                <p className="panel-subtitle" style={{ marginBottom: 12 }}>
                  Essential qualifications or examination gates required to practice
                </p>
                <ul className="bullet-feature-list">
                  {mandatory.map((m, i) => (
                    <li key={i} className="bullet-feature-item">
                      <CheckCircle2 size={16} className="bullet-icon text-emerald" />
                      <span>{safeString(m)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Commonly Preferred Qualifications */}
              <div className="content-panel sub">
                <div className="panel-sub-header">
                  <Award size={18} className="text-amber" />
                  <h3 className="panel-title">Commonly Preferred Qualifications</h3>
                </div>
                <p className="panel-subtitle" style={{ marginBottom: 12 }}>
                  Attributes that strengthen applications and career advancement
                </p>
                <ul className="bullet-feature-list">
                  {preferred.length > 0 ? (
                    preferred.map((p, i) => (
                      <li key={i} className="bullet-feature-item">
                        <CheckCircle2 size={16} className="bullet-icon text-muted" />
                        <span>{safeString(p)}</span>
                      </li>
                    ))
                  ) : (
                    <li className="bullet-feature-item">
                      <CheckCircle2 size={16} className="bullet-icon text-muted" />
                      <span>Relevant internship, project portfolio, or institutional experience</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>

            {/* STATUTORY JURISDICTION ADVISORY NOTE */}
            {guidance?.statutoryFramework && (
              <div className="statutory-advisory-box">
                <AlertCircle size={18} className="advisory-icon" />
                <div className="advisory-content">
                  <h4>Statutory Verification Notice</h4>
                  <p>{guidance.statutoryFramework.note}</p>
                </div>
              </div>
            )}

            {/* EXPANDABLE DEEPER DETAILS & ALTERNATIVE ROUTES */}
            {entryRoutes.length > 0 && (
              <div className="expandable-details-card">
                <button
                  type="button"
                  className="btn-toggle-deep-details"
                  onClick={() => setShowFullDetails(!showFullDetails)}
                  aria-expanded={showFullDetails}
                >
                  <span>Alternative Entry Pathways & Historical Details</span>
                  {showFullDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showFullDetails && (
                  <div className="deep-details-body">
                    <ul className="bullet-feature-list">
                      {entryRoutes.map((er, idx) => (
                        <li key={idx} className="bullet-feature-item">
                          <CheckCircle2 size={16} className="bullet-icon" />
                          <span>{safeString(er)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LOADING & ERROR STATES FOR ASYNC TABS */}
        {activeTab !== 'overview' && tabStatus === 'loading' && (
          <div className="tab-loading-state">
            <div className="spinner-pulse" />
            <p>Loading {activeTab} information...</p>
          </div>
        )}

        {activeTab !== 'overview' && tabStatus === 'error' && (
          <div className="tab-error-state">
            <p>Could not load this section right now. Please try again.</p>
            <button
              type="button"
              className="btn outline small"
              onClick={() => onTabChange(activeTab)}
            >
              Retry
            </button>
          </div>
        )}

        {/* SKILLS TAB: 3-LEVEL INTERACTIVE CAREER SKILLS ENGINE */}
        {activeTab === 'skills' && tabStatus === 'ready' && (() => {
          const allSkills = Array.isArray(tabData.skills) ? tabData.skills : [];
          const foundationalSkills = allSkills.filter(s => s.learning_level === 'foundational');
          const intermediateSkills = allSkills.filter(s => s.learning_level === 'intermediate');
          const advancedSkills = allSkills.filter(s => s.learning_level === 'advanced');

          const displayedSkills = selectedDifficultyLevel === 'foundational'
            ? foundationalSkills
            : selectedDifficultyLevel === 'intermediate'
            ? intermediateSkills
            : selectedDifficultyLevel === 'advanced'
            ? advancedSkills
            : allSkills;

          const levelExplanations = {
            all: 'Browse all documented competencies across 3 distinct learning-difficulty tiers. Difficulty is strictly separate from career importance — foundational skills can be mandatory prerequisites, while advanced skills can be complementary.',
            foundational: 'LEVEL 1 — FOUNDATIONAL: Entry-friendly baseline knowledge, syntax, core principles, and prerequisites that build the essential foundation for more advanced competencies.',
            intermediate: 'LEVEL 2 — INTERMEDIATE: Skills that require foundational knowledge and practical application, standard frameworks, data workflows, and daily role responsibilities.',
            advanced: 'LEVEL 3 — ADVANCED: Complex competencies requiring stronger foundational depth, specialized architectures, production pipelines, research methodologies, or advanced optimization.'
          };

          return (
            <div className="content-panel skills-engine-panel">
              {/* PANEL HEADER */}
              <div className="panel-header-row">
                <div>
                  <div className="engine-eyebrow">
                    <Layers size={14} />
                    <span>INTERACTIVE LEARNING ENGINE</span>
                  </div>
                  <h3 className="panel-title">Skills & Learning Progression</h3>
                  <p className="panel-subtitle">
                    Organized into 3 learning difficulty tiers for <strong>{career.title}</strong>. Click any skill for definitions, prerequisites, subtopics, and exercises.
                  </p>
                </div>
              </div>

              {/* 3-LEVEL SEGMENTED SWITCHER BAR */}
              <div className="skills-difficulty-switcher" role="tablist" aria-label="Learning Difficulty Filter">
                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedDifficultyLevel === 'all'}
                  className={`difficulty-tab-btn ${selectedDifficultyLevel === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedDifficultyLevel('all')}
                >
                  <span>All Skills</span>
                  <span className="diff-count-pill">{allSkills.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedDifficultyLevel === 'foundational'}
                  className={`difficulty-tab-btn foundational ${selectedDifficultyLevel === 'foundational' ? 'active' : ''}`}
                  onClick={() => setSelectedDifficultyLevel('foundational')}
                >
                  <span className="level-dot foundational" />
                  <span>Level 1 · Foundational</span>
                  <span className="diff-count-pill">{foundationalSkills.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedDifficultyLevel === 'intermediate'}
                  className={`difficulty-tab-btn intermediate ${selectedDifficultyLevel === 'intermediate' ? 'active' : ''}`}
                  onClick={() => setSelectedDifficultyLevel('intermediate')}
                >
                  <span className="level-dot intermediate" />
                  <span>Level 2 · Intermediate</span>
                  <span className="diff-count-pill">{intermediateSkills.length}</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedDifficultyLevel === 'advanced'}
                  className={`difficulty-tab-btn advanced ${selectedDifficultyLevel === 'advanced' ? 'active' : ''}`}
                  onClick={() => setSelectedDifficultyLevel('advanced')}
                >
                  <span className="level-dot advanced" />
                  <span>Level 3 · Advanced</span>
                  <span className="diff-count-pill">{advancedSkills.length}</span>
                </button>
              </div>

              {/* LEVEL PURPOSE ADVISORY CALLOUT */}
              <div className="difficulty-advisory-box">
                <Info size={16} className="advisory-icon" />
                <p className="advisory-text">
                  {levelExplanations[selectedDifficultyLevel]}
                </p>
              </div>

              {/* SKILLS CARDS GRID */}
              {displayedSkills.length > 0 ? (
                <div className="skills-interactive-grid">
                  {displayedSkills.map((s) => {
                    const levelNum = s.level_number || (s.learning_level === 'foundational' ? 1 : (s.learning_level === 'advanced' ? 3 : 2));
                    const isReq = s.importance === 'required';
                    const isImp = s.importance === 'important';

                    const impBadgeClass = isReq ? 'badge-mandatory' : (isImp ? 'badge-highvalue' : 'badge-complementary');
                    const impText = isReq ? 'Mandatory' : (isImp ? 'High Value' : 'Complementary');

                    const levelBadgeClass = levelNum === 1 ? 'badge-level-foundational' : (levelNum === 2 ? 'badge-level-intermediate' : 'badge-level-advanced');
                    const levelText = `Level ${levelNum} · ${s.learning_level || (levelNum === 1 ? 'Foundational' : (levelNum === 3 ? 'Advanced' : 'Intermediate'))}`;

                    const subtopics = Array.isArray(s.learning_metadata?.what_to_learn)
                      ? s.learning_metadata.what_to_learn.slice(0, 2)
                      : [];

                    return (
                      <div
                        key={s.id || s.name}
                        className="interactive-skill-card"
                        role="button"
                        tabIndex={0}
                        onClick={() => handleOpenSkillDetail(s)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleOpenSkillDetail(s);
                          }
                        }}
                        aria-label={`View learning details for ${s.name}`}
                      >
                        {/* Top Badges Row */}
                        <div className="skill-card-top-badges">
                          <span className={`drawer-badge ${levelBadgeClass}`}>
                            <Layers size={11} />
                            <span>{levelText}</span>
                          </span>

                          <span className={`drawer-badge ${impBadgeClass}`}>
                            <Award size={11} />
                            <span>{impText}</span>
                          </span>

                          {s.is_recommended_next && (
                            <span className="drawer-badge badge-recommended-next">
                              <Sparkles size={11} />
                              <span>Recommended Next</span>
                            </span>
                          )}

                          {s.user_status === 'demonstrated' && (
                            <span className="drawer-badge status-demonstrated">
                              <CheckCircle2 size={11} />
                              <span>Demonstrated</span>
                            </span>
                          )}
                        </div>

                        {/* Card Title */}
                        <h4 className="skill-card-title">{s.name}</h4>

                        {/* Card Definition / Summary Snippet */}
                        <p className="skill-card-snippet">
                          {s.learning_metadata?.what_it_means
                            ? (s.learning_metadata.what_it_means.length > 120 ? s.learning_metadata.what_it_means.slice(0, 120) + '...' : s.learning_metadata.what_it_means)
                            : (s.description || 'Practical role competency structured for verified learning execution.')}
                        </p>

                        {/* Subtopics Preview */}
                        {subtopics.length > 0 && (
                          <div className="skill-subtopics-preview">
                            {subtopics.map((st, sIdx) => (
                              <span key={sIdx} className="subtopic-tag">
                                • {st.length > 38 ? st.slice(0, 38) + '...' : st}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Card Footer: Effort & Action Cue */}
                        <div className="skill-card-footer">
                          {s.learning_metadata?.estimated_effort && (
                            <span className="skill-effort-pill">
                              <Clock size={12} />
                              <span>{s.learning_metadata.estimated_effort.split('(')[0].trim()}</span>
                            </span>
                          )}

                          <span className="skill-card-action-link">
                            Explore Details <ArrowRight size={13} />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="skills-empty-level-state">
                  <p>No skills recorded in this specific learning tier yet.</p>
                  <button
                    type="button"
                    className="btn outline small"
                    onClick={() => setSelectedDifficultyLevel('all')}
                  >
                    View All Skills
                  </button>
                </div>
              )}
            </div>
          );
        })()}


        {/* CAREER PATH TAB */}
        {activeTab === 'pathways' && tabStatus === 'ready' && (
          <div className="content-panel">
            <h3 className="panel-title">Career Learning & Advancement Pathways</h3>
            <p className="panel-subtitle">Structured progression routes from entry to senior capability</p>

            {Array.isArray(tabData.pathways) && tabData.pathways.length > 0 ? (
              <div className="pathway-cards-grid">
                {tabData.pathways.map(p => (
                  <div key={p.id} className="pathway-item-card">
                    <h4>{p.title}</h4>
                    <p>{p.description}</p>
                    <Link
                      to={`/pathway?career=${career.id}&pathway=${p.id}&title=${encodeURIComponent(career.title)}`}
                      className="btn primary small"
                    >
                      Explore Pathway <ArrowRight size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pathway-generator-cta">
                <h4>Build your personalized career pathway</h4>
                <p>Generate a step-by-step roadmap mapping your education, skills, and target milestones.</p>
                <Link
                  to={`/pathway?career=${career.id}&title=${encodeURIComponent(career.title)}`}
                  className="btn primary"
                >
                  <Sparkles size={16} /> Generate Personalized Pathway
                </Link>
              </div>
            )}
          </div>
        )}

        {/* COURSES TAB */}
        {activeTab === 'courses' && tabStatus === 'ready' && (
          <div className="content-panel">
            <h3 className="panel-title">Linked Academic & Professional Courses</h3>
            <p className="panel-subtitle">Programmes providing accredited preparation for this career</p>

            {Array.isArray(tabData.courses) && tabData.courses.length > 0 ? (
              <div className="institution-grid">
                {tabData.courses.map((course) => (
                  <div className="institution-card" key={course.courseId || course.id}>
                    <div className="institution-image">
                      <GraduationCap size={26} />
                    </div>
                    <span className="tag">
                      {course.level || course.course_type || course.qualification || "Course"}
                    </span>
                    <h2>{course.courseName || course.title}</h2>
                    {course.institutionName && (
                      <p><Building2 size={14} /> {course.institutionName}</p>
                    )}
                    {course.location && (
                      <p style={{ marginTop: 4 }}><MapPin size={14} /> {course.location}</p>
                    )}
                    <span className="muted" style={{ margin: '8px 0 16px 0' }}>
                      {course.duration || course.duration_text || ""}
                    </span>
                    <div style={{ flex: 1 }}></div>
                    {course.institutionId && (
                      <Link to={`/institutions/${course.institutionId}`} className="btn outline full" style={{ marginBottom: 8 }}>
                        View institution <ArrowRight size={14} />
                      </Link>
                    )}
                    {course.officialWebsite && (
                      <a
                        href={course.officialWebsite}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn full"
                        style={{ background: 'var(--surface-sunken)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                      >
                        Official website <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-panel-text">No matching study options are currently catalogued for this career.</p>
            )}
          </div>
        )}

        {/* OPPORTUNITIES TAB */}
        {activeTab === 'opportunities' && tabStatus === 'ready' && (
          <div className="content-panel">
            <h3 className="panel-title">Live & Archived Opportunities</h3>
            <p className="panel-subtitle">Job posts, internships, and recruitments linked to this profile</p>

            {Array.isArray(tabData.opportunities) && tabData.opportunities.length > 0 ? (
              <div className="opportunity-list">
                {tabData.opportunities.map((o) => (
                  <Link className="opportunity-card" to={`/opportunities/${o.id}`} key={o.id}>
                    <div className="opp-logo">
                      <Building2 />
                    </div>
                    <div className="opp-main">
                      <div className="opp-top">
                        <span className={`status-pill ${(o.status || '').toLowerCase()}`}>
                          {o.status}
                        </span>
                        <span>{o.opportunity_type}</span>
                      </div>
                      <h2>{o.title}</h2>
                      <p>
                        <Building2 size={14} /> {o.organization} · <MapPin size={14} /> {o.location}
                      </p>
                      {o.application_deadline && (
                        <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                          <CalendarDays size={13} /> Deadline: {new Date(o.application_deadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                    <ArrowRight size={18} />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="empty-panel-text">No current job or internship opportunities are linked to this career yet.</p>
            )}
          </div>
        )}
      </div>

      {/* ACCESSIBLE INTERACTIVE SKILL DETAIL DRAWER */}
      <SkillDetailDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseSkillDetail}
        skill={activeSkillForDrawer}
        careerTitle={career.title}
        careerId={career.id}
        user={user}
      />
    </section>
  );
}

