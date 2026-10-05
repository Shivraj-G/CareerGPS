import { z } from 'zod';

const education = z.object({
  level: z.string().trim().min(1).max(200).optional(),
  stream: z.string().trim().min(1).max(200).optional(),
  degree: z.string().trim().min(1).max(200).optional(),
  specialization: z.string().trim().min(1).max(200).optional(),
  diplomaField: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  year: z.number().int().min(1).max(2200).optional(),
  education_stage: z.enum(['SCHOOL_12', 'HIGHER_EDUCATION', 'WORKING_PROFESSIONAL']).optional(),
  school_12_status: z.enum(['PURSUING', 'COMPLETED']).optional(),
  school_12_stream: z.string().trim().min(1).max(200).optional(),
  current_program: z.string().trim().min(1).max(200).optional()
}).passthrough();

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
  career_id: z.string().uuid().nullable().optional(),
  constraints: z.record(z.string(), z.unknown()).optional()
}).strict();
