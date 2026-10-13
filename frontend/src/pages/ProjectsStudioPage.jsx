import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  Award,
  Sparkles,
  Clock3,
  CheckCircle2,
  FolderGit2,
  ArrowRight,
  ExternalLink,
  Plus,
  Play,
  Pause,
  Archive,
  RotateCcw,
  ShieldCheck,
  Globe,
  SlidersHorizontal,
  Compass,
  FileCheck2,
  Copy,
  Check,
  AlertCircle,
  Eye,
  RefreshCw
} from 'lucide-react';
import { api, getToken } from '../api/client.js';
import { ProjectWorkspaceModal } from '../components/projects/ProjectWorkspaceModal.jsx';
import { formatSkillDisplayName, getSkillViewModel } from '../utils/skillDisplay.js';

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

function unwrapObject(data) {
  if (data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data;
  }
  return data ?? {};
}

export function ProjectsStudioPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const queryCareerId = searchParams.get('career') || '';
  const queryCareerTitle = searchParams.get('title') || '';
  const initialTab = searchParams.get('tab') || 'recommended';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedCareerId, setSelectedCareerId] = useState(queryCareerId);
  const [selectedCareerTitle, setSelectedCareerTitle] = useState(queryCareerTitle);
  const [careersList, setCareersList] = useState([]);

  // Recommendations state
  const [recommendations, setRecommendations] = useState([]);
  const [tierFilter, setTierFilter] = useState('all');
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);

  // My Projects state
  const [myProjects, setMyProjects] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [myProjectsLoading, setMyProjectsLoading] = useState(false);
  const [myProjectsError, setMyProjectsError] = useState(null);

  // Portfolio state
  const [portfolio, setPortfolio] = useState(null);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [portfolioError, setPortfolioError] = useState(null);
  const [portfolioSaving, setPortfolioSaving] = useState(false);
  const [portfolioSuccessMsg, setPortfolioSuccessMsg] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Editable portfolio fields
  const [portHeadline, setPortHeadline] = useState('');
  const [portBio, setPortBio] = useState('');
  const [portIsPublic, setPortIsPublic] = useState(false);
  const [portGithub, setPortGithub] = useState('');
  const [portLinkedin, setPortLinkedin] = useState('');
  const [portWebsite, setPortWebsite] = useState('');
  const [featuredProjectIds, setFeaturedProjectIds] = useState([]);

  // Active Workspace Modal
  const [workspaceProject, setWorkspaceProject] = useState(null);
  const [startingProjectId, setStartingProjectId] = useState(null);

  // Synchronize state when URL query parameters change
  useEffect(() => {
    if (queryCareerId && queryCareerId !== selectedCareerId) {
      setSelectedCareerId(queryCareerId);
    }
    if (queryCareerTitle && queryCareerTitle !== selectedCareerTitle) {
      setSelectedCareerTitle(queryCareerTitle);
    }
  }, [queryCareerId, queryCareerTitle]);

  // Fetch initial profile & careers catalogue to resolve default career
  useEffect(() => {
    async function loadInitialContext() {
      try {
        const [careersRes, profileRes] = await Promise.all([
          api.careers({ limit: 100 }).catch(() => ({ data: [] })),
          api.profile().catch(() => ({ data: {} }))
        ]);

        const list = unwrapList(careersRes);
        setCareersList(list);

        const prof = unwrapObject(profileRes);
        if (queryCareerId) {
          const match = list.find((c) => String(c.id) === String(queryCareerId));
          if (match && !queryCareerTitle) {
            setSelectedCareerTitle(match.title);
          }
        } else {
          if (prof.current_goal_career_id) {
            setSelectedCareerId(prof.current_goal_career_id);
            setSelectedCareerTitle(prof.current_goal || 'Current Goal');
          } else if (list.length > 0) {
            setSelectedCareerId(list[0].id);
            setSelectedCareerTitle(list[0].title);
          }
        }
      } catch (err) {
        console.error('Error loading careers context:', err);
      }
    }
    loadInitialContext();
  }, [queryCareerId, queryCareerTitle]);

  // Load recommended projects
  const loadRecommendations = useCallback(async (careerId, careerTitle, force = false) => {
    if (!careerId && !careerTitle) return;
    setRecLoading(true);
    setRecError(null);
    try {
      const res = await api.projectRecommendations({
        career_id: careerId || undefined,
        career_title: careerTitle || undefined,
        force_refresh: force ? 'true' : undefined
      });
      const rawProjects = res?.data?.projects || res?.projects || (Array.isArray(res?.data) ? res.data : []);
      const normalized = (Array.isArray(rawProjects) ? rawProjects : []).map(p => {
        const levelNum = Number(p.tier || p.difficulty_level) || (
          String(p.difficulty_label || p.difficulty || '').toLowerCase().includes('starter') ? 1 :
          String(p.difficulty_label || p.difficulty || '').toLowerCase().includes('practical') ? 2 :
          String(p.difficulty_label || p.difficulty || '').toLowerCase().includes('ready') || String(p.difficulty_label || p.difficulty || '').toLowerCase().includes('capstone') ? 3 : 1
        );
        return {
          ...p,
          tier: levelNum,
          difficulty_level: levelNum,
          estimated_hours: p.estimated_hours || (typeof p.estimated_effort === 'string' ? p.estimated_effort.replace(/[^0-9-]/g, '') : p.estimated_effort) || '8-12',
          skills: Array.isArray(p.skills) ? p.skills : (Array.isArray(p.skills_exercised) ? p.skills_exercised : [])
        };
      });
      setRecommendations(normalized);
    } catch (err) {
      setRecError(err.message || 'Unable to load project recommendations.');
    } finally {
      setRecLoading(false);
    }
  }, []);

  // Load user projects
  const loadMyProjects = useCallback(async () => {
    setMyProjectsLoading(true);
    setMyProjectsError(null);
    try {
      const res = await api.myProjects();
      const list = unwrapList(res);
      setMyProjects(list);
    } catch (err) {
      setMyProjectsError(err.message || 'Failed to load user projects.');
      console.error('Failed to load user projects:', err);
    } finally {
      setMyProjectsLoading(false);
    }
  }, []);

  // Load user portfolio
  const loadPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    setPortfolioError(null);
    try {
      const res = await api.myPortfolio();
      const p = unwrapObject(res);
      setPortfolio(p);
      setPortHeadline(p.headline || '');
      setPortBio(p.bio || '');
      setPortIsPublic(!!p.is_public);
      setPortGithub(p.social_links?.github || '');
      setPortLinkedin(p.social_links?.linkedin || '');
      setPortWebsite(p.social_links?.website || '');
      setFeaturedProjectIds(p.featured_project_ids || []);
    } catch (err) {
      setPortfolioError(err.message || 'Failed to load portfolio.');
      console.error('Failed to load portfolio:', err);
    } finally {
      setPortfolioLoading(false);
    }
  }, []);

  // Effect to load data based on selected career and active tab
  useEffect(() => {
    if (selectedCareerId || selectedCareerTitle) {
      loadRecommendations(selectedCareerId, selectedCareerTitle);
    }
  }, [selectedCareerId, selectedCareerTitle, loadRecommendations]);

  useEffect(() => {
    loadMyProjects();
    loadPortfolio();
  }, [loadMyProjects, loadPortfolio]);

  // Handle career dropdown change
  function handleCareerSelect(e) {
    const cid = e.target.value;
    const found = careersList.find((c) => String(c.id) === String(cid));
    setSelectedCareerId(cid);
    setSelectedCareerTitle(found ? found.title : '');
    setSearchParams({ career: cid, title: found ? found.title : '', tab: activeTab });
  }

  // Handle Start Project CTA
  async function handleStartProject(projectRec) {
    // Check if user already has this project started
    const existing = myProjects.find(
      (p) =>
        (p.career_project_id && p.career_project_id === projectRec.id) ||
        p.title.toLowerCase() === projectRec.title.toLowerCase()
    );

    if (existing) {
      setWorkspaceProject(existing);
      return;
    }

    setStartingProjectId(projectRec.id);
    try {
      const payload = {
        career_project_id: projectRec.id,
        project_title: projectRec.title,
        career_id: selectedCareerId || projectRec.career_id,
        career_title: selectedCareerTitle || projectRec.career_title,
        tier: projectRec.tier,
        step_by_step_tasks: projectRec.step_by_step_tasks || projectRec.tasks || [],
        brief: projectRec.brief,
        problemStatement: projectRec.problem_statement || projectRec.problemStatement,
        learningObjectives: projectRec.learning_objectives || projectRec.learningObjectives || [],
        prerequisites: projectRec.prerequisites || [],
        deliverables: projectRec.deliverables || [],
        acceptanceCriteria: projectRec.acceptance_criteria || projectRec.acceptanceCriteria || [],
        skills: projectRec.skills || [],
        starterTemplate: projectRec.starter_template || projectRec.starterTemplate || {},
        nextStep: projectRec.next_step || projectRec.nextStep
      };

      const res = await api.startProject(payload);
      const newProj = res.data;
      await loadMyProjects();
      setWorkspaceProject(newProj);
    } catch (err) {
      alert(err.message || 'Failed to start project.');
    } finally {
      setStartingProjectId(null);
    }
  }

  // Handle open existing workspace
  function handleOpenWorkspace(project) {
    setWorkspaceProject(project);
  }

  // Handle Save Portfolio
  async function handleSavePortfolio(e) {
    e.preventDefault();
    setPortfolioSaving(true);
    setPortfolioSuccessMsg('');
    try {
      const payload = {
        headline: portHeadline.trim() || undefined,
        bio: portBio.trim() || undefined,
        isPublic: portIsPublic,
        socialLinks: {
          github: portGithub.trim() || undefined,
          linkedin: portLinkedin.trim() || undefined,
          website: portWebsite.trim() || undefined
        },
        featuredProjectIds
      };
      const res = await api.updateMyPortfolio(payload);
      const updated = res.data;
      setPortfolio(updated);
      setPortfolioSuccessMsg('Portfolio settings saved successfully!');
      setTimeout(() => setPortfolioSuccessMsg(''), 4000);
    } catch (err) {
      alert(err.message || 'Failed to update portfolio settings.');
    } finally {
      setPortfolioSaving(false);
    }
  }

  function handleCopyShareLink() {
    if (!portfolio?.share_slug) return;
    const url = `${window.location.origin}/portfolio/p/${portfolio.share_slug}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  }

  // Filter recommendations by tier
  const filteredRecommendations = recommendations.filter((p) => {
    if (tierFilter === 'all') return true;
    return p.tier === Number(tierFilter);
  });

  // Filter user projects by status
  const filteredMyProjects = myProjects.filter((p) => {
    if (statusFilter === 'all') return true;
    return p.status === statusFilter;
  });

  const tierStyles = {
    1: { name: 'Level 1 — Starter', color: '#0284c7', bg: '#e0f2fe', desc: 'Focused deliverable practicing core foundational skills.' },
    2: { name: 'Level 2 — Practical', color: '#16a34a', bg: '#dcfce7', desc: 'Realistic multi-skill scenario producing a substantial artifact.' },
    3: { name: 'Level 3 — Career-Ready', color: '#7c3aed', bg: '#f3e8ff', desc: 'Capstone or professional case study demonstrating end-to-end capability.' }
  };

  const activeProjectsCount = myProjects.filter((p) => p.status === 'in_progress').length;
  const completedProjectsCount = myProjects.filter((p) => p.status === 'completed').length;
  const demonstratedSkillsCount = portfolio?.demonstrated_skills?.length || 0;

  return (
    <div className="projects-studio-wrap" style={{ maxWidth: 1400, margin: '0 auto', width: '100%' }}>
      {/* Page Header */}
      <div className="page-heading-row" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="section-kicker">POST-LEARNING STAGE</div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Apply Your Skills — Projects & Portfolio</h1>
          <p style={{ maxWidth: 780 }}>
            Translate what you learn into demonstrable evidence. Build practical deliverables, attach proof, and present verified work to reviewers and employers.
          </p>
        </div>

        {/* Target Career Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: '8px 14px' }}>
          <Compass size={18} color="var(--blue)" />
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase' }}>
              TARGET CAREER FOCUS
            </div>
            <select
              value={selectedCareerId}
              onChange={handleCareerSelect}
              style={{ border: 'none', background: 'transparent', fontWeight: 700, fontSize: 13, color: 'var(--ink)', outline: 'none', cursor: 'pointer' }}
            >
              {careersList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="tabs" style={{ marginTop: 10, marginBottom: 24 }}>
        <button
          className={`tab-link ${activeTab === 'recommended' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('recommended');
            setSearchParams({ career: selectedCareerId, title: selectedCareerTitle, tab: 'recommended' });
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Sparkles size={16} /> Recommended Projects ({recommendations.length})
        </button>
        <button
          className={`tab-link ${activeTab === 'my_projects' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('my_projects');
            setSearchParams({ career: selectedCareerId, title: selectedCareerTitle, tab: 'my_projects' });
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FolderGit2 size={16} /> My Projects ({myProjects.length})
        </button>
        <button
          className={`tab-link ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('portfolio');
            setSearchParams({ career: selectedCareerId, title: selectedCareerTitle, tab: 'portfolio' });
          }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Award size={16} /> Verified Portfolio ({completedProjectsCount} Completed)
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: RECOMMENDED PROJECTS                                   */}
      {/* ============================================================ */}
      {activeTab === 'recommended' && (
        <div>
          {/* Difficulty Level Tier Explainer / Filter */}
          <div className="project-tier-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 24 }}>
            {[1, 2, 3].map((tierNum) => {
              const info = tierStyles[tierNum];
              const isSelected = tierFilter === String(tierNum);
              return (
                <div
                  key={tierNum}
                  onClick={() => setTierFilter(isSelected ? 'all' : String(tierNum))}
                  style={{
                    background: '#fff',
                    border: `1.5px solid ${isSelected ? info.color : 'var(--line)'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 4px 14px rgba(37,99,235,0.08)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: info.color }}>
                      {info.name}
                    </span>
                    {isSelected && <Check size={14} color={info.color} />}
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {info.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Filter Bar */}
          <div className="project-filter-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div className="project-filter-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)' }}>FILTER BY LEVEL:</span>
              <button
                className={`btn small ${tierFilter === 'all' ? 'primary' : 'outline'}`}
                onClick={() => setTierFilter('all')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                All Levels
              </button>
              <button
                className={`btn small ${tierFilter === '1' ? 'primary' : 'outline'}`}
                onClick={() => setTierFilter('1')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Starter
              </button>
              <button
                className={`btn small ${tierFilter === '2' ? 'primary' : 'outline'}`}
                onClick={() => setTierFilter('2')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Practical
              </button>
              <button
                className={`btn small ${tierFilter === '3' ? 'primary' : 'outline'}`}
                onClick={() => setTierFilter('3')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Career-Ready
              </button>
            </div>

            <button
              className="btn outline small"
              onClick={() => loadRecommendations(selectedCareerId, selectedCareerTitle, true)}
              disabled={recLoading}
              title="Refresh project suggestions"
            >
              <RefreshCw size={13} className={recLoading ? 'rotating' : ''} /> Refresh Suggestions
            </button>
          </div>

          {/* Loading / Error States */}
          {recLoading && (
            <div className="empty-state loading-pulse" style={{ padding: 40 }}>
              <Clock3 size={28} />
              <h2>Curating Career Projects...</h2>
              <p>Analyzing pathway milestones, skill gaps, and practical deliverable scenarios.</p>
            </div>
          )}

          {recError && !recLoading && (
            <div className="empty-state" style={{ padding: 40 }}>
              <AlertCircle size={28} color="#ef4444" />
              <h2>Could Not Load Recommendations</h2>
              <p>{recError}</p>
              <button
                className="btn primary small"
                onClick={() => loadRecommendations(selectedCareerId, selectedCareerTitle, true)}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Projects Cards Grid */}
          {!recLoading && !recError && (
            <div className="project-recommendations-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 18 }}>
              {filteredRecommendations.map((project) => {
                const tier = tierStyles[project.tier] || tierStyles[1];
                const activeExisting = myProjects.find(
                  (p) =>
                    (p.career_project_id && p.career_project_id === project.id) ||
                    p.title.toLowerCase() === project.title.toLowerCase()
                );
                const isStarting = startingProjectId === project.id;
                const skillsArr = Array.isArray(project.skills) ? project.skills : [];

                return (
                  <div
                    key={project.id}
                    className="panel project-recommendation-card"
                    style={{
                      padding: 22,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      position: 'relative'
                    }}
                  >
                    <div>
                      {/* Top Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 9px',
                            borderRadius: 6,
                            color: tier.color,
                            backgroundColor: tier.bg
                          }}
                        >
                          {tier.name}
                        </span>
                        {project.estimated_hours && (
                          <span className="muted" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock3 size={13} /> {project.estimated_hours}h effort
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)', marginBottom: 8, lineHeight: 1.3 }}>
                        {project.title}
                      </h3>

                      {/* Brief */}
                      <p style={{ fontSize: 13, color: '#334155', lineHeight: 1.5, marginBottom: 12 }}>
                        {project.brief || project.description}
                      </p>

                      {/* Problem Statement snippet */}
                      {project.problem_statement && (
                        <div style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 6, marginBottom: 12 }}>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Real-World Problem:
                          </span>
                          <span style={{ fontSize: 12, color: '#1e293b' }}>
                            {project.problem_statement}
                          </span>
                        </div>
                      )}

                      {/* Skills Exercised Tags */}
                      <div style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                          Skills Exercised:
                        </span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {skillsArr.slice(0, 4).map((skill, sIdx) => {
                            const name = formatSkillDisplayName(skill);
                            const stableKey = typeof skill === 'object' ? (skill?.skill_id || skill?.id || sIdx) : sIdx;
                            return (
                              <span
                                key={stableKey}
                                style={{
                                  background: '#f1f5f9',
                                  color: '#334155',
                                  padding: '3px 8px',
                                  borderRadius: 5,
                                  fontSize: 11,
                                  fontWeight: 600
                                }}
                              >
                                {name}
                              </span>
                            );
                          })}
                          {skillsArr.length > 4 && (
                            <span style={{ fontSize: 11, color: 'var(--muted)', alignSelf: 'center' }}>
                              +{skillsArr.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action CTA */}
                    <div style={{ paddingTop: 14, borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {activeExisting ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="badge success" style={{ fontSize: 11 }}>
                            {activeExisting.status.replace('_', ' ')}
                          </span>
                        </div>
                      ) : (
                        <span className="muted" style={{ fontSize: 11 }}>
                          Prerequisites reviewed
                        </span>
                      )}

                      <button
                        className={`btn ${activeExisting ? 'outline' : 'primary'} small`}
                        onClick={() => handleStartProject(project)}
                        disabled={isStarting}
                      >
                        {isStarting ? (
                          'Starting...'
                        ) : activeExisting ? (
                          <>Open Workspace <ArrowRight size={13} /></>
                        ) : (
                          <>Start Project <Play size={13} /></>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredRecommendations.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1 / -1', padding: 40, textAlign: 'center' }}>
                  <Sparkles size={28} style={{ color: 'var(--blue)', marginBottom: 12 }} />
                  {recommendations.length > 0 ? (
                    <>
                      <h2>No projects match this difficulty filter</h2>
                      <p className="muted" style={{ maxWidth: 500, margin: '8px auto 16px' }}>
                        No projects at level {tierStyles[tierFilter]?.name || tierFilter} were found for {selectedCareerTitle || 'this career'}.
                      </p>
                      <button
                        className="btn primary small"
                        onClick={() => setTierFilter('all')}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        Show All Levels ({recommendations.length} Projects)
                      </button>
                    </>
                  ) : (
                    <>
                      <h2>No project recommendations found</h2>
                      <p className="muted" style={{ maxWidth: 500, margin: '8px auto 16px' }}>
                        No curated or generated project scenarios found for {selectedCareerTitle || 'this career'}. Try refreshing suggestions or choosing another career goal.
                      </p>
                      <button
                        className="btn primary small"
                        onClick={() => loadRecommendations(selectedCareerId, selectedCareerTitle, true)}
                        disabled={recLoading}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <RefreshCw size={13} className={recLoading ? 'rotating' : ''} /> {recLoading ? 'Generating Suggestions...' : 'Generate Suggestions'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MY PROJECTS (WORKSPACES)                              */}
      {/* ============================================================ */}
      {activeTab === 'my_projects' && (
        <div>
          {/* Progress Overview Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
            <div className="panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#eff6ff', color: 'var(--blue)', display: 'grid', placeItems: 'center' }}>
                <Play size={20} />
              </div>
              <div>
                <b style={{ fontSize: 20 }}>{activeProjectsCount}</b>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>Active In Progress</span>
              </div>
            </div>

            <div className="panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#ecfdf5', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <b style={{ fontSize: 20 }}>{completedProjectsCount}</b>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>Completed & Verified</span>
              </div>
            </div>

            <div className="panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 10, background: '#f3e8ff', color: '#7c3aed', display: 'grid', placeItems: 'center' }}>
                <Award size={20} />
              </div>
              <div>
                <b style={{ fontSize: 20 }}>{demonstratedSkillsCount}</b>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>Demonstrated Skills</span>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {['all', 'in_progress', 'paused', 'completed', 'archived'].map((st) => (
                <button
                  key={st}
                  className={`btn small ${statusFilter === st ? 'primary' : 'outline'}`}
                  onClick={() => setStatusFilter(st)}
                  style={{ textTransform: 'capitalize', fontSize: 12, padding: '6px 12px' }}
                >
                  {st.replace('_', ' ')}
                </button>
              ))}
            </div>

            <button
              className="btn outline small"
              onClick={() => setActiveTab('recommended')}
            >
              <Plus size={13} /> Find New Project
            </button>
          </div>

          {/* Loading / Error States */}
          {myProjectsLoading && (
            <div className="empty-state loading-pulse" style={{ padding: 40, textAlign: 'center' }}>
              <Clock3 size={28} />
              <h2>Loading Your Workspaces...</h2>
              <p>Retrieving your active workspaces, checklists, and submitted deliverables.</p>
            </div>
          )}

          {myProjectsError && !myProjectsLoading && (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <AlertCircle size={28} color="#ef4444" style={{ marginBottom: 10 }} />
              <h2>Could Not Load Your Projects</h2>
              <p className="muted" style={{ maxWidth: 460, margin: '8px auto 16px' }}>{myProjectsError}</p>
              <button
                className="btn primary small"
                onClick={loadMyProjects}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}

          {/* User Projects List */}
          {!myProjectsLoading && !myProjectsError && (
            <div style={{ display: 'grid', gap: 14 }}>
              {filteredMyProjects.map((proj) => {
              const tier = tierStyles[proj.tier] || tierStyles[1];
              const tasks = proj.tasks_progress || proj.step_by_step_tasks || proj.tasks || [];
              const doneTasks = tasks.filter((t) => t.completed).length;
              const progressPct = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
              const deliverablesCount = proj.deliverables?.length || 0;

              return (
                <div
                  key={proj.id}
                  className="panel"
                  style={{
                    padding: 20,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 16
                  }}
                >
                  <div style={{ flex: '1 1 340px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          padding: '2px 7px',
                          borderRadius: 4,
                          color: tier.color,
                          background: tier.bg
                        }}
                      >
                        {tier.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {proj.career_title}
                      </span>
                      <span
                        className={`status-pill ${
                          proj.status === 'completed'
                            ? 'open'
                            : proj.status === 'paused'
                            ? 'warning'
                            : proj.status === 'archived'
                            ? 'closed'
                            : 'upcoming'
                        }`}
                        style={{ textTransform: 'capitalize' }}
                      >
                        {proj.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: '4px 0 6px', color: 'var(--ink)' }}>
                      {proj.title}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'var(--muted)' }}>
                      <span>{doneTasks} of {tasks.length} checklist steps completed</span>
                      <span>•</span>
                      <span>{deliverablesCount} deliverable{deliverablesCount === 1 ? '' : 's'} attached</span>
                    </div>

                    {/* Progress Bar */}
                    <div className="progress" style={{ width: 220, height: 5, marginTop: 8 }}>
                      <i style={{ width: `${progressPct}%` }}></i>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="btn primary small"
                      onClick={() => handleOpenWorkspace(proj)}
                    >
                      Open Workspace <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              );
            })}

            {filteredMyProjects.length === 0 && (
              <div className="empty-state" style={{ padding: 40 }}>
                <FolderGit2 size={28} />
                <h2>No projects found in this view</h2>
                <p>
                  {statusFilter === 'all'
                    ? "You haven't started any projects yet. Pick a recommended deliverable to start practicing your skills."
                    : `You have no projects with status "${statusFilter.replace('_', ' ')}".`}
                </p>
                <button
                  className="btn primary small"
                  onClick={() => setActiveTab('recommended')}
                >
                  Explore Recommended Projects
                </button>
              </div>
            )}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 3: PORTFOLIO SHOWCASE & SETTINGS                         */}
      {/* ============================================================ */}
      {activeTab === 'portfolio' && (
        <div>
          {portfolioLoading && (
            <div className="empty-state loading-pulse" style={{ padding: 40, textAlign: 'center' }}>
              <Clock3 size={28} />
              <h2>Loading Your Portfolio...</h2>
              <p>Retrieving your public showcase details, social links, and verified skills.</p>
            </div>
          )}

          {portfolioError && !portfolioLoading && (
            <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
              <AlertCircle size={28} color="#ef4444" style={{ marginBottom: 10 }} />
              <h2>Could Not Load Portfolio</h2>
              <p className="muted" style={{ maxWidth: 460, margin: '8px auto 16px' }}>{portfolioError}</p>
              <button
                className="btn primary small"
                onClick={loadPortfolio}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RefreshCw size={13} /> Try Again
              </button>
            </div>
          )}

          {!portfolioLoading && !portfolioError && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24 }}>
          {/* Left Column: Settings & Sharing */}
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Portfolio Settings & Sharing</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  Controls which completed projects appear on your verified candidate showcase.
                </span>
              </div>
            </div>

            {portfolioSuccessMsg && (
              <div style={{ background: '#ecfdf5', color: '#065f46', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                {portfolioSuccessMsg}
              </div>
            )}

            {/* Public Sharing Toggle */}
            <div
              style={{
                background: portIsPublic ? '#eff6ff' : '#f8fafc',
                border: `1px solid ${portIsPublic ? '#bfdbfe' : 'var(--line)'}`,
                padding: 16,
                borderRadius: 10,
                marginBottom: 20
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong style={{ fontSize: 14, color: 'var(--ink)' }}>Public Shareable Portfolio</strong>
                  <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                    {portIsPublic
                      ? 'Anyone with your secret link can view your completed deliverables and demonstrated skills.'
                      : 'Portfolio is private. Only you can view your completed deliverables.'}
                  </p>
                </div>
                <label className="switch" style={{ cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={portIsPublic}
                    onChange={(e) => setPortIsPublic(e.target.checked)}
                    style={{ transform: 'scale(1.2)' }}
                  />
                </label>
              </div>

              {portIsPublic && portfolio?.share_slug && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #bfdbfe', display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    readOnly
                    value={`${window.location.origin}/portfolio/p/${portfolio.share_slug}`}
                    style={{ flex: 1, padding: '7px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #93c5fd', background: '#fff' }}
                  />
                  <button
                    className="btn primary small"
                    onClick={handleCopyShareLink}
                    style={{ padding: '6px 12px', fontSize: 12 }}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />} {copiedLink ? 'Copied!' : 'Copy Link'}
                  </button>
                  <a
                    href={`/portfolio/p/${portfolio.share_slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn outline small"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    title="Open live preview in new tab"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>

            {/* Form Fields */}
            <form onSubmit={handleSavePortfolio} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                  PROFESSIONAL HEADLINE
                </label>
                <input
                  type="text"
                  placeholder="e.g. Backend Engineer • Distributed Systems & PostgreSQL"
                  value={portHeadline}
                  onChange={(e) => setPortHeadline(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 7 }}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                  PROFESSIONAL BIO / SUMMARY
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief introductory summary of your background, technical interests, and project capabilities."
                  value={portBio}
                  onChange={(e) => setPortBio(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 7 }}
                />
              </div>

              {/* Social Links */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    GITHUB URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://github.com/username"
                    value={portGithub}
                    onChange={(e) => setPortGithub(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid var(--line)', borderRadius: 6 }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    LINKEDIN URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/username"
                    value={portLinkedin}
                    onChange={(e) => setPortLinkedin(e.target.value)}
                    style={{ width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid var(--line)', borderRadius: 6 }}
                  />
                </div>
              </div>

              {/* Feature Projects Selection */}
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
                  FEATURED COMPLETED PROJECTS
                </label>
                <div style={{ display: 'grid', gap: 8 }}>
                  {myProjects.filter((p) => p.status === 'completed').map((proj) => {
                    const isChecked = featuredProjectIds.length === 0 || featuredProjectIds.includes(proj.id);
                    return (
                      <label
                        key={proj.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 12px',
                          background: '#f8fafc',
                          borderRadius: 6,
                          fontSize: 13,
                          cursor: 'pointer'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFeaturedProjectIds([...featuredProjectIds, proj.id]);
                            } else {
                              setFeaturedProjectIds(featuredProjectIds.filter((id) => id !== proj.id));
                            }
                          }}
                        />
                        <span>{proj.title}</span>
                      </label>
                    );
                  })}

                  {myProjects.filter((p) => p.status === 'completed').length === 0 && (
                    <p className="muted" style={{ fontSize: 12 }}>
                      No completed projects yet. Complete projects from the My Projects tab to feature them here.
                    </p>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <button
                  type="submit"
                  className="btn primary"
                  disabled={portfolioSaving}
                >
                  {portfolioSaving ? 'Saving...' : 'Save Portfolio Settings'}
                </button>
              </div>
            </form>
          </div>

          {/* Right Column: Live Showcase Preview */}
          <div className="panel" style={{ padding: 24, background: '#f8fafc' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Candidate Showcase Preview</h3>
                <span className="muted" style={{ fontSize: 12 }}>How reviewers see your profile</span>
              </div>
              <span className="badge success" style={{ fontSize: 11 }}>
                Live Preview
              </span>
            </div>

            <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 20 }}>
              <div style={{ borderBottom: '1px solid var(--line)', paddingBottom: 14, marginBottom: 14 }}>
                <h2 style={{ fontSize: 20, margin: 0, fontWeight: 800 }}>
                  {portfolio?.display_name || 'Candidate Portfolio'}
                </h2>
                {portHeadline && (
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--blue)', fontWeight: 600 }}>
                    {portHeadline}
                  </p>
                )}
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Target: <strong>{selectedCareerTitle}</strong>
                </div>
                {portBio && (
                  <p style={{ margin: '10px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                    {portBio}
                  </p>
                )}
              </div>

              {/* Demonstrated Skills Chips Preview */}
              <div>
                <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                  Demonstrated Skills ({portfolio?.demonstrated_skills?.length || 0})
                </span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(portfolio?.demonstrated_skills || []).map((sk, idx) => {
                    const skillVm = getSkillViewModel(sk, idx);
                    return (
                      <span
                        key={skillVm.id || idx}
                        style={{
                          background: '#f1f5f9',
                          color: '#0f172a',
                          padding: '3px 8px',
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                        title={skillVm.level ? `${skillVm.name} · Level: ${skillVm.level}` : skillVm.name}
                      >
                        <CheckCircle2 size={12} color="#16a34a" /> {skillVm.name}
                      </span>
                    );
                  })}
                  {(!portfolio?.demonstrated_skills || portfolio.demonstrated_skills.length === 0) && (
                    <span className="muted" style={{ fontSize: 12 }}>
                      Skills will appear here once you complete projects.
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* Active Workspace Modal */}
      {workspaceProject && (
        <ProjectWorkspaceModal
          project={workspaceProject}
          onClose={() => setWorkspaceProject(null)}
          onUpdate={async () => {
            if (workspaceProject?.id) {
              const res = await api.projectDetails(workspaceProject.id).catch(() => null);
              if (res?.data) setWorkspaceProject(res.data);
            }
            loadMyProjects();
            loadPortfolio();
          }}
          onComplete={async (completedData) => {
            if (completedData) {
              setWorkspaceProject(completedData);
            } else if (workspaceProject?.id) {
              const res = await api.projectDetails(workspaceProject.id).catch(() => null);
              if (res?.data) setWorkspaceProject(res.data);
            }
            await loadMyProjects();
            await loadPortfolio();
          }}
        />
      )}
    </div>
  );
}
