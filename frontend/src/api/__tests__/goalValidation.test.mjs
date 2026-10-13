import assert from "node:assert/strict";
import { test } from "node:test";
import { getGoalValidationViewModel } from "../../utils/goalValidation.js";

test("an AI GREEN signal never masquerades as verified eligibility when direct-route status is E", () => {
  const vm = getGoalValidationViewModel({
    goal: "High court judge",
    resolution: "ai_resolved",
    goal_validity: "VALID",
    direct_route_status: "E",
    classification: "E",
    ai_classification: "GREEN",
    profile_fit: "STRONG_START",
    reason: "An initial route assessment is available.",
    allow_continue: true,
  });
  assert.equal(vm.title, "Goal recognized — formal route needs verification");
  assert.equal(vm.directRouteStatus, "E");
  assert.equal(vm.fitLabel, "AI guidance: promising starting point");
  assert.doesNotMatch(vm.title, /highly aligned/i);
});

test("a legal career with a likely bridge is shown as recognized, not missing data or highly aligned", () => {
  const vm = getGoalValidationViewModel({
    goal: "High court judge",
    resolution: "ai_resolved",
    goal_validity: "VALID",
    direct_route_status: "E",
    pathway_status: "YELLOW",
    profile_fit: "BRIDGE_NEEDED",
    reason: "A law-related route and jurisdiction-specific requirements need checking.",
    suggested_routes: [{ title: "Verify the legal education route", steps: ["Check the applicable official rules"] }],
  });
  assert.match(vm.title, /route needs verification/i);
  assert.equal(vm.fitLabel, "AI guidance: a bridge may be needed");
  assert.equal(vm.suggestedRoutes.length, 1);
});

test("unsupported or ambiguous goal cannot receive a positive-alignment label", () => {
  const vm = getGoalValidationViewModel({
    goal: "Beggar",
    resolution: "unsupported_or_unmatched",
    goal_validity: "INVALID",
    direct_route_status: "E",
    pathway_status: "GREEN",
    reason: "Please clarify what type of goal you mean.",
    allow_continue: false,
  });
  assert.equal(vm.title, "Let's clarify this goal");
  assert.equal(vm.allowContinue, false);
  assert.equal(vm.fitLabel, "");
});

test("AI pathway status remains separate from eligibility status", () => {
  const vm = getGoalValidationViewModel({
    goal: "Doctor",
    resolution: "ai_resolved",
    goal_validity: "VALID",
    direct_route_status: "E",
    ai_classification: "RED",
    reason: "Formal medical-admission requirements need verification.",
  });
  assert.equal(vm.directRouteStatus, "E");
  assert.equal(vm.title, "Goal recognized — formal route needs verification");
  assert.equal(vm.fitLabel, "AI guidance: review formal route requirements");
});
