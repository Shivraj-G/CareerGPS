-- Migration 019: Career Pathways Rebuild & Multi-Stage Engine

-- 1. Extend user_pathway_steps status to support 'skipped' and 'blocked'
ALTER TABLE user_pathway_steps DROP CONSTRAINT IF EXISTS user_pathway_steps_status_check;
ALTER TABLE user_pathway_steps ADD CONSTRAINT user_pathway_steps_status_check 
  CHECK (status IN ('not_started', 'in_progress', 'completed', 'skipped', 'blocked'));

-- 2. Add 'Geo Analyst' to careers table if not already present
INSERT INTO careers (id, title, description, responsibilities, qualifications, entry_routes, origin, verification_status, record_status)
VALUES (
  '5b71c777-6a12-4f11-9a7c-3f20d58be101',
  'Geo Analyst',
  'Collects, analyzes, and visualizes geospatial data, satellite imagery, and spatial datasets using Geographic Information Systems (GIS), remote sensing platforms, and spatial database technologies for environmental, urban, and infrastructure intelligence.',
  '["Analyze spatial datasets, satellite imagery, and aerial survey data using GIS tools", "Build spatial queries and maintain spatial databases using PostGIS and SQL", "Design thematic maps, cartographic layouts, and 3D terrain models for planning and research", "Conduct georeferencing, coordinate system transformations, and spatial feature digitization", "Collaborate with urban planning, forestry, maritime, and public works authorities on GIS projects"]'::jsonb,
  '["Bachelor degree in Geography (BA/BSc), Geology, Geoinformatics, or Environmental Science", "Proficiency in GIS software such as QGIS or ArcGIS", "Knowledge of spatial data formats (Shapefiles, GeoJSON, Raster, GeoTIFF) and spatial SQL"]'::jsonb,
  '["BA/BSc in Geography or Geology with GIS / Remote Sensing certification", "Bachelor in Geoinformatics or Urban Planning", "Data Analyst or Surveyor transitioning to Geospatial Analysis"]'::jsonb,
  'curated',
  'verified',
  'published'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  responsibilities = EXCLUDED.responsibilities,
  qualifications = EXCLUDED.qualifications,
  entry_routes = EXCLUDED.entry_routes,
  verification_status = 'verified',
  record_status = 'published';

-- 3. Insert Geo Analyst specific skills into skills and career_skills
INSERT INTO skills (name, description, category, learning_level, origin, verification_status, record_status)
VALUES
  ('GIS (Geographic Information Systems)', 'Core principles of spatial data capture, coordinate systems, and GIS software navigation.', 'technical', 'foundational', 'curated', 'verified', 'published'),
  ('Cartography & Map Design', 'Principles of cartographic composition, symbology, map scale, and thematic visual communication.', 'technical', 'foundational', 'curated', 'verified', 'published'),
  ('Georeferencing & Projections', 'Aligning geographic coordinates, understanding datum transformations, and UTM/WGS84 projection systems.', 'technical', 'foundational', 'curated', 'verified', 'published'),
  ('Spatial Data Analysis', 'Buffer analysis, spatial overlays, proximity calculations, and topological operations.', 'technical', 'intermediate', 'curated', 'verified', 'published'),
  ('QGIS / ArcGIS', 'Professional desktop GIS workflows including vector/raster manipulation and plugin development.', 'tool', 'intermediate', 'curated', 'verified', 'published'),
  ('Remote Sensing & Satellite Imagery', 'Analyzing multispectral satellite bands, NDVI vegetation indices, and aerial drone photogrammetry.', 'technical', 'intermediate', 'curated', 'verified', 'published'),
  ('Spatial SQL & PostGIS', 'Writing spatial SQL queries, ST_Intersects, ST_Distance, and managing spatial geospatial databases.', 'technical', 'intermediate', 'curated', 'verified', 'published'),
  ('Spatial Python & Automation', 'Using GeoPandas, Shapely, Rasterio, and Folium to automate spatial workflows and processing pipelines.', 'technical', 'advanced', 'curated', 'verified', 'published')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  learning_level = EXCLUDED.learning_level;

INSERT INTO career_skills (career_id, skill_id, importance, origin, verification_status)
SELECT '5b71c777-6a12-4f11-9a7c-3f20d58be101', s.id, v.importance, 'curated', 'verified'
FROM (VALUES
  ('GIS (Geographic Information Systems)', 'required'),
  ('Cartography & Map Design', 'required'),
  ('Georeferencing & Projections', 'required'),
  ('Spatial Data Analysis', 'required'),
  ('QGIS / ArcGIS', 'required'),
  ('Remote Sensing & Satellite Imagery', 'important'),
  ('Spatial SQL & PostGIS', 'important'),
  ('Spatial Python & Automation', 'useful')
) AS v(skill_name, importance)
JOIN skills s ON s.name = v.skill_name
ON CONFLICT (career_id, skill_id) DO UPDATE SET
  importance = EXCLUDED.importance;

-- 4. Template pathway for Geo Analyst
INSERT INTO pathways (id, career_id, title, description, pathway_type, record_status, verification_status, origin)
VALUES (
  '5b71c777-6a12-4f11-9a7c-3f20d58be201',
  '5b71c777-6a12-4f11-9a7c-3f20d58be101',
  'Geo Analyst — Spatial Foundations to Professional GIS',
  'A rigorous 6-stage roadmap from geographical fundamentals and coordinate systems to desktop GIS mastery, satellite remote sensing, PostGIS spatial queries, and a verified geospatial portfolio.',
  'template',
  'published',
  'verified',
  'curated'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- Insert steps for Geo Analyst
INSERT INTO pathway_steps (id, pathway_id, step_order, title, description, step_type, verification_status, origin, metadata)
VALUES
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be301',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    1,
    'Geographic Readiness & Coordinate Systems',
    'Establish foundational competence in cartography, map projections (UTM, WGS84), datums, and spatial coordinate reference systems (CRS).',
    'skill',
    'verified',
    'curated',
    '{"stage": "Stage 1: Readiness & Prerequisite Verification", "stage_order": 1, "why_it_matters": "All spatial analysis depends on accurate coordinate reference systems; projection errors distort distances and area calculations.", "what_to_do": "Learn datum transformations, understand EPSG codes (e.g. EPSG:4326 vs EPSG:3857), and practice georeferencing scanned topographical maps.", "prerequisites": ["Basic Geography / Earth Science"], "deliverable": "A georeferenced survey map with zero coordinate deviation uploaded to GIS.", "action_link": "/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101", "action_label": "Check Geo Skills Gap", "estimated_duration": "2-3 weeks", "is_optional": false}'::jsonb
  ),
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be302',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    2,
    'Desktop GIS Mastery with QGIS',
    'Learn vector and raster layer management, digitization, attribute table manipulations, symbology, and map layout compilation.',
    'skill',
    'verified',
    'curated',
    '{"stage": "Stage 2: Foundational Learning", "stage_order": 2, "why_it_matters": "QGIS is the global open-source standard for spatial workflows used across research and commercial spatial planning.", "what_to_do": "Install QGIS, import government cadastral shapefiles, digitize parcel boundaries, and build a multi-layer thematic land-use map.", "prerequisites": ["Geographic Readiness & Coordinate Systems"], "deliverable": "A publication-ready thematic land-use map with scale bar, north arrow, and legend in PDF format.", "action_link": "/courses?search=GIS", "action_label": "Explore GIS Courses", "estimated_duration": "4-5 weeks", "is_optional": false}'::jsonb
  ),
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be303',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    3,
    'Spatial Vector & Raster Analytics',
    'Execute proximity buffering, spatial overlays (intersection, union, clip), terrain analysis (DEM, slope, aspect), and suitability modeling.',
    'skill',
    'verified',
    'curated',
    '{"stage": "Stage 3: Core Competencies", "stage_order": 3, "why_it_matters": "Spatial analysis transforms raw geographic features into actionable business and environmental intelligence.", "what_to_do": "Perform multi-criteria evaluation (MCE) to determine optimal locations for renewable energy or public infrastructure projects.", "prerequisites": ["Desktop GIS Mastery with QGIS"], "deliverable": "A multi-criteria site suitability analysis report with weighted overlay raster results.", "action_link": "/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101", "action_label": "Verify Spatial Analytics", "estimated_duration": "3-4 weeks", "is_optional": false}'::jsonb
  ),
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be304',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    4,
    'Remote Sensing & Satellite Imagery Analysis',
    'Download and process Sentinel-2 and Landsat multispectral imagery, calculate vegetation indices (NDVI), and classify land cover.',
    'skill',
    'verified',
    'curated',
    '{"stage": "Stage 4: Practical Projects", "stage_order": 4, "why_it_matters": "Remote sensing enables temporal monitoring of deforestation, coastal erosion, water bodies, and agricultural health over large geographic areas.", "what_to_do": "Download cloud-free Sentinel-2 bands, composite true and false color imagery, and calculate NDVI time-series for a Goan agricultural district.", "prerequisites": ["Spatial Vector & Raster Analytics"], "deliverable": "A temporal NDVI change detection project with classified vegetation health map.", "action_link": "/courses?search=Remote+Sensing", "action_label": "Find Remote Sensing Courses", "estimated_duration": "4 weeks", "is_optional": false}'::jsonb
  ),
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be305',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    5,
    'Spatial Databases with PostGIS & Spatial SQL',
    'Store, index, and query millions of geographic points, polygons, and lines using PostgreSQL and PostGIS extensions.',
    'skill',
    'verified',
    'curated',
    '{"stage": "Stage 5: Portfolio & Evidence Verification", "stage_order": 5, "why_it_matters": "Modern geospatial workflows rely on scalable spatial databases rather than flat file systems for web mapping and analytics.", "what_to_do": "Load spatial data into PostGIS, create spatial R-tree GiST indexes, and write spatial join queries using ST_DWithin and ST_Contains.", "prerequisites": ["SQL fundamentals"], "deliverable": "A GitHub repository with documented SQL scripts executing spatial queries and geo-API data feeds.", "action_link": "/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101", "action_label": "Assess PostGIS Skills", "estimated_duration": "3-4 weeks", "is_optional": false}'::jsonb
  ),
  (
    '5b71c777-6a12-4f11-9a7c-3f20d58be306',
    '5b71c777-6a12-4f11-9a7c-3f20d58be201',
    6,
    'Geospatial Portfolio & Industry Career Launch',
    'Assemble a public web-GIS portfolio showcasing maps, interactive web viewers (Leaflet/MapLibre), spatial reports, and apply for roles.',
    'job_search',
    'verified',
    'curated',
    '{"stage": "Stage 6: Applications & Job Readiness", "stage_order": 6, "why_it_matters": "Employers require demonstrated proof of cartographic accuracy and data storytelling before hiring.", "what_to_do": "Build an online portfolio of 3 diverse projects (urban mapping, remote sensing, and PostGIS database), prepare an ATS-friendly resume, and apply to geospatial consultancies.", "prerequisites": ["Remote Sensing", "PostGIS"], "deliverable": "A live portfolio website or GitHub Pages repository with 3 interactive geospatial case studies.", "action_link": "/opportunities?type=private_job", "action_label": "Browse Geo Opportunities", "estimated_duration": "3 weeks", "is_optional": false}'::jsonb
  )
ON CONFLICT (pathway_id, step_order) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  metadata = EXCLUDED.metadata;
