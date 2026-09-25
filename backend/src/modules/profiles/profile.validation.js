import { z } from 'zod';

const education = z.object({
  qualification: z.string().trim().min(1).max(200),
  status: z.string().trim().min(1).max(50),
  year: z.number().int().min(1900).max(2200).optional()
}).strict();

const skill = z.object({
  name: z.string().trim().min(1).max(150),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert', 'unknown']).default('beginner'),
  years_experience: z.number().min(0).max(100).optional()
}).strict();

export const profileSchema = z.object({
  education: z.array(education).optional(),
  skills: z.array(skill).optional(),
  experience: z.array(z.record(z.string(), z.unknown())).optional(),
  interests: z.array(z.string().trim().min(1).max(150)).optional(),
  preferred_locations: z.array(z.string().trim().min(1).max(150)).optional(),
  career_goal: z.string().trim().max(250).nullable().optional(),
  constraints: z.record(z.string(), z.unknown()).optional()
}).strict();
