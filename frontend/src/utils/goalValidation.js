const DIRECT_STATES = new Set(["A", "B", "C", "D", "E"]);

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function list(value) {
  return Array.isArray(value)
    ? value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)
    : [];
}


/**
 * Convert API values into safe, readable UI text. Goal/pathway payloads may
 * represent costs as objects such as { estimate: "..." } and timelines as
 * structured objects. React must never receive those objects as child nodes.
 */
export function formatGoalDisplayValue(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") return value.trim() || fallback;
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : fallback;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const parts = value
      .map((item) => formatGoalDisplayValue(item, ""))
      .filter(Boolean);
    return parts.length ? parts.join(" · ") : fallback;
  }
  if (typeof value === "object") {
    const preferredKeys = [
      "estimate", "label", "value", "display", "text", "description",
      "route_endpoint", "next_milestone", "amount", "range", "cost", "duration",
      "time", "timeline", "estimated_duration", "target_weeks"
    ];
    for (const key of preferredKeys) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        const formatted = formatGoalDisplayValue(value[key], "");
        if (formatted) return formatted;
      }
    }
    return fallback;
  }
  return fallback;
}

/**
 * Normalizes the legacy and current goal-validation contracts for UI use.
 * Eligibility and AI pathway fit are deliberately kept separate: GREEN from
 * an LLM is not proof that the user is formally eligible for a route.
 */
export function getGoalValidationViewModel(data) {
  const result = data && typeof data === "object" ? data : {};
  const resolution = clean(result.resolution).toLowerCase();
  const goalValidity = clean(result.goal_validity || result.goalValidity).toUpperCase();
  const directRaw = clean(result.direct_route_status || result.directRouteStatus || result.classification).toUpperCase();
  const directRouteStatus = DIRECT_STATES.has(directRaw) ? directRaw : "E";
  const aiClassification = clean(result.ai_classification || result.pathway_status || result.aiClassification).toUpperCase();
  const profileFit = clean(result.profile_fit || result.ai_pathway_fit || result.profileFit).toUpperCase();
  const goal = clean(result.goal || result.original_input || result.originalInput) || "your goal";

  const unsupported = ["unsupported_or_unmatched", "invalid_goal", "not_found"].includes(resolution)
    || goalValidity === "INVALID"
    || goalValidity === "UNSUPPORTED";
  const needsClarification = resolution === "clarification_required"
    || goalValidity === "CLARIFICATION_REQUIRED";
  const recognized = ["matched", "ai_resolved", "verification_pending", "unverified"].includes(resolution)
    || goalValidity === "VALID"
    || goalValidity === "UNVERIFIED"
    || result.goal_valid === true;

  let title = "Goal recognized — route needs verification";
  let tone = "neutral";
  let fitLabel = "";

  if (unsupported) {
    title = "Let's clarify this goal";
    tone = "neutral";
  } else if (needsClarification) {
    title = "Please clarify your goal";
    tone = "neutral";
  } else if (directRouteStatus === "D") {
    title = "A direct-route requirement may be unmet";
    tone = "warning";
  } else if (directRouteStatus === "B") {
    title = "A condition may need to be completed";
    tone = "warning";
  } else if (directRouteStatus === "C") {
    title = "An alternative route may be available";
    tone = "warning";
  } else if (directRouteStatus === "A") {
    title = "Initial route match — verify specific requirements";
    tone = "positive";
  } else if (recognized) {
    title = "Goal recognized — formal route needs verification";
    tone = "neutral";
  } else if (profileFit === "BRIDGE_NEEDED" || aiClassification === "YELLOW") {
    title = "A bridge may be needed";
    tone = "warning";
  } else if (profileFit === "STRONG_START" || aiClassification === "GREEN") {
    title = "A promising starting point";
    tone = "positive";
  } else if (profileFit === "LONG_RUN" || profileFit === "EXPLORE") {
    title = "A longer-term goal to map";
    tone = "neutral";
  }

  if (!unsupported && !needsClarification) {
    if (profileFit === "STRONG_START" || aiClassification === "GREEN") {
      fitLabel = "AI guidance: promising starting point";
    } else if (profileFit === "BRIDGE_NEEDED" || aiClassification === "YELLOW") {
      fitLabel = "AI guidance: a bridge may be needed";
    } else if (profileFit === "LONG_RUN") {
      fitLabel = "AI guidance: longer-term pathway";
    } else if (profileFit === "EXPLORE") {
      fitLabel = "AI guidance: explore before deciding";
    } else if (aiClassification === "RED") {
      fitLabel = "AI guidance: review formal route requirements";
    }
  }

  let summary = clean(result.reason || result.explanation || result.message);
  if (!summary) {
    if (unsupported) summary = "NaviGoa couldn't confidently identify this as a supported career, programme, exam, skill, or other goal. Rephrase it or choose a suggested option.";
    else if (needsClarification) summary = clean(result.clarification_question) || "A little more detail is needed to identify the exact goal. Choose a suggested match or make the goal more specific.";
    else if (directRouteStatus === "E") summary = `NaviGoa has recognized ${goal}, but it doesn't have enough verified information to determine eligibility for a specific formal route yet.`;
    else if (directRouteStatus === "D") summary = "The current rule mapping indicates a possible restriction for this direct route. Review the stated requirements and available alternatives.";
    else if (directRouteStatus === "B") summary = "A condition may need to be met before this specific route can proceed.";
    else if (directRouteStatus === "C") summary = "The direct route may not be the only option. Compare the available alternatives before deciding.";
    else summary = "This is an initial route assessment, not a guarantee of admission, licensing, or employment.";
  }

  const suggestedRoutes = Array.isArray(result.suggested_routes || result.routes)
    ? (result.suggested_routes || result.routes).filter((item) => item && typeof item === "object")
    : [];
  const fd = result.four_dimensions || result.fourDimensions || {};
  const nextSteps = list(result.next_steps || result.missing_requirements || result.recommended_route || fd.formal_eligibility?.mandatory_gates);
  const skillGaps = list(result.skill_gaps || fd.readiness?.confirmed_gaps);
  const formalBarriers = list(result.formal_barriers || fd.formal_eligibility?.barriers);

  const action = clean(result.action || result.next_action?.title);
  const clarificationQuestion = clean(result.clarification_question || result.clarificationQuestion);
  const allowContinue = result.allow_continue !== false && !unsupported && !needsClarification;

  // Four Dimensions Extraction (Blueprint v2.0)
  const fourDimensions = {
    ambition: {
      goal: clean(fd.ambition?.selected_goal || fd.ambition?.goal || goal),
      goalType: clean(fd.ambition?.goal_type || result.goal_type || "career"),
      owner: "user",
      preserved: true,
      note: clean(fd.ambition?.note || "Goal destination is permanently owned by the user.")
    },
    formalEligibility: {
      status: clean(fd.formal_eligibility?.status || directRouteStatus),
      decision: clean(fd.formal_eligibility?.decision || result.direct_route_decision || "Verification Pending"),
      reason: clean(fd.formal_eligibility?.reason || result.reason || summary),
      mandatoryGates: list(fd.formal_eligibility?.mandatory_gates || formalBarriers),
      barriers: list(fd.formal_eligibility?.barriers || formalBarriers),
      bridgePossible: fd.formal_eligibility?.bridge_possible === true || result.bridge_possible === true,
      citedAuthorities: list(fd.formal_eligibility?.cited_authorities || result.cited_authorities)
    },
    readiness: {
      score: typeof fd.readiness?.score === "number" ? fd.readiness.score : (typeof result.readiness?.score === "number" ? result.readiness.score : 50),
      demonstratedSkills: list(fd.readiness?.demonstrated_skills || result.demonstrated_skills),
      confirmedGaps: list(fd.readiness?.confirmed_gaps || skillGaps),
      levelAlignment: clean(fd.readiness?.level_alignment || result.readiness?.level_alignment || "")
    },
    practicalFeasibility: {
      score: typeof fd.practical_feasibility?.score === "number" ? fd.practical_feasibility.score : (typeof result.practical_feasibility?.score === "number" ? result.practical_feasibility.score : 65),
      deliveryModeConflict: fd.practical_feasibility?.delivery_mode_conflict === true || result.delivery_mode_conflict === true || result.practical_feasibility?.deliveryModeConflict === true || result.practical_feasibility?.delivery_mode_conflict === true,
      statedModes: list(fd.practical_feasibility?.stated_modes || result.practical_feasibility?.stated_modes),
      preferredLocations: list(fd.practical_feasibility?.preferred_locations || result.practical_feasibility?.preferred_locations),
      weeklyHours: typeof fd.practical_feasibility?.weekly_hours === "number" ? fd.practical_feasibility.weekly_hours : (typeof result.practical_feasibility?.weekly_hours === "number" ? result.practical_feasibility.weekly_hours : null),
      obstacles: list(fd.practical_feasibility?.obstacles || result.practical_feasibility?.obstacles)
    }
  };

  const overallFeasibility = result.overall_feasibility || {
    status: directRouteStatus === "A" ? "HIGH_FEASIBILITY" : directRouteStatus === "D" ? "FORMAL_GATE_RESTRICTED" : "NEEDS_VERIFICATION",
    label: directRouteStatus === "A" ? "Practical route available" : "Route needs verification",
    tone: directRouteStatus === "A" ? "positive" : "warning",
    score: fourDimensions.practicalFeasibility.score
  };

  const nextAction = result.next_action || (action ? { title: action, time_range_hours: [2, 4] } : null);
  const milestones = Array.isArray(result.milestones) ? result.milestones : [];
  const sources = Array.isArray(result.sources) ? result.sources : [];

  return {
    goal,
    resolution,
    goalValidity,
    directRouteStatus,
    classification: directRouteStatus,
    aiClassification,
    profileFit,
    title,
    tone,
    fitLabel,
    summary,
    suggestedRoutes,
    nextSteps,
    skillGaps,
    formalBarriers,
    action,
    clarificationQuestion,
    recognized,
    unsupported,
    needsClarification,
    allowContinue,
    aiGenerated: result.ai_generated === true || result.aiGenerated === true,
    confidence: clean(result.confidence || result.evidence_confidence),
    ruleVerification: clean(result.rule_verification || result.ruleVerification),
    // Rich Four-Dimension and Comparison Fields
    fourDimensions,
    overallFeasibility,
    nextAction,
    milestones,
    sources
  };
}
