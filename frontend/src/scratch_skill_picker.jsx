function SkillPicker({ userSkillIds, selectedSkills = [], toggleSkill, careerGoal, educationContext }) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  const [activeTab, setActiveTab] = useState('recommended'); // 'recommended', 'all'
  const [selectedCategory, setSelectedCategory] = useState('');
  
  const [recommendedSkills, setRecommendedSkills] = useState([]);
  const [searchSkills, setSearchSkills] = useState([]);

  const [loadingRecs, setLoadingRecs] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [recsError, setRecsError] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Reset page when category changes
  useEffect(() => {
    setPage(1);
  }, [selectedCategory, activeTab]);

  useEffect(() => {
    if (!educationContext && !careerGoal) {
      setRecommendedSkills([]);
      if (activeTab === 'recommended') setActiveTab('all');
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setRecsError(null);
      setLoadingRecs(true);
      api.suggestSkills({ 
        education: educationContext || undefined, 
        career_goal: careerGoal || undefined 
      }, { signal: controller.signal })
        .then(res => setRecommendedSkills(unwrapList(res)))
        .catch((err) => {
          if (err.name === 'AbortError' || err.code === 'TIMEOUT') return;
          console.error("Failed to load skill suggestions:", err);
          setRecsError("Personalized suggestions are temporarily unavailable.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoadingRecs(false);
        });
    }, 800);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [careerGoal, educationContext]);

  useEffect(() => {
    if (activeTab !== 'all' && !debouncedQuery) return; // Only load search skills when in 'all' tab or when searching
    setLoadingSearch(true);
    api.skills({ search: debouncedQuery, category: selectedCategory, page, limit: 30 })
      .then(res => {
        const data = unwrapList(res);
        if (page === 1) setSearchSkills(data);
        else setSearchSkills(prev => [...prev, ...data]);
        setHasMore(res.pagination && page < res.pagination.total_pages);
      })
      .catch(() => { })
      .finally(() => setLoadingSearch(false));
  }, [debouncedQuery, page, selectedCategory, activeTab]);

  // If user types a query, automatically switch to "All Skills" to search everything
  useEffect(() => {
    if (debouncedQuery) setActiveTab('all');
  }, [debouncedQuery]);

  const displaySkills = activeTab === 'recommended' && !debouncedQuery ? recommendedSkills : searchSkills;
  
  const uniqueDisplaySkills = Array.from(new Map(displaySkills.map(sk => [sk.id || sk.name, sk])).values());
  const groups = { possessed: {}, recommended: {}, general: {} };
  
  for (const sk of uniqueDisplaySkills) {
    const cat = sk.category || "Other";
    if (activeTab === 'recommended' && !debouncedQuery) {
      const rel = sk.relationship === 'possessed' ? 'possessed' : 'recommended';
      if (!groups[rel][cat]) groups[rel][cat] = [];
      groups[rel][cat].push(sk);
    } else {
      if (!groups.general[cat]) groups.general[cat] = [];
      groups.general[cat].push(sk);
    }
  }

  // Predefined common categories for the filter
  const commonCategories = [
    'programming', 'frontend', 'backend', 'databases', 'cloud', 'AI', 'data_science',
    'finance', 'business', 'marketing', 'design', 'soft_skill', 'tools'
  ];

  return (
    <div className="skill-picker-container" style={{ marginTop: 12 }}>
      
      {/* Search and Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <div className="search-bar" style={{ position: 'relative' }}>
          <Search size={16} />
          <input
            placeholder="Search thousands of skills..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {(loadingRecs || loadingSearch) && <span className="muted" style={{ fontSize: 12, position: 'absolute', right: 12 }}>Loading...</span>}
        </div>
        
        <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
          <button 
            type="button" 
            className={`btn small ${activeTab === 'recommended' ? 'primary' : 'outline'}`} 
            onClick={() => { setActiveTab('recommended'); setQuery(''); }}
            disabled={!educationContext && !careerGoal}
          >
            Recommended for you
          </button>
          <button 
            type="button" 
            className={`btn small ${activeTab === 'all' ? 'primary' : 'outline'}`} 
            onClick={() => setActiveTab('all')}
          >
            All Skills Catalogue
          </button>
        </div>
      </div>

      {/* Selected Skills */}
      {selectedSkills.length > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--bg-light)', borderRadius: 8, border: '1px solid var(--line)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
             <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
               Your Selected Skills ({selectedSkills.length})
             </div>
          </div>
          <div className="chip-picker compact">
            {selectedSkills.map(sk => (
              <span
                key={sk.id || sk.skill_id}
                className="chip active"
                onClick={() => toggleSkill(sk)}
                style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {sk.name}
                <X size={12} />
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Category Filter for All Skills tab */}
      {activeTab === 'all' && !debouncedQuery && (
         <div style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
           <div style={{ display: 'flex', gap: 6, width: 'max-content' }}>
              <span 
                className={`chip ${!selectedCategory ? 'active' : ''}`}
                onClick={() => setSelectedCategory('')}
                style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px' }}
              >
                All Categories
              </span>
              {commonCategories.map(cat => (
                <span 
                  key={cat}
                  className={`chip ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                  style={{ cursor: 'pointer', fontSize: 12, padding: '2px 8px', textTransform: 'capitalize' }}
                >
                  {cat.replace('_', ' ')}
                </span>
              ))}
           </div>
         </div>
      )}

      {/* Error State */}
      {recsError && activeTab === 'recommended' && (
        <div style={{ padding: 12, background: "rgba(255, 165, 0, 0.1)", borderRadius: 6, marginBottom: 16 }}>
          <p style={{ color: "var(--brand)", fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertCircle size={16} /> {recsError}
          </p>
          <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 4 }}>
            Browse the full catalogue under "All Skills".
          </p>
        </div>
      )}

      {/* Empty State for Recommendations */}
      {activeTab === 'recommended' && uniqueDisplaySkills.length === 0 && !loadingRecs && !recsError && (
        <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-muted)' }}>
          No personalized recommendations found. Check the "All Skills" tab to browse.
        </div>
      )}

      {/* Recommended Tab Content */}
      {activeTab === 'recommended' && !debouncedQuery && uniqueDisplaySkills.length > 0 && !recsError && (
        <>
          {Object.keys(groups.possessed).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', marginBottom: 12 }}>
                Core Skills
              </div>
              {Object.entries(groups.possessed).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
                  <div className="chip-picker compact">
                    {skills.map(sk => {
                      const selected = userSkillIds.has(sk.id);
                      return (
                        <span
                          key={sk.id || sk.name}
                          className={`chip ${selected ? "active" : ""}`}
                          onClick={() => toggleSkill(sk)}
                          style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={sk.description || sk.name}
                        >
                          {sk.name}
                          {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                          {selected && <Check size={14} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {Object.keys(groups.recommended).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', marginBottom: 12 }}>
                Recommended to Learn
              </div>
              {Object.entries(groups.recommended).map(([cat, skills]) => (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
                  <div className="chip-picker compact">
                    {skills.map(sk => {
                      const selected = userSkillIds.has(sk.id);
                      return (
                        <span
                          key={sk.id || sk.name}
                          className={`chip ${selected ? "active" : ""}`}
                          onClick={() => toggleSkill(sk)}
                          style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          title={sk.description || sk.name}
                        >
                          {sk.name}
                          {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                          {selected && <Check size={14} />}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* All Skills Tab Content */}
      {activeTab === 'all' && (
        <>
          {Object.entries(groups.general).map(([cat, skills]) => (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 'bold', color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.replace('_', ' ')}</div>
              <div className="chip-picker compact">
                {skills.map(sk => {
                  const selected = userSkillIds.has(sk.id);
                  return (
                    <span
                      key={sk.id || sk.name}
                      className={`chip ${selected ? "active" : ""}`}
                      onClick={() => toggleSkill(sk)}
                      style={{ cursor: "pointer", display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      title={sk.description || sk.name}
                    >
                      {sk.name}
                      {sk.origin === 'ai_generated' && <Sparkles size={12} color="var(--brand)" title="AI Suggested" />}
                      {selected && <Check size={14} />}
                    </span>
                  );
                })}
              </div>
            </div>
          ))}

          {uniqueDisplaySkills.length === 0 && !loadingSearch && (
            <p className="muted" style={{ fontSize: 14 }}>No skills found matching your search.</p>
          )}

          {hasMore && (
            <button
              type="button"
              className="btn outline"
              style={{ width: '100%', marginTop: 8 }}
              onClick={() => setPage(p => p + 1)}
              disabled={loadingSearch}
            >
              {loadingSearch ? "Loading..." : "Load More"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
