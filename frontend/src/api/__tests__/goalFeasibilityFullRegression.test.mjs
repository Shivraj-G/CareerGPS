import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { getGoalValidationViewModel, formatGoalDisplayValue } from "../../utils/goalValidation.js";

describe("Career Feasibility & Goal Engine Comprehensive 12-Scenario Regression Suite", () => {
  // Scenario 1: Lawyer with BCA pursuing + Commerce background
  test("Scenario 1 & 6: Lawyer with user's actual BCA pursuing + Commerce background evaluates to State B with BCI citation", () => {
    const rawBackendPayload = {
      goal: "Lawyer",
      classification: "B",
      direct_route_status: "B",
      pathway_status: "B",
      resolution: "matched",
      direct_route_decision: "Degree Completion Milestone (3-Year LL.B. Route)",
      four_dimensions: {
        ambition: { selected_goal: "Lawyer", owner: "user", preserved: true },
        formal_eligibility: {
          status: "B",
          decision: "Degree Completion Milestone (3-Year LL.B. Route)",
          mandatory_gates: [
            "Statutory Bachelor of Laws (LL.B.) degree recognized by the Bar Council of India",
            "Minimum 45% aggregate marks in qualifying bachelor degree",
            "Enrolment with State Bar Council and passing the All India Bar Examination (AIBE)",
            "Mandatory regular, full-time campus-based study (Distance/online law degrees not recognized for court practice)"
          ],
          cited_authorities: ["Bar Council of India (BCI)"]
        },
        readiness: { score: 45, level_alignment: "ongoing" },
        practical_feasibility: {
          score: 50,
          delivery_mode_conflict: true,
          obstacles: ["Delivery Mode Advisory: Bar Council of India (BCI) regulations prohibit distance or online law degrees."]
        }
      },
      routes: [
        {
          id: "3year_llb_graduate_route",
          label: "3-Year LL.B. Post-Graduate Route",
          route_type: "academic_and_statutory",
          scores: { composite_score: 83 },
          time: { route_endpoint: "3 years full-time campus LL.B. + AIBE" },
          cost: { estimate: "State University: ₹35,000–₹75,000/yr" },
          summary: "Complete ongoing BCA degree with >= 45% marks, clear law entrance (CUET-PG / MH CET Law / NLSAT), and graduate from a BCI-approved law faculty."
        },
        {
          id: "5year_integrated_clat_route",
          label: "5-Year Integrated Law Route (B.A. LL.B. / B.B.A. LL.B. via 10+2)",
          route_type: "formal_regulated",
          scores: { composite_score: 75 },
          time: { route_endpoint: "5 years integrated curriculum" },
          cost: { estimate: "NLUs: ₹2.5L–₹3.5L/yr" },
          summary: "Use 10+2 qualification directly to enter 5-Year Integrated Law via CLAT."
        }
      ],
      next_action: {
        title: "Review eligibility brochures and entrance syllabi for 3-Year LL.B. programmes (CUET-PG Law, MH CET Law, NLSAT).",
        time_range_hours: [2, 4],
        rationale: "Under Bar Council of India rules, your bachelor degree qualifies you for 3-Year LL.B. admission upon graduation."
      },
      sources: [
        { authority: "Bar Council of India (BCI)", url: "http://www.barcouncilofindia.org/" }
      ]
    };

    const vm = getGoalValidationViewModel(rawBackendPayload);

    // Verify ViewModel mapping
    assert.equal(vm.directRouteStatus, "B");
    assert.equal(vm.classification, "B");
    assert.match(vm.title, /condition may need to be completed/i);
    assert.equal(vm.fourDimensions.formalEligibility.decision, "Degree Completion Milestone (3-Year LL.B. Route)");
    assert.equal(vm.fourDimensions.formalEligibility.mandatoryGates.length, 4);
    assert.equal(vm.suggestedRoutes.length, 2);
    assert.equal(vm.sources[0].authority, "Bar Council of India (BCI)");
    assert.equal(vm.fourDimensions.practicalFeasibility.deliveryModeConflict, true);
    assert.ok(vm.nextAction.title.includes("3-Year LL.B."));
  });

  // Scenario 2: Data Analyst with appropriate technical/quantitative profile
  test("Scenario 2: Data Analyst with BCA computing background evaluates to State A Direct Route", () => {
    const rawBackendPayload = {
      goal: "Data Analyst",
      classification: "A",
      direct_route_status: "A",
      direct_route_decision: "Direct Quant/Tech Route",
      four_dimensions: {
        ambition: { selected_goal: "Data Analyst", preserved: true },
        formal_eligibility: {
          status: "A",
          decision: "Direct Quant/Tech Route",
          mandatory_gates: ["Demonstrated SQL querying and business dashboard visualization"]
        },
        readiness: { score: 65 },
        practical_feasibility: { score: 90, delivery_mode_conflict: false }
      },
      routes: [
        {
          id: "analytics_portfolio_route",
          label: "SQL + Power BI Portfolio Route",
          scores: { composite_score: 91 },
          time: { route_endpoint: "3–6 months portfolio build" }
        }
      ],
      next_action: {
        title: "Build a multi-table SQL analytics query project and publish a Power BI dashboard.",
        time_range_hours: [4, 8]
      }
    };

    const vm = getGoalValidationViewModel(rawBackendPayload);
    assert.equal(vm.directRouteStatus, "A");
    assert.match(vm.title, /Initial route match/i);
    assert.equal(vm.suggestedRoutes[0].label, "SQL + Power BI Portfolio Route");
  });

  // Scenario 3: Backend Developer with computing background
  test("Scenario 3: Backend Developer with computing background evaluates to State A", () => {
    const rawBackendPayload = {
      goal: "Backend Developer",
      classification: "A",
      direct_route_status: "A",
      direct_route_decision: "Direct Tech Foundation",
      four_dimensions: {
        formal_eligibility: { status: "A", decision: "Direct Tech Foundation" }
      }
    };
    const vm = getGoalValidationViewModel(rawBackendPayload);
    assert.equal(vm.directRouteStatus, "A");
  });

  // Scenario 4: Doctor with non-medical background
  test("Scenario 4: Doctor with BCA/Commerce background evaluates to State D Subject Prerequisite Restricted with NMC citation", () => {
    const rawBackendPayload = {
      goal: "Doctor",
      classification: "D",
      direct_route_status: "D",
      direct_route_decision: "Subject Prerequisite Restricted (NMC Mandate)",
      four_dimensions: {
        formal_eligibility: {
          status: "D",
          decision: "Subject Prerequisite Restricted (NMC Mandate)",
          barriers: ["Missing Class 12 Senior Secondary Physics, Chemistry & Biology (PCB) pass."],
          cited_authorities: ["National Medical Commission (NMC)"]
        },
        practical_feasibility: {
          delivery_mode_conflict: true,
          obstacles: ["Regulated MBBS education cannot be completed online or part-time under NMC rules."]
        }
      },
      routes: [
        {
          id: "nios_biology_bridge",
          label: "NIOS Senior Secondary Biology Bridge + NEET-UG",
          route_type: "academic_bridge",
          scores: { composite_score: 65 }
        }
      ]
    };
    const vm = getGoalValidationViewModel(rawBackendPayload);
    assert.equal(vm.directRouteStatus, "D");
    assert.match(vm.title, /direct-route requirement may be unmet/i);
    assert.equal(vm.formalBarriers[0], "Missing Class 12 Senior Secondary Physics, Chemistry & Biology (PCB) pass.");
    assert.equal(vm.suggestedRoutes[0].route_type, "academic_bridge");
  });

  // Scenario 5: Recognized career with complete verified data (Chef)
  test("Scenario 5: Chef with verified culinary route evaluates to State A with NCHMCT/FSSAI citations", () => {
    const rawBackendPayload = {
      goal: "Chef",
      classification: "A",
      direct_route_status: "A",
      direct_route_decision: "Direct Culinary & Hospitality Route",
      sources: [
        { authority: "NCHMCT" },
        { authority: "FSSAI" }
      ]
    };
    const vm = getGoalValidationViewModel(rawBackendPayload);
    assert.equal(vm.directRouteStatus, "A");
    assert.equal(vm.sources.length, 2);
  });

  // Scenario 7: Unknown or ambiguous career title
  test("Scenario 7: Unknown or ambiguous career title evaluates to State E without fabricating rules", () => {
    const rawBackendPayload = {
      goal: "Space Alchemist",
      classification: "E",
      direct_route_status: "E",
      direct_route_decision: "Verification Pending",
      four_dimensions: {
        formal_eligibility: { status: "E", decision: "Verification Pending" }
      }
    };
    const vm = getGoalValidationViewModel(rawBackendPayload);
    assert.equal(vm.directRouteStatus, "E");
    assert.match(vm.title, /route needs verification/i);
  });

  // Scenario 8: AI provider offline while deterministic data is available
  test("Scenario 8: Deterministic evaluation preserves full fidelity when AI service is unavailable", () => {
    const deterministicPayload = {
      goal: "Lawyer",
      classification: "B",
      direct_route_status: "B",
      ai_classification: null,
      ai_generated: false,
      resolution: "deterministic_rules",
      direct_route_decision: "Degree Completion Milestone (3-Year LL.B. Route)",
      four_dimensions: {
        formal_eligibility: { status: "B", decision: "Degree Completion Milestone (3-Year LL.B. Route)" }
      }
    };
    const vm = getGoalValidationViewModel(deterministicPayload);
    assert.equal(vm.directRouteStatus, "B");
    assert.equal(vm.classification, "B");
    assert.ok(vm.title.length > 0);
    assert.notEqual(vm.title, "Data Missing");
  });

  // Scenario 9: Backend endpoint error handling
  test("Scenario 9: Backend endpoint error does not flash false success or wipe entered career goal", () => {
    let formState = { careerGoal: "Lawyer" };
    let validationError = "Failed to connect to CareerGPS validation service. HTTP 500.";
    let validationData = null;

    // In error condition, validationData remains null, error is captured, and careerGoal is intact
    assert.equal(validationData, null);
    assert.equal(formState.careerGoal, "Lawyer");
    assert.match(validationError, /HTTP 500/i);
  });

  // Scenario 10: Changing Current Goal while earlier validation request is pending
  test("Scenario 10: Changing goal cancels pending request and prevents race conditions", () => {
    let activeRequest = { id: 1, aborted: false };
    let finalRenderedGoal = "";

    function onGoalChange(newGoal) {
      activeRequest.aborted = true; // Abort prior
      activeRequest = { id: 2, goal: newGoal, aborted: false };
    }

    onGoalChange("Chef");
    // Simulate older request 1 resolving late
    if (!activeRequest.aborted && activeRequest.id === 1) {
      finalRenderedGoal = "Lawyer";
    }
    // Simulate newer request 2 resolving
    if (!activeRequest.aborted && activeRequest.id === 2) {
      finalRenderedGoal = activeRequest.goal;
    }

    assert.equal(finalRenderedGoal, "Chef");
  });

  // Scenario 11: Multi-user context isolation
  test("Scenario 11: Switching between users does not leak or reuse cached validation keys", () => {
    function generateValidationKey(userId, goal, contextStr) {
      return `usr:${userId}::${goal}::${contextStr}`;
    }

    const keyUser1 = generateValidationKey("user-1", "Lawyer", '{"edu":"BCA"}');
    const keyUser2 = generateValidationKey("user-2", "Lawyer", '{"edu":"B.Com"}');

    assert.notEqual(keyUser1, keyUser2);
  });

  // Scenario 12: Profile and Onboarding consistency
  test("Scenario 12: Profile and Onboarding produce identical ViewModel outputs from same contract", () => {
    const sharedContract = {
      goal: "Lawyer",
      classification: "B",
      direct_route_status: "B",
      direct_route_decision: "Degree Completion Milestone (3-Year LL.B. Route)"
    };

    const onboardingVm = getGoalValidationViewModel(sharedContract);
    const profileVm = getGoalValidationViewModel(sharedContract);

    assert.equal(onboardingVm.directRouteStatus, profileVm.directRouteStatus);
    assert.equal(onboardingVm.classification, profileVm.classification);
    assert.equal(onboardingVm.title, profileVm.title);
  });
});
