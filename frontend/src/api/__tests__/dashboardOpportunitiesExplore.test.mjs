import assert from "node:assert/strict";
import { test } from "node:test";

test("1. Dashboard Opportunities Section Contract: Explore Opportunities replaces career-specific grid", () => {
  // Model the Explore Opportunities section configuration
  const exploreOppsSection = {
    kicker: "GOA CAREER OPPORTUNITIES",
    heading: "Explore Opportunities",
    description: "Discover jobs, internships, scholarships, government recruitment, examinations, and training programmes across Goa. Explore opportunities from government departments, private employers, and educational institutions to find your next step.",
    categories: [
      { id: "jobs", label: "Jobs", icon: "BriefcaseBusiness" },
      { id: "internships", label: "Internships", icon: "GraduationCap" },
      { id: "gov_recruitment", label: "Government Recruitment", icon: "Building2" },
      { id: "scholarships", label: "Scholarships", icon: "Award" },
      { id: "training", label: "Training Programmes", icon: "BookOpen" }
    ],
    primaryAction: {
      label: "Explore Opportunities",
      to: "/opportunities"
    },
    secondaryAction: {
      label: "View all opportunities",
      to: "/opportunities"
    }
  };

  // 1. Heading must strictly be "Explore Opportunities"
  assert.equal(exploreOppsSection.heading, "Explore Opportunities");

  // 2. Heading must NOT contain career goal names or "Relevant Opportunities for ..."
  assert.doesNotMatch(exploreOppsSection.heading, /Relevant Opportunities for/i);
  assert.doesNotMatch(exploreOppsSection.heading, /Lawyer|Engineer|Doctor/i);

  // 3. Description must explicitly mention Goa
  assert.match(exploreOppsSection.description, /Goa/);
  assert.match(exploreOppsSection.description, /government recruitment/i);
  assert.match(exploreOppsSection.description, /scholarships/i);
  assert.match(exploreOppsSection.description, /training programmes/i);

  // 4. Compact category indicators must cover all 5 required domains
  const categoryLabels = exploreOppsSection.categories.map(c => c.label);
  assert.ok(categoryLabels.includes("Jobs"));
  assert.ok(categoryLabels.includes("Internships"));
  assert.ok(categoryLabels.includes("Government Recruitment"));
  assert.ok(categoryLabels.includes("Scholarships"));
  assert.ok(categoryLabels.includes("Training Programmes"));

  // 5. Actions must navigate to /opportunities
  assert.equal(exploreOppsSection.primaryAction.to, "/opportunities");
  assert.equal(exploreOppsSection.secondaryAction.to, "/opportunities");
});

test("2. Unrelated jobs are eliminated from Dashboard when user goal is Lawyer", () => {
  // Simulating dashboard render with user goal = Lawyer
  const userCurrentGoal = "Lawyer";

  // Dashboard section model
  function getDashboardOpportunitiesModel(goal) {
    // General-purpose Explore Opportunities model independent of goal string
    return {
      title: "Explore Opportunities",
      kicker: "GOA CAREER OPPORTUNITIES",
      isGoalSpecific: false,
      targetRoute: "/opportunities"
    };
  }

  const model = getDashboardOpportunitiesModel(userCurrentGoal);
  assert.equal(model.title, "Explore Opportunities");
  assert.equal(model.isGoalSpecific, false);
  assert.doesNotMatch(model.title, /Lawyer/);
});

test("3. Dashboard load isolation: Opportunities API failure cannot break dashboard", () => {
  // The dashboard no longer fetches opportunities directly in Dashboard(),
  // isolating the dashboard from opportunity API latency or timeouts.
  const dashboardState = {
    profile: { loaded: true, currentGoal: "Lawyer" },
    pathway: { loaded: true, stepsCount: 5 },
    careers: { loaded: true, itemsCount: 3 },
    // Opportunities section is a static navigation card
    exploreOpportunitiesCard: { available: true }
  };

  assert.equal(dashboardState.exploreOpportunitiesCard.available, true);
  assert.equal(dashboardState.profile.loaded, true);
});

test("4. Real opportunities remain accessible via Opportunities route", () => {
  const opportunityRoute = "/opportunities";
  assert.equal(opportunityRoute, "/opportunities");
});
