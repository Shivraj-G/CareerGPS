import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Award,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  BookOpen,
  Clock,
  Compass,
  ArrowRight,
  ExternalLink,
  Target,
  FileCheck2,
  ShieldCheck,
  PlusCircle,
  Check
} from 'lucide-react';
import { api, getToken } from '../../api/client.js';

export default function SkillDetailDrawer({
  isOpen,
  onClose,
  skill,
  careerTitle = 'this career',
  careerId = null,
  user = null,
  onSkillUpdated = null
}) {
  const drawerRef = useRef(null);
  const closeBtnRef = useRef(null);
  const [savingStatus, setSavingStatus] = useState('idle'); // idle | saving | saved | error
  const [saveMessage, setSaveMessage] = useState('');

  // ESC key and focus management
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button when opened
    setTimeout(() => {
      if (closeBtnRef.current) closeBtnRef.current.focus();
    }, 50);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen || !skill) return null;

  const metadata = skill.learning_metadata || {};
  const levelNum = skill.level_number || (skill.learning_level === 'foundational' ? 1 : (skill.learning_level === 'advanced' ? 3 : 2));
  const levelName = skill.learning_level || (levelNum === 1 ? 'foundational' : (levelNum === 3 ? 'advanced' : 'intermediate'));

  // Importance label & styling
  const importanceLabel = skill.importance === 'required'
    ? 'Mandatory Prerequisite'
    : skill.importance === 'important'
    ? 'High-Value Competency'
    : 'Complementary Skill';

  const importanceBadgeClass = skill.importance === 'required'
    ? 'badge-mandatory'
    : skill.importance === 'important'
    ? 'badge-highvalue'
    : 'badge-complementary';

  // Level Badge
  const levelLabel = levelNum === 1
    ? 'Level 1 · Foundational'
    : levelNum === 2
    ? 'Level 2 · Intermediate'
    : 'Level 3 · Advanced';

  const levelBadgeClass = levelNum === 1
    ? 'badge-level-foundational'
    : levelNum === 2
    ? 'badge-level-intermediate'
    : 'badge-level-advanced';

  // User Profile Status
  const userStatus = skill.user_status || (skill.is_demonstrated ? 'demonstrated' : 'not_reported');
  const userStatusLabel = userStatus === 'demonstrated'
    ? 'Demonstrated in Profile'
    : userStatus === 'self_reported'
    ? 'Self-Reported on Profile'
    : userStatus === 'assessed_gap'
    ? 'Assessed Role Gap'
    : 'Not Yet Reported';

  const userStatusBadgeClass = userStatus === 'demonstrated'
    ? 'status-demonstrated'
    : userStatus === 'self_reported'
    ? 'status-self-reported'
    : userStatus === 'assessed_gap'
    ? 'status-assessed-gap'
    : 'status-not-reported';

  // Subtopics list
  const subtopics = Array.isArray(metadata.what_to_learn) && metadata.what_to_learn.length > 0
    ? metadata.what_to_learn
    : ['Foundational concepts and terminology', 'Standard practical tools and workflows', 'Edge cases and error handling'];

  // Prerequisites list
  const prerequisites = Array.isArray(metadata.prerequisites) && metadata.prerequisites.length > 0
    ? metadata.prerequisites
    : (levelNum === 1 ? ['None (Entry-friendly foundational skill)'] : ['Foundational domain literacy']);

  // Learning Resources (strictly verified platform guides, no fake external URLs)
  const resources = Array.isArray(metadata.learning_resources) && metadata.learning_resources.length > 0
    ? metadata.learning_resources
    : [
        {
          title: `NaviGoa Interactive Guide: ${skill.name}`,
          type: 'Curriculum Guide',
          provider: 'NaviGoa Intelligence',
          description: `Practical step-by-step learning modules aligned to verified industry standards.`
        }
      ];

  // Action: Add / Update skill in user profile
  async function handleAddSkillToProfile() {
    if (!getToken() || !user) {
      setSaveMessage('Please log in to save this skill to your profile.');
      setSavingStatus('error');
      return;
    }

    setSavingStatus('saving');
    try {
      // Check if skill has a standard catalog UUID
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(skill.id);
      if (isUuid) {
        // Fetch current user skills first to preserve them
        const current = await api.mySkills();
        const existingList = Array.isArray(current?.data) ? current.data : (Array.isArray(current) ? current : []);
        const alreadyHas = existingList.some(s => s.id === skill.id || s.skill_id === skill.id);

        const updatedPayload = alreadyHas
          ? existingList.map(s => ({
              skill_id: s.id || s.skill_id,
              level: s.level || 'intermediate',
              years_experience: s.years_experience || 0,
              verified: s.verified || false
            }))
          : [
              ...existingList.map(s => ({
                skill_id: s.id || s.skill_id,
                level: s.level || 'intermediate',
                years_experience: s.years_experience || 0,
                verified: s.verified || false
              })),
              {
                skill_id: skill.id,
                level: levelNum === 1 ? 'beginner' : (levelNum === 3 ? 'advanced' : 'intermediate'),
                years_experience: 1,
                verified: false
              }
            ];

        await api.updateMySkills({ skills: updatedPayload });
      } else {
        // Custom or AI-suggested skill
        await api.addCustomSkill({
          name: skill.name,
          level: levelNum === 1 ? 'beginner' : (levelNum === 3 ? 'advanced' : 'intermediate')
        });
      }

      setSavingStatus('saved');
      setSaveMessage(`"${skill.name}" has been recorded on your profile!`);
      if (onSkillUpdated) onSkillUpdated(skill.id);
    } catch (err) {
      console.error('[SkillDetailDrawer] Save error:', err);
      setSavingStatus('error');
      setSaveMessage(err?.message || 'Could not update profile skills at this time.');
    }
  }

  return (
    <div
      className="skill-drawer-backdrop"
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
    >
      <div
        className="skill-drawer-panel"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="skill-drawer-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* DRAWER HEADER */}
        <header className="skill-drawer-header">
          <div className="drawer-header-content">
            <div className="drawer-badges-strip">
              {/* Learning Difficulty Tier */}
              <span className={`drawer-badge ${levelBadgeClass}`}>
                <Layers size={13} />
                <span>{levelLabel}</span>
              </span>

              {/* Career Requirement Importance */}
              <span className={`drawer-badge ${importanceBadgeClass}`}>
                <Award size={13} />
                <span>{importanceLabel}</span>
              </span>

              {/* User Profile Evidence Status */}
              <span className={`drawer-badge ${userStatusBadgeClass}`}>
                {userStatus === 'demonstrated' ? <ShieldCheck size={13} /> : <Compass size={13} />}
                <span>{userStatusLabel}</span>
              </span>
            </div>

            <h2 id="skill-drawer-title" className="skill-drawer-title">
              {skill.name}
            </h2>
            <p className="skill-drawer-career-context">
              Curriculum & Practical Intelligence for <strong>{careerTitle}</strong>
            </p>
          </div>

          <button
            type="button"
            className="btn-drawer-close"
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close skill details"
          >
            <X size={20} />
          </button>
        </header>

        {/* DRAWER BODY (SCROLLABLE) */}
        <div className="skill-drawer-body">
          {/* 1. WHAT IT MEANS (BEGINNER-FRIENDLY EXPLANATION) */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <BookOpen size={16} className="section-icon" />
              <h3>What It Means</h3>
            </div>
            <p className="drawer-prose">
              {metadata.what_it_means || skill.description || `Practical capability in ${skill.name}, focusing on core principles, industry standards, and domain execution.`}
            </p>
          </section>

          {/* 2. WHY THIS CAREER NEEDS IT */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Target size={16} className="section-icon text-accent" />
              <h3>Why {careerTitle} Needs It</h3>
            </div>
            <p className="drawer-prose highlight-box">
              {metadata.why_needed || `Applied directly in ${careerTitle} workflows to carry out specialized responsibilities and maintain role quality.`}
            </p>
          </section>

          {/* 3. USER PROFILE READINESS & PERSONALIZED STATUS */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Compass size={16} className="section-icon text-indigo" />
              <h3>Your Profile Readiness & Status</h3>
            </div>
            <div className="readiness-card">
              <div className="readiness-status-row">
                <span className="readiness-tag">Current Evidence:</span>
                <span className={`status-pill ${userStatusBadgeClass}`}>{userStatusLabel}</span>
              </div>
              <p className="readiness-explanation">
                {skill.readiness_notes || (userStatus === 'demonstrated'
                  ? 'Demonstrated in your profile. You meet or exceed the documented prerequisite expectations for this competency.'
                  : userStatus === 'self_reported'
                  ? 'Self-reported in your profile. Applying this skill in a verified portfolio project will strengthen your readiness.'
                  : 'Not yet recorded in your profile. Developing this foundational skill will increase your overall career alignment.')}
              </p>
            </div>
          </section>

          {/* 4. WHAT TO LEARN (STRUCTURED CONCEPTS / SUBTOPICS) */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Layers size={16} className="section-icon" />
              <h3>What to Learn (Key Concepts & Subtopics)</h3>
            </div>
            <ul className="drawer-checklist">
              {subtopics.map((topic, i) => (
                <li key={i} className="drawer-checklist-item">
                  <CheckCircle2 size={16} className="check-icon" />
                  <span>{topic}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* 5. PREREQUISITES */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <FileCheck2 size={16} className="section-icon" />
              <h3>Prerequisites (Recommended Prior Knowledge)</h3>
            </div>
            <div className="prereq-chips-row">
              {prerequisites.map((pr, idx) => (
                <div key={idx} className="prereq-chip">
                  <span>{pr}</span>
                </div>
              ))}
            </div>
          </section>

          {/* 6. PRACTICAL WORKPLACE APPLICATION */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Award size={16} className="section-icon" />
              <h3>Practical Application in Everyday Work</h3>
            </div>
            <p className="drawer-prose">
              {metadata.practical_application || `Applied in day-to-day ${careerTitle} tasks to deliver verified project outcomes and coordinate deliverables.`}
            </p>
          </section>

          {/* 7. HANDS-ON MINI EXERCISE */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Sparkles size={16} className="section-icon text-amber" />
              <h3>Hands-on Mini Exercise / Project</h3>
            </div>
            <div className="exercise-card">
              <div className="exercise-card-badge">PRACTICE TASK</div>
              <p className="exercise-desc">
                {metadata.hands_on_exercise || `Build a small portfolio artifact or structured case study demonstrating end-to-end execution of ${skill.name}.`}
              </p>
            </div>
          </section>

          {/* 8. ESTIMATED LEARNING EFFORT */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <Clock size={16} className="section-icon" />
              <h3>Estimated Learning Effort</h3>
            </div>
            <div className="effort-display">
              <span className="effort-val">
                {metadata.estimated_effort || (levelNum === 1 ? '1–2 weeks (planning estimate)' : (levelNum === 2 ? '3–4 weeks (planning estimate)' : '6–8 weeks (planning estimate)'))}
              </span>
              <span className="effort-disclaimer">
                Labelled planning estimate based on standard curriculum progression. Individual pace varies with prior experience.
              </span>
            </div>
          </section>

          {/* 9. VERIFIED LEARNING RESOURCES */}
          <section className="drawer-section">
            <div className="drawer-section-heading">
              <BookOpen size={16} className="section-icon" />
              <h3>Learning Resources & Guidance</h3>
            </div>
            <div className="resources-list">
              {resources.map((res, rIdx) => (
                <div key={rIdx} className="resource-item-card">
                  <div className="resource-header">
                    <span className="resource-title">{res.title}</span>
                    <span className="resource-tag">{res.type}</span>
                  </div>
                  <p className="resource-desc">{res.description}</p>
                  <div className="resource-meta">
                    <span className="resource-provider">Provider: {res.provider}</span>
                    <span className="verified-pill">
                      <ShieldCheck size={12} /> Verified Platform Standard
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 10. NEXT ACTION & PROFILE INTERACTION */}
          <section className="drawer-section action-section">
            <div className="drawer-section-heading">
              <ArrowRight size={16} className="section-icon text-success" />
              <h3>Recommended Next Action</h3>
            </div>
            <div className="next-action-card">
              <p className="next-action-text">
                {metadata.recommended_action || `Review core principles of ${skill.name} and execute the hands-on exercise to build working confidence.`}
              </p>

              <div className="next-action-buttons">
                <button
                  type="button"
                  className="btn primary small"
                  onClick={handleAddSkillToProfile}
                  disabled={savingStatus === 'saving' || savingStatus === 'saved'}
                >
                  {savingStatus === 'saving' ? (
                    'Recording to Profile...'
                  ) : savingStatus === 'saved' ? (
                    <>
                      <Check size={14} /> Added to Profile
                    </>
                  ) : (
                    <>
                      <PlusCircle size={14} /> Save {skill.name} to My Profile
                    </>
                  )}
                </button>

                <button
                  type="button"
                  className="btn outline small"
                  onClick={onClose}
                >
                  Return to Skills Tab
                </button>
              </div>

              {saveMessage && (
                <p className={`action-feedback-msg ${savingStatus === 'error' ? 'text-danger' : 'text-success'}`}>
                  {saveMessage}
                </p>
              )}
            </div>
          </section>
        </div>

        {/* DRAWER FOOTER */}
        <footer className="skill-drawer-footer">
          <span className="footer-tip">
            Press <kbd>Esc</kbd> or click outside to dismiss this learning guide.
          </span>
          <button type="button" className="btn outline small" onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
