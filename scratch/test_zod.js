import { z } from 'zod';

const education = z.object({
  level: z.string().trim().min(1).max(200).optional(),
  stream: z.string().trim().min(1).max(200).optional(),
  degree: z.string().trim().min(1).max(200).optional(),
  specialization: z.string().trim().min(1).max(200).optional(),
  diplomaField: z.string().trim().min(1).max(200).optional(),
  qualification: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(50).optional(),
  year: z.number().int().min(1900).max(2200).optional()
}).passthrough();

const schema = z.object({
  education: z.array(education).optional(),
  career_goal: z.string().trim().max(250).nullable().optional(),
}).strict();

const result = schema.safeParse({
  education: [
    {
      level: "Undergraduate",
      qualification: "Undergraduate",
      status: "pursuing"
    }
  ],
  career_goal: ""
});

console.log(JSON.stringify(result, null, 2));
