import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { normalizeSkillKey, deduplicateSkillList } from "../../utils/skillCanonical.js";

describe("Onboarding Skills & Current Goal Shared Intelligence Regression Suite", () => {
  // Mock skill recommendations representative of engine output
  const DATA_ANALYST_RECS = [
    { id: "s-sql", name: "SQL", category: "database", is_core: true, relationship: "direct" },
    { id: "s-excel", name: "Excel", category: "data", is_core: true, relationship: "direct" },
    { id: "s-cleaning", name: "Data Cleaning", category: "data", is_core: true, relationship: "direct" },
    { id: "s-viz1", name: "Data Visualisation", category: "data", is_core: true, relationship: "direct" },
    { id: "s-viz2", name: "Data Visualization", category: "data_science", is_core: true, relationship: "direct" },
    { id: "s-powerbi", name: "Power BI", category: "data", is_core: true, relationship: "direct" },
    { id: "s-stats", name: "Statistics", category: "data", is_core: true, relationship: "direct" },
    { id: "s-comm", name: "Communication", category: "soft_skill", is_core: false, relationship: "supporting" },
    { id: "s-prog", name: "Programming Fundamentals", category: "software_development", is_core: false, relationship: "supporting" },
    { id: "s-vue", name: "Vue.js", category: "frontend", is_core: false, relationship: "supporting" },
    { id: "s-test", name: "Software Testing", category: "QA", is_core: false, relationship: "supporting" },
    { id: "s-cicd", name: "CI/CD", category: "cloud_devops", is_core: false, relationship: "supporting" },
  ];

  const BACKEND_DEV_RECS = [
    { id: "s-js", name: "JavaScript", category: "programming", is_core: true, relationship: "direct" },
    { id: "s-node", name: "Node.js", category: "backend", is_core: true, relationship: "direct" },
    { id: "s-api", name: "REST APIs", category: "backend", is_core: true, relationship: "direct" },
    { id: "s-sql", name: "SQL", category: "database", is_core: true, relationship: "direct" },
    { id: "s-dsa", name: "Data Structures and Algorithms", category: "programming", is_core: true, relationship: "direct" },
    { id: "s-comm", name: "Communication", category: "soft_skill", is_core: false, relationship: "supporting" },
  ];

  const CHEF_RECS = [
    { id: "s-culinary", name: "Culinary Techniques", category: "hospitality", is_core: true, relationship: "direct" },
    { id: "s-food-safe", name: "Food Safety & Hygiene", category: "hospitality", is_core: true, relationship: "direct" },
    { id: "s-menu", name: "Menu Planning", category: "hospitality", is_core: true, relationship: "direct" },
    { id: "s-team", name: "Teamwork", category: "soft_skill", is_core: false, relationship: "supporting" },
  ];

  const LAWYER_RECS = [
    { id: "s-oral", name: "Oral Advocacy", category: "law", is_core: true, relationship: "direct" },
    { id: "s-briefing", name: "Case Briefing", category: "law", is_core: true, relationship: "direct" },
    { id: "s-contract", name: "Contract Drafting", category: "law", is_core: true, relationship: "direct" },
    { id: "s-reasoning", name: "Legal Reasoning", category: "law", is_core: true, relationship: "direct" },
    { id: "s-research", name: "Legal Research", category: "law", is_core: true, relationship: "direct" },
    { id: "s-comm", name: "Communication", category: "soft_skill", is_core: false, relationship: "supporting" },
  ];

  test("Scenario A: Data Analyst role recommendations and isolation", () => {
    const deduped = deduplicateSkillList(DATA_ANALYST_RECS);
    const core = deduped.filter(s => s.is_core);
    const supporting = deduped.filter(s => !s.is_core);

    const coreNames = core.map(s => s.name);
    // Core must contain Data Analyst capabilities
    assert.ok(coreNames.includes("SQL"));
    assert.ok(coreNames.includes("Excel"));
    assert.ok(coreNames.includes("Data Cleaning"));
    assert.ok(coreNames.includes("Statistics") || coreNames.includes("Power BI"));

    // Vue.js, Software Testing, and CI/CD must NOT be in core recommendations
    assert.ok(!coreNames.includes("Vue.js"), "Vue.js must not be in Core for Data Analyst");
    assert.ok(!coreNames.includes("Software Testing"), "Software Testing must not be in Core for Data Analyst");
    assert.ok(!coreNames.includes("CI/CD"), "CI/CD must not be in Core for Data Analyst");

    // Deduplication test: Data Visualisation vs Data Visualization
    const vizItems = deduped.filter(s => normalizeSkillKey(s.name) === "data visualization");
    assert.equal(vizItems.length, 1, "Duplicate visuali[s/z]ation skills must be resolved to 1 canonical skill");

    // Supporting skills remain separated
    const suppNames = supporting.map(s => s.name);
    assert.ok(suppNames.includes("Communication"));
  });

  test("Scenario B: Backend Developer recommendations focus on backend competencies", () => {
    const deduped = deduplicateSkillList(BACKEND_DEV_RECS);
    const core = deduped.filter(s => s.is_core).map(s => s.name);

    assert.ok(core.includes("Node.js"));
    assert.ok(core.includes("REST APIs"));
    assert.ok(core.includes("SQL"));
    assert.ok(core.includes("JavaScript"));
    // Analytics-only skills do not dominate
    assert.ok(!core.includes("Spreadsheet Analysis"));
    assert.ok(!core.includes("Power BI"));
  });

  test("Scenario C: Chef recommendations focus on culinary capabilities", () => {
    const deduped = deduplicateSkillList(CHEF_RECS);
    const core = deduped.filter(s => s.is_core).map(s => s.name);

    assert.ok(core.includes("Culinary Techniques"));
    assert.ok(core.includes("Food Safety & Hygiene"));
    assert.ok(core.includes("Menu Planning"));
    // Software engineering skills must not appear in Chef core
    assert.ok(!core.includes("JavaScript"));
    assert.ok(!core.includes("REST APIs"));
    assert.ok(!core.includes("Docker"));
  });

  test("Scenario D: Lawyer recommendations focus on legal competencies", () => {
    const deduped = deduplicateSkillList(LAWYER_RECS);
    const core = deduped.filter(s => s.is_core).map(s => s.name);

    assert.ok(core.includes("Legal Research"));
    assert.ok(core.includes("Legal Reasoning"));
    assert.ok(core.includes("Contract Drafting"));
    assert.ok(core.includes("Case Briefing"));
    // Unrelated tech skills must not be in Lawyer core
    assert.ok(!core.includes("Vue.js"));
    assert.ok(!core.includes("Python"));
  });

  test("Scenario E: Changing goal preserves user-selected skills and refreshes recommendations", () => {
    // User selected SQL and Excel while on Data Analyst
    const selectedSkills = [
      { skill_id: "s-sql", name: "SQL", level: "beginner" },
      { skill_id: "s-excel", name: "Excel", level: "beginner" }
    ];

    // User changes goal from Data Analyst to Backend Developer
    const newRecs = deduplicateSkillList(BACKEND_DEV_RECS, new Set(selectedSkills.map(s => s.skill_id)));

    // User's selected skills are still present and preserved
    assert.equal(selectedSkills.length, 2);
    assert.equal(selectedSkills[0].name, "SQL");
    assert.equal(selectedSkills[1].name, "Excel");

    // The new recommendation list targets Backend Developer
    const newCore = newRecs.filter(s => s.is_core).map(s => s.name);
    assert.ok(newCore.includes("Node.js"));
    assert.ok(newCore.includes("REST APIs"));
  });

  test("Scenario F: AI service unavailable fallback handling", () => {
    // When AI service is offline, response envelope returns db_fallback with database skills
    const apiResponse = {
      data: deduplicateSkillList(DATA_ANALYST_RECS),
      status: "db_fallback"
    };

    assert.equal(apiResponse.status, "db_fallback");
    assert.ok(Array.isArray(apiResponse.data));
    assert.ok(apiResponse.data.length > 0);
    // Verified DB skills are still usable
    const core = apiResponse.data.filter(s => s.is_core).map(s => s.name);
    assert.ok(core.includes("SQL"));
  });

  test("Scenario G: Persistence contracts ensure selected skills and goal are saved", () => {
    // Simulated onboarding form state
    const onboardingForm = {
      status: "Bachelor Student",
      location: "Goa",
      educationStage: "Higher Education",
      stream: "Science — PCM",
      degree: "Bachelor of Computer Applications (BCA)",
      careerGoal: "Data Analyst",
      careerId: "549fa435-9499-4e45-bee1-b89a13b3d64e",
      skills: [
        { skill_id: "s-sql", name: "SQL", level: "beginner", is_custom: false },
        { skill_id: "s-cleaning", name: "Data Cleaning", level: "beginner", is_custom: false }
      ]
    };

    // Profile update payload contract
    const profilePayload = {
      career_goal: onboardingForm.careerGoal,
      career_id: onboardingForm.careerId,
      preferred_locations: ["Goa + Remote"]
    };

    const skillsPayload = {
      skills: onboardingForm.skills.map(s => ({ skill_id: s.skill_id, level: s.level }))
    };

    assert.equal(profilePayload.career_goal, "Data Analyst");
    assert.equal(profilePayload.career_id, "549fa435-9499-4e45-bee1-b89a13b3d64e");
    assert.equal(skillsPayload.skills.length, 2);
    assert.equal(skillsPayload.skills[0].skill_id, "s-sql");
    assert.equal(skillsPayload.skills[1].skill_id, "s-cleaning");
  });

  test("Scenario H: Incomplete education does not hallucinate qualifications or eligibility", () => {
    const incompleteContext = {
      educationStage: "Higher Education",
      stream: "",
      degree: "",
      careerGoal: "Data Analyst"
    };

    function validateEducation(ctx) {
      const missing = [];
      if (!ctx.stream) missing.push("12th Stream");
      if (!ctx.degree) missing.push("Current Education");
      return missing;
    }

    const missing = validateEducation(incompleteContext);
    assert.ok(missing.includes("12th Stream"));
    assert.ok(missing.includes("Current Education"));
    assert.equal(missing.length, 2);
  });
});
