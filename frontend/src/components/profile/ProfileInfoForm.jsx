import React from "react";
import { 
  User, 
  Mail, 
  GraduationCap, 
  BriefcaseBusiness, 
  Target, 
  MapPin, 
  Lock, 
  AlertCircle, 
  Check, 
  HelpCircle,
  FileText
} from "lucide-react";
import {
  SUPPORTED_STREAMS,
  EDUCATION_STAGES,
  EDUCATION_STATUS_OPTIONS,
  INDUSTRY_OPTIONS,
  EXPERIENCE_OPTIONS,
  normalizeStream
} from "../../utils/educationOptions.js";

export default function ProfileInfoForm({
  form,
  setForm,
  availablePrograms = [],
  programsLoading = false,
  fieldErrors = {},
  onEducationStageChange,
  onCareerGoalChange
}) {
  if (!form) return null;

  function joinLocations(locations) {
    if (!Array.isArray(locations) || !locations.length) return "Goa + Remote";
    if (locations.includes("Goa") && locations.includes("Remote")) return "Goa + Remote";
    if (locations.includes("Goa")) return "Goa";
    if (locations.includes("Remote")) return "Remote";
    if (locations.includes("Pan India")) return "Pan India";
    return locations.join(", ");
  }

  function parseLocations(val) {
    if (val === "Goa + Remote") return ["Goa", "Remote"];
    if (val === "Goa") return ["Goa"];
    if (val === "Remote") return ["Remote"];
    if (val === "Pan India") return ["Pan India"];
    return [val];
  }

  return (
    <div className="profile-info-form-container panel" role="region" aria-label="Profile Information Form">
      <div className="panel-header-simple">
        <h3 className="section-title-clean">Profile &amp; Career Details</h3>
        <p className="panel-subtext">
          Keep your academic foundation, target ambition, and experience up to date to receive verified guidance.
        </p>
      </div>

      <div className="profile-form-sections-stack">
        {/* Section 1: Personal Details */}
        <div className="form-section-card">
          <div className="form-section-header">
            <User size={15} className="text-brand" />
            <h4>Personal &amp; Contact</h4>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="field-label">Full Name</span>
              <input
                type="text"
                value={form.localName || ""}
                onChange={e => setForm(prev => ({ ...prev, localName: e.target.value }))}
                placeholder="e.g. Rahul Naik"
                className={fieldErrors.localName ? "field-error-input" : ""}
                aria-invalid={!!fieldErrors.localName}
              />
              {fieldErrors.localName && (
                <span className="field-error-text">{fieldErrors.localName}</span>
              )}
            </label>

            <label className="form-field">
              <span className="field-label">
                Email Address
                <span className="read-only-badge">
                  <Lock size={10} /> Locked
                </span>
              </span>
              <input
                type="email"
                value={form.email || ""}
                readOnly
                className="input-readonly"
                title="Email is tied to your account credentials"
              />
            </label>
          </div>
        </div>

        {/* Section 2: Academic & Education (Locked & Read-Only) */}
        <div className="form-section-card">
          <div className="form-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GraduationCap size={15} className="text-brand" />
              <h4>Academic Foundation</h4>
            </div>
            <span className="read-only-badge">
              <Lock size={10} /> Set during onboarding
            </span>
          </div>

          <p className="field-hint-text" style={{ margin: '4px 0 16px 0', fontSize: '11.5px', color: '#64748b' }}>
            Education information is permanently locked to preserve verified prerequisites, eligibility rules, and career intelligence.
          </p>

          <div className="form-grid">
            <label className="form-field full-width">
              <span className="field-label">
                Current Education Stage
                <span className="read-only-badge">
                  <Lock size={10} /> Set during onboarding
                </span>
              </span>
              <input
                type="text"
                readOnly
                disabled
                value={
                  form.educationStage === "Higher Education"
                    ? "Higher Education (Undergraduate / Degree / Diploma)"
                    : form.educationStage === "Currently in 12th"
                    ? "Currently in 12th / Senior Secondary"
                    : form.educationStage === "Working Professional"
                    ? "Working Professional"
                    : (form.educationStage || "Education information unavailable")
                }
                className="input-readonly"
                tabIndex={-1}
                aria-readonly="true"
              />
            </label>

            {form.educationStage === "Working Professional" ? (
              <>
                <label className="form-field">
                  <span className="field-label">
                    Industry / Field
                    <span className="read-only-badge">
                      <Lock size={10} /> Set during onboarding
                    </span>
                  </span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.industry || "Education information unavailable"}
                    className="input-readonly"
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>

                <label className="form-field">
                  <span className="field-label">
                    Current Role / Title
                    <span className="read-only-badge">
                      <Lock size={10} /> Set during onboarding
                    </span>
                  </span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.currentRole || "Education information unavailable"}
                    className="input-readonly"
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>

                <label className="form-field full-width">
                  <span className="field-label">
                    Years of Experience
                    <span className="read-only-badge">
                      <Lock size={10} /> Set during onboarding
                    </span>
                  </span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.professionalExperience || "Education information unavailable"}
                    className="input-readonly"
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="form-field">
                  <span className="field-label">
                    12th / Higher Secondary Stream
                    <span className="read-only-badge">
                      <Lock size={10} /> Set during onboarding
                    </span>
                  </span>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.stream || (form.educationStage === "Working Professional" ? "Not applicable" : "Education information unavailable")}
                    className="input-readonly"
                    tabIndex={-1}
                    aria-readonly="true"
                  />
                </label>

                {form.educationStage === "Currently in 12th" ? (
                  <>
                    <label className="form-field">
                      <span className="field-label">
                        Education Status
                        <span className="read-only-badge">
                          <Lock size={10} /> Set during onboarding
                        </span>
                      </span>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.educationStatus || "Pursuing"}
                        className="input-readonly"
                        tabIndex={-1}
                        aria-readonly="true"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label className="form-field">
                      <span className="field-label">
                        Current Degree / Program
                        <span className="read-only-badge">
                          <Lock size={10} /> Set during onboarding
                        </span>
                      </span>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.degree || (form.hasEducation ? "Degree not specified" : "Education information unavailable")}
                        className="input-readonly"
                        tabIndex={-1}
                        aria-readonly="true"
                      />
                    </label>

                    {Boolean(form.masterDegree) && (
                      <label className="form-field">
                        <span className="field-label">
                          Master's Degree / Program
                          <span className="read-only-badge">
                            <Lock size={10} /> Set during onboarding
                          </span>
                        </span>
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={form.masterDegree}
                          className="input-readonly"
                          tabIndex={-1}
                          aria-readonly="true"
                        />
                      </label>
                    )}

                    <label className="form-field">
                      <span className="field-label">
                        Specialization / Major
                        <span className="read-only-badge">
                          <Lock size={10} /> Set during onboarding
                        </span>
                      </span>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.specialization || (form.hasEducation ? "None specified" : "Education information unavailable")}
                        className="input-readonly"
                        tabIndex={-1}
                        aria-readonly="true"
                      />
                    </label>

                    <label className="form-field">
                      <span className="field-label">
                        Education Status
                        <span className="read-only-badge">
                          <Lock size={10} /> Set during onboarding
                        </span>
                      </span>
                      <input
                        type="text"
                        readOnly
                        disabled
                        value={form.educationStatus || (form.hasEducation ? "Education information unavailable" : "Education information unavailable")}
                        className="input-readonly"
                        tabIndex={-1}
                        aria-readonly="true"
                      />
                    </label>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Section 3: Professional Experience & Projects */}
        <div className="form-section-card">
          <div className="form-section-header">
            <FileText size={15} className="text-brand" />
            <h4>Experience &amp; Portfolio</h4>
          </div>

          <label className="form-field full-width">
            <span className="field-label">Internships, Projects, and Work Experience</span>
            <textarea
              value={form.experienceText || ""}
              onChange={e => setForm(prev => ({ ...prev, experienceText: e.target.value }))}
              placeholder="Detail your practical projects, open-source work, internships, or certifications..."
              rows={3}
              className="form-textarea"
            />
            <span className="field-hint">
              Used to calculate Readiness scores and recommend relevant next actions.
            </span>
          </label>
        </div>

        {/* Section 4: Target Ambition & Preferences */}
        <div className="form-section-card">
          <div className="form-section-header">
            <Target size={15} className="text-brand" />
            <h4>Target Ambition &amp; Location Preferences</h4>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span className="field-label">
                Target Career Ambition
                <span className="field-req-tag">evaluated live</span>
              </span>
              <input
                type="text"
                value={form.careerGoal || ""}
                onChange={onCareerGoalChange}
                placeholder="e.g. Doctor, Software Developer, Data Scientist"
                className="font-medium"
              />
              <span className="field-hint">
                Preserved as your permanent strategic ambition.
              </span>
            </label>

            <label className="form-field">
              <span className="field-label">Preferred Locations</span>
              <select
                value={joinLocations(form.preferredLocations)}
                onChange={e => setForm(prev => ({
                  ...prev,
                  preferredLocations: parseLocations(e.target.value)
                }))}
                className="form-select"
              >
                <option value="Goa + Remote">Goa + Remote</option>
                <option value="Goa">Goa Only</option>
                <option value="Remote">Remote Only</option>
                <option value="Pan India">Pan India</option>
              </select>
              <span className="field-hint">
                Filters local Goa institutions, companies, and opportunities.
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
