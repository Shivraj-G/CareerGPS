import React, { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Compass,
  AlertTriangle,
  HelpCircle,
  ShieldCheck,
  Zap,
  RefreshCw,
  BookOpen,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getGoalValidationViewModel, formatGoalDisplayValue } from "../../utils/goalValidation.js";

const ELIGIBILITY_BADGES = {
  A: {
    label: "State A: Directly Eligible",
    sub: "Direct statutory route is open based on verified profile qualifications.",
    color: "#15803d",
    bg: "rgba(22, 163, 74, 0.08)",
    border: "rgba(22, 163, 74, 0.3)",
    icon: CheckCircle2
  },
  B: {
    label: "State B: Milestone / Condition Pending",
    sub: "One prerequisite milestone or qualifying test needs to be completed.",
    color: "#ca8a04",
    bg: "rgba(202, 138, 4, 0.08)",
    border: "rgba(202, 138, 4, 0.3)",
    icon: Clock
  },
  C: {
    label: "State C: Alternative Route Available",
    sub: "Direct entry has barriers, but viable alternative or lateral transition routes exist.",
    color: "#087F8C",
    bg: "rgba(8, 127, 140, 0.08)",
    border: "rgba(8, 127, 140, 0.3)",
    icon: Compass
  },
  D: {
    label: "State D: Direct Route Restricted",
    sub: "Statutory prerequisites restrict this exact route; legal academic bridge required.",
    color: "#c2410c",
    bg: "rgba(194, 65, 12, 0.08)",
    border: "rgba(194, 65, 12, 0.3)",
    icon: AlertTriangle
  },
  E: {
    label: "State E: Prerequisite Verification Required",
    sub: "Goal recognized; statutory requirements need to be verified against specific profile facts.",
    color: "#475569",
    bg: "rgba(71, 85, 105, 0.08)",
    border: "rgba(71, 85, 105, 0.3)",
    icon: HelpCircle
  }
};

export default function OnboardingGoalFeasibilityCard({
  validationData,
  isValidating = false,
  careerGoal = "",
  validationError = null,
  onRetry,
  onReset
}) {
  const [showAllRoutes, setShowAllRoutes] = useState(false);

  // Loading State
  if (isValidating) {
    return (
      <div
        className="onboarding-goal-card loading"
        style={{
          marginTop: 16,
          padding: "20px 24px",
          borderRadius: 12,
          border: "1px solid rgba(8, 127, 140, 0.25)",
          background: "#F7F9F7",
          display: "flex",
          alignItems: "center",
          gap: 14
        }}
        aria-live="polite"
      >
        <RefreshCw size={20} className="spinning text-brand" style={{ animation: "spin 1.5s linear infinite" }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#18312B" }}>
            Evaluating Career Feasibility...
          </div>
          <div style={{ fontSize: "0.85rem", color: "#475569", marginTop: 2 }}>
            Checking formal eligibility criteria, education prerequisites, and statutory routes for "{careerGoal.trim()}".
          </div>
        </div>
      </div>
    );
  }

  // Network / Service Error State
  if (validationError) {
    return (
      <div
        className="onboarding-goal-card error"
        style={{
          marginTop: 16,
          padding: "20px 24px",
          borderRadius: 12,
          border: "1px solid rgba(220, 38, 38, 0.3)",
          background: "rgba(220, 38, 38, 0.04)"
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <AlertTriangle size={20} color="#dc2626" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: "0 0 4px", color: "#991b1b", fontSize: "0.95rem", fontWeight: 600 }}>
              Evaluation Service Temporarily Unavailable
            </h4>
            <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#475569" }}>
              {typeof validationError === "string" ? validationError : "Could not connect to the career validation engine. Your entered goal remains saved."}
            </p>
            {onRetry && (
              <button
                type="button"
                className="btn outline sm"
                onClick={onRetry}
                style={{ fontSize: "0.8rem", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <RefreshCw size={13} /> Retry Evaluation
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No Data Yet
  if (!validationData) return null;

  const vm = getGoalValidationViewModel(validationData);
  const statusKey = vm.directRouteStatus || "E";
  const badge = ELIGIBILITY_BADGES[statusKey] || ELIGIBILITY_BADGES.E;
  const BadgeIcon = badge.icon;

  const mandatoryGates = vm.fourDimensions?.formalEligibility?.mandatoryGates || [];
  const routes = vm.suggestedRoutes || [];
  const nextAction = vm.nextAction;
  const sources = vm.sources || [];
  const decisionText = vm.fourDimensions?.formalEligibility?.decision || "";

  return (
    <div
      className="onboarding-goal-card"
      style={{
        marginTop: 16,
        padding: "22px 24px",
        borderRadius: 12,
        border: `1.5px solid ${badge.border}`,
        background: "#FFFFFF",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}
    >
      {/* 1. Header Badge */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              borderRadius: 20,
              background: badge.bg,
              border: `1px solid ${badge.border}`,
              color: badge.color,
              fontWeight: 700,
              fontSize: "0.85rem",
              letterSpacing: "0.01em"
            }}
          >
            <BadgeIcon size={16} />
            <span>{badge.label}</span>
          </div>

          {vm.fourDimensions?.readiness?.score > 0 && (
            <span style={{ fontSize: "0.8rem", color: "#64748b", fontWeight: 500 }}>
              Readiness: {vm.fourDimensions.readiness.score}%
            </span>
          )}
        </div>

        {sources.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.78rem", color: "#475569", background: "rgba(8, 127, 140, 0.06)", padding: "3px 8px", borderRadius: 6 }}>
            <ShieldCheck size={14} color="#087F8C" />
            <span>{sources[0].authority || "Verified Authority"}</span>
          </div>
        )}
      </div>

      {/* 2. Decision & Human-readable Explanation */}
      {decisionText && decisionText !== "Verification Pending" && (
        <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#18312B", marginBottom: 6 }}>
          {decisionText}
        </div>
      )}

      <p style={{ margin: "0 0 16px", fontSize: "0.88rem", lineHeight: 1.55, color: "#334155" }}>
        {vm.summary}
      </p>

      {/* 3. Mandatory Statutory Gates / Prerequisites */}
      {mandatoryGates.length > 0 && (
        <div style={{ marginBottom: 16, background: "#F7F9F7", padding: "12px 16px", borderRadius: 8, border: "1px solid rgba(21, 61, 50, 0.08)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem", fontWeight: 700, color: "#153D32", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
            <BookOpen size={14} color="#153D32" />
            <span>Formal Education & Route Prerequisites</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: "0.83rem", color: "#334155", lineHeight: 1.5 }}>
            {mandatoryGates.slice(0, 4).map((gate, idx) => (
              <li key={`gate-${idx}`} style={{ marginBottom: 4 }}>{gate}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 4. Actionable Next Step Box */}
      {nextAction?.title && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            borderRadius: 8,
            background: "rgba(39, 103, 73, 0.06)",
            border: "1px solid rgba(39, 103, 73, 0.2)",
            display: "flex",
            alignItems: "flex-start",
            gap: 10
          }}
        >
          <Zap size={18} color="#276749" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#276749", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                Recommended Immediate Next Step
              </span>
              {nextAction.time_range_hours && (
                <span style={{ fontSize: "0.75rem", background: "rgba(39, 103, 73, 0.12)", color: "#153D32", padding: "2px 6px", borderRadius: 4, fontWeight: 600 }}>
                  ~{nextAction.time_range_hours[0]}–{nextAction.time_range_hours[1]} hrs
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.86rem", fontWeight: 600, color: "#18312B", marginTop: 3 }}>
              {nextAction.title}
            </div>
            {nextAction.rationale && (
              <div style={{ fontSize: "0.8rem", color: "#475569", marginTop: 2 }}>
                {nextAction.rationale}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. Candidate Routes & Bridge Options */}
      {routes.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#153D32", textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Available Routes & Alternatives ({routes.length})
            </span>
            {routes.length > 1 && (
              <button
                type="button"
                onClick={() => setShowAllRoutes(s => !s)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#087F8C",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: 0
                }}
              >
                {showAllRoutes ? "Show less" : "Compare all routes"}
                {showAllRoutes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {(showAllRoutes ? routes : routes.slice(0, 1)).map((route, idx) => {
              const routeDuration = formatGoalDisplayValue(
                route.estimated_duration || route.time?.route_endpoint || route.duration,
                "Structured duration"
              );
              return (
                <div
                  key={route.id || `route-${idx}`}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: idx === 0 ? "rgba(8, 127, 140, 0.03)" : "#ffffff",
                    fontSize: "0.82rem"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: "#18312B" }}>{route.label || route.title}</span>
                    <span style={{ fontSize: "0.75rem", background: "#f1f5f9", padding: "2px 6px", borderRadius: 4, color: "#475569" }}>
                      {routeDuration}
                    </span>
                  </div>
                  {route.summary && (
                    <div style={{ color: "#475569", lineHeight: 1.45, fontSize: "0.8rem" }}>
                      {route.summary}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {statusKey === 'D' && onReset && (
        <div style={{ marginTop: 14 }}>
          <button
            type="button"
            className="btn outline sm"
            onClick={onReset}
            style={{ fontSize: "0.8rem", padding: "6px 12px" }}
          >
            Change Career Goal
          </button>
        </div>
      )}
    </div>
  );
}
