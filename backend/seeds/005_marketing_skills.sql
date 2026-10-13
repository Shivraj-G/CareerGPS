BEGIN;

INSERT INTO skills (name, category, record_status) VALUES
('Search Engine Optimization (SEO)', 'marketing', 'published'),
('Search Engine Marketing (SEM)', 'marketing', 'published'),
('Social Media Marketing', 'marketing', 'published'),
('Content Marketing', 'marketing', 'published'),
('Email Marketing', 'marketing', 'published'),
('Marketing Analytics', 'marketing', 'published'),
('Campaign Management', 'marketing', 'published'),
('Audience Segmentation', 'marketing', 'published'),
('Conversion Rate Optimization', 'marketing', 'published'),
('Web Analytics', 'data', 'published'),
('Advertising Platforms', 'marketing', 'published'),
('Branding', 'marketing', 'published')
ON CONFLICT (name) DO NOTHING;

COMMIT;
