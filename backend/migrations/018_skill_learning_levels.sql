BEGIN;

-- 1. Add learning_level and learning_metadata to skills
ALTER TABLE skills 
  ADD COLUMN IF NOT EXISTS learning_level VARCHAR(20) DEFAULT 'intermediate' CHECK (learning_level IN ('foundational', 'intermediate', 'advanced')),
  ADD COLUMN IF NOT EXISTS learning_metadata JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_skills_learning_level ON skills(learning_level);

-- 2. Map authentic medical skills for Doctor (1fbc7614-cf1f-460b-b167-6eda303bb61e)
INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status)
SELECT '1fbc7614-cf1f-460b-b167-6eda303bb61e', s.id, v.importance, 'curated', 'verified'
FROM (VALUES
  ('Anatomy', 'required'),
  ('Physiology', 'required'),
  ('Medical terminology', 'required'),
  ('Medical ethics', 'important'),
  ('Clinical history taking', 'required'),
  ('Clinical documentation', 'important'),
  ('Clinical handover communication', 'important'),
  ('Clinical Assessment', 'important'),
  ('Infection Control', 'important'),
  ('Clinical decision support', 'useful')
) AS v(skill_name, importance)
JOIN skills s ON s.name = v.skill_name
ON CONFLICT (career_id, skill_id) DO NOTHING;

-- 3. Map authentic medical/surgical skills for Surgeon (86b18b71-a8ea-45c2-8865-4a9d055a50b2)
INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status)
SELECT '86b18b71-a8ea-45c2-8865-4a9d055a50b2', s.id, v.importance, 'curated', 'verified'
FROM (VALUES
  ('Anatomy', 'required'),
  ('Physiology', 'required'),
  ('Medical terminology', 'required'),
  ('Infection Control', 'required'),
  ('Wound care fundamentals', 'required'),
  ('Clinical history taking', 'important'),
  ('Clinical handover communication', 'important'),
  ('Clinical Assessment', 'important'),
  ('Clinical decision support', 'required')
) AS v(skill_name, importance)
JOIN skills s ON s.name = v.skill_name
ON CONFLICT (career_id, skill_id) DO NOTHING;

-- 4. Set accurate default learning levels for foundational skills
UPDATE skills SET learning_level = 'foundational' WHERE name IN (
  'Python', 'Python programming', 'HTML', 'CSS', 'JavaScript', 'Git', 'GitHub', 'Excel', 'Microsoft Excel',
  'Problem Solving', 'Communication', 'Presentation Skills', 'Physical Fitness', 'Anatomy', 'Physiology',
  'Medical terminology', 'Medical ethics', 'Digital literacy', 'Professional communication', 'Adaptability',
  'Business Knowledge', 'Teamwork', 'Office Administration', 'Statistics', 'Statistics for geography',
  'Programming fundamentals', 'Linux fundamentals', 'First Aid'
);

-- 5. Set accurate default learning levels for intermediate skills
UPDATE skills SET learning_level = 'intermediate' WHERE name IN (
  'Machine Learning', 'Machine learning fundamentals', 'SQL', 'React', 'React.js', 'Node.js', 'Express.js',
  'PostgreSQL', 'MySQL', 'MongoDB', 'Data Cleaning', 'Data Visualisation', 'Power BI', 'Tableau', 'Reporting',
  'Data Handling', 'Business Analysis', 'ERP Concepts', 'Accounting', 'Teaching/Pedagogy',
  'Curriculum Development', 'Assessment and Evaluation', 'Clinical history taking', 'Clinical documentation',
  'Clinical handover communication', 'Clinical Assessment', 'Clinical Care', 'Infection Control',
  'Infection prevention and control', 'Wound care fundamentals', 'Law Knowledge', 'Critical Thinking',
  'API Testing', 'REST APIs', 'Spring Boot', 'TypeScript', 'Java', 'C++', 'UI/UX Design', 'Figma'
);

-- 6. Set accurate default learning levels for advanced skills
UPDATE skills SET learning_level = 'advanced' WHERE name IN (
  'LLM Concepts', 'RAG', 'Vector Search', 'Prompt Engineering', 'Docker', 'Kubernetes', 'System Design',
  'Software architecture fundamentals', 'Clinical decision support', 'Academic Writing', 'Research Methodology',
  'Research methods in psychology', 'Grant Writing', 'Litigation Strategy', 'Microservices'
);

COMMIT;
