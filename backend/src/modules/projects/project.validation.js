import { z } from 'zod';

export const projectRecommendQuerySchema = z.object({
  careerId: z.string().optional(),
  career_id: z.string().optional(),
  careerTitle: z.string().optional(),
  career_title: z.string().optional(),
  force_refresh: z.coerce.string().optional(),
  forceRefresh: z.coerce.string().optional(),
  level: z.coerce.number().int().min(1).max(3).optional()
});

export const startProjectSchema = z.object({
  projectId: z.string().optional(),
  career_project_id: z.string().optional(),
  careerId: z.string().optional(),
  career_id: z.string().optional(),
  careerTitle: z.string().max(200).optional(),
  career_title: z.string().max(200).optional(),
  pathwayId: z.string().optional(),
  pathway_id: z.string().optional(),
  userPathwayStepId: z.string().optional(),
  user_pathway_step_id: z.string().optional(),
  title: z.string().max(250).optional(),
  project_title: z.string().max(250).optional(),
  difficultyLevel: z.coerce.number().int().min(1).max(3).optional(),
  tier: z.coerce.number().int().min(1).max(3).optional(),
  difficultyLabel: z.enum(['Starter', 'Practical', 'Career-Ready']).optional(),
  projectType: z.string().max(50).default('technical'),
  brief: z.string().optional(),
  problemStatement: z.string().optional(),
  learningObjectives: z.array(z.string()).default([]),
  prerequisites: z.array(z.string()).default([]),
  tasks: z.array(z.any()).default([]),
  step_by_step_tasks: z.array(z.any()).default([]),
  deliverables: z.array(z.any()).default([]),
  acceptanceCriteria: z.array(z.string()).default([]),
  skills: z.array(z.any()).default([]),
  starterTemplate: z.record(z.any()).default({}),
  nextStep: z.string().optional()
}).refine(data => {
  return Boolean((data.title && data.title.trim()) || (data.project_title && data.project_title.trim()));
}, {
  message: 'Title is required',
  path: ['title']
});

export const updateProjectSchema = z.object({
  title: z.string().max(250).optional(),
  status: z.enum(['suggested', 'planned', 'in_progress', 'paused', 'submitted', 'completed', 'archived']).optional(),
  progressPercent: z.number().int().min(0).max(100).optional(),
  tasksProgress: z.array(z.object({
    order: z.number().int().optional(),
    title: z.string().optional(),
    completed: z.boolean().default(false),
    notes: z.string().optional()
  })).optional(),
  brief: z.string().optional(),
  problemStatement: z.string().optional(),
  reflection: z.object({
    whatLearned: z.string().optional(),
    challengesFaced: z.string().optional(),
    whatWouldImprove: z.string().optional(),
    nextSteps: z.string().optional()
  }).optional(),
  isInPortfolio: z.boolean().optional(),
  portfolioOrder: z.number().int().optional(),
  portfolioSummary: z.string().optional(),
  portfolioApproach: z.string().optional(),
  portfolioToolsUsed: z.array(z.string()).optional(),
  portfolioOutcomes: z.string().optional(),
  portfolioLimitations: z.string().optional(),
  portfolioLessons: z.string().optional(),
  customMetadata: z.record(z.any()).optional()
});

export const deliverableSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, 'Deliverable title is required').max(200),
  type: z.string().optional(),
  deliverableType: z.string().optional(),
  deliverable_type: z.string().optional(),
  url: z.string().optional(),
  linkUrl: z.string().optional(),
  link_url: z.string().optional(),
  notes: z.string().max(2000).optional(),
  verified: z.boolean().optional()
}).transform(data => {
  const resolvedType = (data.type || data.deliverableType || data.deliverable_type || 'report_doc').trim();
  const normalizedType = resolvedType === 'github_repo' ? 'code_repo' : resolvedType;
  const resolvedUrl = (data.url || data.linkUrl || data.link_url || '').trim();
  return {
    ...data,
    type: normalizedType,
    deliverable_type: normalizedType,
    url: resolvedUrl,
    link_url: resolvedUrl,
    linkUrl: resolvedUrl
  };
}).refine(data => {
  const allowed = [
    'code_repo', 'live_demo', 'report_doc', 'map_spatial',
    'lesson_plan', 'presentation', 'dataset', 'case_study',
    'architecture', 'test_results', 'design_work', 'spreadsheet',
    'culinary_portfolio', 'clinical_simulation', 'financial_model',
    'recipe_costing', 'other'
  ];
  return allowed.includes(data.type);
}, {
  message: 'Invalid deliverable type',
  path: ['type']
}).refine(data => {
  const target = data.url;
  if (!target) return true;
  if (!/^https?:\/\//i.test(target)) return false;
  try {
    const parsed = new URL(target);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}, {
  message: 'URL must be a valid HTTP or HTTPS address (e.g. https://github.com/...)',
  path: ['url']
});

export const submitProjectSchema = z.object({
  deliverables: z.array(deliverableSchema).min(1, 'At least one deliverable or link is required for completion'),
  reflection: z.object({
    whatLearned: z.string().optional(),
    difficulties: z.string().optional(),
    challengesFaced: z.string().optional(),
    whatToImprove: z.string().optional(),
    whatWouldImprove: z.string().optional(),
    nextSteps: z.string().optional()
  }).optional().default({}),
  evaluationChecklist: z.array(z.string()).optional(),
  addToPortfolio: z.boolean().default(true)
});

export const portfolioUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  professionalTitle: z.string().max(250).optional(),
  bio: z.string().max(2500).optional(),
  targetCareerId: z.string().uuid().nullable().optional(),
  targetCareerTitle: z.string().max(250).optional(),
  contactEmail: z.string().email().nullable().optional().or(z.literal('')),
  socialLinks: z.object({
    github: z.string().optional(),
    linkedin: z.string().optional(),
    website: z.string().optional(),
    twitter: z.string().optional()
  }).optional(),
  isPublic: z.boolean().optional(),
  shareSlug: z.string().regex(/^[a-z0-9-_]+$/i, 'Slug must contain only alphanumeric characters, dashes, or underscores').max(100).optional(),
  privacySettings: z.object({
    showEmail: z.boolean().optional(),
    showEducation: z.boolean().optional(),
    showSkills: z.boolean().optional(),
    allowDownload: z.boolean().optional()
  }).optional(),
  featuredProjectIds: z.array(z.string().uuid()).optional()
});

export const addDeliverableSchema = deliverableSchema;
export const recommendationQuerySchema = projectRecommendQuerySchema;
export const updateTaskProgressSchema = z.object({
  taskOrder: z.number().int().min(1),
  completed: z.boolean(),
  notes: z.string().optional()
});
export const updateProjectStatusSchema = z.object({
  status: z.enum(['suggested', 'planned', 'in_progress', 'paused', 'submitted', 'completed', 'archived'])
});
export const updatePortfolioSchema = portfolioUpdateSchema;

