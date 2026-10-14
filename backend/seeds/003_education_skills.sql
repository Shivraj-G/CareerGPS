
-- Add skills for Geography and GIS
INSERT INTO skills (name, category, record_status) VALUES
('GIS', 'geography', 'published'),
('QGIS', 'geography', 'published'),
('ArcGIS', 'geography', 'published'),
('Cartography', 'geography', 'published'),
('Remote Sensing', 'geography', 'published'),
('Spatial Analysis', 'geography', 'published'),
('Geospatial Data', 'geography', 'published'),
('GPS', 'geography', 'published'),
('Field Surveying', 'geography', 'published'),
('Environmental Studies', 'geography', 'published'),
('Geographic Research', 'geography', 'published')
ON CONFLICT (name) DO NOTHING;
-- Add skills for Biology
INSERT INTO skills (name, category, record_status) VALUES
('Biological Sciences', 'biology', 'published'),
('Laboratory Techniques', 'biology', 'published'),
('Scientific Research', 'biology', 'published'),
('Genetics', 'biology', 'published'),
('Microbiology', 'biology', 'published')
ON CONFLICT (name) DO NOTHING;
-- Add skills for Commerce / Accounting
INSERT INTO skills (name, category, record_status) VALUES
('Bookkeeping', 'finance', 'published'),
('Taxation', 'finance', 'published'),
('Auditing', 'finance', 'published'),
('Financial Reporting', 'finance', 'published'),
('Corporate Finance', 'finance', 'published'),
('Business Analysis', 'business', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for Mathematics / Statistics
INSERT INTO skills (name, category, record_status) VALUES
('Calculus', 'mathematics', 'published'),
('Probability', 'mathematics', 'published'),
('Statistics', 'mathematics', 'published'),
('Mathematical Modelling', 'mathematics', 'published'),
('Data Analysis', 'data_science', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add skills for BCA / Computer Applications
INSERT INTO skills (name, category, record_status) VALUES
('C', 'programming', 'published'),
('Java', 'programming', 'published'),
('Python', 'programming', 'published'),
('DSA', 'computer_science', 'published'),
('DBMS', 'databases', 'published'),
('Web Development', 'frontend', 'published'),
('APIs', 'backend', 'published'),
('Software Engineering', 'computer_science', 'published'),
('Git', 'tools', 'published'),
('Testing', 'QA', 'published'),
('CSS', 'frontend', 'published')
ON CONFLICT (name) DO NOTHING;

-- Add generic Engineering skills (B.Tech will often recommend branch specific ones, but we add some core ones)
INSERT INTO skills (name, category, record_status) VALUES
('AutoCAD', 'engineering', 'published'),
('Circuit Design', 'engineering', 'published'),
('Thermodynamics', 'engineering', 'published'),
('Structural Analysis', 'engineering', 'published'),
('Manufacturing Processes', 'engineering', 'published')
ON CONFLICT (name) DO NOTHING;

