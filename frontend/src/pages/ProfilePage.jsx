import React, { useEffect, useState, useRef, useCallback } from "react";
import { api } from "../api/client.js";
import { unwrapObject, unwrapList } from "../utils/unwrap.js";
import { normalizeStream } from "../utils/educationOptions.js";
import ProfileHeader from "../components/profile/ProfileHeader.jsx";
import ProfileSummaryCard from "../components/profile/ProfileSummaryCard.jsx";
import GoalFeasibilityDashboard from "../components/profile/GoalFeasibilityDashboard.jsx";
import SkillsInterestsPanel from "../components/profile/SkillsInterestsPanel.jsx";
import ProfileInfoForm from "../components/profile/ProfileInfoForm.jsx";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { getDisplayName, getAvatarInitials, resolveUserFullName } from "../utils/userDisplay.js";

function getLocalName(userId) {
  if (!userId) return "";
  try {
    return localStorage.getItem(`careergps_local_name_${userId}`) || "";
  } catch {
    return "";
  }
}

function setLocalName(userId, name) {
  if (!userId || !name) return;
  try {
    localStorage.setItem(`careergps_local_name_${userId}`, name);
  } catch {}
}

export default function ProfilePage({ user = null, refreshUser = async () => {} } = {}) {
  // Authenticated user and refresh callback are supplied by the application
  // shell's AuthProvider. Do not consume a second, unrelated AuthContext.

  const [form, setForm] = useState(null);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState("");
  const [status, setStatus] = useState("loading"); // 'loading' | 'ready' | 'error'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMsg, setSavedMsg] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // Completeness state
  const [completeness, setCompleteness] = useState({
    percentage: 0,
    completed_fields: 0,
    total_fields: 6,
    missing_fields: []
  });

  // Skills states
  const [allSkills, setAllSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillsError, setSkillsError] = useState(null);
  const [userSkillIds, setUserSkillIds] = useState(new Set());
  const [userSkillLevels, setUserSkillLevels] = useState({});
  const [customSkills, setCustomSkills] = useState([]);

  // Goal & Validation states
  const [careerInfo, setCareerInfo] = useState(null);
  const [validationData, setValidationData] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const lastValidatedKeyRef = useRef("");
  const validationSeqRef = useRef(0);

  // Education dynamic programs
  const [availablePrograms, setAvailablePrograms] = useState([]);
  const [programsLoading, setProgramsLoading] = useState(false);

  // 1. Load available degree programs when 12th stream or stage changes
  useEffect(() => {
    if (form && (form.educationStage === "Higher Education" || form.educationLevel === "Undergraduate" || form.educationLevel === "Postgraduate")) {
      setProgramsLoading(true);
      const normalizedStream = normalizeStream(form.stream) || form.stream;
      api.educationPrograms(normalizedStream)
        .then(res => {
          const programs = res.data || [];
          const excluded = ["Masters", "Other", "MBA", "MCA"];
          const displayPrograms = programs.filter(p => !excluded.includes(p) || p === form.degree);
          if (form.degree && !displayPrograms.includes(form.degree)) {
            displayPrograms.unshift(form.degree);
          }
          setAvailablePrograms(displayPrograms);
        })
        .catch(err => {
          console.error("Failed to load matching education programs:", err);
          if (form.degree) {
            setAvailablePrograms([form.degree]);
          }
        })
        .finally(() => {
          setProgramsLoading(false);
        });
    } else {
      setAvailablePrograms([]);
    }
  }, [form?.stream, form?.educationStage]);

  // Clean experience object for payload
  function getCleanedExperience() {
    if (!form) return [];
    if (form.educationStage === "Working Professional") {
      const exp = {};
      if (form.industry) exp.industry = form.industry;
      if (form.currentRole) exp.role = form.currentRole;
      if (form.professionalExperience) exp.duration = form.professionalExperience;
      return Object.keys(exp).length > 0 ? [exp] : [];
    } else {
      return form.experienceText ? [{ description: form.experienceText }] : [];
    }
  }

  // Current profile context string for validation dependency - uses canonical persisted education
  const currentProfileContextStr = JSON.stringify({
    education: form?.savedEducation || [],
    experience: getCleanedExperience(),
    skills: Array.from(userSkillIds)
      .filter(id => !customSkills.some(cs => cs.id === id))
      .map(skill_id => ({
        skill_id,
        level: userSkillLevels[skill_id] || "beginner"
      }))
  });

  // 2. Debounced Live Goal Feasibility Validation Effect
  useEffect(() => {
    if (!form || !form.careerGoal || !form.careerGoal.trim()) {
      if (validationData) setValidationData(null);
      setIsValidating(false);
      lastValidatedKeyRef.current = "";
      return;
    }

    const validationKey = `${form.careerGoal.trim()}::${currentProfileContextStr}`;
    if (validationKey === lastValidatedKeyRef.current) return;

    const controller = new AbortController();
    const currentSeq = ++validationSeqRef.current;

    const timer = setTimeout(async () => {
      setIsValidating(true);
      try {
        const valRes = await api.validateGoal(
          {
            goal: form.careerGoal.trim(),
            profileContext: JSON.parse(currentProfileContextStr)
          },
          { signal: controller.signal }
        );

        if (!controller.signal.aborted && currentSeq === validationSeqRef.current) {
          const unwrapped = unwrapObject(valRes);
          setValidationData(unwrapped);
          lastValidatedKeyRef.current = validationKey;
        }
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError' || err.code === 'TIMEOUT' || err.code === 'CANCELLED') {
          return;
        }
        console.error("Live goal validation failed:", err);
      } finally {
        if (!controller.signal.aborted && currentSeq === validationSeqRef.current) {
          setIsValidating(false);
        }
      }
    }, 600);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [form?.careerGoal, currentProfileContextStr]);

  // 3. Parallel Data Loader for Profile, Completeness, and Skills
  const loadProfileData = useCallback(() => {
    let active = true;
    setStatus("loading");
    setError(null);

    Promise.allSettled([
      api.profile(),
      api.profileCompleteness(),
      api.skills(),
      api.mySkills(),
      api.myCustomSkills()
    ]).then(([profileRes, completenessRes, allSkillsRes, mySkillsRes, myCustomSkillsRes]) => {
      if (!active) return;

      if (profileRes.status === "fulfilled") {
        const p = unwrapObject(profileRes.value);
        if (!p || typeof p !== "object") {
          setError(new Error("Profile data is invalid or empty."));
          setStatus("error");
          return;
        }

        const eduList = Array.isArray(p.education) ? p.education : [];
        const hasEducation = eduList.length > 0;

        const bachelors = eduList.find(e => e.level === "Undergraduate");
        const masters = eduList.find(e => e.level === "Postgraduate");
        const school = eduList.find(e => e.education_stage === "SCHOOL_12" || e.level === "12th / Higher Secondary" || e.level === "12th");
        const workingPro = eduList.find(e => e.education_stage === "WORKING_PROFESSIONAL" || e.level === "Working Professional");

        const latest = masters || bachelors || school || workingPro || (hasEducation ? eduList[0] : null);

        let eduStage = "";
        if (!hasEducation || !latest) {
          eduStage = "";
        } else if (latest.education_stage === "SCHOOL_12" || latest.level === "12th / Higher Secondary" || latest.level === "12th") {
          eduStage = "Currently in 12th";
        } else if (latest.education_stage === "WORKING_PROFESSIONAL" || latest.level === "Working Professional") {
          eduStage = "Working Professional";
        } else if (latest.education_stage === "HIGHER_EDUCATION" || latest.level === "Undergraduate" || latest.level === "Postgraduate" || latest.degree || latest.current_program || latest.qualification) {
          eduStage = "Higher Education";
        } else {
          eduStage = "";
        }

        const rawStream = bachelors?.school_12_stream || bachelors?.stream || school?.school_12_stream || school?.stream || latest?.school_12_stream || latest?.stream || "";
        const normalizedStream = normalizeStream(rawStream) || rawStream;

        function resolveDegree(item) {
          if (!item) return "";
          if (item.current_program) return item.current_program;
          if (item.degree) return item.degree;
          if (item.qualification) {
            const q = item.qualification.trim();
            if (q.startsWith("BCA")) return "BCA";
            if (q.startsWith("B.Com") || q.startsWith("BCom")) return "B.Com";
            if (q.startsWith("B.Sc") || q.startsWith("BSc")) return "B.Sc";
            if (q.startsWith("B.Tech") || q.startsWith("BTech")) return "B.Tech / BE";
            if (q === "Undergraduate" || q === "Under Graduate" || q === "Graduate") return "";
            return q;
          }
          return "";
        }

        const rawDegree = resolveDegree(bachelors) || resolveDegree(latest);
        const rawMasterDegree = resolveDegree(masters);
        const specialization = latest?.specialization || bachelors?.specialization || masters?.specialization || "";

        let exp = "";
        let ind = "";
        let role = "";
        let profExp = "";
        if (Array.isArray(p.experience) && p.experience.length > 0) {
          const firstExp = p.experience[0];
          if (firstExp && typeof firstExp === "object") {
            if (firstExp.role || firstExp.industry || firstExp.duration) {
              ind = firstExp.industry || "";
              role = firstExp.role || "";
              profExp = firstExp.duration || "";
            } else {
              exp = firstExp.description || "";
            }
          }
        }

        const rawStatus = latest?.status || latest?.school_12_status || bachelors?.status || "";
        const formattedStatus = typeof rawStatus === "string" && rawStatus.trim().length > 0
          ? (rawStatus.trim().charAt(0).toUpperCase() + rawStatus.trim().slice(1).toLowerCase())
          : "";

        const initialFormData = {
          localName: resolveUserFullName(p, user, getLocalName(user?.id)) || "",
          email: user?.email || p.email || "",
          educationStage: eduStage,
          stream: normalizedStream,
          degree: rawDegree,
          masterDegree: rawMasterDegree,
          specialization: specialization,
          diplomaField: latest?.diplomaField || bachelors?.diplomaField || "",
          currentYear: latest?.year ? String(latest.year) : (bachelors?.year ? String(bachelors.year) : ""),
          educationStatus: formattedStatus,
          hasEducation: hasEducation,
          savedEducation: eduList,
          experienceText: exp,
          industry: ind,
          currentRole: role,
          professionalExperience: profExp,
          fullEducation: latest || {},
          careerGoal: p.career_goal || "",
          preferredLocations: Array.isArray(p.preferred_locations) && p.preferred_locations.length ? p.preferred_locations : ["Goa", "Remote"],
          interests: Array.isArray(p.interests) ? p.interests : [],
          careerId: p.career_id || null,
          constraints: p.constraints && typeof p.constraints === "object" ? p.constraints : {},
        };

        setForm(initialFormData);
        setInitialFormSnapshot(JSON.stringify(initialFormData));

        // Fetch career detail if career_id is present
        if (p.career_id) {
          api.career(p.career_id)
            .then(res => { if (active) setCareerInfo(unwrapObject(res)); })
            .catch(() => {
              api.aiCareer(p.career_id)
                .then(res => { if (active) setCareerInfo(unwrapObject(res)); })
                .catch(() => { if (active) setCareerInfo(null); });
            });
        }

        setStatus("ready");
      } else {
        const reason = profileRes.reason;
        setError(reason instanceof Error ? reason : new Error(reason?.message || "Failed to load profile."));
        setStatus("error");
      }

      // Handle completeness response
      if (completenessRes.status === "fulfilled") {
        const cData = unwrapObject(completenessRes.value);
        if (cData) {
          setCompleteness(cData);
        }
      }

      // Handle allSkills response
      if (allSkillsRes.status === "fulfilled") {
        setAllSkills(unwrapList(allSkillsRes.value));
        setSkillsError(null);
      } else {
        setSkillsError(allSkillsRes.reason?.message || "Could not load skill catalogue.");
      }
      setSkillsLoading(false);

      // Handle user's selected skills and custom skills
      if (mySkillsRes.status === "fulfilled") {
        const mySkills = unwrapList(mySkillsRes.value);
        let myCustoms = [];
        if (myCustomSkillsRes.status === "fulfilled") {
          myCustoms = unwrapList(myCustomSkillsRes.value);
          setCustomSkills(myCustoms);
        }

        setUserSkillIds(new Set([...mySkills.map(s => s.id), ...myCustoms.map(s => s.id)]));
        const levels = {};
        mySkills.forEach(s => { levels[s.id] = s.level || "beginner"; });
        myCustoms.forEach(s => { levels[s.id] = s.level || "beginner"; });
        setUserSkillLevels(levels);
      }
    }).catch(err => {
      if (!active) return;
      console.error("Profile load encountered an error:", err);
      setError(err instanceof Error ? err : new Error(err?.message || "Failed to load profile."));
      setStatus("error");
    });

    return () => {
      active = false;
    };
  }, [user?.id, user?.email]);

  useEffect(() => {
    loadProfileData();
  }, [loadProfileData]);

  // Check if form has unsaved edits
  const isDirty = form ? JSON.stringify(form) !== initialFormSnapshot : false;

  // 4. Save Changes Action
  async function handleSave() {
    if (saving) return;

    // Basic validation
    const errs = {};
    if (!form.localName?.trim()) {
      errs.localName = "Full name is required.";
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Please fix the validation errors before saving.");
      return;
    }
    setFieldErrors({});

    setSaving(true);
    setSavedMsg("");
    setError(null);

    try {
      // 1. Save profile fields via PUT /profiles/me
      // CRITICAL: Locked education fields are omitted from profile edit payload.
      // Education is set exclusively during onboarding and cannot be modified from profile.
      await api.updateProfile({
        full_name: form.localName?.trim() || null,
        experience: getCleanedExperience(),
        interests: form.interests,
        preferred_locations: form.preferredLocations,
        career_goal: form.careerGoal || null,
        career_id: validationData?.career_id || form.careerId || null,
        constraints: form.constraints,
      });

      // 2. Save user_skills via PUT /skills/me
      await api.updateMySkills({
        skills: Array.from(userSkillIds)
          .filter(id => !customSkills.some(cs => cs.id === id)) // Exclude custom skills
          .map(skill_id => ({
            skill_id,
            level: userSkillLevels[skill_id] || "beginner",
          })),
      });

      // Persist local name
      if (user?.id) {
        setLocalName(user.id, form.localName);
      }

      await refreshUser();

      // Refresh completeness score
      try {
        const compRes = await api.profileCompleteness();
        const updatedComp = unwrapObject(compRes);
        if (updatedComp) setCompleteness(updatedComp);
      } catch {}

      setInitialFormSnapshot(JSON.stringify(form));
      setSavedMsg("Profile, ambition, and skills saved successfully.");
      setTimeout(() => setSavedMsg(""), 4500);
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError(err?.message || "Failed to save profile changes. Your edits remain intact.");
    } finally {
      setSaving(false);
    }
  }

  // 5. Skill Toggle Handler
  async function handleToggleSkill(skillObj) {
    if (!skillObj || !skillObj.id) return;
    const skillId = skillObj.id;
    const isCustom = skillObj.origin === "ai_generated" || skillObj.is_custom;

    if (isCustom) {
      const isSelected = userSkillIds.has(skillId);
      if (isSelected) {
        try {
          await api.deleteCustomSkill(skillId);
          setCustomSkills(prev => prev.filter(s => s.id !== skillId));
          setUserSkillIds(prev => {
            const next = new Set(prev);
            next.delete(skillId);
            return next;
          });
        } catch (err) {
          console.error("Failed to delete custom skill:", err);
        }
      } else {
        try {
          const added = unwrapObject(await api.addCustomSkill({ name: skillObj.name, level: "beginner" }));
          if (added && added.id) {
            setCustomSkills(prev => [...prev, added]);
            setUserSkillIds(prev => new Set(prev).add(added.id));
          }
        } catch (err) {
          console.error("Failed to add custom skill:", err);
        }
      }
      return;
    }

    setUserSkillIds(prev => {
      const next = new Set(prev);
      if (next.has(skillId)) {
        next.delete(skillId);
      } else {
        next.add(skillId);
        if (!userSkillLevels[skillId]) {
          setUserSkillLevels(lv => ({ ...lv, [skillId]: "beginner" }));
        }
      }
      return next;
    });
  }

  // 6. Custom Skill Add Handler
  async function handleAddCustomSkill(skillName) {
    if (!skillName?.trim()) return;
    const added = unwrapObject(await api.addCustomSkill({ name: skillName.trim(), level: "beginner" }));
    if (added && added.id) {
      setCustomSkills(prev => [...prev, added]);
      setUserSkillIds(prev => new Set(prev).add(added.id));
    }
  }

  // Loading State
  if (status === "loading") {
    return (
      <div className="profile-page-loading" role="status">
        <Loader2 size={32} className="spin-icon text-brand" />
        <h3 style={{ marginTop: 16 }}>Loading your Career Profile...</h3>
        <p className="text-muted">Fetching verified credentials, intelligence anchors, and skills catalogue.</p>
      </div>
    );
  }

  // Error State
  if (status === "error" || !form) {
    return (
      <div className="profile-page-error panel" role="alert">
        <AlertCircle size={36} className="text-red" />
        <h3 style={{ marginTop: 12 }}>Unable to Load Profile</h3>
        <p className="text-muted">
          {typeof error === "string" ? error : (error?.message || "Could not retrieve profile records from the server.")}
        </p>
        <button type="button" className="btn primary" onClick={loadProfileData} style={{ marginTop: 16 }}>
          <RefreshCw size={14} /> Retry Loading Profile
        </button>
      </div>
    );
  }

  return (
    <div className="profile-dashboard-wrapper" role="main">
      {/* A. Profile Header */}
      <ProfileHeader
        completeness={completeness}
        saving={saving}
        savedMsg={savedMsg}
        error={error}
        isDirty={isDirty}
        onSave={handleSave}
        onClearMessages={() => { setSavedMsg(""); setError(null); }}
      />

      {/* B. Personal Profile Summary Card */}
      <ProfileSummaryCard
        form={form}
        user={user}
        completeness={completeness}
      />

      {/* Main Two-Column Layout */}
      <div className="profile-dashboard-grid">
        {/* Left Column: Current Goal Feasibility Dashboard + Profile Details Form */}
        <div className="profile-main-column">
          {/* C. Current Career Goal and Feasibility (The Centerpiece) */}
          <GoalFeasibilityDashboard
            careerGoal={form.careerGoal}
            careerInfo={careerInfo}
            validationData={validationData}
            isValidating={isValidating}
            onRetryValidation={() => {
              lastValidatedKeyRef.current = "";
              setForm(prev => ({ ...prev }));
            }}
          />

          {/* E. Profile Information Form */}
          <ProfileInfoForm
            form={form}
            setForm={setForm}
            availablePrograms={availablePrograms}
            programsLoading={programsLoading}
            fieldErrors={fieldErrors}
            onCareerGoalChange={e => {
              const val = e.target.value;
              setForm(prev => ({ ...prev, careerGoal: val, careerId: null }));
              if (validationData) setValidationData(null);
              setCareerInfo(null);
            }}
          />

          {/* Sticky Mobile Save Action */}
          <div className="mobile-save-bar">
            <button
              type="button"
              className="btn primary full"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving changes..." : "Save changes"}
            </button>
          </div>
        </div>

        {/* Right Column: D. Skills and Interests Panel */}
        <div className="profile-side-column">
          <SkillsInterestsPanel
            userSkillIds={userSkillIds}
            userSkillLevels={userSkillLevels}
            customSkills={customSkills}
            allSkills={allSkills}
            careerGoal={form.careerGoal}
            educationContext={`${form.educationStage} ${form.degree || form.stream || ""}`.trim()}
            onToggleSkill={handleToggleSkill}
            onAddCustomSkill={handleAddCustomSkill}
          />
        </div>
      </div>
    </div>
  );
}
