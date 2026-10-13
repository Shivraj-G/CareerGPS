import React, { useState, useEffect } from "react";
import { 
  Search, 
  Sparkles, 
  Check, 
  X, 
  Plus, 
  Layers, 
  AlertCircle, 
  BookOpen, 
  Tag,
  Loader2,
  Trash2
} from "lucide-react";
import { api } from "../../api/client.js";
import { unwrapList, unwrapObject } from "../../utils/unwrap.js";
import { deduplicateSkillList } from "../../utils/skillCanonical.js";

const COMMON_CATEGORIES = [
  "programming", "healthcare", "data_science", "frontend", "backend", 
  "databases", "cloud", "AI", "finance", "business", "design", "tools", "soft_skill"
];

function skillKey(skill, scope = "skill") {
  const id = skill?.id ?? skill?.skill_id;
  const name = String(skill?.name ?? "unnamed-skill").trim().toLowerCase().replace(/\s+/g, "-");
  const category = String(skill?.category ?? "general").trim().toLowerCase().replace(/\s+/g, "-");
  return `${scope}:${id || `${name}:${category}`}`;
}

export default function SkillsInterestsPanel({
  userSkillIds = new Set(),
  userSkillLevels = {},
  selectedSkillsObjects = [],
  customSkills = [],
  allSkills = [],
  careerGoal = "",
  careerId = "",
  educationContext = "",
  onToggleSkill,
  onAddCustomSkill,
  onDeleteCustomSkill
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTab, setActiveTab] = useState("recommended"); // 'recommended' | 'all'
  const [selectedCategory, setSelectedCategory] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  const [recommendedSkills, setRecommendedSkills] = useState([]);
  const [searchSkills, setSearchSkills] = useState([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [recsError, setRecsError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  // When searching, auto-switch to "all" tab
  useEffect(() => {
    if (debouncedQuery) {
      setActiveTab("all");
    }
  }, [debouncedQuery]);

  // Fetch recommended skills whenever career goal, careerId, or education changes
  useEffect(() => {
    if (!educationContext && !careerGoal && !careerId) {
      setRecommendedSkills([]);
      if (activeTab === "recommended") setActiveTab("all");
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoadingRecs(true);
      setRecsError(null);
      api.suggestSkills({
        education: educationContext || undefined,
        career_goal: careerGoal || undefined,
        career_id: careerId || undefined
      }, { signal: controller.signal })
        .then(res => {
          if (!controller.signal.aborted) {
            const list = unwrapList(res);
            setRecommendedSkills(deduplicateSkillList(list, userSkillIds));
          }
        })
        .catch(err => {
          if (controller.signal.aborted || err.name === 'AbortError' || err.code === 'TIMEOUT' || err.code === 'CANCELLED') return;
          console.error("Skill suggestions failed:", err);
          setRecsError("Suggestions are temporarily limited. Browse the full catalogue.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingRecs(false);
        });
    }, 500);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [careerGoal, careerId, educationContext]);

  // Fetch search skills for "all" tab
  useEffect(() => {
    if (activeTab !== "all" && !debouncedQuery) return;
    setLoadingSearch(true);
    api.skills({
      search: debouncedQuery,
      category: selectedCategory || undefined,
      page,
      limit: 30
    })
      .then(res => {
        const data = unwrapList(res);
        if (page === 1) setSearchSkills(data);
        else setSearchSkills(prev => [...prev, ...data]);
        setHasMore(res.pagination && page < res.pagination.total_pages);
      })
      .catch(() => {})
      .finally(() => setLoadingSearch(false));
  }, [debouncedQuery, page, selectedCategory, activeTab]);

  // Find all currently selected skill objects (catalogue + recommendations + custom + fallback)
  const selectedSkills = Array.from(userSkillIds).map(id => {
    return allSkills.find(s => (s.id || s.skill_id) === id) 
      || recommendedSkills.find(s => (s.id || s.skill_id) === id)
      || customSkills.find(s => (s.id || s.skill_id) === id)
      || selectedSkillsObjects.find(s => (s.id || s.skill_id) === id);
  }).filter(Boolean);

  // Filter recommendations based on domain relevance
  const isDoctorGoal = careerGoal.toLowerCase().includes("doctor") || careerGoal.toLowerCase().includes("mbbs") || careerGoal.toLowerCase().includes("surgeon");

  // Separate recommendations into Core Goal Skills vs Supporting Skills
  const directRecommended = [];
  const supportingRecommended = [];

  for (const sk of deduplicateSkillList(recommendedSkills, userSkillIds)) {
    // If the goal is Doctor, exclude marketing/advertising platforms from core recommendations
    const catLower = (sk.category || "").toLowerCase();
    const nameLower = (sk.name || "").toLowerCase();
    const isMarketing = catLower.includes("marketing") || nameLower.includes("advertising") || nameLower.includes("seo");

    if (isDoctorGoal && isMarketing) {
      continue;
    }

    if (sk.relationship === "direct" || sk.is_core) {
      directRecommended.push(sk);
    } else {
      supportingRecommended.push(sk);
    }
  }

  // Handle adding custom skill
  async function handleCreateCustom(e) {
    e.preventDefault();
    if (!customInput.trim() || addingCustom) return;
    setAddingCustom(true);
    try {
      if (onAddCustomSkill) {
        await onAddCustomSkill(customInput.trim());
      }
      setCustomInput("");
    } catch (err) {
      console.error(err);
    } finally {
      setAddingCustom(false);
    }
  }

  return (
    <div className="skills-interests-panel panel" role="region" aria-label="Skills and Interests Management">
      <div className="panel-header-simple">
        <div className="panel-title-row">
          <div className="section-kicker">
            <Layers size={13} className="text-brand" /> SKILLS &amp; COMPETENCIES
          </div>
          <span className="selected-count-badge">
            <strong>{selectedSkills.length}</strong> Selected
          </span>
        </div>
        <p className="panel-subtext">
          Select relevant skills to improve career match accuracy, gap analysis, and personalized learning pathways.
        </p>
      </div>

      {/* 1. Selected Skills Box (Always visible at top) */}
      <div className="selected-skills-box" aria-label="Your Selected Skills">
        <div className="selected-box-header">
          <span className="selected-box-title">YOUR SELECTED SKILLS ({selectedSkills.length})</span>
          {selectedSkills.length === 0 && (
            <span className="selected-box-empty-hint">No skills added yet</span>
          )}
        </div>

        {selectedSkills.length > 0 ? (
          <div className="chip-picker compact selected-chips-list">
            {selectedSkills.map(sk => {
              const isCustom = sk.origin === "ai_generated" || sk.is_custom;
              // Check if user has non-medical skill under doctor goal
              const isCrossDomain = isDoctorGoal && (
                (sk.category || "").toLowerCase().includes("marketing") || 
                (sk.name || "").toLowerCase().includes("advertising")
              );

              return (
                <span
                  key={skillKey(sk, "selected")}
                  className={`chip active selected-chip ${isCrossDomain ? "cross-domain-chip" : ""}`}
                  onClick={() => onToggleSkill(sk)}
                  title={`${sk.name} ${isCrossDomain ? "(User-Selected Skill)" : ""} - Click to remove`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onToggleSkill(sk); }}
                >
                  <span className="chip-label">{sk.name}</span>
                  {isCrossDomain && (
                    <span className="chip-domain-tag">User Added</span>
                  )}
                  {isCustom && (
                    <Sparkles size={11} className="text-indigo" title="Custom Skill" />
                  )}
                  <X size={12} className="chip-remove-icon" />
                </span>
              );
            })}
          </div>
        ) : (
          <p className="selected-empty-message">
            Browse recommended skills below or search the catalogue to add your competencies.
          </p>
        )}
      </div>

      {/* 2. Search & Tab Strip */}
      <div className="skills-search-controls">
        <div className="search-bar skill-search-input-wrap">
          <Search size={15} className="search-icon" />
          <input
            placeholder="Search thousands of verified skills..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Search skills catalogue"
          />
          {(loadingRecs || loadingSearch) && (
            <Loader2 size={15} className="spin-icon search-loading-indicator" />
          )}
          {query && (
            <button 
              type="button" 
              className="search-clear-btn" 
              onClick={() => { setQuery(""); }}
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Tab Buttons */}
        <div className="skills-tab-strip">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'recommended' ? 'active' : ''}`}
            onClick={() => { setActiveTab('recommended'); setQuery(''); }}
            disabled={!educationContext && !careerGoal}
          >
            <Sparkles size={13} />
            <span>Recommended for You</span>
            {recommendedSkills.length > 0 && (
              <span className="tab-count-pill">{directRecommended.length + supportingRecommended.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            <BookOpen size={13} />
            <span>All Skills Catalogue</span>
          </button>
        </div>
      </div>

      {/* 3. Recommended Tab Content */}
      {activeTab === 'recommended' && !debouncedQuery && (
        <div className="recommended-tab-content">
          {recsError && (
            <div className="recs-alert-box" role="status">
              <AlertCircle size={15} />
              <span>{recsError}</span>
            </div>
          )}

          {loadingRecs && recommendedSkills.length === 0 && (
            <div className="skills-loading-container">
              <Loader2 size={20} className="spin-icon text-brand" />
              <span>Analyzing profile and pathway requirements...</span>
            </div>
          )}

          {!loadingRecs && directRecommended.length === 0 && supportingRecommended.length === 0 && !recsError && (
            <div className="recs-empty-state">
              <p>No specific skill recommendations found for your current goal. Browse the <strong>All Skills Catalogue</strong> to select your skills.</p>
            </div>
          )}

          {/* Core Goal Skills Group */}
          {directRecommended.length > 0 && (
            <div className="skills-group-block">
              <div className="group-heading-row">
                <span className="group-badge core">CORE GOAL SKILLS</span>
                <span className="group-sub">Essential competencies for {careerGoal || "your target role"}</span>
              </div>
              <div className="chip-picker compact">
                {directRecommended.map(sk => {
                  const isSelected = userSkillIds.has(sk.id);
                  return (
                    <button
                      key={skillKey(sk, "recommended-core")}
                      type="button"
                      className={`chip skill-action-chip ${isSelected ? "active" : ""}`}
                      onClick={() => onToggleSkill(sk)}
                      title={sk.description || sk.name}
                    >
                      <span>{sk.name}</span>
                      {isSelected ? <Check size={13} className="check-icon" /> : <Plus size={13} className="add-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Supporting & Domain Skills Group */}
          {supportingRecommended.length > 0 && (
            <div className="skills-group-block">
              <div className="group-heading-row">
                <span className="group-badge supporting">SUPPORTING &amp; TRANSFERABLE SKILLS</span>
                <span className="group-sub">Valuable domain and analytical capabilities</span>
              </div>
              <div className="chip-picker compact">
                {supportingRecommended.map(sk => {
                  const isSelected = userSkillIds.has(sk.id);
                  return (
                    <button
                      key={skillKey(sk, "recommended-supporting")}
                      type="button"
                      className={`chip skill-action-chip ${isSelected ? "active" : ""}`}
                      onClick={() => onToggleSkill(sk)}
                      title={sk.description || sk.name}
                    >
                      <span>{sk.name}</span>
                      {isSelected ? <Check size={13} className="check-icon" /> : <Plus size={13} className="add-icon" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. All Skills Catalogue Content */}
      {activeTab === 'all' && (
        <div className="all-skills-tab-content">
          {/* Category Filter Pills */}
          {!debouncedQuery && (
            <div className="category-filter-strip">
              <button
                type="button"
                className={`category-pill ${!selectedCategory ? "active" : ""}`}
                onClick={() => setSelectedCategory("")}
              >
                All Categories
              </button>
              {COMMON_CATEGORIES.map(cat => (
                <button
                  key={cat}
                  type="button"
                  className={`category-pill ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.replace("_", " ")}
                </button>
              ))}
            </div>
          )}

          {/* Skills Grid */}
          <div className="chip-picker compact all-skills-chips">
            {searchSkills.map(sk => {
              const isSelected = userSkillIds.has(sk.id);
              return (
                <button
                  key={skillKey(sk, "catalogue")}
                  type="button"
                  className={`chip skill-action-chip ${isSelected ? "active" : ""}`}
                  onClick={() => onToggleSkill(sk)}
                  title={sk.description || sk.name}
                >
                  <span>{sk.name}</span>
                  {isSelected ? <Check size={13} className="check-icon" /> : <Plus size={13} className="add-icon" />}
                </button>
              );
            })}
          </div>

          {searchSkills.length === 0 && !loadingSearch && (
            <div className="all-skills-empty">
              <p>No published skills matched "{debouncedQuery}". You can add it as a custom skill below.</p>
            </div>
          )}

          {hasMore && (
            <button
              type="button"
              className="btn outline load-more-skills-btn"
              onClick={() => setPage(p => p + 1)}
              disabled={loadingSearch}
            >
              {loadingSearch ? <Loader2 size={15} className="spin-icon" /> : "Load More Skills"}
            </button>
          )}
        </div>
      )}

      {/* 5. Add Custom Skill Form */}
      <form onSubmit={handleCreateCustom} className="custom-skill-form">
        <input
          placeholder="Can't find a skill? Add a custom skill..."
          value={customInput}
          onChange={e => setCustomInput(e.target.value)}
          aria-label="Custom skill name"
        />
        <button
          type="submit"
          className="btn small outline add-custom-btn"
          disabled={!customInput.trim() || addingCustom}
        >
          {addingCustom ? <Loader2 size={13} className="spin-icon" /> : <Plus size={13} />}
          <span>Add</span>
        </button>
      </form>
    </div>
  );
}
