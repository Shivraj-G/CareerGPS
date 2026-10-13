import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Check,
  CheckCircle2,
  Clock3,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  SkipForward,
  Trash2,
  Bookmark,
  BookmarkCheck,
  Compass,
  BookOpen,
  BriefcaseBusiness,
  GraduationCap,
  Building2,
  Target,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Info
} from 'lucide-react';
import { api, getToken } from '../../api/client.js';

function unwrapList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

function unwrapObject(data) {
  if (data && typeof data === 'object' && data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return data.data;
  }
  return data ?? {};
}

export function CareerPathwayView({ user }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const careerId = params.get('career') || '';
  const templatePathwayId = params.get('pathway') || '';
  const careerTitle = params.get('title') || '';
  const origin = params.get('origin') || '';
  const type = params.get('type') || '';
  const vstatus = params.get('vstatus') || '';

  const [pathway, setPathway] = useState(null);
  const [existingPathways, setExistingPathways] = useState([]);
  const [generatedPathways, setGeneratedPathways] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);
  const [actionLoadingStepId, setActionLoadingStepId] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState(null);
  const [expandedSteps, setExpandedSteps] = useState({});
  const [activeStrategyTab, setActiveStrategyTab] = useState('current');

  useEffect(() => {
    if (!showRemoveConfirm) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isRemoving) setShowRemoveConfirm(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showRemoveConfirm, isRemoving]);

  async function loadPathwayData(explicitCareerId, explicitTemplatePathwayId) {
    setStatus('loading');
    setError(null);
    if (!getToken()) {
      setStatus('empty');
      return;
    }

    const currentCareerId = explicitCareerId !== undefined ? explicitCareerId : careerId;
    const currentTemplateId = explicitTemplatePathwayId !== undefined ? explicitTemplatePathwayId : templatePathwayId;

    try {
      if (type === 'ai_profile' && currentCareerId) {
        if (currentCareerId.startsWith('rec_')) {
          setStatus('empty');
          return;
        }
        const res = unwrapObject(await api.aiCareerPathway(currentCareerId));
        if (!res || Object.keys(res).length === 0) {
          setStatus('empty');
          return;
        }
        const mapped = { ...res };
        mapped.steps = (res.steps || []).map(s => ({
          ...s,
          id: s.order,
          status: (res.progress || []).includes(s.order) ? 'completed' : 'not_started'
        }));
        setPathway(mapped);
        setStatus('ready');
        return;
      }

      if (currentCareerId) {
        if (currentTemplateId) {
          try {
            // First check if the user already has an active or saved user_pathway for this template
            const activeRes = unwrapList(await api.userPathways());
            const userMatch = activeRes.find(up => up.pathway_id === currentTemplateId || up.id === currentTemplateId);
            if (userMatch) {
              const fullActive = unwrapObject(await api.userPathway(userMatch.id));
              if (fullActive && fullActive.id) {
                setPathway(fullActive);
                setStatus('ready');
                return;
              }
            }

            // Otherwise, fetch the template pathway directly to preview its multi-stage steps
            const tplRes = unwrapObject(await api.pathway(currentTemplateId));
            if (tplRes && tplRes.id) {
              setPathway({
                ...tplRes,
                isTemplatePreview: true,
                steps: (tplRes.steps || []).map(s => ({
                  ...s,
                  status: 'not_started'
                }))
              });
              setStatus('ready');
              return;
            }
          } catch (tplErr) {
            console.warn("Could not load template pathway directly, checking career pathways:", tplErr);
          }
        }

        const res = unwrapObject(await api.careerPathwaysList(currentCareerId));
        if (res.selected) {
          setPathway(res.selected);
          setStatus('ready');
        } else {
          setExistingPathways(res.existing || []);
          if (res.aiGenerated && res.aiGenerated.length > 0) {
            setGeneratedPathways(res.aiGenerated);
            setStatus('generated_selection');
          } else {
            setStatus('pre_generation');
          }
        }
      } else {
        const activeRes = unwrapList(await api.userPathways());
        if (activeRes.length > 0) {
          const selected = unwrapObject(await api.userPathway(activeRes[0].id));
          setPathway(selected);
          setStatus('ready');
        } else {
          setPathway(null);
          setStatus('empty');
        }
      }
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }

  useEffect(() => {
    loadPathwayData();
  }, [careerId, templatePathwayId, type, user?.id]);

  // Check saved status
  useEffect(() => {
    if (pathway?.pathway_id) {
      // Check if template is saved
      setSaved(Boolean(pathway.saved));
    }
  }, [pathway]);

  async function handleGenerate() {
    setIsGenerating(true);
    setError(null);
    try {
      const res = await api.generatePathway({ career_id: careerId });
      setGeneratedPathways(res.data);
      setStatus('generated_selection');
    } catch (err) {
      setError(err);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSelectPathway(userPathwayId) {
    try {
      const updated = unwrapObject(await api.selectPathway(userPathwayId));
      if (updated && updated.id) {
        setPathway(updated);
        setStatus('ready');
      } else {
        await loadPathwayData();
      }
    } catch (err) {
      alert('Failed to select pathway. Please try again.');
    }
  }

  async function handleSelectTemplatePathway(id) {
    if (isSelecting) return;
    setIsSelecting(true);
    try {
      const updated = unwrapObject(await api.selectTemplatePathway(id));
      if (updated && updated.id) {
        setPathway(updated);
        setStatus('ready');
        setFeedbackToast({
          type: 'success',
          message: 'Pathway successfully chosen and added to My Plan!'
        });
        if (careerId) {
          navigate(`/pathway?career=${careerId}`, { replace: true });
        }
      } else {
        await loadPathwayData();
      }
    } catch (err) {
      alert('Failed to initialize template pathway. Please try again.');
    } finally {
      setIsSelecting(false);
    }
  }

  function handleExitPreview() {
    if (careerId) {
      navigate(`/pathway?career=${careerId}`, { replace: true });
      loadPathwayData();
    } else {
      navigate(-1);
    }
  }

  async function handleChangePath() {
    if (pathway?.isTemplatePreview) {
      handleExitPreview();
      return;
    }
    const targetCareerId = careerId || pathway?.career_id;
    if (targetCareerId) {
      try {
        const res = unwrapObject(await api.careerPathwaysList(targetCareerId));
        setExistingPathways(res.existing || []);
        if (res.aiGenerated && res.aiGenerated.length > 0) {
          setGeneratedPathways(res.aiGenerated);
          setStatus('generated_selection');
        } else {
          setStatus('pre_generation');
        }
        if (careerId !== targetCareerId) {
          navigate(`/pathway?career=${targetCareerId}`);
        }
      } catch {
        setStatus('pre_generation');
      }
    } else {
      navigate('/careers');
    }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    try {
      if (type === 'ai_profile' && careerId) {
        if (next) await api.saveAiCareer(careerId);
        else await api.unsaveAiCareer(careerId);
      } else if (pathway?.pathway_id) {
        if (next) await api.savePathway(pathway.pathway_id);
        else await api.unsavePathway(pathway.pathway_id);
      }
    } catch (err) {
      setSaved(!next);
    }
  }

  function handleRemoveClick() {
    if (isRemoving) return;
    if (!pathway) return;

    if (pathway.isTemplatePreview) {
      setFeedbackToast({
        type: 'info',
        message: 'This pathway template is only in preview mode and has not been added to My Plan.'
      });
      return;
    }

    setShowRemoveConfirm(true);
  }

  async function handleConfirmRemove() {
    if (isRemoving) return;
    if (!pathway) return;

    const assignmentId = pathway.user_pathway_id || (!pathway.isTemplatePreview ? pathway.id : null);
    if (!assignmentId) return;

    setIsRemoving(true);
    try {
      await api.deleteUserPathway(assignmentId);
      setShowRemoveConfirm(false);
      setPathway(null);
      setFeedbackToast({
        type: 'success',
        message: 'Pathway removed from My Plan. Your progress has been archived.'
      });

      if (careerId) {
        navigate(`/pathway?career=${careerId}`, { replace: true });
        await loadPathwayData(careerId, null);
      } else {
        await loadPathwayData('', null);
      }
    } catch (err) {
      setShowRemoveConfirm(false);
      setFeedbackToast({
        type: 'error',
        message: err.message || 'Failed to remove pathway. Please try again.'
      });
    } finally {
      setIsRemoving(false);
    }
  }

  const handleRemovePathway = handleRemoveClick;

  const renderFeedbackToast = () => {
    if (!feedbackToast) return null;
    const isSuccess = feedbackToast.type === 'success';
    const isError = feedbackToast.type === 'error';
    return (
      <div
        className="panel feedback-toast"
        style={{
          background: isSuccess ? '#f0fdf4' : isError ? '#fef2f2' : '#eff6ff',
          border: isSuccess ? '1px solid #86efac' : isError ? '1px solid #fca5a5' : '1px solid #bfdbfe',
          color: isSuccess ? '#166534' : isError ? '#991b1b' : '#1e40af',
          padding: '12px 18px',
          borderRadius: 8,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 14,
          fontWeight: 600
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isSuccess ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedbackToast.message}</span>
        </div>
        <button
          onClick={() => setFeedbackToast(null)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 4, fontSize: 16 }}
          aria-label="Dismiss message"
        >
          ×
        </button>
      </div>
    );
  };

  async function handleCompleteStep(stepId) {
    if (actionLoadingStepId) return;
    setActionLoadingStepId(stepId);
    try {
      const updated = unwrapObject(await api.completePathwayStep(pathway.id, stepId));
      setPathway(updated);
    } catch (err) {
      alert(err.message || 'Failed to update step.');
    } finally {
      setActionLoadingStepId(null);
    }
  }

  async function handleSkipStep(stepId) {
    if (actionLoadingStepId) return;
    setActionLoadingStepId(stepId);
    try {
      const updated = unwrapObject(await api.skipPathwayStep(pathway.id, stepId));
      setPathway(updated);
    } catch (err) {
      alert(err.message || 'Failed to skip step.');
    } finally {
      setActionLoadingStepId(null);
    }
  }

  async function handleUndoStep(stepId) {
    if (actionLoadingStepId) return;
    setActionLoadingStepId(stepId);
    try {
      const updated = unwrapObject(await api.undoPathwayStep(pathway.id, stepId));
      setPathway(updated);
    } catch (err) {
      alert(err.message || 'Failed to undo step.');
    } finally {
      setActionLoadingStepId(null);
    }
  }

  async function handleCompleteEntirePathway() {
    if (!pathway?.id) return;
    setStatus('loading');
    try {
      const updated = unwrapObject(await api.completePathway(pathway.id));
      setPathway(updated);
      setStatus('ready');
    } catch (err) {
      alert(err.message || 'Failed to complete pathway.');
      setStatus('ready');
    }
  }

  const { prerequisitesCompleted, requiredPreStepsTotal, requiredPreStepsDone } = useMemo(() => {
    if (!pathway?.steps || pathway.steps.length === 0) {
      return { prerequisitesCompleted: false, requiredPreStepsTotal: 0, requiredPreStepsDone: 0 };
    }
    const preProjectSteps = pathway.steps.filter((s) => {
      const meta = s.metadata || {};
      const order = Number(meta.stage_order || s.step_order || 1);
      const stageName = (meta.stage || '').toLowerCase();
      const titleLower = (s.title || '').toLowerCase();
      const isProjectStage = order >= 4 || stageName.includes('project') || stageName.includes('portfolio') || titleLower.includes('project') || titleLower.includes('portfolio');
      return !isProjectStage;
    });

    if (preProjectSteps.length === 0) {
      return { prerequisitesCompleted: true, requiredPreStepsTotal: 0, requiredPreStepsDone: 0 };
    }

    const mandatorySteps = preProjectSteps.filter(s => !s.metadata?.is_optional && !s.is_optional);
    const stepsToCheck = mandatorySteps.length > 0 ? mandatorySteps : preProjectSteps;
    const completedOrSkipped = stepsToCheck.filter(s => s.status === 'completed' || s.status === 'skipped');
    const isDone = completedOrSkipped.length === stepsToCheck.length || pathway.status === 'completed';

    return {
      prerequisitesCompleted: isDone,
      requiredPreStepsTotal: stepsToCheck.length,
      requiredPreStepsDone: completedOrSkipped.length
    };
  }, [pathway]);

  const toggleExpand = (stepId) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  // Group steps by Stage
  const groupedStages = useMemo(() => {
    if (!pathway?.steps) return [];
    const stagesMap = new Map();
    
    pathway.steps.forEach(s => {
      const meta = s.metadata || {};
      const stageName = meta.stage || `Stage ${meta.stage_order || s.step_order || 1}`;
      const stageOrder = meta.stage_order || s.step_order || 1;

      if (!stagesMap.has(stageName)) {
        stagesMap.set(stageName, {
          name: stageName,
          order: stageOrder,
          steps: []
        });
      }
      stagesMap.get(stageName).steps.push(s);
    });

    return Array.from(stagesMap.values()).sort((a, b) => a.order - b.order);
  }, [pathway?.steps]);

  // Loading state
  if (status === 'loading') {
    return (
      <div className="pathway-loading-wrap" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Clock3 size={32} className="spin-icon" style={{ color: 'var(--primary)', marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, fontWeight: 600 }}>Assembling your personalized career pathway...</h2>
        <p className="muted" style={{ fontSize: 14 }}>Matching your profile, education, and acquired skills.</p>
      </div>
    );
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="panel pathway-error-box" style={{ margin: '40px auto', maxWidth: 640, padding: 32, textAlign: 'center' }}>
        <AlertCircle size={36} style={{ color: 'var(--red)', marginBottom: 16 }} />
        <h2 style={{ fontSize: 20, marginBottom: 8 }}>Unable to load pathway</h2>
        <p className="muted" style={{ marginBottom: 24 }}>{error?.message || 'Something went wrong. Please try again.'}</p>
        <button className="btn primary" onClick={loadPathwayData}>Try Again</button>
      </div>
    );
  }

  // Empty state
  if (status === 'empty') {
    return (
      <div className="pathway-page">
        {renderFeedbackToast()}
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">CAREER PATHWAY</div>
            <h1>No active pathway yet</h1>
            <p>Pick a career and generate a step-by-step pathway tailored to your experience.</p>
          </div>
        </div>
        <div className="panel empty-pathway-panel" style={{ padding: 48, textAlign: 'center', maxWidth: 680, margin: '30px auto' }}>
          <Compass size={48} style={{ color: 'var(--blue)', marginBottom: 16 }} />
          <h2 style={{ fontSize: 22, marginBottom: 12 }}>Explore careers to build your plan</h2>
          <p className="muted" style={{ marginBottom: 28, lineHeight: 1.6 }}>
            Browse through verified careers in Goa. When you open any career, generate or select its structured multi-stage pathway to track real progress.
          </p>
          <Link to="/careers" className="btn primary large" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Explore Careers <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    );
  }

  // Pre-generation state (when career is chosen but no active pathway yet)
  if (status === 'pre_generation') {
    return (
      <div className="pathway-page">
        {renderFeedbackToast()}
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">CAREER PATHWAY</div>
            <h1>Career Pathways for {careerTitle || 'Your Goal'}</h1>
            <p>Choose an existing verified pathway template or generate AI-personalized strategies.</p>
          </div>
        </div>

        {existingPathways && existingPathways.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div className="section-title">
              <h2>VERIFIED REFERENCE PATHWAYS</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
              {existingPathways.map(p => (
                <div key={p.id} className="panel detail-panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className="badge success" style={{ fontSize: 11 }}>Verified Template</span>
                        <h3 style={{ fontSize: 18, margin: 0 }}>{p.title}</h3>
                      </div>
                      <p className="muted" style={{ fontSize: 14, margin: 0 }}>{p.description || 'Standard verified roadmap.'}</p>
                    </div>
                    <button className="btn primary" onClick={() => handleSelectTemplatePathway(p.id)}>
                      Start this pathway
                    </button>
                  </div>
                  {p.steps && p.steps.length > 0 && (
                    <div style={{ padding: '14px 16px', background: '#f8fafc', borderRadius: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.6px', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        Multi-Stage Steps ({p.steps.length})
                      </span>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                        {p.steps.map(s => s.title).join(' → ')}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="section-title" style={{ marginTop: 32 }}>
          <h2>PERSONALIZED AI PATHWAYS</h2>
        </div>
        <div className="panel pathway-card" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <Sparkles size={32} style={{ color: 'var(--blue)', marginBottom: 12 }} />
          <h2 style={{ fontSize: 20, marginBottom: 10 }}>Generate 2 Tailored Strategies</h2>
          <p className="muted" style={{ maxWidth: 560, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Our engine evaluates your degree, years of experience, and acquired skills to build two distinct routes: Project-Driven vs Structured Learning.
          </p>
          <button className="btn primary large" onClick={handleGenerate} disabled={isGenerating} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {isGenerating ? 'Generating 2 Strategies...' : 'Generate 2 Personalized Pathways'} <ArrowRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  // Generated Selection state
  if (status === 'generated_selection' && generatedPathways && generatedPathways.length > 0) {
    return (
      <div className="pathway-page">
        {renderFeedbackToast()}
        <div className="page-heading-row">
          <div>
            <div className="section-kicker">STRATEGY SELECTION</div>
            <h1>Choose Your Strategy for {careerTitle || pathway?.career_title || 'Your Career'}</h1>
            <p>Select the learning strategy that best matches your timeline and learning style.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24, marginTop: 20 }}>
          {generatedPathways.map((p, idx) => {
            const ctx = p.generated_context || {};
            const isAltA = idx === 0;
            return (
              <div key={p.id} className="panel detail-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%', border: isAltA ? '2px solid rgba(37,99,235,0.2)' : '1px solid var(--border)' }}>
                <div style={{ marginBottom: 16 }}>
                  <span className="badge blue" style={{ fontSize: 11, marginBottom: 8 }}>
                    {isAltA ? 'STRATEGY A · PROJECT-DRIVEN' : 'STRATEGY B · STRUCTURED LEARNING'}
                  </span>
                  <h2 style={{ fontSize: 20, marginTop: 4, marginBottom: 6 }}>{p.title}</h2>
                  <span className="muted" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock3 size={14} /> Estimated: {ctx.estimated_duration || p.estimated_duration || '6-9 months'}
                  </span>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 6 }}>Core Philosophy</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>{ctx.strategy || p.strategy || 'Tailored progression pathway.'}</p>
                </div>

                <div style={{ flex: 1, marginBottom: 24 }}>
                  <h3 style={{ fontSize: 12, textTransform: 'uppercase', color: 'var(--muted)', letterSpacing: '0.5px', marginBottom: 12 }}>
                    Stages & Milestones ({(p.steps || []).length})
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(p.steps || []).slice(0, 5).map((s, si) => (
                      <div key={s.id || si} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13 }}>
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#eff6ff', color: 'var(--blue)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, flex: 'none' }}>
                          {s.step_order || si + 1}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.title}</div>
                          <div className="muted" style={{ fontSize: 12 }}>{s.metadata?.deliverable || s.description}</div>
                        </div>
                      </div>
                    ))}
                    {(p.steps || []).length > 5 && (
                      <div className="muted" style={{ fontSize: 12, paddingLeft: 32 }}>
                        + {(p.steps || []).length - 5} more specialization & job readiness steps
                      </div>
                    )}
                  </div>
                </div>

                <button className="btn primary" onClick={() => handleSelectPathway(p.id)} style={{ width: '100%', justifyContent: 'center' }}>
                  Select This Pathway <ArrowRight size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Active / Ready Pathway view
  const metrics = pathway?.metrics || {
    total: (pathway?.steps || []).length,
    completed: (pathway?.steps || []).filter(s => s.status === 'completed').length,
    skipped: (pathway?.steps || []).filter(s => s.status === 'skipped').length,
    in_progress: (pathway?.steps || []).filter(s => s.status === 'in_progress').length,
    percentage: 0
  };

  const startingPoint = pathway?.starting_point || {
    step_order: 1,
    title: pathway?.steps?.[0]?.title || 'Foundation Step',
    stage: 'Stage 1',
    reason: 'Personalized based on your current education and background.'
  };

  const displayCareerTitle = pathway?.career_title || careerTitle || 'Your Selected Career';

  return (
    <div className="pathway-page">
      {/* Feedback Toast Banner */}
      {renderFeedbackToast()}

      {/* Header Bar */}
      <div className="page-heading-row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="section-kicker">PERSONALIZED CAREER PATHWAY</div>
          <h1 style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '4px 0 8px' }}>
            <span>Your Pathway to {displayCareerTitle}</span>
            {pathway?.isTemplatePreview ? (
              <span className="badge amber" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <BookOpen size={14} /> Template Preview
              </span>
            ) : pathway?.origin === 'ai_generated' ? (
              <span className="badge blue" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Sparkles size={14} /> AI Personalized
              </span>
            ) : (
              <span className="badge success" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <ShieldCheck size={14} /> Verified Roadmap
              </span>
            )}
          </h1>
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Structured, multi-stage roadmap connected to verified learning deliverables and your real profile progress.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {pathway?.isTemplatePreview ? (
            <>
              <button
                className="btn primary"
                onClick={() => handleSelectTemplatePathway(pathway.id)}
                disabled={isSelecting}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Check size={16} /> <span>{isSelecting ? 'Selecting...' : 'Choose this path'}</span>
              </button>
              <button
                className="btn ghost"
                onClick={handleExitPreview}
                disabled={isSelecting}
                title="Return to pathway options for this career"
                style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <ArrowLeft size={15} /> <span>Back to Pathways</span>
              </button>
            </>
          ) : (
            <>
              {pathway?.status !== 'completed' && (
                <button
                  className="btn outline"
                  onClick={handleCompleteEntirePathway}
                  title="Mark all pathway milestones completed"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#16a34a', borderColor: '#86efac' }}
                >
                  <CheckCircle2 size={16} /> <span>Complete All</span>
                </button>
              )}
              <button className="btn outline" onClick={toggleSave} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {saved ? <BookmarkCheck size={16} style={{ color: 'var(--blue)' }} /> : <Bookmark size={16} />}
                <span>{saved ? 'Saved in My Plan' : 'Save to My Plan'}</span>
              </button>
              <button
                className="btn ghost"
                onClick={handleChangePath}
                disabled={isRemoving}
                title="Change to a different pathway for this career"
                style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCcw size={15} /> <span>Change Path</span>
              </button>
              <button
                className="btn outline danger"
                onClick={handleRemovePathway}
                disabled={isRemoving}
                title="Remove this pathway from My Plan and archive progress"
                style={{ color: '#dc2626', borderColor: '#fca5a5', display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={15} /> <span>{isRemoving ? 'Removing...' : 'Remove from My Plan'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Template Preview Notice Banner */}
      {pathway?.isTemplatePreview && (
        <div
          className="panel template-preview-banner"
          style={{
            background: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: 8,
            padding: '14px 20px',
            margin: '20px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#92400e' }}>
            <BookOpen size={18} style={{ flex: 'none' }} />
            <span>
              <strong>Previewing Template:</strong> This is a reusable pathway template. Click <strong>Choose this path</strong> to add it to My Plan and start tracking verified milestone progress.
            </span>
          </div>
          <button
            className="btn primary small"
            onClick={() => handleSelectTemplatePathway(pathway.id)}
            disabled={isSelecting}
            style={{ fontSize: 12 }}
          >
            <Check size={14} /> {isSelecting ? 'Selecting...' : 'Choose this path'}
          </button>
        </div>
      )}

      {/* Starting Point & Profile Alignment Banner */}
      <div className="panel pathway-alignment-card" style={{ background: '#f8fafc', borderLeft: '4px solid var(--blue)', padding: '20px 24px', margin: '24px 0', borderRadius: '0 8px 8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#eff6ff', display: 'grid', placeItems: 'center', color: 'var(--blue)', flex: 'none' }}>
            <Zap size={22} />
          </div>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--blue)', marginBottom: 4 }}>
              Current Starting Point · {startingPoint.stage}
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              {startingPoint.title}
            </div>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', lineHeight: 1.5 }}>
              {startingPoint.reason}
            </p>
          </div>
        </div>
      </div>

      {/* Prerequisites Completed -> Unlock Projects & Portfolio Transition Banner */}
      {prerequisitesCompleted && (
        <div
          className="panel pathway-unlocked-banner"
          style={{
            background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
            border: '1.5px solid #86efac',
            borderRadius: 12,
            padding: '24px 28px',
            margin: '20px 0 24px',
            boxShadow: '0 4px 16px rgba(16,185,129,0.08)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background: '#22c55e',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#ffffff',
                  flex: 'none',
                  boxShadow: '0 2px 8px rgba(34,197,94,0.3)'
                }}
              >
                <CheckCircle2 size={24} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#15803d', marginBottom: 4 }}>
                  STAGE UNLOCKED · PROJECTS & PORTFOLIO READY
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: '0 0 6px' }}>
                  Pathway prerequisites completed — start applying your skills.
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: '#334155', maxWidth: 650, lineHeight: 1.5 }}>
                  You have satisfied the required foundational milestones for {displayCareerTitle}. Put your learning into practice by building real deliverables in the Project Studio.
                </p>
              </div>
            </div>

            <Link
              to={`/projects?career=${pathway?.career_id || careerId}&title=${encodeURIComponent(displayCareerTitle)}&tab=recommended`}
              className="btn primary large"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 22px',
                fontSize: 14,
                fontWeight: 700,
                background: '#16a34a',
                borderColor: '#16a34a',
                color: '#fff',
                textDecoration: 'none',
                borderRadius: 8,
                boxShadow: '0 4px 12px rgba(22,163,74,0.25)'
              }}
            >
              <Sparkles size={16} /> Open Recommended Projects <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      )}

      {/* Main Pathway Layout: Left Timeline, Right Summary */}
      <div className="pathway-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 24, alignItems: 'flex-start' }}>
        
        {/* Left: Stages & Steps */}
        <div className="pathway-stages-container" style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          {groupedStages.map((stageGroup) => (
            <div key={stageGroup.name} className="pathway-stage-section">
              {/* Stage Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 10px', background: '#e2e8f0', borderRadius: 4, letterSpacing: '0.5px' }}>
                  STAGE {stageGroup.order}
                </span>
                <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                  {stageGroup.name.replace(/^Stage \d+:\s*/, '')}
                </h2>
              </div>

              {/* Stage Steps */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {stageGroup.steps.map((step) => {
                  const meta = step.metadata || {};
                  const isCompleted = step.status === 'completed';
                  const isSkipped = step.status === 'skipped';
                  const isBlocked = step.status === 'blocked' || step.is_blocked;
                  const isFocus = step.is_current_focus;
                  const isExpanded = expandedSteps[step.id] ?? isFocus;
                  const isLoading = actionLoadingStepId === step.id;

                  return (
                    <div
                      key={step.id || step.pathway_step_id}
                      className={`panel pathway-step-card ${isCompleted ? 'step-completed' : ''} ${isFocus ? 'step-focus' : ''} ${isBlocked ? 'step-blocked' : ''}`}
                      style={{
                        padding: '20px 22px',
                        border: isFocus ? '2px solid var(--blue)' : isCompleted ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border)',
                        background: isCompleted ? '#fafdfb' : isBlocked ? '#fcfbf8' : '#ffffff',
                        borderRadius: 10,
                        transition: 'box-shadow 0.2s ease'
                      }}
                    >
                      {/* Top Row: Number, Title, Badges */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          {/* Step Number Circle */}
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 13,
                              flex: 'none',
                              background: isCompleted ? '#10b981' : isFocus ? 'var(--blue)' : isSkipped ? '#94a3b8' : '#e2e8f0',
                              color: isCompleted || isFocus || isSkipped ? '#ffffff' : 'var(--text)'
                            }}
                          >
                            {isCompleted ? <Check size={18} /> : step.step_order}
                          </div>

                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: isCompleted ? 'var(--text)' : 'var(--text)' }}>
                                {step.title}
                              </h3>
                              {isFocus && (
                                <span className="badge blue" style={{ fontSize: 11, padding: '2px 8px' }}>Current Focus</span>
                              )}
                              {isCompleted && step.completion_source === 'auto_detected' && (
                                <span className="badge success" style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <Sparkles size={12} /> Auto-detected
                                </span>
                              )}
                              {isSkipped && (
                                <span className="badge" style={{ fontSize: 11, padding: '2px 8px', background: '#e2e8f0' }}>Skipped</span>
                              )}
                              {isBlocked && (
                                <span className="badge warning" style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                  <AlertCircle size={12} /> Blocked by Prerequisite
                                </span>
                              )}
                            </div>
                            <span className="muted" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock3 size={13} /> {meta.estimated_duration || '2-4 weeks'}
                            </span>
                          </div>
                        </div>

                        {/* Expand toggle */}
                        <button
                          className="icon-btn"
                          onClick={() => toggleExpand(step.id)}
                          style={{ padding: 6 }}
                          aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
                        >
                          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </button>
                      </div>

                      {/* Auto Evidence callout if auto-detected */}
                      {step.auto_evidence && (
                        <div style={{ margin: '12px 0 6px', padding: '8px 12px', background: '#ecfdf5', borderRadius: 6, fontSize: 12, color: '#065f46', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <CheckCircle2 size={15} style={{ flex: 'none' }} />
                          <span>{step.auto_evidence}</span>
                        </div>
                      )}

                      {/* Blocked message if blocked */}
                      {isBlocked && step.block_reason && (
                        <div style={{ margin: '12px 0 6px', padding: '8px 12px', background: '#fffbeb', borderRadius: 6, fontSize: 12, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <AlertCircle size={15} style={{ flex: 'none' }} />
                          <span>{step.block_reason}</span>
                        </div>
                      )}

                      {/* Expanded Details */}
                      {isExpanded && (
                        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Why it matters */}
                          {meta.why_it_matters && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                                Why this matters
                              </div>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{meta.why_it_matters}</p>
                            </div>
                          )}

                          {/* What to do */}
                          {meta.what_to_do && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                                What to do
                              </div>
                              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>{meta.what_to_do}</p>
                            </div>
                          )}

                          {/* Deliverable */}
                          {meta.deliverable && (
                            <div style={{ padding: '10px 14px', background: '#f8fafc', borderRadius: 6 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                                Expected Deliverable / Proof of Completion
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                                {meta.deliverable}
                              </span>
                            </div>
                          )}

                          {/* Action Link & Step Controls */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
                            {/* Action Link into NaviGoa */}
                            {meta.action_link ? (
                              <Link
                                to={meta.action_link}
                                className="btn outline small"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                              >
                                {meta.action_label || 'Explore Step Action'} <ExternalLink size={13} />
                              </Link>
                            ) : <div />}

                            {/* Buttons */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {pathway?.isTemplatePreview ? (
                                <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
                                  Choose this path to track progress
                                </span>
                              ) : isCompleted ? (
                                <button
                                  className="btn ghost small"
                                  disabled={isLoading}
                                  onClick={() => handleUndoStep(step.pathway_step_id || step.id)}
                                  style={{ color: 'var(--muted)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                >
                                  <RotateCcw size={13} /> <span>{isLoading ? 'Updating...' : 'Undo Complete'}</span>
                                </button>
                              ) : isSkipped ? (
                                <button
                                  className="btn outline small"
                                  disabled={isLoading}
                                  onClick={() => handleUndoStep(step.pathway_step_id || step.id)}
                                  style={{ fontSize: 12 }}
                                >
                                  {isLoading ? 'Updating...' : 'Restore Step'}
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="btn ghost small"
                                    disabled={isLoading || isBlocked}
                                    onClick={() => handleSkipStep(step.pathway_step_id || step.id)}
                                    style={{ color: 'var(--muted)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                    title="Skip this step if not required"
                                  >
                                    <SkipForward size={13} /> <span>Skip</span>
                                  </button>
                                  <button
                                    className="btn primary small"
                                    disabled={isLoading || isBlocked}
                                    onClick={() => handleCompleteStep(step.pathway_step_id || step.id)}
                                    style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <Check size={14} /> <span>{isLoading ? 'Saving...' : 'Mark Complete'}</span>
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Right: Progress Tracker & Stats */}
        <aside className="pathway-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'sticky', top: 20 }}>
          {/* Progress Card */}
          <div className="panel" style={{ padding: 22 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
              OVERALL PROGRESS
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '10px 0 14px' }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: 'var(--blue)' }}>
                {metrics.percentage}%
              </span>
              <span className="muted" style={{ fontSize: 13 }}>
                ({metrics.completed} of {metrics.total} steps)
              </span>
            </div>

            {/* Progress Bar */}
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', marginBottom: 18 }}>
              <div
                style={{
                  height: '100%',
                  width: `${metrics.percentage}%`,
                  background: 'var(--blue)',
                  transition: 'width 0.4s ease'
                }}
              />
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, paddingTop: 14, borderTop: '1px solid #f1f5f9', fontSize: 13 }}>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>COMPLETED</span>
                <b style={{ color: '#10b981' }}>{metrics.completed}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>SKIPPED</span>
                <b style={{ color: '#64748b' }}>{metrics.skipped}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>IN PROGRESS</span>
                <b style={{ color: 'var(--blue)' }}>{metrics.in_progress}</b>
              </div>
              <div>
                <span className="muted" style={{ display: 'block', fontSize: 11 }}>REMAINING</span>
                <b>{metrics.remaining}</b>
              </div>
            </div>
          </div>

          {/* Projects & Portfolio Stage Unlocking Card */}
          <div
            className="panel"
            style={{
              padding: 20,
              border: prerequisitesCompleted ? '1.5px solid #86efac' : '1px solid #e2e8f0',
              background: prerequisitesCompleted ? '#f0fdf4' : '#f8fafc'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: prerequisitesCompleted ? '#16a34a' : 'var(--muted)', textTransform: 'uppercase' }}>
                STAGE 4 · PROJECTS STUDIO
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: 99,
                  background: prerequisitesCompleted ? '#dcfce7' : '#e2e8f0',
                  color: prerequisitesCompleted ? '#15803d' : '#64748b'
                }}
              >
                {prerequisitesCompleted ? 'UNLOCKED' : 'IN PROGRESS'}
              </span>
            </div>
            <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 6px', color: '#0f172a' }}>
              {prerequisitesCompleted ? 'Ready to Build Deliverables' : 'Complete Foundations to Unlock'}
            </h4>
            <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              {prerequisitesCompleted
                ? `You've completed ${requiredPreStepsDone}/${requiredPreStepsTotal} prerequisite milestones. Translate your knowledge into verified portfolio artifacts.`
                : `Complete ${requiredPreStepsTotal - requiredPreStepsDone} more prerequisite step(s) to automatically unlock career deliverables.`}
            </p>
            <Link
              to={`/projects?career=${pathway?.career_id || careerId}&title=${encodeURIComponent(displayCareerTitle)}&tab=recommended`}
              className={`btn ${prerequisitesCompleted ? 'primary' : 'outline'} small`}
              style={{ width: '100%', justifyContent: 'center', textDecoration: 'none' }}
            >
              {prerequisitesCompleted ? 'Start Career Projects' : 'Preview Project Studio'}
            </Link>
          </div>

          {/* Quick Guidance Box */}
          <div className="panel" style={{ padding: 18, background: '#f8fafc', fontSize: 13 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, marginBottom: 8 }}>
              <Info size={16} style={{ color: 'var(--blue)' }} />
              <span>Evidence-Based Progress</span>
            </div>
            <p className="muted" style={{ margin: 0, lineHeight: 1.5, fontSize: 12 }}>
              Steps are automatically satisfied when supported by verified profile skills, education, or projects. You can also confirm completion or skip non-mandatory milestones.
            </p>
          </div>
        </aside>
      </div>

      {/* Accessible Confirmation Modal for Removal */}
      {showRemoveConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 9999,
            padding: '20px',
            backdropFilter: 'blur(3px)'
          }}
          onClick={() => {
            if (!isRemoving) setShowRemoveConfirm(false);
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '12px',
              padding: '26px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.18)',
              border: '1px solid var(--line)',
              textAlign: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: '#fee2e2',
                color: '#dc2626',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Trash2 size={24} />
            </div>
            <h2 id="remove-modal-title" style={{ fontSize: '18px', fontWeight: 600, marginBottom: '10px', color: '#0f172a' }}>
              Remove from My Plan?
            </h2>
            <p style={{ fontSize: '13.5px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '24px' }}>
              Are you sure you want to remove this pathway from My Plan? Your past progress will be archived.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setShowRemoveConfirm(false)}
                disabled={isRemoving}
                style={{ minWidth: 90 }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={handleConfirmRemove}
                disabled={isRemoving}
                style={{
                  background: '#dc2626',
                  borderColor: '#dc2626',
                  color: '#fff',
                  minWidth: 140,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6
                }}
              >
                {isRemoving ? <Clock3 size={15} className="spin-icon" /> : <Trash2 size={15} />}
                <span>{isRemoving ? 'Archiving...' : 'Remove Pathway'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CareerPathwayView;
