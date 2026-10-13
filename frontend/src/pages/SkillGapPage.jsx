import React from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, Target, Sparkles } from 'lucide-react';
import SkillGapSection from '../components/career/SkillGapSection.jsx';
import RelatedCareersSection from '../components/career/RelatedCareersSection.jsx';

export default function SkillGapPage({ user = null }) {
  const [params] = useSearchParams();
  const careerId = params.get('career') || '';
  const careerTitle = params.get('title') || 'this career';
  const type = params.get('type') || '';
  const isAiProfile = type === 'ai_profile';

  return (
    <div className="skill-gap-page-container">
      {/* Breadcrumb Navigation */}
      <nav className="career-breadcrumb" style={{ marginBottom: 16 }}>
        {careerId ? (
          <Link to={`/careers/${careerId}`} className="breadcrumb-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Back to {careerTitle}
          </Link>
        ) : (
          <Link to="/careers" className="breadcrumb-link" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ArrowLeft size={14} /> Back to all careers
          </Link>
        )}
      </nav>

      {/* Main Analysis Section */}
      <SkillGapSection
        careerId={careerId}
        careerTitle={careerTitle}
        isAiProfile={isAiProfile}
        user={user}
      />

      {/* Related Careers IMMEDIATELY BELOW Skill Gap Analysis */}
      {careerId && (
        <RelatedCareersSection
          careerId={careerId}
          currentTitle={careerTitle}
          user={user}
        />
      )}
    </div>
  );
}
