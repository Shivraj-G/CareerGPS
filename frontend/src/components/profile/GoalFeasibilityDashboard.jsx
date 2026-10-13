import React, { useState } from "react";
import {
  Target,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  Compass,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  Scale,
  Calendar,
  BookOpen,
  Award,
  Zap,
  Info
} from "lucide-react";
import { getGoalValidationViewModel, formatGoalDisplayValue } from "../../utils/goalValidation.js";

const ELIGIBILITY_BADGES = {
  A: {
    label: "State A: Directly Eligible",
    sub: "Direct statutory route is open based on verified profile qualifications.",
    color: "#15803d",
    bg: "rgba(22, 163, 74, 0.08)",
    border: "rgba(22, 163, 74, 0.25)",
    icon: CheckCircle2
  },
  B: {
    label: "State B: Milestone / Condition Pending",
    sub: "One prerequisite milestone or qualifying test needs to be completed.",
    color: "#ca8a04",
    bg: "rgba(202, 138, 4, 0.08)",
    border: "rgba(202, 138, 4, 0.25)",
    icon: Clock
  },
  C: {
    label: "State C: Alternative Route Available",
    sub: "Direct entry has barriers, but viable alternative or lateral transition routes exist.",
    color: "#2563eb",
    bg: "rgba(37, 99, 235, 0.08)",
    border: "rgba(37, 99, 235, 0.25)",
    icon: Compass
  },
  D: {
    label: "State D: Direct Route Restricted",
    sub: "Statutory prerequisites restrict this exact route; legal academic bridge required.",
    color: "#d97706",
    bg: "rgba(217, 119, 6, 0.08)",
    border: "rgba(217, 119, 6, 0.25)",
    icon: AlertTriangle
  },
  E: {
    label: "State E: Prerequisite Verification Required",
    sub: "Goal recognized; statutory requirements need to be verified against specific profile facts.",
    color: "#4b5563",
    bg: "rgba(107, 114, 128, 0.08)",
    border: "rgba(107, 114, 128, 0.25)",
    icon: HelpCircle
  }
};

export default function GoalFeasibilityDashboard({
  careerGoal,
  careerInfo,
  validationData,
  isValidating = false,
  onRetryValidation
}) {
  const [expandedSection, setExpandedSection] = useState(null); // 'routes' | 'sources' | 'milestones'
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  if (!careerGoal || !careerGoal.trim()) {
    return (
      <div className="panel goal-feasibility-panel empty-goal-panel" role="region" aria-label="Career Feasibility Dashboard">
        <div className="empty-goal-content">
          <div className="empty-goal-icon">
            <Target size={24} className="text-brand" />
          </div>
          <h3>Select a Career Ambition</h3>
          <p>
            Enter your target career goal in the form below (e.g., <em>Doctor</em>, <em>Software Developer</em>, or <em>Corporate Lawyer</em>) to evaluate formal eligibility, practical feasibility, readiness, and personalized bridges.
          </p>
        </div>
      </div>
    );
  }

  const vm = getGoalValidationViewModel(validationData || { goal: careerGoal });
  const directRouteStatus = vm.directRouteStatus || "E";
  const badgeConfig = ELIGIBILITY_BADGES[directRouteStatus] || ELIGIBILITY_BADGES.E;
  const BadgeIcon = badgeConfig.icon;

  const hasDeliveryConflict = vm.fourDimensions?.practicalFeasibility?.deliveryModeConflict;
  const routes = vm.suggestedRoutes?.length > 0 ? vm.suggestedRoutes : [];
  const nextAction = vm.nextAction || (vm.action ? { title: vm.action, time_range_hours: [2, 4] } : null);
  const formalBarriers = vm.formalBarriers || [];
  const skillGaps = vm.skillGaps || [];
  const sources = vm.sources || [];
  const milestones = vm.milestones || [];
  const selectedRoute = routes[selectedRouteIdx] || null;
  // Current backend contract stores timeline data in route.time and cost in
  // route.cost.estimate; older payloads may still use scalar legacy fields.
  const routeTimeline = selectedRoute
    ? formatGoalDisplayValue(
        selectedRoute.estimated_duration ??
        (selectedRoute.time && typeof selectedRoute.time === "object"
          ? selectedRoute.time.route_endpoint ?? selectedRoute.time.next_milestone
          : selectedRoute.time) ??
        selectedRoute.duration,
        ""
      )
    : "";
  const routeCost = selectedRoute
    ? formatGoalDisplayValue(selectedRoute.cost ?? selectedRoute.estimate, "")
    : "";
  const routeFlexibility = selectedRoute ? formatGoalDisplayValue(selectedRoute.flexibility, "") : "";
  const routeRisk = selectedRoute ? formatGoalDisplayValue(selectedRoute.risk, "") : "";

  const toggleSection = (sectionName) => {
    setExpandedSection(prev => prev === sectionName ? null : sectionName);
  };

  return (
    <div className="panel goal-feasibility-panel" role="region" aria-label="Current Career Goal and Feasibility">
      {/* 1. Header Banner: Career Ambition (Permanently Preserved) */}
      <div className="goal-banner-header">
        <div className="goal-banner-top">
          <div className="goal-kicker-tag">
            <Target size={13} className="text-brand" />
            <span>PRIMARY CAREER AMBITION</span>
          </div>
          <div className="goal-invariant-badge" title="User-Selected Ambition is permanently owned and never downgraded">
            <Sparkles size={12} className="text-indigo" />
            <span>Ambition Preserved &bull; User-Owned</span>
          </div>
        </div>

        <div className="goal-title-row">
          <h2 className="goal-display-name">{careerGoal}</h2>
          {isValidating && (
            <div className="goal-validating-badge">
              <span className="pulse-indicator" />
              <span>Evaluating live compatibility...</span>
            </div>
          )}
        </div>

        {careerInfo?.description && (
          <p className="goal-description-text">
            {careerInfo.description}
          </p>
        )}
      </div>

      {/* Validation loading skeleton */}
      {isValidating && !validationData && (
        <div className="goal-skeleton-container" aria-live="polite">
          <div className="skeleton-bar lg" />
          <div className="skeleton-bar md" />
          <div className="skeleton-grid-row">
            <div className="skeleton-card" />
            <div className="skeleton-card" />
            <div className="skeleton-card" />
          </div>
        </div>
      )}

      {/* Main Evaluated Dashboard (when data is ready) */}
      {validationData && (
        <div className="goal-evaluation-body">
          {/* Regulatory Delivery Mode Conflict Alert (e.g. Doctor + Online/Part-time study) */}
          {hasDeliveryConflict && (
            <div className="goal-regulatory-alert" role="alert">
              <div className="alert-icon-wrap">
                <ShieldAlert size={20} />
              </div>
              <div className="alert-content">
                <strong>Delivery Mode &amp; Regulatory Alignment Notice:</strong>
                <p>
                  {vm.fourDimensions?.practicalFeasibility?.obstacles?.[0] ||
                    "Under statutory National Medical Commission (NMC) regulations, clinical medical education (MBBS) cannot be completed online or part-time. Full-time, on-site laboratory and hospital training is mandatory."}
                </p>
              </div>
            </div>
          )}

          {/* 2. Formal Eligibility & Practical Feasibility Status Grid */}
          <div className="dimensions-summary-grid">
            {/* Dimension B: Formal Eligibility Card */}
            <div className="dimension-card formal-eligibility-card">
              <div className="dim-head">
                <span className="dim-label">FORMAL ELIGIBILITY</span>
                <span
                  className="status-badge-pill"
                  style={{
                    backgroundColor: badgeConfig.bg,
                    borderColor: badgeConfig.border,
                    color: badgeConfig.color
                  }}
                >
                  <BadgeIcon size={13} />
                  <span>{badgeConfig.label}</span>
                </span>
              </div>

              <div className="dim-decision-title">
                {vm.fourDimensions?.formalEligibility?.decision || "Standard Route Check"}
              </div>

              <p className="dim-reason-text">
                {vm.fourDimensions?.formalEligibility?.reason || vm.summary}
              </p>

              {formalBarriers.length > 0 && (
                <div className="dim-barriers-box">
                  <div className="dim-box-title">Key Regulatory Gates:</div>
                  <ul className="dim-list">
                    {formalBarriers.map((barrier, idx) => (
                      <li key={idx}>
                        <Info size={12} className="text-amber flex-shrink-0" />
                        <span>{barrier}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Dimension C & D: Readiness & Practical Feasibility Score Card */}
            <div className="dimension-card scores-card">
              <div className="dim-head">
                <span className="dim-label">READINESS &amp; FEASIBILITY</span>
                <span className="dim-version-tag">Engine v2.0</span>
              </div>

              <div className="score-rows">
                {/* Readiness Score */}
                <div className="score-row-item">
                  <div className="score-info">
                    <span className="score-title">Profile Readiness</span>
                    <span className="score-number">{vm.fourDimensions?.readiness?.score ?? 50}/100</span>
                  </div>
                  <div className="score-bar-track">
                    <div 
                      className="score-bar-fill readiness"
                      style={{ width: `${Math.min(100, Math.max(10, vm.fourDimensions?.readiness?.score ?? 50))}%` }}
                    />
                  </div>
                  <span className="score-caption">
                    {vm.fourDimensions?.readiness?.demonstratedSkills?.length || 0} demonstrated profile skills aligned
                  </span>
                </div>

                {/* Practical Feasibility Score */}
                <div className="score-row-item">
                  <div className="score-info">
                    <span className="score-title">Practical Feasibility</span>
                    <span className="score-number">{vm.fourDimensions?.practicalFeasibility?.score ?? 65}/100</span>
                  </div>
                  <div className="score-bar-track">
                    <div 
                      className={`score-bar-fill ${hasDeliveryConflict ? "warning" : "positive"}`}
                      style={{ width: `${Math.min(100, Math.max(10, vm.fourDimensions?.practicalFeasibility?.score ?? 65))}%` }}
                    />
                  </div>
                  <span className="score-caption">
                    {hasDeliveryConflict ? "On-site requirement mismatch identified" : "Compatible with schedule & study preferences"}
                  </span>
                </div>
              </div>

              {/* Quick Gap Counter */}
              <div className="gap-badges-row">
                <span className="gap-pill">
                  <strong>{skillGaps.length}</strong> Skill milestones
                </span>
                <span className="gap-pill">
                  <strong>{routes.length}</strong> Route options
                </span>
                {vm.fourDimensions?.formalEligibility?.bridgePossible && (
                  <span className="bridge-available-pill">
                    <Zap size={11} /> Legal bridge available
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 3. Next Best Action (Prominently Highlighted) */}
          {nextAction && (
            <div className="next-best-action-banner" role="region" aria-label="Next Best Action">
              <div className="action-banner-inner">
                <div className="action-icon-circle">
                  <Zap size={20} />
                </div>
                <div className="action-text-content">
                  <div className="action-kicker">RECOMMENDED NEXT BEST ACTION</div>
                  <h4 className="action-title">{nextAction.title}</h4>
                  {nextAction.rationale && (
                    <p className="action-rationale">{nextAction.rationale}</p>
                  )}
                </div>
                {nextAction.time_range_hours && (
                  <div className="action-time-pill" title="Estimated time to complete">
                    <Clock size={13} />
                    <span>{nextAction.time_range_hours[0]}–{nextAction.time_range_hours[1]} hrs</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. Actionable Skill Gaps & Prerequisites Breakdown */}
          {skillGaps.length > 0 && (
            <div className="skill-gaps-section">
              <div className="section-subheading">
                <Layers size={14} className="text-brand" />
                <span>IDENTIFIED SKILL MILESTONES &amp; PREREQUISITES</span>
              </div>
              <div className="gaps-chips-grid">
                {skillGaps.map((gap, idx) => (
                  <div key={idx} className="gap-chip-card">
                    <span className="gap-num">0{idx + 1}</span>
                    <span className="gap-name">{gap}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 5. Expandable Candidate Routes & Legal Bridge Comparison */}
          {routes.length > 0 && (
            <div className="expandable-panel-section">
              <button
                type="button"
                className="expandable-toggle-btn"
                onClick={() => toggleSection('routes')}
                aria-expanded={expandedSection === 'routes'}
              >
                <div className="toggle-left">
                  <Scale size={16} className="text-blue" />
                  <strong>Candidate Pathways &amp; Academic Bridges ({routes.length} routes)</strong>
                </div>
                <div className="toggle-right">
                  <span className="toggle-sub">Compare direct route vs NIOS/alternative bridges</span>
                  {expandedSection === 'routes' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {expandedSection === 'routes' && (
                <div className="routes-comparison-container">
                  {/* Route Selector Tabs */}
                  <div className="routes-tab-strip">
                    {routes.map((rt, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className={`route-tab-btn ${selectedRouteIdx === idx ? "active" : ""}`}
                        onClick={() => setSelectedRouteIdx(idx)}
                      >
                        <span className="rt-badge">{rt.route_type ? rt.route_type.replace('_', ' ') : `Route ${idx + 1}`}</span>
                        <span className="rt-label">{rt.label || rt.title}</span>
                      </button>
                    ))}
                  </div>

                  {/* Active Route Details */}
                  {routes[selectedRouteIdx] && (
                    <div className="route-detail-card">
                      <div className="route-detail-header">
                        <div>
                          <h4 className="route-detail-title">{formatGoalDisplayValue(routes[selectedRouteIdx].label || routes[selectedRouteIdx].title, `Route ${selectedRouteIdx + 1}`)}</h4>
                          <p className="route-detail-summary">{formatGoalDisplayValue(routes[selectedRouteIdx].summary, "")}</p>
                        </div>
                        {routes[selectedRouteIdx].feasibility_score && (
                          <div className="route-feasibility-pill">
                            <span>Feasibility:</span>
                            <strong>{routes[selectedRouteIdx].feasibility_score}/100</strong>
                          </div>
                        )}
                      </div>

                      <div className="route-parameters-grid">
                        {routeTimeline && (
                          <div className="param-item">
                            <span className="param-label">Estimated Timeline</span>
                            <span className="param-val">{routeTimeline}</span>
                          </div>
                        )}
                        {routeCost && (
                          <div className="param-item">
                            <span className="param-label">Financial Investment</span>
                            <span className="param-val">{routeCost}</span>
                          </div>
                        )}
                        {routeFlexibility && (
                          <div className="param-item">
                            <span className="param-label">Study Mode / Flexibility</span>
                            <span className="param-val">{routeFlexibility}</span>
                          </div>
                        )}
                        {routeRisk && (
                          <div className="param-item">
                            <span className="param-label">Considerations &amp; Risk</span>
                            <span className="param-val text-amber">{routeRisk}</span>
                          </div>
                        )}
                      </div>

                      {Array.isArray(routes[selectedRouteIdx].steps) && routes[selectedRouteIdx].steps.length > 0 && (
                        <div className="route-steps-sequence">
                          <div className="sequence-title">Action Sequence:</div>
                          <ol className="sequence-list">
                            {routes[selectedRouteIdx].steps.map((st, i) => (
                              <li key={i}>{formatGoalDisplayValue(st, "Step details unavailable")}</li>
                            ))}
                          </ol>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 6. Authoritative Sources and Regulatory Citations Accordion */}
          {sources.length > 0 && (
            <div className="expandable-panel-section">
              <button
                type="button"
                className="expandable-toggle-btn"
                onClick={() => toggleSection('sources')}
                aria-expanded={expandedSection === 'sources'}
              >
                <div className="toggle-left">
                  <ShieldCheck size={16} className="text-green" />
                  <strong>Authoritative Sources &amp; Statutory Citations ({sources.length} cited)</strong>
                </div>
                <div className="toggle-right">
                  <span className="toggle-sub">Verified legal rules &amp; eligibility gazettes</span>
                  {expandedSection === 'sources' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {expandedSection === 'sources' && (
                <div className="sources-container">
                  <div className="sources-grid">
                    {sources.map((src, idx) => (
                      <div key={idx} className="source-card">
                        <div className="source-authority">
                          <BookOpen size={13} className="text-blue" />
                          <strong>{formatGoalDisplayValue(src.authority, "Source authority")}</strong>
                        </div>
                        <div className="source-doc-name">{formatGoalDisplayValue(src.document, "Source document")}</div>
                        <div className="source-footer">
                          {src.review_date && (
                            <span className="source-date">Reviewed: {src.review_date}</span>
                          )}
                          {src.url && (
                            <a 
                              href={src.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="source-link"
                            >
                              <span>Official Gazette</span>
                              <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. Milestones Accordion */}
          {milestones.length > 0 && (
            <div className="expandable-panel-section">
              <button
                type="button"
                className="expandable-toggle-btn"
                onClick={() => toggleSection('milestones')}
                aria-expanded={expandedSection === 'milestones'}
              >
                <div className="toggle-left">
                  <Calendar size={16} className="text-indigo" />
                  <strong>Structured Pathway Milestones ({milestones.length})</strong>
                </div>
                <div className="toggle-right">
                  {expandedSection === 'milestones' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {expandedSection === 'milestones' && (
                <div className="milestones-timeline-container">
                  <div className="timeline-items">
                    {milestones.map((m, idx) => (
                      <div key={idx} className="timeline-item">
                        <div className="timeline-marker">{idx + 1}</div>
                        <div className="timeline-content">
                          <strong className="timeline-title">{formatGoalDisplayValue(m.title, `Milestone ${idx + 1}`)}</strong>
                          {m.target_weeks && (
                            <span className="timeline-time">{formatGoalDisplayValue(m.target_weeks, "")}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
