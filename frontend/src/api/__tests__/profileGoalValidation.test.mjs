import assert from "node:assert/strict";
import { test } from "node:test";

test("Profile data extraction safely handles complete and incomplete profiles", () => {
  function extractProfileFormData(p, user = {}) {
    const edu = Array.isArray(p?.education) && p.education.length > 0 && p.education[0] && typeof p.education[0] === "object" ? p.education[0] : {};

    let eduStage = "Higher Education";
    if (edu.education_stage === "SCHOOL_12" || edu.level === "12th / Higher Secondary" || edu.level === "12th") {
      eduStage = "Currently in 12th";
    } else if (edu.education_stage === "WORKING_PROFESSIONAL" || edu.level === "Working Professional") {
      eduStage = "Working Professional";
    } else if (!edu.education_stage && !edu.level && !edu.degree) {
      eduStage = "Currently in 12th";
    }

    let exp = "";
    let ind = "";
    let role = "";
    let profExp = "";
    if (Array.isArray(p?.experience) && p.experience.length > 0) {
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

    return {
      educationStage: eduStage,
      stream: edu.school_12_stream || edu.stream || "",
      degree: edu.current_program || edu.degree || "",
      educationStatus: typeof edu.status === "string" && edu.status.length > 0 ? (edu.status.charAt(0).toUpperCase() + edu.status.slice(1)) : "Pursuing",
      experienceText: exp,
      industry: ind,
      currentRole: role,
      professionalExperience: profExp,
      careerGoal: p?.career_goal ?? "",
      preferredLocations: Array.isArray(p?.preferred_locations) && p.preferred_locations.length ? p.preferred_locations : ["Goa", "Remote"],
      interests: Array.isArray(p?.interests) ? p.interests : [],
      careerId: p?.career_id ?? null,
      constraints: p?.constraints && typeof p.constraints === "object" ? p.constraints : {},
    };
  }

  // 1. Incomplete / empty profile
  const empty = extractProfileFormData({});
  assert.equal(empty.educationStage, "Currently in 12th");
  assert.equal(empty.educationStatus, "Pursuing");
  assert.equal(empty.careerGoal, "");
  assert.deepEqual(empty.preferredLocations, ["Goa", "Remote"]);
  assert.deepEqual(empty.interests, []);
  assert.equal(empty.careerId, null);

  // 2. Profile with malformed / non-object fields
  const malformed = extractProfileFormData({
    education: [null],
    experience: ["Just a string"],
    preferred_locations: null,
    career_goal: null,
  });
  assert.equal(malformed.educationStage, "Currently in 12th");
  assert.equal(malformed.experienceText, "");
  assert.equal(malformed.careerGoal, "");
  assert.deepEqual(malformed.preferredLocations, ["Goa", "Remote"]);

  // 3. Complete profile with working professional experience
  const pro = extractProfileFormData({
    education: [{ education_stage: "WORKING_PROFESSIONAL", status: "completed" }],
    experience: [{ role: "Backend Developer", industry: "IT", duration: "3 years" }],
    career_goal: "Full Stack Engineer",
    preferred_locations: ["Panaji", "Remote"],
    interests: ["Software", "AI"],
    career_id: "car-123",
  });
  assert.equal(pro.educationStage, "Working Professional");
  assert.equal(pro.currentRole, "Backend Developer");
  assert.equal(pro.industry, "IT");
  assert.equal(pro.professionalExperience, "3 years");
  assert.equal(pro.careerGoal, "Full Stack Engineer");
  assert.deepEqual(pro.preferredLocations, ["Panaji", "Remote"]);
  assert.equal(pro.careerId, "car-123");
});

test("Goal validation key calculation and state transition rules", () => {
  // Simulates the validation effect logic
  let lastValidatedGoalRef = { current: "" };
  let isValidating = false;
  let validationData = null;

  function handleGoalChange(newGoal, profileContext) {
    if (!newGoal || !newGoal.trim()) {
      validationData = null;
      isValidating = false;
      lastValidatedGoalRef.current = "";
      return "CLEARED";
    }

    const validationKey = `${newGoal}::${JSON.stringify(profileContext)}`;
    if (validationKey === lastValidatedGoalRef.current) {
      return "SKIPPED_ALREADY_VALIDATED";
    }

    isValidating = true;
    return { validationKey };
  }

  function handleValidationSuccess(validationKey, result) {
    validationData = result;
    lastValidatedGoalRef.current = validationKey;
    isValidating = false;
  }

  function handleValidationCancellation() {
    // On cancellation/abort, loading state stays handled or reset, but ref is NOT updated
    isValidating = false;
  }

  // Initial state: empty
  const ctx = { education: [], skills: [] };
  assert.equal(handleGoalChange("", ctx), "CLEARED");
  assert.equal(lastValidatedGoalRef.current, "");
  assert.equal(isValidating, false);

  // User enters "Software Engineer"
  const start = handleGoalChange("Software Engineer", ctx);
  assert.equal(isValidating, true);
  assert.equal(lastValidatedGoalRef.current, ""); // NOT prematurely set!

  // Request succeeds
  handleValidationSuccess(start.validationKey, { classification: "A", direct_route_status: "A" });
  assert.equal(isValidating, false);
  assert.equal(lastValidatedGoalRef.current, start.validationKey);
  assert.equal(validationData.classification, "A");

  // Redundant trigger with same goal and context is skipped
  assert.equal(handleGoalChange("Software Engineer", ctx), "SKIPPED_ALREADY_VALIDATED");

  // User clears goal
  assert.equal(handleGoalChange("", ctx), "CLEARED");
  assert.equal(validationData, null);
  assert.equal(lastValidatedGoalRef.current, "");
  assert.equal(isValidating, false);

  // User re-enters the same goal: must validate again (not skipped!)
  const reenter = handleGoalChange("Software Engineer", ctx);
  assert.notEqual(reenter, "SKIPPED_ALREADY_VALIDATED");
  assert.equal(isValidating, true);

  // Cancelled request leaves ref empty so retry is possible
  handleValidationCancellation();
  assert.equal(isValidating, false);
  assert.equal(lastValidatedGoalRef.current, "");
});
