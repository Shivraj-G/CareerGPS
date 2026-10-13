import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Bookmark,
  BookmarkCheck,
  ShieldCheck,
  Clock3,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Layers,
  Scale,
  BookOpen
} from 'lucide-react';

function getDomainLabel(domainKey = '', title = '', description = '') {
  const domainMap = {
    ACADEMIA_EDUCATION: 'Higher Education & Academic Research',
    SOFTWARE_PLATFORMS: 'Software & Platform Engineering',
    DATA_INTELLIGENCE: 'Data Analytics & Artificial Intelligence',
    ENTERPRISE_SYSTEMS: 'Enterprise Systems & Business Operations',
    FINANCE_ACCOUNTING: 'Finance, Banking & Accounting Technology',
    HEALTHCARE_CLINICAL: 'Clinical Medicine & Healthcare Services',
    PUBLIC_SAFETY_LAW: 'Public Safety, Law & Judicial Administration',
    CULINARY_HOSPITALITY: 'Culinary Arts & Hospitality Management',
    ADMINISTRATION: 'Business Operations & Administration',
    TECHNICAL_TRADES: 'Technical Systems & Engineering Trades',
    DESIGN_CREATIVE: 'Product Design, UI/UX & Visual Media'
  };

  if (domainKey && domainMap[domainKey]) {
    return domainMap[domainKey];
  }

  const text = (title + ' ' + description).toLowerCase();
  if (text.includes('professor') || text.includes('teacher') || text.includes('academic') || text.includes('lecturer')) {
    return 'Higher Education & Academic Research';
  }
  if (text.includes('finance') || text.includes('accounting') || text.includes('financial')) {
    return 'Finance & Accounting Technology';
  }
  if (text.includes('erp') || text.includes('enterprise resource') || text.includes('sap')) {
    return 'Enterprise Systems & Operations';
  }
  if (text.includes('data') || text.includes('analytics') || text.includes('bi analyst')) {
    return 'Data Analytics & Artificial Intelligence';
  }
  if (text.includes('business analyst') || text.includes('requirements') || text.includes('consultant')) {
    return 'Business Analysis & Systems Strategy';
  }
  if (text.includes('cyber') || text.includes('security')) {
    return 'Cybersecurity & Infrastructure';
  }
  if (text.includes('doctor') || text.includes('surgeon') || text.includes('clinical') || text.includes('medical')) {
    return 'Clinical Medicine & Healthcare';
  }
  if (text.includes('police') || text.includes('law enforcement')) {
    return 'Public Safety & Law Enforcement';
  }
  if (text.includes('engineer') || text.includes('developer') || text.includes('software')) {
    return 'Software & Platform Engineering';
  }
  return 'Professional Career Track';
}

export default function CareerHero({
  career,
  saved = false,
  onToggleSave = () => {},
  user = null
}) {
  const [expandedDesc, setExpandedDesc] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(null);

  if (!career) return null;

  const domain = getDomainLabel(career.domainInfo?.topDomain, career.title, career.description);
  const desc = career.description || 'Comprehensive career guide and competency profile.';
  const isLongDesc = desc.length > 220;
  const displayDesc = isLongDesc && !expandedDesc ? desc.slice(0, 220) + '...' : desc;

  function handleSaveClick() {
    onToggleSave();
    const nextSaved = !saved;
    setSaveFeedback(nextSaved ? 'Saved to your shortlist' : 'Removed from shortlist');
    setTimeout(() => setSaveFeedback(null), 2500);
  }

  const isVerified = career.verificationStatus === 'verified' && career.origin !== 'ai_generated';
  const isAiGenerated = career.origin === 'ai_generated' || career.isAiProfile;
  const isNeedsReview = career.verificationStatus === 'needs_review' || career.verificationStatus === 'unverified';
  const statutory = career.regulatoryGuidance?.statutoryFramework;

  return (
    <header className="career-hero-card">
      {/* Breadcrumb Navigation */}
      <nav className="career-breadcrumb" aria-label="Breadcrumb">
        <Link to="/" className="breadcrumb-link">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <Link to="/careers" className="breadcrumb-link">Careers</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current" aria-current="page">{career.title}</span>
      </nav>

      <div className="career-hero-main">
        {/* Left Icon Badge */}
        <div className="career-hero-badge" aria-hidden="true">
          <BriefcaseBusiness size={32} />
        </div>

        {/* Center Content */}
        <div className="career-hero-content">
          <div className="career-hero-eyebrow">
            <span className="domain-pill">
              <Layers size={13} />
              {domain}
            </span>

            {/* Clear, Trustworthy Verification Badges */}
            {isVerified && (
              <span className="verification-pill verified" title="Independently curated and verified in the official NaviGoa database">
                <ShieldCheck size={13} />
                Verified Catalogue Entry
              </span>
            )}

            {isNeedsReview && !isAiGenerated && (
              <span className="verification-pill needs-review" title="Curated catalogue guide; specific recruitment criteria vary by state and university">
                <BookOpen size={13} />
                Catalogue Guidance Entry
              </span>
            )}

            {isAiGenerated && (
              <span className="verification-pill ai-generated" title="Synthesized by NaviGoa intelligence models. Official accreditation pending.">
                <Sparkles size={13} />
                AI Assisted Career Guide
              </span>
            )}

            {career.contentSource?.enriched && !isAiGenerated && (
              <span className="verification-pill enriched" title="Enriched overview synthesized from structured syllabus models">
                <Sparkles size={13} />
                Enriched Overview
              </span>
            )}
          </div>

          <h1 className="career-hero-title">{career.title}</h1>

          {/* Concise Plain-Language Overview by Default */}
          <div className="career-hero-desc-wrap">
            <p className="career-hero-desc">{displayDesc}</p>
            {isLongDesc && (
              <button
                type="button"
                className="btn-toggle-desc"
                onClick={() => setExpandedDesc(!expandedDesc)}
                aria-expanded={expandedDesc}
              >
                {expandedDesc ? (
                  <>Show concise summary <ChevronUp size={14} /></>
                ) : (
                  <>Read full overview <ChevronDown size={14} /></>
                )}
              </button>
            )}
          </div>

          {/* Statutory Framework Trust Notice */}
          {statutory && (
            <div className="statutory-hero-notice">
              <Scale size={14} className="statutory-icon" />
              <span>
                <strong>Regulatory Framework:</strong> Governed by {statutory.authority} ({statutory.jurisdiction}). Specific minimums and vacancy criteria vary by institution.
              </span>
            </div>
          )}

          {isAiGenerated && career.disclaimer && (
            <div className="career-hero-disclaimer" role="alert">
              <Sparkles size={15} />
              <span>{career.disclaimer}</span>
            </div>
          )}

          {career.sourceUrl && (
            <div className="career-hero-meta-links">
              <a
                href={career.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="source-reference-link"
              >
                View official reference gazette <ExternalLink size={13} />
              </a>
            </div>
          )}
        </div>

        {/* Right Actions */}
        <div className="career-hero-actions">
          <button
            type="button"
            className={`btn-save-career ${saved ? 'saved' : ''}`}
            onClick={handleSaveClick}
            title={saved ? 'Remove from your saved shortlist' : 'Save career to your personal shortlist'}
            aria-pressed={saved}
          >
            {saved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
            <span>{saved ? 'Saved' : 'Save Career'}</span>
          </button>
          {saveFeedback && (
            <span className="save-feedback-toast" role="status">
              {saveFeedback}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
