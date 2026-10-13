import React from "react";
import { 
  GraduationCap, 
  MapPin, 
  Target, 
  BriefcaseBusiness, 
  CheckCircle2, 
  ShieldCheck, 
  Mail,
  Compass
} from "lucide-react";
import { getDisplayName, getAvatarInitials } from "../../utils/userDisplay.js";

export default function ProfileSummaryCard({
  form,
  user,
  completeness = { percentage: 0, completed_fields: 0, total_fields: 6 }
}) {
  if (!form) return null;

  const displayName = getDisplayName(form, user, "User");
  const initials = getAvatarInitials(form, user, "U");

  // Education summary line
  let educationHeadline = "Education information unavailable";
  let educationSub = "";
  if (!form.hasEducation && !form.educationStage && !form.degree) {
    educationHeadline = "Education information unavailable";
  } else if (form.educationStage === "Currently in 12th") {
    educationHeadline = `Class 12 / Higher Secondary${form.stream ? ` (${form.stream})` : ""}`;
    educationSub = form.educationStatus ? `Status: ${form.educationStatus}` : "Pursuing";
  } else if (form.educationStage === "Higher Education") {
    educationHeadline = form.degree 
      ? form.degree + (form.specialization ? ` · ${form.specialization}` : "")
      : "Higher Education";
    educationSub = [
      form.stream ? `12th: ${form.stream}` : null,
      form.currentYear ? `Year ${form.currentYear}` : null,
      form.educationStatus ? form.educationStatus : null
    ].filter(Boolean).join(" · ");
  } else if (form.educationStage === "Working Professional") {
    educationHeadline = form.currentRole || "Working Professional";
    educationSub = [
      form.industry || null,
      form.professionalExperience ? `${form.professionalExperience} experience` : null
    ].filter(Boolean).join(" · ");
  }

  const locationsStr = Array.isArray(form.preferredLocations) && form.preferredLocations.length > 0
    ? form.preferredLocations.join(" · ")
    : "Goa · Remote";

  const percentage = completeness.percentage ?? Math.round(((completeness.completed_fields || 0) / (completeness.total_fields || 6)) * 100);

  return (
    <div className="profile-summary-card panel" role="region" aria-label="Personal Profile Summary">
      <div className="profile-summary-inner">
        {/* Left: Avatar with initials */}
        <div className="profile-avatar-wrapper">
          <div className="profile-avatar-large" aria-hidden="true">
            {initials}
          </div>
          <div className="profile-status-dot" title="Authenticated User Profile" />
        </div>

        {/* Center: Identity and Education details */}
        <div className="profile-identity-col">
          <div className="profile-name-row">
            <h2 className="profile-user-name">{displayName}</h2>
            <span className="profile-verified-pill" title="Verified Account">
              <ShieldCheck size={13} className="text-blue" />
              <span>Verified Account</span>
            </span>
          </div>

          <div className="profile-meta-grid">
            {/* Email */}
            <div className="profile-meta-item">
              <Mail size={13} className="text-muted flex-shrink-0" />
              <span className="profile-meta-email">{form.email || user?.email || "No email on record"}</span>
            </div>

            {/* Education */}
            <div className="profile-meta-item">
              <GraduationCap size={13} className="text-muted" />
              <div>
                <strong className="profile-meta-strong">{educationHeadline}</strong>
                {educationSub && <span className="profile-meta-sub"> · {educationSub}</span>}
              </div>
            </div>

            {/* Locations */}
            <div className="profile-meta-item">
              <MapPin size={13} className="text-muted" />
              <span>{locationsStr}</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Highlights (Target Goal & Completeness) */}
        <div className="profile-highlights-col">
          <div className="profile-highlight-box goal-box">
            <div className="highlight-label">
              <Target size={12} className="text-brand" /> CURRENT TARGET GOAL
            </div>
            <div className="highlight-target-value">
              {form.careerGoal ? (
                <span>{form.careerGoal}</span>
              ) : (
                <span className="text-muted font-normal italic">No goal set yet</span>
              )}
            </div>
            <span className="highlight-tag">User Ambition</span>
          </div>

          <div className="profile-highlight-box completeness-box">
            <div className="highlight-label">
              <CheckCircle2 size={12} className="text-green" /> PROFILE INTEGRITY
            </div>
            <div className="highlight-score-value">
              {percentage}% Complete
            </div>
            <span className="highlight-tag">
              {completeness.completed_fields || 0}/{completeness.total_fields || 6} Data Anchors
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
