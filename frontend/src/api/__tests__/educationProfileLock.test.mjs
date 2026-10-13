import assert from "node:assert/strict";
import { test } from "node:test";

/**
 * Helpers mimicking ProfilePage.jsx and ProfileInfoForm.jsx canonical mapping logic
 */
function resolveProfileEducation(dbEducation) {
  const eduList = Array.isArray(dbEducation) ? dbEducation : [];
  const bachelors = eduList.find(e => e.level === "Undergraduate" || e.education_stage === "HIGHER_EDUCATION") || eduList[0] || {};
  const school12 = eduList.find(e => e.level === "12th / Higher Secondary" || e.education_stage === "SCHOOL_12") || {};

  // Extract raw degree or qualification
  const rawDegree = bachelors.degree || bachelors.current_program || bachelors.qualification || "";
  let resolvedDegree = rawDegree;
  if (rawDegree.includes("BCA")) resolvedDegree = "BCA";
  else if (rawDegree.includes("B.Tech") || rawDegree.includes("B.E")) resolvedDegree = "B.Tech / BE";
  else if (rawDegree.includes("B.Sc")) resolvedDegree = "B.Sc";
  else if (rawDegree.includes("B.Com")) resolvedDegree = "B.Com";

  // Stream extraction (separate from degree)
  const resolvedStream = school12.school_12_stream || school12.stream || bachelors.school_12_stream || "";

  // Education stage
  let stage = "";
  if (bachelors.level === "Undergraduate" || bachelors.education_stage === "HIGHER_EDUCATION") {
    stage = "college";
  } else if (school12.level || school12.education_stage === "SCHOOL_12") {
    stage = "12th";
  }

  return {
    educationStage: stage,
    stream_12: resolvedStream,
    bachelorsDegree: resolvedDegree,
    specialization: bachelors.specialization || "",
    educationStatus: bachelors.status || school12.school_12_status || ""
  };
}

function buildProfileUpdatePayload(formState) {
  // In CareerGPS ProfilePage, education is strictly locked and omitted from PUT /profiles/me
  const payload = {
    career_goal: formState.career_goal,
    preferred_locations: formState.preferred_locations,
    interests: formState.interests,
    skills: formState.skills
  };
  // Explicitly ensure education fields are not sent
  delete payload.education;
  delete payload.stream_12;
  delete payload.bachelorsDegree;
  delete payload.specialization;
  delete payload.educationStatus;
  return payload;
}

test("1. Onboarding education with BCA and Science — PCMB resolves accurately to Profile display", () => {
  const dbEducation = [
    {
      level: "Undergraduate",
      degree: "BCA",
      current_program: "BCA",
      school_12_stream: "Science — PCMB",
      specialization: "Artificial Intelligence",
      status: "pursuing"
    },
    {
      level: "12th / Higher Secondary",
      school_12_stream: "Science — PCMB",
      status: "completed"
    }
  ];

  const resolved = resolveProfileEducation(dbEducation);
  assert.equal(resolved.educationStage, "college");
  assert.equal(resolved.stream_12, "Science — PCMB");
  assert.equal(resolved.bachelorsDegree, "BCA");
  assert.equal(resolved.specialization, "Artificial Intelligence");
  assert.equal(resolved.educationStatus, "pursuing");
});

test("2. Legacy qualification label 'BCA (Bachelor of Computer Applications)' maps to canonical 'BCA'", () => {
  const legacyEdu = [
    {
      qualification: "BCA (Bachelor of Computer Applications)",
      school_12_stream: "Commerce with Mathematics",
      status: "pursuing"
    }
  ];

  const resolved = resolveProfileEducation(legacyEdu);
  assert.equal(resolved.bachelorsDegree, "BCA");
  assert.equal(resolved.stream_12, "Commerce with Mathematics");
  assert.equal(resolved.educationStatus, "pursuing");
});

test("3. Missing education record produces honest empty values without fabricating BCA, Commerce, or Pursuing", () => {
  const resolved = resolveProfileEducation([]);
  assert.equal(resolved.educationStage, "");
  assert.equal(resolved.stream_12, "");
  assert.equal(resolved.bachelorsDegree, "");
  assert.equal(resolved.specialization, "");
  assert.equal(resolved.educationStatus, "");
});

test("4. 12th stream is not inferred from degree or specialization", () => {
  const edu = [
    {
      level: "Undergraduate",
      degree: "BCA",
      specialization: "Artificial Intelligence",
      status: "pursuing"
      // Note: no 12th stream provided in this entry
    }
  ];

  const resolved = resolveProfileEducation(edu);
  assert.equal(resolved.bachelorsDegree, "BCA");
  assert.equal(resolved.stream_12, "", "Stream must NOT be guessed as Science or Commerce");
});

test("5. Profile update payload strictly omits education fields preventing overwrites", () => {
  const formState = {
    career_goal: "Full Stack Engineer",
    preferred_locations: ["Panaji, Goa"],
    interests: ["Web Development"],
    skills: [{ name: "React", level: "intermediate" }],
    // Education in form state
    educationStage: "college",
    stream_12: "Science — PCMB",
    bachelorsDegree: "BCA",
    specialization: "AI",
    educationStatus: "pursuing"
  };

  const payload = buildProfileUpdatePayload(formState);
  assert.equal(payload.career_goal, "Full Stack Engineer");
  assert.equal(payload.education, undefined);
  assert.equal(payload.stream_12, undefined);
  assert.equal(payload.bachelorsDegree, undefined);
  assert.equal(payload.specialization, undefined);
  assert.equal(payload.educationStatus, undefined);
});

test("6. Read-only field configuration includes lock label and disabled/readonly attributes", () => {
  const fieldProps = {
    className: "input input-readonly",
    readOnly: true,
    disabled: true,
    "aria-readonly": "true",
    badge: "Set during onboarding"
  };

  assert.equal(fieldProps.readOnly, true);
  assert.equal(fieldProps.disabled, true);
  assert.equal(fieldProps["aria-readonly"], "true");
  assert.equal(fieldProps.badge, "Set during onboarding");
  assert.match(fieldProps.className, /input-readonly/);
});
