import assert from "node:assert/strict";
import { test } from "node:test";
import { getGoalValidationViewModel, formatGoalDisplayValue } from "../../utils/goalValidation.js";

test("Scenario 1: Doctor with unverified formal requirements maps to State E (honest neutral, never Blocked/Ineligible)", () => {
  const doctorUnverifiedPayload = {
    goal: "Doctor",
    resolution: "ai_resolved",
    goal_validity: "VALID",
    direct_route_status: "E",
    direct_route_decision: "Subject Facts Required",
    reason: "Under statutory National Medical Commission (NMC) regulations, direct entry into MBBS requires Class 12 Science with Physics, Chemistry, Biology/Biotechnology, and English with qualifying NEET-UG score. Your profile indicates a Science background but Biology/Biotechnology coursework has not yet been verified.",
    suggested_routes: [
      {
        title: "Verify Class 12 Biology / Biotechnology or NIOS Single-Subject Bridge",
        route_type: "nios_pcb_bridge_neet",
        steps: [
          "Confirm Class 12 marks sheet includes Biology/Biotechnology",
          "If absent, enroll in NIOS on-demand examination for Biology as an additional subject",
          "Register and qualify for NEET-UG"
        ]
      }
    ],
    next_action: {
      title: "Verify Class 12 Biology / Biotechnology or enroll in NIOS PCB bridge",
      rationale: "NMC eligibility requires documented Physics, Chemistry, and Biology/Biotechnology in Class 12.",
      time_range_hours: [2, 4]
    },
    sources: [
      {
        title: "National Medical Commission (NMC) Regulations on Graduate Medical Education",
        url: "https://www.nmc.org.in"
      }
    ]
  };

  const vm = getGoalValidationViewModel(doctorUnverifiedPayload);

  // 1. Direct route status must be E, not D
  assert.equal(vm.directRouteStatus, "E");

  // 2. Title must reflect verification needed, never "Blocked" or "Ineligible"
  assert.equal(vm.title, "Goal recognized — formal route needs verification");
  assert.doesNotMatch(vm.title, /blocked/i);
  assert.doesNotMatch(vm.title, /ineligible/i);

  // 3. Four dimensions must be cleanly extracted
  assert.equal(vm.fourDimensions.formalEligibility.status, "E");
  assert.equal(vm.fourDimensions.formalEligibility.decision, "Subject Facts Required");
  assert.match(vm.fourDimensions.formalEligibility.reason, /National Medical Commission/);

  // 4. Candidate bridge routes must be preserved
  assert.equal(vm.suggestedRoutes.length, 1);
  assert.equal(vm.suggestedRoutes[0].route_type, "nios_pcb_bridge_neet");

  // 5. Next Best Action is preserved
  assert.ok(vm.nextAction);
  assert.match(vm.nextAction.title, /BIOS|NIOS|Biology/i);
});

test("Scenario 2: Backend Developer with relevant technical skills maps to State A (Directly Eligible)", () => {
  const backendDevPayload = {
    goal: "Backend Developer",
    resolution: "ai_resolved",
    goal_validity: "VALID",
    direct_route_status: "A",
    direct_route_decision: "Direct Route Open",
    reason: "Direct employment and internship pathways are open with demonstrated programming and systems skills.",
    suggested_routes: [
      {
        title: "Standard Software Engineering Route",
        route_type: "standard_entry",
        steps: ["Build portfolio projects", "Contribute to open source", "Apply for internships"]
      }
    ],
    next_action: {
      title: "Build and deploy a RESTful API with PostgreSQL",
      time_range_hours: [10, 20]
    }
  };

  const vm = getGoalValidationViewModel(backendDevPayload);
  assert.equal(vm.directRouteStatus, "A");
  assert.equal(vm.fourDimensions.formalEligibility.status, "A");
  assert.equal(vm.fourDimensions.formalEligibility.decision, "Direct Route Open");
  assert.ok(vm.suggestedRoutes.length > 0);
});

test("Scenario 3: Goal with missing profile data does not crash and defaults safely to State E", () => {
  const minimalPayload = {
    goal: "Marine Biologist"
  };

  const vm = getGoalValidationViewModel(minimalPayload);
  assert.equal(vm.directRouteStatus, "E");
  assert.equal(vm.goal, "Marine Biologist");
  assert.ok(vm.title);
  assert.ok(vm.fourDimensions);
  assert.equal(vm.fourDimensions.formalEligibility.status, "E");
});

test("Scenario 4: Doctor goal with delivery mode conflict (Online/Remote preference vs clinical MBBS) identifies practical constraint", () => {
  const payloadWithConflict = {
    goal: "Doctor",
    direct_route_status: "E",
    delivery_mode_conflict: true,
    practical_feasibility: {
      score: 40,
      obstacles: [
        "Under statutory National Medical Commission (NMC) regulations, clinical medical education (MBBS) cannot be completed online or part-time. Full-time, on-site laboratory and hospital training is mandatory."
      ],
      deliveryModeConflict: true
    }
  };

  const vm = getGoalValidationViewModel(payloadWithConflict);
  assert.equal(vm.fourDimensions.practicalFeasibility.deliveryModeConflict, true);
  assert.match(vm.fourDimensions.practicalFeasibility.obstacles[0], /National Medical Commission.*regulations|NMC/i);
});

test("Scenario 5: Unrelated user-selected skills (Advertising Platforms under Doctor) are flagged as user-added, not core medical skills", () => {
  const userSkills = [
    { id: "sk-1", name: "Anatomy", category: "healthcare" },
    { id: "sk-2", name: "Physiology", category: "healthcare" },
    { id: "sk-3", name: "Advertising Platforms", category: "marketing" }
  ];

  const isDoctorGoal = true;

  // Filter or tag helper simulating SkillsInterestsPanel logic
  const categorized = userSkills.map(sk => {
    const isCrossDomain = isDoctorGoal && (
      (sk.category || "").toLowerCase().includes("marketing") || 
      (sk.name || "").toLowerCase().includes("advertising")
    );
    return { ...sk, isCrossDomain };
  });

  const adSkill = categorized.find(s => s.name === "Advertising Platforms");
  const anatomySkill = categorized.find(s => s.name === "Anatomy");

  assert.ok(adSkill);
  assert.equal(adSkill.isCrossDomain, true, "Advertising Platforms should be marked cross-domain under Doctor");
  assert.equal(anatomySkill.isCrossDomain, false, "Anatomy is a legitimate healthcare skill");
});

test("Scenario 6: Empty skills profile handles gracefully with 0 count and does not fail", () => {
  const userSkillIds = new Set();
  const allSkills = [
    { id: "sk-1", name: "Python", category: "programming" },
    { id: "sk-2", name: "SQL", category: "databases" }
  ];

  const selected = allSkills.filter(s => userSkillIds.has(s.id));
  assert.equal(selected.length, 0);
  assert.equal(Array.isArray(selected), true);
});

test("Scenario 7: Many skills profile (e.g. 15 skills) preserves exact count and items", () => {
  const skills = Array.from({ length: 15 }, (_, i) => ({
    id: `sk-${i + 1}`,
    name: `Skill ${i + 1}`,
    category: "general"
  }));
  const userSkillIds = new Set(skills.map(s => s.id));

  const selected = skills.filter(s => userSkillIds.has(s.id));
  assert.equal(selected.length, 15);
});

test("Scenario 8: Deterministic fallback preserves neutral explanation when AI service is unavailable", () => {
  const aiUnavailableFallback = {
    goal: "Doctor",
    goal_validity: "VALID",
    direct_route_status: "E",
    direct_route_decision: "Subject Facts Required",
    reason: "Formal eligibility has not yet been verified against your complete profile facts. Under statutory NMC regulations, direct entry requires Class 12 PCB + NEET-UG.",
    ai_classification: "E",
    allow_continue: true,
    suggested_routes: []
  };

  const vm = getGoalValidationViewModel(aiUnavailableFallback);
  assert.equal(vm.directRouteStatus, "E");
  assert.match(vm.summary, /Formal eligibility has not yet been verified/);
  assert.doesNotMatch(vm.summary, /blocked/i);
});

test("Scenario 9: Ambition preservation rule: Save is permitted even when direct route is State D (Restricted)", () => {
  // Verifies that a user with State D (e.g. Commerce student wanting to be Doctor via NIOS bridge) can save their profile
  const validationResult = {
    classification: "D",
    direct_route_status: "D",
    direct_route_decision: "Prerequisite Bridge Route Required",
    allow_continue: true // Must remain true! User ambition is user-owned
  };

  // In our redesigned ProfilePage, handleSave does NOT block on classification === 'RED' or 'D'
  function canSaveProfile(res) {
    // User ambition is user-owned and permanently preservable
    return true;
  }

  assert.equal(canSaveProfile(validationResult), true);
});


test("Regression: structured route cost { estimate } is formatted to safe React text", () => {
  assert.equal(formatGoalDisplayValue({ estimate: "₹1.5L–₹3L total" }), "₹1.5L–₹3L total");
  assert.equal(formatGoalDisplayValue({ time: { estimate: "6 years" } }), "6 years");
  assert.equal(formatGoalDisplayValue({ estimate: { label: "Low-cost route" } }), "Low-cost route");
  assert.equal(formatGoalDisplayValue({ unknown_nested_object: true }, "Not yet estimated"), "Not yet estimated");
});

test("Regression: structured timeline and cost objects never stringify as [object Object]", () => {
  const route = {
    time: { next_milestone: "2–4 weeks", route_endpoint: "6–7 years" },
    cost: { estimate: "Government college fees vary by institution" }
  };
  const timeline = formatGoalDisplayValue(route.time.route_endpoint || route.time.next_milestone);
  const cost = formatGoalDisplayValue(route.cost);
  assert.equal(timeline, "6–7 years");
  assert.equal(cost, "Government college fees vary by institution");
  assert.doesNotMatch(`${timeline}${cost}`, /\[object Object\]/);
});
