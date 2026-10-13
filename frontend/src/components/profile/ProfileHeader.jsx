import React from "react";
import { Check, CheckCircle2, AlertCircle, Loader2, Sparkles, Save, ShieldCheck } from "lucide-react";

export default function ProfileHeader({
  completeness = { percentage: 0, completed_fields: 0, total_fields: 6, missing_fields: [] },
  saving = false,
  savedMsg = "",
  error = null,
  isDirty = false,
  onSave,
  onClearMessages
}) {
  const percentage = completeness.percentage ?? Math.round(((completeness.completed_fields || 0) / (completeness.total_fields || 6)) * 100);
  const isComplete = percentage >= 100;

  return (
    <header className="profile-dashboard-header" role="banner">
      <div className="profile-header-main">
        <div className="profile-header-titles">
          <div className="profile-badge-row">
            <span className="profile-kicker">
              <Sparkles size={13} className="text-brand" /> Career Intelligence Engine
            </span>
            {isDirty && (
              <span className="profile-dirty-badge" title="You have unsaved changes">
                <span className="pulse-dot" /> Unsaved edits
              </span>
            )}
          </div>
          <h1 className="profile-title">Career Profile</h1>
          <p className="profile-description">
            Your profile anchors all career recommendations, formal eligibility evaluations, and personalized learning pathways.
          </p>
        </div>

        {/* Right side actions and completeness bar */}
        <div className="profile-header-actions">
          {/* Completeness indicator widget */}
          <div className="profile-completeness-widget" aria-label={`Profile ${percentage}% complete`}>
            <div className="completeness-meta">
              <span className="completeness-label">
                Profile Completeness
              </span>
              <span className="completeness-value">
                {percentage}%
              </span>
            </div>
            <div className="completeness-track" role="progressbar" aria-valuenow={percentage} aria-valuemin="0" aria-valuemax="100">
              <div
                className="completeness-bar"
                style={{
                  width: `${Math.min(100, Math.max(8, percentage))}%`,
                  backgroundColor: percentage >= 85 ? "var(--green)" : percentage >= 50 ? "var(--blue)" : "var(--amber)"
                }}
              />
            </div>
            <div className="completeness-hint">
              {isComplete ? (
                <span className="text-green-strong" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShieldCheck size={12} /> Complete profile
                </span>
              ) : completeness.missing_fields?.length > 0 ? (
                <span>Needs: {completeness.missing_fields.slice(0, 2).map(f => f.replace('_', ' ')).join(', ')}</span>
              ) : (
                <span>{completeness.completed_fields || 0} of {completeness.total_fields || 6} sections set</span>
              )}
            </div>
          </div>

          {/* Primary Save Button */}
          <div className="profile-save-container">
            <button
              type="button"
              id="profile-save-btn"
              className={`btn primary profile-save-btn ${savedMsg ? "btn-success" : ""}`}
              onClick={onSave}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="spin-icon" />
                  <span>Saving...</span>
                </>
              ) : savedMsg ? (
                <>
                  <Check size={16} />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save size={16} />
                  <span>Save changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Global Save feedback alerts */}
      {savedMsg && (
        <div className="profile-alert success" role="status">
          <CheckCircle2 size={16} />
          <span>{savedMsg}</span>
          <button type="button" className="alert-close-btn" onClick={onClearMessages} aria-label="Dismiss">×</button>
        </div>
      )}

      {error && (
        <div className="profile-alert error" role="alert">
          <AlertCircle size={16} />
          <span>{typeof error === "string" ? error : (error.message || "Unable to save profile changes.")}</span>
          <button type="button" className="alert-close-btn" onClick={onClearMessages} aria-label="Dismiss">×</button>
        </div>
      )}
    </header>
  );
}
