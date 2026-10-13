import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  Circle,
  Clock3,
  Award,
  Sparkles,
  ExternalLink,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  FolderGit2,
  FileText,
  Globe,
  Layers,
  Pause,
  Play,
  Archive,
  RotateCcw,
  ShieldCheck,
  Compass,
  FileSpreadsheet,
  Eye,
  BookOpen,
  Check,
  Utensils,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../../api/client.js';
import { formatSkillDisplayName } from '../../utils/skillDisplay.js';

function getDomainHelpers(project) {
  const career = String(project.career_title || '').toLowerCase();
  const domain = String(project.domain || '').toLowerCase();
  const title = String(project.title || '').toLowerCase();

  // Data Engineering
  if (career.includes('data eng') || title.includes('data eng') || title.includes('pipeline') || title.includes('etl') || domain.includes('data_eng')) {
    return {
      defaultType: 'code_repo',
      placeholder: 'e.g. Built using Python, PostgreSQL & dbt; automated pipeline with schema validation tests',
      suggestedDeliverables: [
        { title: 'Data Pipeline Repository (dbt / Python)', type: 'code_repo' },
        { title: 'Schema Validation & Data Quality Test Report', type: 'report_doc' },
        { title: 'Pipeline Architecture Diagram & Runbook', type: 'presentation' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Source Data Discovery & Ingestion Setup', description: 'Inspect raw data source format (CSV/JSON/Parquet/API) and implement ingestion logic.', expected_output: 'Ingestion script and raw data landing zone' },
        { order: 2, title: 'Schema Modeling & Database Table Definition', description: 'Design normalized relational or dimensional schema with explicit types and primary keys.', expected_output: 'DDL schema migration scripts' },
        { order: 3, title: 'Data Transformation & Business Logic Pipeline', description: 'Implement cleaning, deduplication, and transformation stages with error handling.', expected_output: 'Transformation pipeline code' },
        { order: 4, title: 'Data Quality Validation & Automated Assertions', description: 'Write automated assertions checking nullability, uniqueness, and reference integrity.', expected_output: 'Passing test suite or validation summary' },
        { order: 5, title: 'Pipeline Documentation & Performance Runbook', description: 'Document lineage, refresh frequency, indexing strategy, and operational monitoring.', expected_output: 'README runbook and architecture diagram' }
      ]
    };
  }

  // Chef / Culinary
  if (career.includes('chef') || career.includes('culinary') || title.includes('menu') || title.includes('culinary') || domain.includes('culinary')) {
    return {
      defaultType: 'culinary_portfolio',
      placeholder: 'e.g. Standardized recipes tested in kitchen, costing calculated with ingredient yield, HACCP food safety audit complete',
      suggestedDeliverables: [
        { title: 'Standardized Recipe Cards & Food Costing Sheet', type: 'spreadsheet' },
        { title: 'HACCP Food Safety & Allergen Matrix', type: 'report_doc' },
        { title: 'Final Plated Menu Presentation & Tasting Portfolio', type: 'culinary_portfolio' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Menu Theme, Concept & Course Architecture', description: 'Define target cuisine, dining occasion, portion targets, and seasonal ingredient availability.', expected_output: 'Complete menu concept brief' },
        { order: 2, title: 'Recipe Standardization & Yield Formulation', description: 'Document exact weights, prep instructions, cooking temperatures, and batch yields for all courses.', expected_output: 'Standardized recipe cards' },
        { order: 3, title: 'Ingredient Costing, Yield Analysis & Margin Pricing', description: 'Calculate total recipe cost, per-portion cost, raw yield variance, and recommended retail prices.', expected_output: 'Costing workbook with food cost %' },
        { order: 4, title: 'Food Safety, Critical Control Points & Allergen Matrix', description: 'Map out storage temperatures, hygiene controls (HACCP), and cross-contamination prevention.', expected_output: 'Allergen matrix and HACCP checklist' },
        { order: 5, title: 'Plating Execution, Tasting Notes & Service Brief', description: 'Document visual plating aesthetics, service timing, texture contrasts, and culinary tasting notes.', expected_output: 'Plated dish photos and service guide' }
      ]
    };
  }

  // Teacher / Education
  if (career.includes('teacher') || career.includes('educat') || title.includes('lesson') || title.includes('curriculum') || domain.includes('education')) {
    return {
      defaultType: 'lesson_plan',
      placeholder: 'e.g. Aligned to curricular standards, includes differentiated instructional tiers, assessment rubrics, and interactive materials',
      suggestedDeliverables: [
        { title: 'Complete Lesson Plan & Learning Objectives Document', type: 'lesson_plan' },
        { title: 'Differentiated Assessment Rubric & Feedback Criteria', type: 'report_doc' },
        { title: 'Instructional Slides & Classroom Activity Materials', type: 'presentation' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Curricular Standards & Learning Objective Formulation', description: 'Align learning objectives with state/board standards using Bloom’s taxonomy.', expected_output: 'Standardized lesson objectives' },
        { order: 2, title: 'Instructional Sequence & Pedagogical Materials', description: 'Author interactive lecture outline, guided practice exercises, and student handouts.', expected_output: 'Slide deck and classroom activity sheets' },
        { order: 3, title: 'Differentiated Learning Strategy & Accommodations', description: 'Create modifications and tiered activities for diverse learner abilities and special needs.', expected_output: 'Differentiation matrix' },
        { order: 4, title: 'Formative & Summative Assessment Instruments', description: 'Develop scoring rubrics, quick-check quizzes, and capstone evaluation metrics.', expected_output: 'Scoring rubric and student assessment' },
        { order: 5, title: 'Pedagogical Reflection & Engagement Audit', description: 'Evaluate instructional pacing, anticipated misconceptions, and post-lesson reflection guidelines.', expected_output: 'Teaching delivery and reflection notes' }
      ]
    };
  }

  // GIS Analyst / Spatial
  if (career.includes('gis') || career.includes('spatial') || career.includes('cartograph') || title.includes('gis') || title.includes('spatial') || domain.includes('spatial')) {
    return {
      defaultType: 'map_spatial',
      placeholder: 'e.g. Vector/raster layers processed in QGIS/ArcGIS, spatial queries executed, web map published with symbology',
      suggestedDeliverables: [
        { title: 'Interactive Web Map / GeoJSON Spatial Layer', type: 'map_spatial' },
        { title: 'Thematic Cartographic Maps & Analytical Report', type: 'report_doc' },
        { title: 'Geoprocessing Workflow & Data Dictionary', type: 'presentation' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Spatial Data Acquisition & Coordinate Cleaning', description: 'Gather boundary and attribute data, reproject coordinate reference systems (CRS), and clean geometry.', expected_output: 'Cleaned shapefile or GeoJSON dataset' },
        { order: 2, title: 'Spatial Analysis & Geoprocessing Operations', description: 'Run spatial joins, proximity buffers, density calculations, and multi-criteria evaluations.', expected_output: 'Processed analytical spatial layers' },
        { order: 3, title: 'Cartographic Design & Thematic Map Layout', description: 'Design publication-quality map with color palettes, scale bars, north arrows, and clear legends.', expected_output: 'High-resolution PDF or SVG maps' },
        { order: 4, title: 'Interactive Web Map Deployment & Layer Publishing', description: 'Publish interactive web map via Leaflet, Mapbox, or ArcGIS Online with clickable popup attributes.', expected_output: 'Live web map URL or GeoJSON viewer' },
        { order: 5, title: 'Methodology Documentation & Spatial Findings Brief', description: 'Document spatial data sources, analytical limitations, and findings for decision-makers.', expected_output: 'Analytical memo and metadata guide' }
      ]
    };
  }

  // Accountant / Finance
  if (career.includes('account') || career.includes('audit') || title.includes('ledger') || title.includes('tax') || title.includes('reconciliation') || domain.includes('accounting')) {
    return {
      defaultType: 'spreadsheet',
      placeholder: 'e.g. Double-entry journal posted, bank reconciliation balanced, financial statements modeled according to accounting standards',
      suggestedDeliverables: [
        { title: 'General Ledger & Bank Reconciliation Workbook', type: 'spreadsheet' },
        { title: 'Financial Statements (Balance Sheet, P&L, Cash Flow)', type: 'report_doc' },
        { title: 'Internal Controls & Variance Analysis Memorandum', type: 'presentation' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Chart of Accounts & Opening Balance Setup', description: 'Configure ledger chart of accounts and record opening balance journal entries.', expected_output: 'Standardized chart of accounts' },
        { order: 2, title: 'Transaction Posting & Monthly Ledger Balancing', description: 'Record operating transactions, accruals, prepayments, and generate preliminary trial balance.', expected_output: 'Complete general ledger entries' },
        { order: 3, title: 'Bank Reconciliation & Discrepancy Adjustments', description: 'Reconcile bank statements against ledger records, identifying timing differences and adjustments.', expected_output: 'Balanced bank reconciliation schedule' },
        { order: 4, title: 'Financial Statement Preparation (P&L, Balance Sheet)', description: 'Author formal Income Statement, Balance Sheet, and Cash Flow Statement complying with standards.', expected_output: 'Complete financial statements package' },
        { order: 5, title: 'Variance Analysis & Internal Controls Review', description: 'Perform ratio analysis, budget vs. actual variance review, and recommend internal controls.', expected_output: 'Management analysis memo' }
      ]
    };
  }

  // Nurse / Healthcare
  if (career.includes('nurse') || career.includes('nursing') || career.includes('health') || title.includes('clinical') || domain.includes('healthcare')) {
    return {
      defaultType: 'clinical_simulation',
      placeholder: 'e.g. Simulated care plan based on evidence-based protocols, patient privacy protected, vital trends analyzed',
      suggestedDeliverables: [
        { title: 'Simulated Nursing Care Plan & Protocol Document', type: 'clinical_simulation' },
        { title: 'Patient Health Risk Assessment & Intervention Memo', type: 'report_doc' },
        { title: 'Clinical Safety & Medication Protocol Audit', type: 'presentation' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Patient Simulation Baseline & Assessment Review', description: 'Review simulated clinical history, vital signs trends, lab values, and symptom progression.', expected_output: 'Comprehensive baseline intake report' },
        { order: 2, title: 'Nursing Diagnoses & Priority Problem Identification', description: 'Formulate evidence-based nursing diagnoses prioritizing immediate and long-term patient risks.', expected_output: 'Prioritized nursing diagnoses' },
        { order: 3, title: 'Intervention Protocol & Evidence-Based Care Steps', description: 'Detail pharmacological and non-pharmacological interventions adhering to safety standards.', expected_output: 'Detailed care intervention plan' },
        { order: 4, title: 'Patient Safety, Infection Control & Privacy Safeguards', description: 'Audit infection control measures, fall prevention protocols, and HIPAA/patient privacy safeguards.', expected_output: 'Clinical safety checklist' },
        { order: 5, title: 'Care Evaluation Milestones & Patient Discharge Plan', description: 'Define measurable recovery outcomes, patient/family education guidelines, and follow-up criteria.', expected_output: 'Discharge readiness summary' }
      ]
    };
  }

  // Graphic Designer / Creative
  if (career.includes('graphic') || career.includes('design') || title.includes('design') || title.includes('brand') || domain.includes('design')) {
    return {
      defaultType: 'design_work',
      placeholder: 'e.g. Designed in Figma/Illustrator, scalable vector components, design tokens, visual hierarchy verified',
      suggestedDeliverables: [
        { title: 'Design System & Visual Brand Guidelines (Figma / PDF)', type: 'design_work' },
        { title: 'High-Resolution Mockups & Vector Asset Export', type: 'presentation' },
        { title: 'Design Rationale & Case Study Presentation', type: 'report_doc' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Creative Brief & Visual Inspiration Moodboard', description: 'Define brand goals, user personas, moodboard concepts, and typographic direction.', expected_output: 'Creative brief and moodboard' },
        { order: 2, title: 'Exploratory Wireframing & Layout Thumbnails', description: 'Iterate rapid low-fidelity layout concepts exploring visual balance and focal contrast.', expected_output: 'Iterative layout sketches' },
        { order: 3, title: 'High-Fidelity Visual Design & Component Authoring', description: 'Design detailed interfaces, marketing collateral, or brand marks with consistent grid systems.', expected_output: 'Figma file or vector compositions' },
        { order: 4, title: 'Design System Tokens, Typography & Color Palette', description: 'Document accessible contrast ratios (WCAG), typography scales, and UI component variants.', expected_output: 'Design system style guide' },
        { order: 5, title: 'Asset Production & Case Study Presentation', description: 'Export production-ready assets (SVG, PNG, PDF) and author an end-to-end design case study.', expected_output: 'Export package and portfolio case study' }
      ]
    };
  }

  // AI Engineer
  if (career.includes('ai ') || career.includes('machine learning') || career.includes('deep learning') || title.includes('model') || domain.includes('ai')) {
    return {
      defaultType: 'code_repo',
      placeholder: 'e.g. Model trained with PyTorch/Scikit-Learn, evaluation metrics benchmarked, reproducible notebook with model card',
      suggestedDeliverables: [
        { title: 'Model Training & Evaluation Notebook (Jupyter)', type: 'dataset' },
        { title: 'Inference API & Interactive Demo Application', type: 'live_demo' },
        { title: 'Model Performance & Error Analysis Report', type: 'report_doc' }
      ],
      fallbackTasks: [
        { order: 1, title: 'Dataset Curation, Cleaning & EDA', description: 'Explore feature distributions, handle missing values, and structure training/validation/test splits.', expected_output: 'Cleaned dataset and EDA notebook' },
        { order: 2, title: 'Baseline Model Implementation & Feature Engineering', description: 'Build and evaluate benchmark model, engineer domain features, and establish evaluation metric.', expected_output: 'Benchmark training script' },
        { order: 3, title: 'Model Optimization & Hyperparameter Tuning', description: 'Train candidate models, tune hyperparameters, and track experiments (loss/accuracy curves).', expected_output: 'Optimized model weights/artifacts' },
        { order: 4, title: 'Performance Evaluation & Error Analysis', description: 'Generate confusion matrix, ROC-AUC, precision-recall curve, and diagnose error patterns.', expected_output: 'Evaluation report and metric tables' },
        { order: 5, title: 'Inference Pipeline, Model Card & Reproducibility Guide', description: 'Package model into reproducible inference script or API with documented limitations.', expected_output: 'Model card and inference demo' }
      ]
    };
  }

  // Default / Backend Developer / Technical
  return {
    defaultType: 'code_repo',
    placeholder: 'e.g. Built using clean modular architecture, verified with automated tests, documented in README',
    suggestedDeliverables: [
      { title: 'Core Source Code Repository (GitHub / GitLab)', type: 'code_repo' },
      { title: 'Live Deployed Application or Interactive Demo', type: 'live_demo' },
      { title: 'Technical Architecture & Implementation Report', type: 'report_doc' }
    ],
    fallbackTasks: [
      { order: 1, title: 'Requirements Definition & Solution Architecture', description: 'Analyze problem constraints, select appropriate tech stack, and design architecture.', expected_output: 'Architecture specification document' },
      { order: 2, title: 'Core Implementation & Foundation Setup', description: 'Build foundational modules, configuration, and fundamental domain logic.', expected_output: 'Working baseline application' },
      { order: 3, title: 'Feature Development & Business Logic', description: 'Implement primary end-to-end features according to specifications.', expected_output: 'Completed functional features' },
      { order: 4, title: 'Quality Assurance, Edge Case & Error Testing', description: 'Author tests validating edge cases, performance boundaries, and error recovery.', expected_output: 'Automated test suite results' },
      { order: 5, title: 'Documentation, Deployment & Reflection', description: 'Document usage guide, deployment runbook, and author reflection on design trade-offs.', expected_output: 'Comprehensive project README' }
    ]
  };
}

const DELIVERABLE_TYPE_OPTIONS = [
  { value: 'code_repo', label: 'Code Repository (GitHub / GitLab / Bitbucket)' },
  { value: 'live_demo', label: 'Live Demo / Deployed Application' },
  { value: 'report_doc', label: 'Written Report / Case Study / PDF' },
  { value: 'spreadsheet', label: 'Spreadsheet / Financial Model / Costing Sheet' },
  { value: 'map_spatial', label: 'GIS Map / Web Map / Spatial Analysis' },
  { value: 'lesson_plan', label: 'Lesson Plan / Curriculum / Rubric' },
  { value: 'presentation', label: 'Slide Deck / Video Walkthrough (Slides / Loom)' },
  { value: 'design_work', label: 'Design System / Mockups (Figma / Behance)' },
  { value: 'culinary_portfolio', label: 'Culinary Standardization / Menu / Food Safety' },
  { value: 'clinical_simulation', label: 'Simulated Care Plan / Clinical Protocol' },
  { value: 'dataset', label: 'Dataset / Notebook (Jupyter / Colab)' },
  { value: 'other', label: 'Other Documented Workplace Evidence' }
];

function getDeliverableIcon(type) {
  switch (type) {
    case 'code_repo':
    case 'github_repo':
      return <FolderGit2 size={18} color="#2563eb" />;
    case 'live_demo':
      return <Globe size={18} color="#16a34a" />;
    case 'spreadsheet':
      return <FileSpreadsheet size={18} color="#059669" />;
    case 'map_spatial':
      return <Compass size={18} color="#d97706" />;
    case 'lesson_plan':
      return <BookOpen size={18} color="#9333ea" />;
    case 'presentation':
      return <Eye size={18} color="#4f46e5" />;
    case 'design_work':
      return <Sparkles size={18} color="#ec4899" />;
    case 'culinary_portfolio':
      return <Utensils size={18} color="#ea580c" />;
    case 'clinical_simulation':
      return <ShieldCheck size={18} color="#0284c7" />;
    case 'dataset':
      return <Layers size={18} color="#0d9488" />;
    default:
      return <FileText size={18} color="#7c3aed" />;
  }
}

function resolveInitialTasks(project, helpers) {
  if (Array.isArray(project.tasks_progress) && project.tasks_progress.length > 0) {
    return project.tasks_progress;
  }
  if (Array.isArray(project.step_by_step_tasks) && project.step_by_step_tasks.length > 0) {
    return project.step_by_step_tasks;
  }
  if (Array.isArray(project.tasks) && project.tasks.length > 0) {
    return project.tasks;
  }
  return helpers.fallbackTasks;
}

function getCleanBrief(project) {
  const raw = project.brief || project.description || '';
  if (!raw || raw.toLowerCase().includes('introductory workplace artifact') || raw.toLowerCase().includes('baseline deliverable')) {
    return `Plan, execute, and document a complete, professional ${project.title} exercising the core competencies expected of a ${project.career_title || 'practitioner'}.`;
  }
  return raw;
}

export function ProjectWorkspaceModal({
  project,
  onClose,
  onUpdate,
  onComplete
}) {
  const helpers = getDomainHelpers(project);

  const [activeTab, setActiveTab] = useState('brief');
  const [tasks, setTasks] = useState(() => resolveInitialTasks(project, helpers));
  const [deliverables, setDeliverables] = useState(project.deliverables || []);
  const [reflection, setReflection] = useState(project.reflection || {
    whatLearned: '',
    difficulties: '',
    whatToImprove: ''
  });

  // Deliverable form state
  const [editingDelId, setEditingDelId] = useState(null);
  const [delTitle, setDelTitle] = useState('');
  const [delType, setDelType] = useState(helpers.defaultType);
  const [delUrl, setDelUrl] = useState('');
  const [delNotes, setDelNotes] = useState('');
  const [delError, setDelError] = useState(null);
  const [delSuccess, setDelSuccess] = useState(null);
  const [delLoading, setDelLoading] = useState(false);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [reopenEditing, setReopenEditing] = useState(false);

  useEffect(() => {
    const curHelpers = getDomainHelpers(project);
    setTasks(resolveInitialTasks(project, curHelpers));
    setDeliverables(project.deliverables || []);
    if (project.reflection) {
      setReflection(project.reflection);
    }
  }, [project]);

  const completedTasksCount = tasks.filter((t) => t.completed).length;
  const progressPercent = tasks.length > 0 ? Math.round((completedTasksCount / tasks.length) * 100) : 0;
  const isCompleted = project.status === 'completed' && !reopenEditing;

  const tierLabels = {
    1: { label: 'Level 1 — Starter', class: 'badge-starter', color: '#0284c7', bg: '#e0f2fe' },
    2: { label: 'Level 2 — Practical', class: 'badge-practical', color: '#16a34a', bg: '#dcfce7' },
    3: { label: 'Level 3 — Career-Ready', class: 'badge-career', color: '#7c3aed', bg: '#f3e8ff' }
  };
  const tierInfo = tierLabels[project.tier || project.difficulty_level] || tierLabels[1];

  async function handleToggleTask(taskOrder, curCompleted) {
    if (isCompleted) return;
    const nextCompleted = !curCompleted;
    const updatedTasks = tasks.map((t) =>
      (t.order === taskOrder || t.step_number === taskOrder) ? { ...t, completed: nextCompleted } : t
    );
    setTasks(updatedTasks);

    try {
      await api.updateProjectTask(project.id, {
        taskOrder,
        completed: nextCompleted
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to update task:', err);
      // Revert on error
      setTasks(tasks);
    }
  }

  function handleApplySuggestedDeliverable(suggested) {
    setDelTitle(suggested.title);
    setDelType(suggested.type);
    setEditingDelId(null);
    setDelError(null);
    setDelSuccess(`Applied suggested template: "${suggested.title}"`);
    setTimeout(() => setDelSuccess(null), 3000);
  }

  function handleStartEditDeliverable(del) {
    setEditingDelId(del.id || null);
    setDelTitle(del.title || '');
    setDelType(del.type || del.deliverable_type || helpers.defaultType);
    setDelUrl(del.url || del.link_url || '');
    setDelNotes(del.notes || '');
    setDelError(null);
    setDelSuccess(null);
    setActiveTab('deliverables');
  }

  function handleCancelEditDeliverable() {
    setEditingDelId(null);
    setDelTitle('');
    setDelType(helpers.defaultType);
    setDelUrl('');
    setDelNotes('');
    setDelError(null);
  }

  async function handleSaveDeliverable(e) {
    e.preventDefault();
    setDelError(null);
    setDelSuccess(null);

    const trimmedTitle = delTitle.trim();
    if (!trimmedTitle) {
      setDelError('Please provide a title for this deliverable.');
      return;
    }

    const trimmedUrl = delUrl.trim();
    if (trimmedUrl) {
      try {
        const parsed = new URL(trimmedUrl);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          setDelError('Deliverable link must use HTTP or HTTPS.');
          return;
        }
      } catch {
        setDelError('Please enter a valid web URL (e.g. https://github.com/... or https://...)');
        return;
      }
    }

    setDelLoading(true);
    try {
      const payload = {
        id: editingDelId || undefined,
        title: trimmedTitle,
        type: delType,
        deliverableType: delType,
        url: trimmedUrl || undefined,
        linkUrl: trimmedUrl || undefined,
        notes: delNotes.trim() || undefined
      };

      const res = await api.addProjectDeliverable(project.id, payload);
      const updatedProject = res.data;
      setDeliverables(updatedProject.deliverables || []);
      setEditingDelId(null);
      setDelTitle('');
      setDelUrl('');
      setDelNotes('');
      setDelSuccess(editingDelId ? 'Deliverable updated successfully.' : 'Deliverable attached successfully.');
      setTimeout(() => setDelSuccess(null), 3500);
      if (onUpdate) onUpdate();
    } catch (err) {
      setDelError(err.message || 'Failed to save deliverable.');
    } finally {
      setDelLoading(false);
    }
  }

  async function handleRemoveDeliverable(del, index) {
    if (isCompleted) return;
    try {
      const targetIdentifier = del.id || index;
      const res = await api.removeProjectDeliverable(project.id, targetIdentifier);
      const updatedProject = res.data;
      setDeliverables(updatedProject.deliverables || []);
      if (editingDelId === del.id) {
        handleCancelEditDeliverable();
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Failed to remove deliverable:', err);
      setDelError(err.message || 'Failed to remove deliverable.');
    }
  }

  async function handleStatusChange(nextStatus) {
    setStatusLoading(true);
    try {
      await api.updateProjectStatus(project.id, { status: nextStatus });
      if (onUpdate) onUpdate();
    } catch (err) {
      alert(err.message || 'Failed to update status');
    } finally {
      setStatusLoading(false);
    }
  }

  async function handleSubmitProject(e) {
    e.preventDefault();
    setSubmitError(null);

    if (deliverables.length === 0) {
      setSubmitError('Please attach at least one deliverable or piece of evidence before completing.');
      setActiveTab('deliverables');
      return;
    }

    if (!reflection.whatLearned?.trim() || !reflection.difficulties?.trim() || !reflection.whatToImprove?.trim()) {
      setSubmitError('Please answer all 3 reflection questions below to document your learning and problem solving.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        deliverables,
        reflection: {
          whatLearned: reflection.whatLearned.trim(),
          difficulties: reflection.difficulties.trim(),
          whatToImprove: reflection.whatToImprove.trim()
        },
        skillIds: project.skills ? project.skills.map(s => typeof s === 'string' ? s : s.id).filter(Boolean) : []
      };

      const res = await api.submitProject(project.id, payload);
      const completedProject = res.data?.project || res.data;
      if (onComplete) onComplete(completedProject);
      if (onUpdate) onUpdate();
      setReopenEditing(false);
      setActiveTab('reflection');
    } catch (err) {
      setSubmitError(err.message || 'Submission failed. Please check inputs and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const skillsList = Array.isArray(project.skills) ? project.skills : [];
  const cleanBrief = getCleanBrief(project);

  return (
    <div className="project-modal-backdrop" onClick={onClose}>
      <div className="project-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="project-modal-header">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 6,
                  color: tierInfo.color,
                  backgroundColor: tierInfo.bg
                }}
              >
                {tierInfo.label}
              </span>
              <span className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
                {project.career_title || 'Career Project'}
              </span>
              {project.status && (
                <span
                  className={`status-pill ${
                    project.status === 'completed'
                      ? 'open'
                      : project.status === 'paused'
                      ? 'warning'
                      : 'upcoming'
                  }`}
                  style={{ textTransform: 'capitalize' }}
                >
                  {project.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <h1 style={{ fontSize: 21, margin: 0, fontWeight: 800, color: 'var(--ink)' }}>
              {project.title}
            </h1>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close project workspace">
            <X size={20} />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="project-modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'brief' ? 'active' : ''}`}
            onClick={() => setActiveTab('brief')}
          >
            Project Brief
          </button>
          <button
            className={`tab-btn ${activeTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setActiveTab('tasks')}
          >
            Step-by-Step Tasks ({completedTasksCount}/{tasks.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'deliverables' ? 'active' : ''}`}
            onClick={() => setActiveTab('deliverables')}
          >
            Deliverables & Proof ({deliverables.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'reflection' ? 'active' : ''}`}
            onClick={() => setActiveTab('reflection')}
          >
            {project.status === 'completed' && !reopenEditing ? 'Evidence & Completed State' : 'Submit & Complete'}
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="project-modal-body">
          {/* TAB 1: BRIEF */}
          {activeTab === 'brief' && (
            <div className="workspace-stack">
              <div className="workspace-section">
                <h3>What You Will Produce</h3>
                <p style={{ lineHeight: 1.6 }}>{cleanBrief}</p>
              </div>

              {project.problem_statement && (
                <div className="workspace-section">
                  <h3>Real-World Scenario / Problem Context</h3>
                  <div className="callout" style={{ background: '#f8fafc', borderColor: '#e2e8f0', color: '#1e293b' }}>
                    <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>{project.problem_statement}</p>
                  </div>
                </div>
              )}

              <div className="workspace-section">
                <h3>Why This Matters Professionally</h3>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                  Demonstrates applied practical mastery for <strong>{project.career_title || 'this role'}</strong>. Employers and clients look for demonstrated proof of domain methodology rather than theoretical claims.
                </p>
              </div>

              <div className="workspace-section">
                <h3>Skills Exercised</h3>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {skillsList.map((skill, idx) => {
                    const name = formatSkillDisplayName(skill);
                    const stableKey = typeof skill === 'object' ? (skill?.skill_id || skill?.id || idx) : idx;
                    return (
                      <span
                        key={stableKey}
                        style={{
                          background: '#eff6ff',
                          color: '#1d4ed8',
                          padding: '4px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Check size={12} /> {name}
                      </span>
                    );
                  })}
                  {skillsList.length === 0 && (
                    <span className="muted" style={{ fontSize: 12 }}>Core competencies for {project.career_title}</span>
                  )}
                </div>
              </div>

              {project.acceptance_criteria && Array.isArray(project.acceptance_criteria) && project.acceptance_criteria.length > 0 && (
                <div className="workspace-section">
                  <h3>Acceptance Criteria</h3>
                  <ul className="criteria-list" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                    {project.acceptance_criteria.map((crit, idx) => (
                      <li key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8, fontSize: 13 }}>
                        <CheckCircle2 size={16} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>{crit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {project.prerequisites && (
                <div className="workspace-section">
                  <h3>Prerequisites & Baseline Knowledge</h3>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {Array.isArray(project.prerequisites) ? project.prerequisites.join(' • ') : project.prerequisites}
                  </p>
                </div>
              )}

              {project.estimated_hours && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                  <Clock3 size={14} /> Estimated Effort: <strong>{project.estimated_hours} hours</strong>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TASKS CHECKLIST */}
          {activeTab === 'tasks' && (
            <div className="workspace-stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16 }}>Structured Task Checklist</h3>
                  <span className="muted" style={{ fontSize: 12 }}>
                    Sequential tasks tailored for {project.career_title}. Check off each stage as you work.
                  </span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--blue)' }}>{progressPercent}% Complete</span>
                  <div className="progress" style={{ width: 140, height: 6, marginTop: 4 }}>
                    <i style={{ width: `${progressPercent}%` }}></i>
                  </div>
                </div>
              </div>

              <div className="tasks-container">
                {tasks.map((task, idx) => {
                  const orderNum = task.order ?? task.step_number ?? (idx + 1);
                  const isTaskDone = !!task.completed;
                  return (
                    <div
                      key={orderNum}
                      className={`task-row ${isTaskDone ? 'completed' : ''}`}
                      onClick={() => handleToggleTask(orderNum, isTaskDone)}
                    >
                      <button
                        className="task-check-btn"
                        disabled={isCompleted}
                        aria-label={isTaskDone ? 'Mark task incomplete' : 'Mark task complete'}
                      >
                        {isTaskDone ? (
                          <CheckCircle2 size={18} color="#16a34a" />
                        ) : (
                          <Circle size={18} color="#94a3b8" />
                        )}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--muted)' }}>
                            STEP {orderNum}
                          </span>
                          <span
                            className="task-title"
                            style={{
                              textDecoration: isTaskDone ? 'line-through' : 'none',
                              fontWeight: 700,
                              fontSize: 13,
                              color: isTaskDone ? 'var(--muted)' : 'var(--ink)'
                            }}
                          >
                            {task.task_name || task.title || task.name}
                          </span>
                        </div>
                        {task.description && (
                          <p style={{ margin: '4px 0 0', fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                            {task.description}
                          </p>
                        )}
                        {(task.expected_output || task.deliverable_hint) && (
                          <div style={{ marginTop: 4, fontSize: 11, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <strong>Deliverable Output:</strong> {task.expected_output || task.deliverable_hint}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DELIVERABLES */}
          {activeTab === 'deliverables' && (
            <div className="workspace-stack">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>Deliverables & Evidence of Work</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  Attach links or documentation for your work. Suitable for repositories, live deployments, spreadsheets, GIS maps, lesson plans, portfolios, or reports.
                </span>
              </div>

              {/* Suggested Deliverables Chips */}
              {!isCompleted && helpers.suggestedDeliverables && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={14} /> Suggested Deliverables for {project.career_title}:
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {helpers.suggestedDeliverables.map((sug, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplySuggestedDeliverable(sug)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #86efac',
                          borderRadius: 6,
                          padding: '4px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#15803d',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Plus size={12} /> {sug.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Existing Deliverables List */}
              <div className="deliverables-list" style={{ marginTop: 8 }}>
                {deliverables.map((del, idx) => {
                  const delTypeVal = del.type || del.deliverable_type || 'report_doc';
                  const delUrlVal = del.url || del.link_url;
                  const isVerified = !!del.verified;

                  return (
                    <div key={del.id || idx} className="deliverable-card">
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                        <div className="del-icon">
                          {getDeliverableIcon(delTypeVal)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{del.title}</span>
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '1px 6px',
                                borderRadius: 4,
                                background: '#f1f5f9',
                                color: '#475569'
                              }}
                            >
                              {delTypeVal.replace('_', ' ')}
                            </span>
                            {/* Evidence status badge distinguishing user submitted vs verified */}
                            {isVerified ? (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 7px',
                                  borderRadius: 4,
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <ShieldCheck size={11} /> Verified Proof
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 700,
                                  padding: '1px 7px',
                                  borderRadius: 4,
                                  background: '#fef3c7',
                                  color: '#b45309',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3
                                }}
                              >
                                <Clock3 size={11} /> User-Submitted Proof
                              </span>
                            )}
                          </div>

                          {delUrlVal && (
                            <a
                              href={delUrlVal}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontSize: 12, color: 'var(--blue)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3, wordBreak: 'break-all' }}
                            >
                              {delUrlVal} <ExternalLink size={12} />
                            </a>
                          )}
                          {del.notes && (
                            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)', lineHeight: 1.4 }}>
                              {del.notes}
                            </p>
                          )}
                        </div>
                      </div>

                      {!isCompleted && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
                          <button
                            className="icon-btn"
                            onClick={() => handleStartEditDeliverable(del)}
                            title="Edit deliverable"
                            style={{ color: 'var(--blue)' }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            className="icon-btn"
                            onClick={() => handleRemoveDeliverable(del, idx)}
                            title="Remove deliverable"
                            style={{ color: '#ef4444' }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {deliverables.length === 0 && (
                  <div className="empty-state" style={{ padding: 24, margin: '8px 0' }}>
                    <FolderGit2 size={24} />
                    <h2 style={{ fontSize: 14 }}>No deliverables attached yet</h2>
                    <p style={{ fontSize: 12 }}>Add your first deliverable link or workplace evidence below.</p>
                  </div>
                )}
              </div>

              {/* Add / Edit Deliverable Form */}
              {!isCompleted && (
                <div className="panel" style={{ padding: 18, background: '#f8fafc', marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ margin: 0, fontSize: 14 }}>
                      {editingDelId ? 'Edit Attached Deliverable' : 'Attach Workplace Deliverable'}
                    </h4>
                    {editingDelId && (
                      <button
                        type="button"
                        onClick={handleCancelEditDeliverable}
                        style={{ background: 'transparent', border: 0, color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}
                      >
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <form onSubmit={handleSaveDeliverable} style={{ display: 'grid', gap: 12 }}>
                    {delError && (
                      <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                        {delError}
                      </div>
                    )}
                    {delSuccess && (
                      <div style={{ color: '#15803d', background: '#dcfce7', padding: '8px 12px', borderRadius: 6, fontSize: 12 }}>
                        {delSuccess}
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                          DELIVERABLE TITLE *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Standardized Menu Costing Sheet, Pipeline Repo, Lesson Plan PDF"
                          value={delTitle}
                          onChange={(e) => setDelTitle(e.target.value)}
                          required
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 6 }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                          DELIVERABLE TYPE
                        </label>
                        <select
                          value={delType}
                          onChange={(e) => setDelType(e.target.value)}
                          style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 6 }}
                        >
                          {DELIVERABLE_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                        LINK URL (OPTIONAL FOR DOCUMENTS / LOCAL WORK, HTTP / HTTPS)
                      </label>
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..., https://github.com/..., https://..."
                        value={delUrl}
                        onChange={(e) => setDelUrl(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 6 }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                        METHODOLOGY NOTES / CONTEXT
                      </label>
                      <input
                        type="text"
                        placeholder={helpers.placeholder}
                        value={delNotes}
                        onChange={(e) => setDelNotes(e.target.value)}
                        style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--line)', borderRadius: 6 }}
                      />
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        type="submit"
                        className="btn primary small"
                        disabled={delLoading}
                      >
                        <Plus size={14} /> {delLoading ? 'Saving...' : editingDelId ? 'Save Changes' : 'Attach Deliverable'}
                      </button>
                      {editingDelId && (
                        <button
                          type="button"
                          className="btn ghost small"
                          onClick={handleCancelEditDeliverable}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SUBMIT & REFLECTION */}
          {activeTab === 'reflection' && (
            <div className="workspace-stack">
              <div>
                <h3 style={{ margin: 0, fontSize: 16 }}>
                  {project.status === 'completed' && !reopenEditing ? 'Completed Project & Verified Evidence' : 'Document Your Learning & Complete Project'}
                </h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  Employers, clients, and mentors evaluate methodology, problem-solving under constraints, and growth mindset.
                </span>
              </div>

              {submitError && (
                <div style={{ color: '#b91c1c', background: '#fee2e2', padding: '10px 14px', borderRadius: 6, fontSize: 13 }}>
                  {submitError}
                </div>
              )}

              {/* Readiness Status Checklist */}
              {!isCompleted && (
                <div className="panel" style={{ padding: 14, background: '#f8fafc', display: 'grid', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>Completion Readiness:</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    {completedTasksCount >= tasks.length ? (
                      <CheckCircle2 size={15} color="#16a34a" />
                    ) : (
                      <AlertCircle size={15} color="#d97706" />
                    )}
                    <span>
                      Step-by-Step Checklist: <strong>{completedTasksCount} of {tasks.length}</strong> tasks checked.
                      {completedTasksCount < tasks.length && ' (Optional: you can still submit if evidence is complete)'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                    {deliverables.length > 0 ? (
                      <CheckCircle2 size={15} color="#16a34a" />
                    ) : (
                      <AlertCircle size={15} color="#ef4444" />
                    )}
                    <span>
                      Deliverables Attached: <strong>{deliverables.length}</strong> deliverable{deliverables.length === 1 ? '' : 's'}.
                      {deliverables.length === 0 && ' (Required: attach at least 1 deliverable in Deliverables tab)'}
                    </span>
                  </div>
                </div>
              )}

              {project.status === 'completed' && !reopenEditing && (
                <div className="callout" style={{ background: '#ecfdf5', borderColor: '#a7f3d0', color: '#065f46' }}>
                  <Award size={22} style={{ flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 14 }}>Project Completed & Verified as Demonstrated Evidence</strong>
                    <p style={{ margin: '4px 0 0', fontSize: 12, lineHeight: 1.5 }}>
                      This completed project unlocks proficiency evidence for <strong>{project.career_title}</strong> and is featured in your portfolio.
                    </p>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn outline small"
                        onClick={() => setReopenEditing(true)}
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        Update Deliverables or Reflection
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmitProject} style={{ display: 'grid', gap: 16, marginTop: 8 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                    1. What did you learn and accomplish through this project? *
                  </label>
                  <textarea
                    rows={3}
                    disabled={isCompleted}
                    value={reflection.whatLearned}
                    onChange={(e) => setReflection({ ...reflection, whatLearned: e.target.value })}
                    placeholder={`Describe the domain concepts applied for ${project.career_title}, tools/methodologies used, and the final deliverable produced.`}
                    required
                    style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid var(--line)', borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                    2. What difficulties or challenges did you encounter, and how did you resolve them? *
                  </label>
                  <textarea
                    rows={3}
                    disabled={isCompleted}
                    value={reflection.difficulties}
                    onChange={(e) => setReflection({ ...reflection, difficulties: e.target.value })}
                    placeholder="Explain obstacles encountered (e.g. edge cases, tool constraints, unexpected data, cost limits) and your problem-solving process."
                    required
                    style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid var(--line)', borderRadius: 8 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', display: 'block', marginBottom: 6 }}>
                    3. What would you improve or do differently in a future iteration? *
                  </label>
                  <textarea
                    rows={3}
                    disabled={isCompleted}
                    value={reflection.whatToImprove}
                    onChange={(e) => setReflection({ ...reflection, whatToImprove: e.target.value })}
                    placeholder="Mention features, optimizations, better methodologies, or scaling factors you would adopt next time."
                    required
                    style={{ width: '100%', padding: 10, fontSize: 13, border: '1px solid var(--line)', borderRadius: 8 }}
                  />
                </div>

                {!isCompleted && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                    {reopenEditing && (
                      <button
                        type="button"
                        className="btn outline"
                        onClick={() => setReopenEditing(false)}
                        style={{ padding: '9px 16px' }}
                      >
                        Cancel Editing
                      </button>
                    )}
                    <button
                      type="submit"
                      className="btn primary"
                      disabled={submitting}
                      style={{ padding: '9px 20px' }}
                    >
                      <Award size={16} /> {submitting ? 'Verifying & Submitting...' : reopenEditing ? 'Save Updated Submission' : 'Complete Project & Verify Skills'}
                    </button>
                  </div>
                )}
              </form>
            </div>
          )}
        </div>

        {/* Modal Footer Lifecycle Actions */}
        <div className="project-modal-footer">
          <div style={{ display: 'flex', gap: 8 }}>
            {project.status === 'in_progress' && (
              <button
                className="btn outline small"
                disabled={statusLoading}
                onClick={() => handleStatusChange('paused')}
              >
                <Pause size={13} /> Pause Project
              </button>
            )}
            {project.status === 'paused' && (
              <button
                className="btn primary small"
                disabled={statusLoading}
                onClick={() => handleStatusChange('in_progress')}
              >
                <Play size={13} /> Resume Project
              </button>
            )}
            {project.status !== 'archived' && (
              <button
                className="btn ghost small"
                disabled={statusLoading}
                onClick={() => handleStatusChange('archived')}
              >
                <Archive size={13} /> Archive
              </button>
            )}
            {project.status === 'archived' && (
              <button
                className="btn outline small"
                disabled={statusLoading}
                onClick={() => handleStatusChange('in_progress')}
              >
                <RotateCcw size={13} /> Unarchive
              </button>
            )}
          </div>
          <div>
            <button className="btn outline small" onClick={onClose}>
              Close Workspace
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
