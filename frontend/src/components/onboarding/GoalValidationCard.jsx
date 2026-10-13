import React, { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  CircleHelp,
  ShieldAlert,
  Sparkles,
  Compass,
  GraduationCap,
  Scale,
  Clock,
  ArrowRight,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin,
  Calendar,
  AlertTriangle,
  BookOpen
} from "lucide-react";
import { getGoalValidationViewModel } from "../../utils/goalValidation.js";

const STATE_BADGES = {
  A: { label: "State A: Directly Eligible", color: "#16a34a", bg: "rgba(22, 163, 74, 0.12)", border: "#86efac" },
  B: { label: "State B: Conditionally Eligible", color: "#ca8a04", bg: "rgba(202, 138, 4, 0.12)", border: "#fde047" },
  C: { label: "State C: Alternative Route Available", color: "#2563eb", bg: "rgba(37, 99, 235, 0.12)", border: "#93c5fd" },
  D: { label: "State D: Direct Route Restricted", color: "#dc2626", bg: "rgba(220, 38, 38, 0.12)", border: "#fca5a5" },
  E: { label: "State E: Verification Pending", color: "#4b5563", bg: "rgba(107, 114, 128, 0.12)", border: "#d1d5db" }
};

export default function GoalValidationCard({ data }) {
  if (!data) return null;
  const vm = getGoalValidationViewModel(data);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "dimensions" | "routes" | "plan"
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  const stateBadge = STATE_BADGES[vm.directRouteStatus] || STATE_BADGES.E;
  const hasDeliveryConflict = vm.fourDimensions?.practicalFeasibility?.deliveryModeConflict;

  const routes = vm.suggestedRoutes && vm.suggestedRoutes.length > 0
    ? vm.suggestedRoutes
    : [];

  return (
    <div
      className="feasibility-engine-card"
      role="region"
      aria-label="Goal Feasibility and Validation Assessment"
      style={{
        marginTop: 18,
        borderRadius: 12,
        border: "1px solid rgba(226, 232, 240, 0.9)",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.06), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      }}
    >
      {/* Top Banner / Verdict Bar */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
          background: hasDeliveryConflict
            ? "linear-gradient(135deg, rgba(254, 243, 199, 0.5) 0%, rgba(254, 226, 226, 0.4) 100%)"
            : vm.tone === "positive"
              ? "linear-gradient(135deg, rgba(220, 252, 231, 0.5) 0%, rgba(240, 253, 244, 0.3) 100%)"
              : "linear-gradient(135deg, rgba(241, 245, 249, 0.7) 0%, rgba(248, 250, 252, 0.5) 100%)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: hasDeliveryConflict ? "rgba(220, 38, 38, 0.12)" : vm.tone === "positive" ? "rgba(22, 163, 74, 0.12)" : "rgba(100, 116, 139, 0.12)",
              color: hasDeliveryConflict ? "#b91c1c" : vm.tone === "positive" ? "#15803d" : "#475569"
            }}
          >
            {hasDeliveryConflict ? <AlertTriangle size={20} /> : vm.tone === "positive" ? <CheckCircle2 size={20} /> : <Compass size={20} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                {vm.title}
              </span>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: 6,
                  border: `1px solid ${stateBadge.border}`,
                  background: stateBadge.bg,
                  color: stateBadge.color
                }}
              >
                {stateBadge.label}
              </span>
            </div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
              Ambition destination preserved: <strong style={{ color: "#0f172a" }}>{vm.goal}</strong>
              {vm.ruleVerification && <span> &bull; Rule engine v2.0</span>}
            </div>
          </div>
        </div>

        {/* User Ambition Invariant Tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.05)",
            border: "1px solid rgba(15, 23, 42, 0.08)",
            fontSize: 11,
            color: "#334155"
          }}
        >
          <Sparkles size={12} style={{ color: "#6366f1" }} />
          <span>User-Owned Ambition (Never Downgraded)</span>
        </div>
      </div>

      {/* Critical Study-Mode & Regulatory Alert (Doctor + Online/Remote case) */}
      {hasDeliveryConflict && (
        <div
          style={{
            margin: "14px 20px 0",
            padding: "12px 16px",
            borderRadius: 8,
            border: "1px solid rgba(239, 68, 68, 0.3)",
            background: "rgba(254, 242, 242, 0.8)",
            color: "#991b1b",
            fontSize: 13,
            lineHeight: 1.5,
            display: "flex",
            alignItems: "flex-start",
            gap: 10
          }}
        >
          <ShieldAlert size={18} style={{ flexShrink: 0, marginTop: 2, color: "#dc2626" }} />
          <div>
            <strong style={{ display: "block", marginBottom: 2 }}>Delivery Mode Conflict Identified:</strong>
            {vm.fourDimensions?.practicalFeasibility?.obstacles?.[0] ||
              "Under National Medical Commission (NMC) regulations, medical education (MBBS) and clinical rotations CANNOT be completed online or part-time. Full-time, on-site hospital training is legally required."}
          </div>
        </div>
      )}

      {/* Interactive Tabs Header */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(226, 232, 240, 0.8)",
          padding: "0 20px",
          background: "#f8fafc",
          marginTop: hasDeliveryConflict ? 14 : 0
        }}
      >
        {[
          { id: "overview", label: "Executive Summary", icon: Compass },
          { id: "dimensions", label: "Four Dimensions", icon: Layers },
          { id: "routes", label: `Candidate Routes (${routes.length})`, icon: Scale },
          { id: "plan", label: "Next Actions & Sources", icon: Calendar }
        ].map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 14px",
                border: "none",
                background: "transparent",
                borderBottom: isActive ? "2px solid #2563eb" : "2px solid transparent",
                color: isActive ? "#2563eb" : "#64748b",
                fontWeight: isActive ? 600 : 500,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <IconComponent size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Executive Summary */}
      {activeTab === "overview" && (
        <div style={{ padding: "18px 20px" }}>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, lineHeight: 1.6, color: "#334155" }}>
            {vm.summary}
          </p>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 12,
              marginBottom: 16
            }}
          >
            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Direct Route Status</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: stateBadge.color, marginTop: 4 }}>
                {stateBadge.label.split(":")[1] || stateBadge.label}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{vm.fourDimensions?.formalEligibility?.decision || "Standard check"}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Readiness Score</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginTop: 4 }}>
                {vm.fourDimensions?.readiness?.score ?? 50}/100
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {vm.fourDimensions?.readiness?.demonstratedSkills?.length || 0} demonstrated skills
              </div>
            </div>

            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase" }}>Practical Feasibility</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: hasDeliveryConflict ? "#dc2626" : "#16a34a", marginTop: 4 }}>
                {vm.fourDimensions?.practicalFeasibility?.score ?? 65}/100
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                {hasDeliveryConflict ? "On-site requirement mismatch" : "Compatible with schedule"}
              </div>
            </div>
          </div>

          {/* Immediate Next Step Card */}
          {vm.nextAction && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                background: "linear-gradient(135deg, rgba(238, 242, 255, 0.6) 0%, rgba(224, 231, 255, 0.4) 100%)",
                border: "1px solid rgba(199, 210, 254, 0.8)",
                display: "flex",
                alignItems: "flex-start",
                gap: 12
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "#4f46e5",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <ArrowRight size={16} />
              </div>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4f46e5", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Recommended First Step (Sized to your schedule)
                </span>
                <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 600, color: "#1e1b4b" }}>
                  {vm.nextAction.title}
                </p>
                {vm.nextAction.time_range_hours && (
                  <span style={{ display: "inline-block", fontSize: 11, color: "#6366f1", marginTop: 4 }}>
                    <Clock size={11} style={{ display: "inline", verticalAlign: "-1px", marginRight: 3 }} />
                    Estimated commitment: {vm.nextAction.time_range_hours[0]}–{vm.nextAction.time_range_hours[1]} hours
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Four Dimensions Independent Evaluation */}
      {activeTab === "dimensions" && (
        <div style={{ padding: "18px 20px", display: "grid", gap: 14 }}>
          {/* Dimension A: Ambition */}
          <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", textTransform: "uppercase" }}>Dimension A: Goal and Ambition</span>
              <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#dbeafe", color: "#1e40af" }}>User Owned</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155" }}>
              Target Goal: <strong>{vm.fourDimensions.ambition.goal}</strong> ({vm.fourDimensions.ambition.goalType})
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
              Invariant: Your selected career destination is permanently preserved. NaviGoa does not downgrade or discard goals.
            </p>
          </div>

          {/* Dimension B: Formal Eligibility */}
          <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: stateBadge.color, textTransform: "uppercase" }}>Dimension B: Formal Eligibility</span>
              <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 4, background: stateBadge.bg, color: stateBadge.color, fontWeight: 600 }}>
                {stateBadge.label}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#334155", fontWeight: 500 }}>
              {vm.fourDimensions.formalEligibility.decision}
            </p>
            {vm.fourDimensions.formalEligibility.reason && (
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#475569" }}>
                {vm.fourDimensions.formalEligibility.reason}
              </p>
            )}

            {vm.fourDimensions.formalEligibility.mandatoryGates.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a" }}>Statutory & Mandatory Gates:</span>
                <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#475569" }}>
                  {vm.fourDimensions.formalEligibility.mandatoryGates.map((gate, i) => (
                    <li key={`gate-${i}`}>{gate}</li>
                  ))}
                </ul>
              </div>
            )}

            {vm.fourDimensions.formalEligibility.citedAuthorities.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>
                Statutory Authorities: {vm.fourDimensions.formalEligibility.citedAuthorities.join(", ")}
              </div>
            )}
          </div>

          {/* Dimension C: Readiness */}
          <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0d9488", textTransform: "uppercase" }}>Dimension C: Readiness</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>Score: {vm.fourDimensions.readiness.score}/100</span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#334155" }}>
              Demonstrated Skills: {vm.fourDimensions.readiness.demonstratedSkills.length > 0 ? vm.fourDimensions.readiness.demonstratedSkills.join(", ") : "None verified in profile yet"}
            </p>
            {vm.fourDimensions.readiness.confirmedGaps.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a" }}>Gaps to Address:</span>
                <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#475569" }}>
                  {vm.fourDimensions.readiness.confirmedGaps.map((gap, i) => (
                    <li key={`gap-${i}`}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Dimension D: Practical Feasibility */}
          <div style={{ padding: 14, borderRadius: 8, border: "1px solid #e2e8f0", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: hasDeliveryConflict ? "#dc2626" : "#16a34a", textTransform: "uppercase" }}>
                Dimension D: Practical Feasibility
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: hasDeliveryConflict ? "#dc2626" : "#16a34a" }}>
                Score: {vm.fourDimensions.practicalFeasibility.score}/100
              </span>
            </div>

            {hasDeliveryConflict ? (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#b91c1c", fontWeight: 500 }}>
                Study Mode Conflict: Selected mode (Online / Part-time) is not legally permitted for clinical medical degrees.
              </p>
            ) : (
              <p style={{ margin: "6px 0 0", fontSize: 12.5, color: "#15803d" }}>
                Schedule & study mode appear compatible with the selected target direction.
              </p>
            )}

            {vm.fourDimensions.practicalFeasibility.obstacles.length > 0 && (
              <div style={{ marginTop: 6 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: "#0f172a" }}>Practical Constraints Identified:</span>
                <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12, color: "#475569" }}>
                  {vm.fourDimensions.practicalFeasibility.obstacles.map((obs, i) => (
                    <li key={`obs-${i}`}>{obs}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Candidate Routes Comparison Table / Cards */}
      {activeTab === "routes" && (
        <div style={{ padding: "18px 20px" }}>
          {routes.length === 0 ? (
            <p style={{ fontSize: 13, color: "#64748b" }}>No candidate routes generated yet.</p>
          ) : (
            <div>
              {/* Route Selector Pills */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                {routes.map((r, idx) => (
                  <button
                    key={`route-btn-${idx}`}
                    type="button"
                    onClick={() => setSelectedRouteIdx(idx)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 20,
                      border: selectedRouteIdx === idx ? "1px solid #2563eb" : "1px solid #cbd5e1",
                      background: selectedRouteIdx === idx ? "#eff6ff" : "#fff",
                      color: selectedRouteIdx === idx ? "#1d4ed8" : "#475569",
                      fontWeight: selectedRouteIdx === idx ? 600 : 500,
                      fontSize: 12,
                      cursor: "pointer"
                    }}
                  >
                    Route {idx + 1}: {r.label || r.title}
                  </button>
                ))}
              </div>

              {/* Selected Route Detailed Card */}
              {routes[selectedRouteIdx] && (() => {
                const sel = routes[selectedRouteIdx];
                return (
                  <div style={{ padding: 16, borderRadius: 10, border: "1px solid #cbd5e1", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                      <h5 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
                        {sel.label || sel.title}
                      </h5>
                      <span style={{ fontSize: 11, padding: "3px 8px", borderRadius: 4, background: "#f1f5f9", color: "#475569", fontWeight: 600 }}>
                        {sel.route_type || "candidate_path"}
                      </span>
                    </div>

                    <p style={{ margin: "8px 0 12px", fontSize: 13, lineHeight: 1.5, color: "#334155" }}>
                      {sel.summary}
                    </p>

                    {/* Trade-Offs Grid */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                        gap: 10,
                        background: "#f8fafc",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                        marginBottom: 12
                      }}
                    >
                      <div>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Time to Milestone:</span>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>
                          {sel.time?.next_milestone || sel.time_to_milestone || "2–4 weeks"}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Total Duration:</span>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>
                          {sel.time?.route_endpoint || sel.estimated_duration || "Not estimated"}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Cost Estimate:</span>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>
                          {sel.cost?.estimate || sel.cost || "Standard"}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Flexibility:</span>
                        <div style={{ fontSize: 12, fontWeight: 500, color: "#0f172a" }}>
                          {sel.flexibility || "Standard"}
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Risk & Caveats:</span>
                        <div style={{ fontSize: 12, color: "#b45309" }}>
                          {sel.risk || "Standard admission/hiring competition"}
                        </div>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>Exit Points:</span>
                        <div style={{ fontSize: 12, color: "#334155" }}>
                          {sel.exit_points || "Skills transferable to adjacent industries"}
                        </div>
                      </div>
                    </div>

                    {/* Steps in Route */}
                    {Array.isArray(sel.steps) && sel.steps.length > 0 && (
                      <div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: "#0f172a" }}>Key Route Steps:</span>
                        <ol style={{ margin: "4px 0 0 18px", padding: 0, fontSize: 12.5, color: "#334155" }}>
                          {sel.steps.map((st, si) => (
                            <li key={`step-${si}`} style={{ marginBottom: 4 }}>{st}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Concrete Actions, Milestones & Official Citations */}
      {activeTab === "plan" && (
        <div style={{ padding: "18px 20px" }}>
          {/* Milestones timeline */}
          {vm.milestones && vm.milestones.length > 0 ? (
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>
                Sequential Milestones:
              </span>
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {vm.milestones.map((ms, idx) => (
                  <div
                    key={`ms-${idx}`}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 12px",
                      borderRadius: 6,
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: 12.5
                    }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        background: "#e2e8f0",
                        color: "#475569",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700
                      }}
                    >
                      {ms.order || idx + 1}
                    </span>
                    <span style={{ flex: 1, color: "#1e293b", fontWeight: 500 }}>{ms.title}</span>
                    {ms.target_weeks && (
                      <span style={{ fontSize: 11, color: "#64748b" }}>{ms.target_weeks}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : vm.nextSteps && vm.nextSteps.length > 0 ? (
            <div style={{ marginBottom: 18 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", textTransform: "uppercase" }}>
                Recommended Actions:
              </span>
              <ul style={{ margin: "6px 0 0 18px", fontSize: 12.5, color: "#334155" }}>
                {vm.nextSteps.map((ns, i) => (
                  <li key={`ns-${i}`} style={{ marginBottom: 4 }}>{ns}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Official Citations */}
          {vm.sources && vm.sources.length > 0 && (
            <div style={{ padding: 12, borderRadius: 8, background: "#f8fafc", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                <BookOpen size={13} /> Authoritative Statutory Sources Consulted:
              </span>
              <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
                {vm.sources.map((src, i) => (
                  <div key={`src-${i}`} style={{ fontSize: 12, color: "#334155" }}>
                    &bull; <strong>{src.authority}</strong>: {src.document}
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ marginLeft: 6, color: "#2563eb", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 2 }}
                      >
                        Official Notice <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p style={{ margin: "14px 0 0", fontSize: 11, color: "#94a3b8" }}>
            Disclaimer: NaviGoa provides educational decision-support. Formal admissions, licensing, and employment are governed exclusively by respective statutory authorities and institutions.
          </p>
        </div>
      )}
    </div>
  );
}
