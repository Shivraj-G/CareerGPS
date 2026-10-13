BEGIN;

-- Add skills for Mass Communication & Media
INSERT INTO skills (name, category, record_status) VALUES
('Journalism', 'media', 'published'),
('News Writing', 'media', 'published'),
('Media Production', 'media', 'published'),
('Editing', 'media', 'published'),
('Storytelling', 'media', 'published'),
('Digital Media', 'media', 'published'),
('Public Relations', 'media', 'published'),
('Media Research', 'media', 'published'),
('Copywriting', 'communication', 'published'),
('Public Speaking', 'communication', 'published'),
('Communication', 'soft_skill', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Psychology
INSERT INTO skills (name, category, record_status) VALUES
('Counseling', 'psychology', 'published'),
('Behavioral Analysis', 'psychology', 'published'),
('Clinical Psychology', 'psychology', 'published'),
('Psychotherapy', 'psychology', 'published'),
('Mental Health Assessment', 'psychology', 'published'),
('Cognitive Behavioral Therapy (CBT)', 'psychology', 'published'),
('Psychological Testing', 'psychology', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Economics
INSERT INTO skills (name, category, record_status) VALUES
('Macroeconomics', 'business', 'published'),
('Microeconomics', 'business', 'published'),
('Econometrics', 'data_science', 'published'),
('Economic Forecasting', 'finance', 'published'),
('Quantitative Analysis', 'finance', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Agriculture
INSERT INTO skills (name, category, record_status) VALUES
('Agronomy', 'agriculture', 'published'),
('Crop Management', 'agriculture', 'published'),
('Soil Science', 'agriculture', 'published'),
('Agricultural Economics', 'agriculture', 'published'),
('Plant Pathology', 'agriculture', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Design
INSERT INTO skills (name, category, record_status) VALUES
('Graphic Design', 'design', 'published'),
('UI/UX Design', 'design', 'published'),
('Industrial Design', 'design', 'published'),
('Typography', 'design', 'published'),
('Adobe Creative Suite', 'tools', 'published'),
('Figma', 'tools', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Law
INSERT INTO skills (name, category, record_status) VALUES
('Legal Research', 'law', 'published'),
('Contract Drafting', 'law', 'published'),
('Litigation', 'law', 'published'),
('Corporate Law', 'law', 'published'),
('Intellectual Property', 'law', 'published'),
('Legal Compliance', 'law', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Nursing / Healthcare
INSERT INTO skills (name, category, record_status) VALUES
('Patient Care', 'healthcare', 'published'),
('Clinical Assessment', 'healthcare', 'published'),
('Basic Life Support (BLS)', 'healthcare', 'published'),
('Medication Administration', 'healthcare', 'published'),
('Health Records Management', 'healthcare', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Mechanical / Civil Engineering
INSERT INTO skills (name, category, record_status) VALUES
('SolidWorks', 'tools', 'published'),
('CAD', 'tools', 'published'),
('Fluid Mechanics', 'engineering', 'published'),
('Structural Engineering', 'engineering', 'published'),
('Construction Management', 'engineering', 'published'),
('Geotechnical Engineering', 'engineering', 'published')
ON CONFLICT (name) DO NOTHING;

COMMIT;
