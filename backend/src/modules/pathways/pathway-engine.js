/**
 * CareerGPS Multi-Stage Career Pathway Engine
 * 
 * Generates and personalizes multi-stage career development pathways.
 * Evaluates profile evidence (education, work experience, acquired skills),
 * auto-detects completion signals, prevents generic steps, and respects
 * exact career identities (e.g. Geo Analyst !== Business Analyst).
 */

export const PATHWAY_STAGES = [
  { order: 1, name: 'Stage 1: Readiness & Prerequisite Verification' },
  { order: 2, name: 'Stage 2: Foundational Learning' },
  { order: 3, name: 'Stage 3: Core Competencies' },
  { order: 4, name: 'Stage 4: Apply Your Skills — Projects & Portfolio' },
  { order: 5, name: 'Stage 5: Portfolio & Evidence Verification' },
  { order: 6, name: 'Stage 6: Experience & Industry Specialization' },
  { order: 7, name: 'Stage 7: Applications & Job Readiness' }
];

export function normalizeText(str) {
  if (!str || typeof str !== 'string') return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, ' ');
}

/**
 * Curated domain pathway templates that provide career-specific,
 * multi-stage, measurable steps with real deliverables and internal action links.
 */
export const DOMAIN_PATHWAY_TEMPLATES = {
  'backend developer': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Computer Science & Backend Runtime Foundations',
      why_it_matters: 'Server-side systems require a solid grasp of async execution models, event loops, process memory, and data structures.',
      what_to_do: 'Master JavaScript/Node.js or Python runtime internals, asynchronous flow control (Promises, async/await), stream handling, and fundamental algorithmic complexity.',
      prerequisites: ['Basic Programming Syntax'],
      deliverable: 'A CLI tool implementing stream-based file processing with comprehensive async error handling.',
      action_link: '/courses?search=Node.js',
      action_label: 'Explore Backend Foundations',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['JavaScript', 'Node.js', 'Problem Solving']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Relational Database Architecture & SQL Modeling',
      why_it_matters: 'Data persistence and query performance are core backend responsibilities. Bad schemas and unindexed queries crash systems under load.',
      what_to_do: 'Design normalized schemas in PostgreSQL, write complex multi-table JOINs, implement indexing strategies (B-tree, GIN), and enforce ACID transactions.',
      prerequisites: ['Computer Science & Backend Runtime Foundations'],
      deliverable: 'A documented PostgreSQL schema migration suite with performance-benchmarked queries and transaction boundaries.',
      action_link: '/courses?search=PostgreSQL',
      action_label: 'Study Database Architecture',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['SQL', 'PostgreSQL', 'DBMS']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'RESTful API Architecture, Validation & Authentication',
      why_it_matters: 'APIs are the public contracts of backend systems. Secure authentication, idempotency, and schema validation prevent severe security vulnerabilities.',
      what_to_do: 'Build production Express.js or Fastify APIs with JWT/OAuth2 authentication, centralized error middleware, request rate-limiting, and Zod/Joi validation schemas.',
      prerequisites: ['Relational Database Architecture & SQL Modeling'],
      deliverable: 'A fully functional CRUD service with role-based access control (RBAC), input validation, and Postman/OpenAPI documentation.',
      action_link: '/skills/gap',
      action_label: 'Verify API Competencies',
      estimated_duration: '5 weeks',
      is_optional: false,
      skills: ['REST APIs', 'Express.js', 'API Testing']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Asynchronous Processing, Caching & Message Queues',
      why_it_matters: 'Real-world backend services decouple heavy compute tasks and absorb spikes using in-memory caches and distributed task queues.',
      what_to_do: 'Integrate Redis for session caching and query result invalidation. Implement BullMQ or RabbitMQ workers for email queues, PDF generation, or webhook retries.',
      prerequisites: ['RESTful API Architecture'],
      deliverable: 'A background job worker service consuming queued tasks with retry mechanisms, exponential backoff, and dead-letter queues.',
      action_link: '/projects?career=dd929e8c-07b1-4567-a202-384a53b6e254',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '4-5 weeks',
      is_optional: false,
      skills: ['Redis', 'Caching', 'Message Queues']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Automated Testing, Security (OWASP) & Containerization',
      why_it_matters: 'Reliable backends demand high automated test coverage, defense against SQL injection/XSS/CSRF, and repeatable container runtimes.',
      what_to_do: 'Write unit and integration tests using Vitest/Jest and Supertest. Secure APIs following OWASP Top 10 guidelines. Containerize services with multi-stage Dockerfiles.',
      prerequisites: ['Asynchronous Processing & Caching'],
      deliverable: 'A Dockerized multi-container app (API + DB + Redis) with automated passing integration tests in Docker Compose.',
      action_link: '/courses?search=Docker',
      action_label: 'Learn Docker & Testing',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Docker', 'API Testing', 'Security']
    },
    {
      order: 6,
      stage: 'Stage 6: Experience & Industry Specialization',
      stage_order: 6,
      title: 'Cloud Infrastructure, CI/CD & Observability',
      why_it_matters: 'Modern backend engineers manage automated deployments and monitor production systems with metrics, logs, and distributed traces.',
      what_to_do: 'Set up GitHub Actions for automated linting and test runs. Deploy containers to AWS/GCP/Render. Configure Winston/Pino structured logging and Prometheus health metrics.',
      prerequisites: ['Automated Testing & Containerization'],
      deliverable: 'A live cloud-deployed service backed by a GitHub Actions CI/CD pipeline and automated health-check endpoints.',
      action_link: '/opportunities?type=private_job',
      action_label: 'View Backend Openings',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['DevOps', 'CI/CD', 'Cloud Computing']
    },
    {
      order: 7,
      stage: 'Stage 7: Applications & Job Readiness',
      stage_order: 7,
      title: 'Production System Portfolio & Technical System Design',
      why_it_matters: 'Senior technical interviewers evaluate backend candidates through system design tradeoffs, database indexing reasoning, and code quality.',
      what_to_do: 'Synthesize a public GitHub repository with comprehensive README, architecture diagrams (Mermaid), and live swagger docs. Practice system design interview scenarios.',
      prerequisites: ['Cloud Infrastructure & CI/CD'],
      deliverable: 'A public GitHub portfolio showcasing 2 documented backend architectures and a ready-to-interview technical profile.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Apply for Backend Roles',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['System Design', 'Git', 'Portfolio']
    }
  ],

  'ai engineer': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Mathematics & Statistical Foundations',
      why_it_matters: 'Linear algebra, calculus, and probability form the mathematical bedrock of all neural networks, loss functions, and optimization algorithms.',
      what_to_do: 'Study matrix multiplication, eigenvalues, multivariate calculus, gradient descent mathematics, and probability distributions with NumPy implementations.',
      prerequisites: ['Basic Programming', 'Class 12th Mathematics'],
      deliverable: 'A documented Jupyter notebook with vector-matrix algebra proofs and NumPy gradient descent from scratch.',
      action_link: '/skills/gap?career=2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
      action_label: 'Assess Math Readiness',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Mathematics', 'Statistics', 'Python']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Production Python & Data Preparation Pipelines',
      why_it_matters: 'Real-world AI engineering begins with ingestion, cleaning, schema validation, and vectorization of messy production data.',
      what_to_do: 'Master Pandas, Polars, and SQL. Write scalable data cleaning routines, handle missing values, and structure reproducible train/val/test splits.',
      prerequisites: ['Python basics'],
      deliverable: 'A clean data preprocessing pipeline script that consumes raw CSV/JSON and exports feature-engineered tensors.',
      action_link: '/courses?search=Python',
      action_label: 'Explore Python Courses',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Python', 'SQL', 'Data Cleaning']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Machine Learning Algorithms & Model Evaluation',
      why_it_matters: 'Before building neural networks, an AI engineer must understand classical algorithms, bias-variance tradeoff, and rigorous metric selection.',
      what_to_do: 'Implement regression, decision trees, random forests, and gradient boosting (XGBoost). Measure accuracy with precision, recall, F1, ROC-AUC, and cross-validation.',
      prerequisites: ['Production Python & Data Preparation'],
      deliverable: 'A comparative benchmark report evaluating 4 ML models on a public dataset with confusion matrices and metric curves.',
      action_link: '/skills/gap?career=2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
      action_label: 'Evaluate ML Skills',
      estimated_duration: '5-6 weeks',
      is_optional: false,
      skills: ['Machine Learning', 'Model Evaluation']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Deep Learning & Neural Network Architectures',
      why_it_matters: 'PyTorch is the industry standard for modern deep learning, computer vision, and transformer architectures.',
      what_to_do: 'Build feedforward neural networks, CNNs, and attention mechanisms using PyTorch. Train models using GPU acceleration and track experiments with TensorBoard or MLflow.',
      prerequisites: ['Machine Learning Algorithms & Model Evaluation'],
      deliverable: 'A PyTorch GitHub repository implementing a convolutional or transformer model with training curves and checkpoint management.',
      action_link: '/projects?career=2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '6 weeks',
      is_optional: false,
      skills: ['Deep Learning', 'PyTorch']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'RAG Architecture & Production AI Services',
      why_it_matters: 'Modern enterprise AI demands Retrieval-Augmented Generation (RAG), vector databases, and REST API deployment for LLMs.',
      what_to_do: 'Build a production RAG application using FastAPI, LangChain/LlamaIndex, and PostgreSQL pgvector or Chroma. Implement chunking strategies and citation tracking.',
      prerequisites: ['Deep Learning & Neural Networks'],
      deliverable: 'A deployed, live full-stack RAG web application backed by vector search and structured JSON streaming.',
      action_link: '/skills/gap?career=2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
      action_label: 'Verify LLM & RAG Competency',
      estimated_duration: '4-5 weeks',
      is_optional: false,
      skills: ['LLM Concepts', 'RAG', 'REST APIs']
    },
    {
      order: 6,
      stage: 'Stage 6: Experience & Industry Specialization',
      stage_order: 6,
      title: 'MLOps, Model Deployment & Monitoring',
      why_it_matters: 'Models are useless without containerized deployment, latency optimization, data drift monitoring, and CI/CD pipelines.',
      what_to_do: 'Containerize models using Docker. Deploy using ONNX runtime or Triton server. Set up Prometheus/Grafana or EvidentlyAI to detect data drift.',
      prerequisites: ['RAG Architecture & Production AI Services'],
      deliverable: 'A Dockerized microservice repository with automated CI/CD GitHub Actions testing inference latency and endpoint reliability.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Check MLOps Roles',
      estimated_duration: '4 weeks',
      is_optional: true,
      skills: ['Docker', 'DevOps', 'System Design']
    },
    {
      order: 7,
      stage: 'Stage 7: Applications & Job Readiness',
      stage_order: 7,
      title: 'AI Portfolio Presentation & Technical Interviews',
      why_it_matters: 'Demonstrating clean code, architectural trade-offs, and live running systems separates candidates from hobbyists.',
      what_to_do: 'Publish a unified portfolio site linking 3 documented GitHub projects with demo videos, write an engineering-focused technical resume, and prepare for system design rounds.',
      prerequisites: ['MLOps Deployment'],
      deliverable: 'A live portfolio website and ATS-optimized resume showcasing 3 verified AI engineering projects.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Apply for AI Roles',
      estimated_duration: '3 weeks',
      is_optional: false,
      skills: ['Presentation Skills', 'System Design']
    }
  ],

  'geo analyst': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Geographic Foundations & Coordinate Systems',
      why_it_matters: 'All spatial analysis depends on accurate coordinate reference systems; projection errors distort distances and area calculations.',
      what_to_do: 'Master cartographic projections (UTM, WGS84), datum transformations, and georeferencing scanned topographical survey maps.',
      prerequisites: ['Class 12th Geography or Earth Science'],
      deliverable: 'A georeferenced cadastral survey map with sub-pixel alignment uploaded to QGIS.',
      action_link: '/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101',
      action_label: 'Assess Geo Fundamentals',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['GIS (Geographic Information Systems)', 'Cartography & Map Design']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Desktop GIS Workflows with QGIS',
      why_it_matters: 'QGIS is the global open-source spatial platform used for vector digitizing, layer management, and thematic cartography.',
      what_to_do: 'Import Shapefiles, GeoJSON, and Geopackages. Digitize land-use polygons, edit attribute tables, and design professional thematic maps.',
      prerequisites: ['Geographic Foundations & Coordinate Systems'],
      deliverable: 'A publication-ready multi-layer thematic land-use map with scale bar, north arrow, and legend in PDF format.',
      action_link: '/courses?search=GIS',
      action_label: 'Explore GIS Courses',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['QGIS / ArcGIS', 'GIS (Geographic Information Systems)']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Spatial Vector & Raster Analytics',
      why_it_matters: 'Spatial analysis transforms raw geographic boundaries into actionable environmental, infrastructure, and zoning intelligence.',
      what_to_do: 'Perform buffer analysis, topological overlays, Digital Elevation Model (DEM) slope/aspect modeling, and multi-criteria site suitability.',
      prerequisites: ['Desktop GIS Workflows with QGIS'],
      deliverable: 'A multi-criteria site suitability report determining optimal locations for public infrastructure or solar installations.',
      action_link: '/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101',
      action_label: 'Evaluate Spatial Analytics',
      estimated_duration: '4-5 weeks',
      is_optional: false,
      skills: ['Spatial Data Analysis']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Satellite Remote Sensing & Spectral Indices',
      why_it_matters: 'Remote sensing provides multispectral satellite observation for agricultural health, coastal change, and flood mapping.',
      what_to_do: 'Acquire Sentinel-2 and Landsat imagery, calculate NDVI (Normalized Difference Vegetation Index) and NDWI, and perform supervised classification.',
      prerequisites: ['Spatial Vector & Raster Analytics'],
      deliverable: 'A temporal NDVI vegetation change study for a coastal district with before/after classification maps.',
      action_link: '/projects?career=5b71c777-6a12-4f11-9a7c-3f20d58be101',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Remote Sensing & Satellite Imagery']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Spatial Databases with PostGIS & Spatial SQL',
      why_it_matters: 'Modern enterprise GIS relies on spatial SQL in PostgreSQL rather than static desktop files.',
      what_to_do: 'Store and index spatial geometries in PostGIS using GiST indexing. Execute spatial joins (ST_Intersects, ST_DWithin) and spatial aggregations.',
      prerequisites: ['Basic SQL'],
      deliverable: 'A GitHub repository containing SQL scripts with complex spatial queries and geospatial database schema.',
      action_link: '/skills/gap?career=5b71c777-6a12-4f11-9a7c-3f20d58be101',
      action_label: 'Check PostGIS Skills',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Spatial SQL & PostGIS', 'SQL']
    },
    {
      order: 6,
      stage: 'Stage 6: Experience & Industry Specialization',
      stage_order: 6,
      title: 'Web-GIS Visualization & Spatial Automation',
      why_it_matters: 'Interactive web maps (Leaflet, MapLibre, GeoServer) allow decision-makers to explore spatial findings dynamically.',
      what_to_do: 'Build an interactive web-mapping dashboard using Leaflet.js or MapLibre. Use Python (GeoPandas) to automate routine spatial processing.',
      prerequisites: ['Spatial Databases with PostGIS'],
      deliverable: 'A live interactive web map hosted on GitHub Pages querying GeoJSON layers.',
      action_link: '/courses?search=Web+GIS',
      action_label: 'Learn Web GIS',
      estimated_duration: '3-4 weeks',
      is_optional: true,
      skills: ['Spatial Python & Automation']
    },
    {
      order: 7,
      stage: 'Stage 7: Applications & Job Readiness',
      stage_order: 7,
      title: 'Geospatial Portfolio & Industry Career Placement',
      why_it_matters: 'Consulting firms, municipal departments, and environmental agencies look for verified maps and spatial reports.',
      what_to_do: 'Compile 3 spatial case studies into a public portfolio, refine your resume to highlight GIS analysis outcomes, and apply for Geo Analyst roles.',
      prerequisites: ['Web-GIS Visualization'],
      deliverable: 'A professional spatial portfolio website with 3 verified mapping projects and case summaries.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Explore Geo Analyst Jobs',
      estimated_duration: '3 weeks',
      is_optional: false,
      skills: ['Presentation Skills', 'Cartography & Map Design']
    }
  ],

  'assistant professor': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Master’s Degree Completion & Academic Eligibility (55%+)',
      why_it_matters: 'UGC statutory regulations require a Master’s degree with a minimum of 55% marks (50% for reserved categories) in the relevant subject.',
      what_to_do: 'Complete postgraduate coursework, maintain distinction-level grade point average, and compile official transcripts.',
      prerequisites: ['Bachelor’s Degree in Relevant Discipline'],
      deliverable: 'Official Master’s Degree certificate and consolidated transcript verifying 55%+ aggregate.',
      action_link: '/institutions?type=Degree',
      action_label: 'View University Programs',
      estimated_duration: 'Formal academic program',
      is_optional: false,
      skills: ['Academic Writing', 'Subject Domain Knowledge']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'UGC-NET / CSIR-NET / SET Qualification Preparation',
      why_it_matters: 'Clearing the National Eligibility Test (NET) or State Eligibility Test (SET) is the mandatory statutory gateway for assistant professor appointments across India.',
      what_to_do: 'Prepare for Paper 1 (Teaching & Research Aptitude) and Paper 2 (Subject Specialization). Solve 10 years of previous examination papers.',
      prerequisites: ['Master’s Degree (final year or completed)'],
      deliverable: 'UGC-NET / SET qualification scorecard or official certificate of eligibility.',
      action_link: '/courses?search=UGC+NET',
      action_label: 'Find NET Prep Resources',
      estimated_duration: '4-6 months',
      is_optional: false,
      skills: ['Teaching/Pedagogy', 'Research Methodology']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Pedagogical Methods, Syllabus Design & Classroom Management',
      why_it_matters: 'Higher education requires student-centered instruction, outcome-based education (OBE), and course outcome (CO) mapping.',
      what_to_do: 'Master Bloom’s taxonomy, design a 15-week university semester course syllabus, and prepare lesson plans and assessment rubrics.',
      prerequisites: ['Master’s Degree'],
      deliverable: 'A comprehensive 15-week semester course syllabus complete with learning objectives and evaluation rubrics.',
      action_link: '/skills/gap?career=17e40e2c-763d-496c-8fc8-c18e40bd8ab1',
      action_label: 'Assess Pedagogy Competencies',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Teaching/Pedagogy', 'Curriculum Development']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Academic Portfolio & Research',
      stage_order: 4,
      title: 'Peer-Reviewed Scholarly Publications (UGC-CARE / Scopus)',
      why_it_matters: 'Academic Performance Indicators (API) heavily weight published research in UGC-CARE or Scopus indexed journals for recruitment and CAS promotion.',
      what_to_do: 'Author and submit 2 research papers based on original empirical or theoretical work to recognized indexed journals.',
      prerequisites: ['Research Methodology'],
      deliverable: 'Two published peer-reviewed research papers or official acceptance letters from indexed journals.',
      action_link: '/projects?career=17e40e2c-763d-496c-8fc8-c18e40bd8ab1',
      action_label: 'Open Teaching Portfolio Studio',
      estimated_duration: '3-6 months',
      is_optional: false,
      skills: ['Academic Writing', 'Research Methodology']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Ph.D. Enrollment & Doctoral Research Dissertation',
      why_it_matters: 'A Ph.D. is the primary long-term credential for university tenure, research supervision, and professor progression.',
      what_to_do: 'Enroll in an approved doctoral program, complete research coursework, submit synopsis, and advance doctoral research.',
      prerequisites: ['Master’s Degree and NET/Entrance'],
      deliverable: 'Ph.D. registration confirmation or approved doctoral thesis synopsis.',
      action_link: '/institutions?type=Degree',
      action_label: 'Find Doctoral Institutions',
      estimated_duration: '3-5 years',
      is_optional: false,
      skills: ['Research Methodology', 'Academic Writing']
    },
    {
      order: 6,
      stage: 'Stage 6: Experience & Industry Specialization',
      stage_order: 6,
      title: 'Guest Lecturing, Conference Presentations & Departmental Practice',
      why_it_matters: 'Actual teaching demonstration and national/international conference presentations validate classroom presence.',
      what_to_do: 'Deliver guest lectures as an adjunct or contract faculty member, and present research papers at two recognized national conferences.',
      prerequisites: ['NET Qualification'],
      deliverable: 'Conference presentation certificates and documentation of college guest lecturing hours.',
      action_link: '/opportunities?type=government_recruitment',
      action_label: 'Check College Openings',
      estimated_duration: '6 months',
      is_optional: true,
      skills: ['Presentation Skills', 'Teaching/Pedagogy']
    },
    {
      order: 7,
      stage: 'Stage 7: Applications & Job Readiness',
      stage_order: 7,
      title: 'Academic Dossier Compilation & University Recruitment Applications',
      why_it_matters: 'College recruitment committees evaluate verified API scores, teaching philosophy statements, and mock lecture performance.',
      what_to_do: 'Prepare an academic CV, calculate official API/PBAS score, write a teaching philosophy statement, and apply for college/university positions.',
      prerequisites: ['UGC-NET / Ph.D.', 'Publications'],
      deliverable: 'A completed Academic Dossier with API score calculation and teaching demonstration recording.',
      action_link: '/opportunities?type=government_recruitment',
      action_label: 'View Faculty Recruitment Notices',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Communication', 'Presentation Skills']
    }
  ],

  'data analyst': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Business Spreadsheet Modeling & Advanced Excel',
      why_it_matters: 'Excel remains the most universal tool in corporate reporting, ad-hoc financial models, and quick data pivots.',
      what_to_do: 'Master XLOOKUP, INDEX/MATCH, Pivot Tables, Power Query, dynamic arrays, and nested logical conditions.',
      prerequisites: ['Basic computer literacy'],
      deliverable: 'An interactive Excel workbook with dynamic dashboard, KPI summaries, and automated Power Query data refresh.',
      action_link: '/skills/gap?career=549fa435-9499-4e45-bee1-b89a13b3d64e',
      action_label: 'Check Excel Skills',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Excel', 'Data Handling']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Relational Database Querying with SQL',
      why_it_matters: '90% of business data lives in relational databases; SQL is the primary language for data extraction and transformation.',
      what_to_do: 'Write SELECT queries with INNER/LEFT/FULL joins, GROUP BY aggregations, HAVING clauses, CTEs, and window functions (ROW_NUMBER, RANK, LEAD/LAG).',
      prerequisites: ['Business Spreadsheet Modeling'],
      deliverable: 'A SQL script solving 15 complex business analytical questions against a multi-table database.',
      action_link: '/courses?search=SQL',
      action_label: 'Browse SQL Courses',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['SQL', 'PostgreSQL']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Business Intelligence Dashboards with Power BI or Tableau',
      why_it_matters: 'Decision-makers need intuitive, interactive visual dashboards that answer strategic questions at a glance.',
      what_to_do: 'Connect to database sources, build star-schema data models, write DAX measures, and design clean executive dashboards.',
      prerequisites: ['Relational Database Querying with SQL'],
      deliverable: 'A live Power BI or Tableau public dashboard tracking sales, customer churn, and profitability trends.',
      action_link: '/skills/gap?career=549fa435-9499-4e45-bee1-b89a13b3d64e',
      action_label: 'Evaluate BI Competencies',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Power BI', 'Tableau', 'Data Visualisation']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Exploratory Data Analysis with Python (Pandas & Seaborn)',
      why_it_matters: 'Python unlocks advanced statistical distributions, automated web scraping, and custom visualizations beyond BI tool limitations.',
      what_to_do: 'Use Pandas to inspect distributions, handle missing values, detect outliers, and produce correlation heatmaps with Seaborn.',
      prerequisites: ['SQL Querying'],
      deliverable: 'A structured Jupyter notebook detailing an end-to-end Exploratory Data Analysis (EDA) on an industry dataset.',
      action_link: '/projects?career=549fa435-9499-4e45-bee1-b89a13b3d64e',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '4-5 weeks',
      is_optional: false,
      skills: ['Python', 'Data Cleaning', 'Statistics']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'End-to-End Analytics Case Study & Business Storytelling',
      why_it_matters: 'Insights must translate into dollar value or cost savings; analysts must tell a convincing story with recommendations.',
      what_to_do: 'Select a real-world business problem (e.g. e-commerce conversion drop or hospital readmission rates), formulate hypotheses, analyze data, and present 3 strategic recommendations.',
      prerequisites: ['BI Dashboards', 'Python EDA'],
      deliverable: 'A slide deck and executive summary report containing findings, data visuals, and prioritized action steps.',
      action_link: '/skills/gap?career=549fa435-9499-4e45-bee1-b89a13b3d64e',
      action_label: 'Verify Portfolio Evidence',
      estimated_duration: '3 weeks',
      is_optional: false,
      skills: ['Reporting', 'Presentation Skills']
    },
    {
      order: 6,
      stage: 'Stage 6: Applications & Job Readiness',
      stage_order: 6,
      title: 'Analytics Portfolio & Technical Case Interview Prep',
      why_it_matters: 'Interviews assess live SQL live-coding, metric intuition (e.g. CAC, LTV, Retention), and communication of findings.',
      what_to_do: 'Publish a GitHub portfolio repository with your SQL queries, Python notebooks, and dashboard links; practice take-home data challenges.',
      prerequisites: ['End-to-End Case Study'],
      deliverable: 'A professional portfolio linking 3 case studies and a GitHub repository with clean analytical code.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Explore Data Analyst Roles',
      estimated_duration: '3 weeks',
      is_optional: false,
      skills: ['Problem Solving', 'Communication']
    }
  ],

  'doctor': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Higher Secondary Science Foundation (10+2 PCB — Physics, Chemistry, Biology)',
      why_it_matters: 'Under National Medical Commission (NMC) regulations, candidates must have completed 10+2 with Physics, Chemistry, Biology/Biotechnology and English with required aggregate marks.',
      what_to_do: 'Complete Class 12th science curriculum with thorough mastery of biological systems, organic chemistry, and mechanics.',
      prerequisites: ['Secondary School (10th Pass)'],
      deliverable: 'Class 12th marksheet verifying passing grades in Physics, Chemistry, and Biology.',
      action_link: '/profile',
      action_label: 'Verify 12th Stream',
      estimated_duration: '2 years of senior secondary',
      is_optional: false,
      skills: ['Anatomy', 'Physiology']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'NEET-UG Examination Qualification & Merit Rank',
      why_it_matters: 'The National Eligibility cum Entrance Test (NEET-UG) is the sole mandatory national gateway for admission to MBBS in India.',
      what_to_do: 'Prepare across Physics, Chemistry, and Zoology/Botany; practice mock time-bound tests and clear the cutoff percentile.',
      prerequisites: ['Class 12th with PCB'],
      deliverable: 'Official NEET-UG scorecard confirming eligibility and national all-India rank.',
      action_link: '/institutions?type=Degree',
      action_label: 'View Medical Colleges in Goa',
      estimated_duration: '1-2 years prep',
      is_optional: false,
      skills: ['Critical Thinking', 'Problem Solving']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Pre-Clinical & Para-Clinical MBBS Curriculum (Years 1-3)',
      why_it_matters: 'Provides deep foundational mastery of human anatomy, physiology, biochemistry, pathology, pharmacology, and microbiology.',
      what_to_do: 'Attend full-time accredited medical college lectures, cadaveric dissection, histology labs, and university examinations.',
      prerequisites: ['NEET-UG Allotted MBBS Seat'],
      deliverable: 'First and Second Professional MBBS university exam passing certificates.',
      action_link: '/skills/gap?career=1fbc7614-cf1f-460b-b167-6eda303bb61e',
      action_label: 'View Pre-Clinical Skills',
      estimated_duration: '2.5 years',
      is_optional: false,
      skills: ['Anatomy', 'Physiology', 'Medical terminology']
    },
    {
      order: 4,
      stage: 'Stage 4: Practical Projects',
      stage_order: 4,
      title: 'Clinical Rotations & Patient History Taking (Years 3-4.5)',
      why_it_matters: 'Developing hands-on clinical acumen in internal medicine, surgery, obstetrics/gynecology, and pediatrics in hospital wards.',
      what_to_do: 'Complete bed-side ward postings, take patient case histories, perform physical examinations, and observe procedures under faculty.',
      prerequisites: ['Pre-Clinical MBBS Completion'],
      deliverable: 'Completed clinical logbook signed by department heads and Final Professional MBBS Degree certificate.',
      action_link: '/skills/gap?career=1fbc7614-cf1f-460b-b167-6eda303bb61e',
      action_label: 'Assess Clinical Competencies',
      estimated_duration: '2 years',
      is_optional: false,
      skills: ['Clinical history taking', 'Clinical Assessment', 'Medical ethics']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Compulsory Rotating Medical Internship (CRMI — 1 Year)',
      why_it_matters: 'NMC mandates a 12-month full-time rotatory hospital internship covering casualty/ER, medicine, surgery, rural health center, and ob-gyn.',
      what_to_do: 'Manage in-patient emergency admissions, administer medications, record clinical progress notes, and execute rotational duties.',
      prerequisites: ['Final MBBS Clear'],
      deliverable: 'Official Compulsory Rotating Medical Internship completion certificate issued by teaching hospital.',
      action_link: '/opportunities?type=internship',
      action_label: 'Check Clinical Internships',
      estimated_duration: '12 months full-time',
      is_optional: false,
      skills: ['Clinical Care', 'Infection Control', 'Clinical handover communication']
    },
    {
      order: 6,
      stage: 'Stage 6: Experience & Industry Specialization',
      stage_order: 6,
      title: 'State Medical Council Registration & Practice License',
      why_it_matters: 'Practicing medicine without registration from the State Medical Council / NMC is illegal under statutory law.',
      what_to_do: 'Submit internship completion and degree credentials to the State Medical Council to receive permanent registration number.',
      prerequisites: ['Internship Completion'],
      deliverable: 'Official Permanent Medical Council Registration Certificate and practice number.',
      action_link: '/opportunities?type=government_recruitment',
      action_label: 'View Medical Officer Openings',
      estimated_duration: '4-8 weeks',
      is_optional: false,
      skills: ['Medical ethics', 'Clinical documentation']
    }
  ],

  'marketing specialist': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Marketing Principles, Audience Profiling & Market Research',
      why_it_matters: 'Effective marketing begins with understanding customer segmentation, market positioning, and buyer personas.',
      what_to_do: 'Study marketing fundamentals (4 Ps), conduct qualitative customer interviews, and build 2 detailed target audience personas.',
      prerequisites: ['Basic Business & Communication Literacy'],
      deliverable: 'Audience Persona Document with demographic segmentation and pain-point analysis.',
      action_link: '/courses?search=Marketing',
      action_label: 'Explore Marketing Courses',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Market Research', 'Audience Segmentation']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Digital Marketing Channels, SEO & Copywriting',
      why_it_matters: 'Organic search discovery and persuasive copywriting form the foundation of inbound marketing channels.',
      what_to_do: 'Conduct keyword research with SEMrush or Google Keyword Planner, write SEO-optimized long-form articles, and create social content.',
      prerequisites: ['Marketing Principles & Market Research'],
      deliverable: 'Keyword research matrix and 2 published SEO content articles.',
      action_link: '/courses?search=SEO',
      action_label: 'Browse SEO & Content Courses',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Content Marketing', 'SEO', 'Copywriting']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Paid Acquisition, Campaign Budgeting & Conversion Tracking',
      why_it_matters: 'Modern marketing requires measurable ROI across paid search and social channels with UTM tracking and conversion events.',
      what_to_do: 'Structure Google Search and Meta Ads campaigns, set up Google Analytics 4 (GA4) event tags, and design A/B landing page tests.',
      prerequisites: ['Digital Marketing Channels & SEO'],
      deliverable: 'Multi-channel campaign brief and conversion tracking architecture plan.',
      action_link: '/skills/gap',
      action_label: 'Assess Performance Marketing Skills',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['Digital Marketing', 'Data Analysis', 'Conversion Optimization']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Multi-Channel Campaign Strategy, Assets & Measurement Plan',
      why_it_matters: 'Employers evaluate marketers on cohesive strategic planning, creative asset execution, and measurable conversion goals.',
      what_to_do: 'Develop a complete product launch campaign brief, creative ad mockups across 3 channels, email nurture flow, and measurement framework.',
      prerequisites: ['Paid Acquisition & Conversion Tracking'],
      deliverable: 'Comprehensive multi-channel campaign portfolio brief with sample creative copy, email flows, and KPI dashboards.',
      action_link: '/projects?career=8f1a2b3c-4d5e-6f7a-8b9c-0d1e2f3a4b5c',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Digital Marketing', 'Content Strategy', 'Social Media Marketing']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Full Marketing Campaign Case Study & Performance Synthesis',
      why_it_matters: 'Strategic case studies showcasing CAC, ROAS, and conversion funnel improvements demonstrate commercial acumen.',
      what_to_do: 'Compile a case study detailing campaign objectives, channel strategy, budget allocation, actual or simulated metrics, and retrospective findings.',
      prerequisites: ['Multi-Channel Campaign Strategy'],
      deliverable: 'Executive marketing case study presentation slide deck and portfolio showcase document.',
      action_link: '/portfolio',
      action_label: 'Assemble Marketing Portfolio',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Reporting', 'Communication', 'Data Analysis']
    },
    {
      order: 6,
      stage: 'Stage 6: Applications & Job Readiness',
      stage_order: 6,
      title: 'Marketing Portfolio Review & Agency/In-House Interview Preparation',
      why_it_matters: 'Translates verified campaign deliverables into marketing specialist and growth manager interviews.',
      what_to_do: 'Publish digital marketing portfolio with campaign artifacts and case summaries, refine resume, and practice campaign strategy case interviews.',
      prerequisites: ['Full Marketing Campaign Case Study'],
      deliverable: 'Polished digital marketing portfolio website and customized ATS-friendly marketing resume.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Explore Marketing Roles',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Communication', 'Presentation Skills']
    }
  ],

  'business analyst': [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: 'Business Analysis Foundations & Stakeholder Requirement Elicitation',
      why_it_matters: 'Business analysts bridge corporate strategy and software engineering by defining clear business needs without ambiguity.',
      what_to_do: 'Master BABOK core knowledge areas, conduct stakeholder interview simulations, and draft user stories with acceptance criteria.',
      prerequisites: ['Basic Analytical & Problem Solving Literacy'],
      deliverable: 'Stakeholder Analysis Matrix and Initial Business Requirement Document (BRD).',
      action_link: '/courses?search=Business+Analysis',
      action_label: 'Explore BA Fundamentals',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Business Analysis', 'Requirements Gathering']
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: 'Process Modeling (BPMN) & Workflow Optimization',
      why_it_matters: 'Mapping Current State (AS-IS) versus Future State (TO-BE) workflows pinpoints operational bottlenecks and cost inefficiencies.',
      what_to_do: 'Learn BPMN 2.0 notation in Lucidchart or Draw.io; map order fulfillment or onboarding processes, and document handoffs.',
      prerequisites: ['Business Analysis Foundations'],
      deliverable: 'AS-IS and TO-BE process flow diagram with bottleneck analysis.',
      action_link: '/courses?search=BPMN',
      action_label: 'Learn Process Modeling',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Process Mapping', 'Problem Solving']
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: 'Data-Driven Business Analysis, SQL & Financial Modeling',
      why_it_matters: 'Decisions must be backed by quantitative evidence, cost-benefit analyses, and relational data extracts.',
      what_to_do: 'Write SQL queries to analyze customer cohorts and order friction; build 3-statement financial or ROI model in Excel.',
      prerequisites: ['Process Modeling'],
      deliverable: 'Cost-Benefit Analysis model and SQL extraction query suite.',
      action_link: '/skills/gap',
      action_label: 'Assess Analytical Skills',
      estimated_duration: '4 weeks',
      is_optional: false,
      skills: ['SQL', 'Data Analysis', 'Financial Modeling']
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: 'Comprehensive Business Case Study & Process Redesign Deliverables',
      why_it_matters: 'Hiring managers look for complete end-to-end case studies containing BRD, functional specs, user journeys, and financial ROI.',
      what_to_do: 'Develop a comprehensive enterprise case study solving a real operational problem, detailing scope, AS-IS vs TO-BE, user stories, and cost estimates.',
      prerequisites: ['Data-Driven Business Analysis'],
      deliverable: 'End-to-end Business Requirements Document (BRD) and process redesign portfolio package.',
      action_link: '/projects?career=c1000008-0008-4000-8000-000000000001',
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Business Analysis', 'Documentation', 'Process Mapping']
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: 'Executive Stakeholder Presentation & Acceptance Criteria Rubric',
      why_it_matters: 'Translating complex systems into clear executive slide decks ensures alignment across executive management and engineering.',
      what_to_do: 'Author an executive slide deck summarizing project ROI, implementation timeline, risk mitigations, and user acceptance criteria.',
      prerequisites: ['Comprehensive Business Case Study'],
      deliverable: 'Executive presentation slide deck and project sign-off matrix.',
      action_link: '/portfolio',
      action_label: 'Assemble BA Portfolio',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Communication', 'Presentation Skills', 'Stakeholder Management']
    },
    {
      order: 6,
      stage: 'Stage 6: Applications & Job Readiness',
      stage_order: 6,
      title: 'BA Portfolio Review & Case Interview Preparation',
      why_it_matters: 'Prepares the candidate for agile scrum ceremonies, mock client presentations, and business analyst technical screenings.',
      what_to_do: 'Publish BA portfolio case studies, optimize resume with quantifiable metric outcomes, and practice case interview scenarios.',
      prerequisites: ['Executive Stakeholder Presentation'],
      deliverable: 'Polished portfolio linking documented case studies and ATS-ready resume.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Explore Business Analyst Roles',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: ['Communication', 'Problem Solving']
    }
  ]
};

/**
 * Builds deterministic multi-stage steps for any career using career attributes
 * when a specialized template is not already defined.
 */
export function buildGenericCareerPathway(careerTitle, careerRecord = {}) {
  const normTitle = normalizeText(careerTitle);
  if (DOMAIN_PATHWAY_TEMPLATES[normTitle]) {
    return DOMAIN_PATHWAY_TEMPLATES[normTitle];
  }

  // Check partial key matches
  for (const [key, tpl] of Object.entries(DOMAIN_PATHWAY_TEMPLATES)) {
    if (normTitle.includes(key) || key.includes(normTitle)) {
      return tpl;
    }
  }

  const title = careerRecord.title || careerTitle;
  const desc = careerRecord.description || `Professional career pathway for ${title}.`;
  const skills = Array.isArray(careerRecord.required_skills)
    ? careerRecord.required_skills.map(s => typeof s === 'string' ? s : s.name)
    : [];

  return [
    {
      order: 1,
      stage: 'Stage 1: Readiness & Prerequisite Verification',
      stage_order: 1,
      title: `Prerequisite & Entry Route Verification for ${title}`,
      why_it_matters: `Ensures compliance with formal qualifications, baseline knowledge, and professional prerequisites required for ${title}.`,
      what_to_do: `Verify current education against typical entry routes for ${title}. Gather academic transcripts and confirm foundational readiness.`,
      prerequisites: ['High school completion'],
      deliverable: 'A verified academic/experience profile meeting baseline requirements.',
      action_link: '/profile',
      action_label: 'Update Profile & Education',
      estimated_duration: '2-3 weeks',
      is_optional: false,
      skills: skills.slice(0, 2)
    },
    {
      order: 2,
      stage: 'Stage 2: Foundational Learning',
      stage_order: 2,
      title: `Foundational Knowledge & Tools for ${title}`,
      why_it_matters: `Provides essential vocabulary, industry concepts, and core methodologies used daily by a ${title}.`,
      what_to_do: `Study core introductory principles and introductory tools for ${title}. Complete structured coursework or introductory modules.`,
      prerequisites: ['Prerequisite Verification'],
      deliverable: 'Completed coursework notes or certificate of foundation module completion.',
      action_link: `/courses?search=${encodeURIComponent(title)}`,
      action_label: 'Browse Relevant Courses',
      estimated_duration: '4-6 weeks',
      is_optional: false,
      skills: skills.slice(0, 3)
    },
    {
      order: 3,
      stage: 'Stage 3: Core Competencies',
      stage_order: 3,
      title: `Core Professional Competencies for ${title}`,
      why_it_matters: `These are the primary hands-on competencies that define successful day-to-day performance in the role.`,
      what_to_do: `Develop practical execution skills aligned with the documented responsibilities of a ${title}.`,
      prerequisites: ['Foundational Knowledge'],
      deliverable: 'Demonstrated mastery of primary tools and workflow tasks.',
      action_link: '/skills/gap',
      action_label: 'Assess Skill Gap',
      estimated_duration: '6-8 weeks',
      is_optional: false,
      skills: skills.slice(2, 5)
    },
    {
      order: 4,
      stage: 'Stage 4: Apply Your Skills — Projects & Portfolio',
      stage_order: 4,
      title: `Apply Your Skills — Practical Projects & Portfolio Deliverables for ${title}`,
      why_it_matters: `Employers and evaluators look for verified practical application rather than passive theoretical understanding.`,
      what_to_do: `Complete practical projects or portfolio case deliverables demonstrating applied capability in ${title}.`,
      prerequisites: ['Core Professional Competencies'],
      deliverable: 'Documented project deliverables, case studies, or portfolio evidence artifacts.',
      action_link: `/projects?career=${encodeURIComponent(title)}`,
      action_label: 'Open Project & Portfolio Studio',
      estimated_duration: '4-5 weeks',
      is_optional: false,
      skills: skills.slice(3, 6)
    },
    {
      order: 5,
      stage: 'Stage 5: Portfolio & Evidence Verification',
      stage_order: 5,
      title: `Professional Evidence & Portfolio Assembly`,
      why_it_matters: `Tangible evidence establishes credibility during technical assessments and candidate reviews.`,
      what_to_do: `Assemble verified deliverables, project case studies, and recommendations into a structured digital portfolio.`,
      prerequisites: ['Applied Mini-Projects'],
      deliverable: 'A public digital portfolio or documented project summary demonstrating capability.',
      action_link: '/opportunities',
      action_label: 'Explore Opportunities',
      estimated_duration: '3-4 weeks',
      is_optional: false,
      skills: ['Presentation Skills', 'Documentation']
    },
    {
      order: 6,
      stage: 'Stage 6: Applications & Job Readiness',
      stage_order: 6,
      title: `Role Application, Networking & Industry Transition`,
      why_it_matters: `Translates demonstrated capability into active applications, interview performance, and career placement.`,
      what_to_do: `Tailor resumes to highlight portfolio deliverables, prepare for role-specific interview questions, and apply to vetted opportunities.`,
      prerequisites: ['Professional Evidence & Portfolio Assembly'],
      deliverable: 'A targeted ATS-friendly resume and active applications submitted to relevant job openings.',
      action_link: '/opportunities?type=private_job',
      action_label: 'Browse Active Openings',
      estimated_duration: '3 weeks',
      is_optional: false,
      skills: ['Communication', 'Interview Skills']
    }
  ];
}

/**
 * Evaluates the user's saved profile, education, work experience,
 * and acquired skills against the pathway steps to auto-detect
 * completed steps, assign starting points, and personalize guidance.
 */
export function evaluateUserProgressAndEvidence(userContext = {}, steps = [], careerTitle = '') {
  const profile = userContext.profile || {};
  const education = Array.isArray(profile.education) ? profile.education : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const userSkills = Array.isArray(userContext.user_skills) ? userContext.user_skills : [];
  const customSkills = Array.isArray(userContext.custom_skills) ? userContext.custom_skills : [];
  const userProjects = Array.isArray(userContext.user_projects) ? userContext.user_projects : [];

  // Build a normalized lookup set of all acquired skills
  const acquiredSkillNames = new Set();
  for (const sk of userSkills) {
    const name = typeof sk === 'string' ? sk : sk?.name;
    if (name) acquiredSkillNames.add(normalizeText(name));
  }
  for (const cs of customSkills) {
    const name = typeof cs === 'string' ? cs : cs?.name;
    if (name) acquiredSkillNames.add(normalizeText(name));
  }

  // Determine user experience tier
  let totalExperienceYears = 0;
  for (const exp of experience) {
    const yrs = Number(exp.years) || (exp.duration ? parseFloat(exp.duration) : 0) || 0;
    totalExperienceYears += yrs;
  }
  const hasSeniorRole = experience.some(exp => {
    const r = (exp.role || exp.title || '').toLowerCase();
    return r.includes('senior') || r.includes('lead') || r.includes('head') || r.includes('manager') || r.includes('engineer');
  });

  const isExperienced = totalExperienceYears >= 3 || (totalExperienceYears >= 1 && hasSeniorRole);
  const isIntermediate = totalExperienceYears >= 1 || education.some(e => {
    const deg = (e.degree || e.current_program || e.level || '').toLowerCase();
    return deg.includes('bachelor') || deg.includes('bca') || deg.includes('btech') || deg.includes('bsc') || deg.includes('ba');
  }) || acquiredSkillNames.size >= 3;

  const experienceTier = isExperienced ? 'experienced' : isIntermediate ? 'intermediate' : 'beginner';

  // Process steps
  const processedSteps = [];
  let foundStartingPoint = false;
  let startingPointStep = null;
  let startingPointReason = '';
  const completedStepsTitles = [];

  for (let i = 0; i < steps.length; i++) {
    const rawStep = steps[i];
    const metadata = (rawStep.metadata && typeof rawStep.metadata === 'object') ? rawStep.metadata : {};
    const metaStage = metadata.stage || rawStep.stage || `Stage ${Math.min(7, i + 1)}`;
    const metaStageOrder = Number(metadata.stage_order || rawStep.stage_order) || Math.min(7, i + 1);
    const stepSkills = Array.isArray(metadata.skills) ? metadata.skills : (Array.isArray(rawStep.skills) ? rawStep.skills : []);
    const prereqs = Array.isArray(metadata.prerequisites) ? metadata.prerequisites : (Array.isArray(rawStep.prerequisites) ? rawStep.prerequisites : []);

    const isProjectOrPortfolioStage = (
      metaStageOrder === 4 ||
      metaStageOrder === 5 ||
      metaStage.toLowerCase().includes('projects') ||
      metaStage.toLowerCase().includes('portfolio') ||
      (rawStep.title && rawStep.title.toLowerCase().includes('portfolio')) ||
      (rawStep.title && rawStep.title.toLowerCase().includes('projects'))
    );

    // Existing database status from user_pathway_steps
    const existingStatus = rawStep.status || 'not_started';
    let finalStatus = existingStatus;
    let completionSource = rawStep.completion_source || null;
    let autoEvidence = null;

    // Evaluate automatic evidence if not manually marked completed or skipped
    if (existingStatus === 'not_started' || existingStatus === 'in_progress') {
      // 1. For project/portfolio stages, check for actual completed user projects
      if (isProjectOrPortfolioStage && userProjects.length > 0) {
        const completedProject = userProjects.find(p => 
          p.status === 'completed' &&
          (
            !careerTitle ||
            normalizeText(p.career_title).includes(normalizeText(careerTitle)) ||
            normalizeText(careerTitle).includes(normalizeText(p.career_title)) ||
            (Array.isArray(p.skills) && p.skills.some(ps => stepSkills.map(s => normalizeText(s)).includes(normalizeText(ps))))
          )
        );
        if (completedProject) {
          finalStatus = 'completed';
          completionSource = 'project_completed';
          autoEvidence = `Verified via completed project: "${completedProject.title}" with submitted deliverables and reflection`;
        }
      }

      // 2. Check if user already possesses the skills of this step (disallow generic skills on project stages)
      if (!autoEvidence && !isProjectOrPortfolioStage) {
        let matchedSkill = null;
        for (const reqSkill of stepSkills) {
          const normReq = normalizeText(reqSkill);
          for (const acquired of acquiredSkillNames) {
            if (acquired.includes(normReq) || normReq.includes(acquired)) {
              matchedSkill = reqSkill;
              break;
            }
          }
          if (matchedSkill) break;
        }

        if (matchedSkill) {
          finalStatus = 'completed';
          completionSource = 'auto_detected';
          autoEvidence = `Auto-detected from your acquired skill: ${matchedSkill}`;
        }
      }

      // 3. Check education evidence for Stage 1 / prerequisite steps
      if (!autoEvidence && (metaStageOrder === 1 || i === 0)) {
        const titleNorm = normalizeText(rawStep.title);
        const descNorm = normalizeText(rawStep.description || rawStep.what_to_do || '');

        if (titleNorm.includes('secondary') || titleNorm.includes('10 2') || titleNorm.includes('class 12')) {
          const has12th = education.some(e => {
            const l = (e.level || e.education_stage || '').toLowerCase();
            return l.includes('12') || l.includes('senior') || l.includes('higher') || l.includes('school_12');
          });
          if (has12th) {
            finalStatus = 'completed';
            completionSource = 'auto_detected';
            autoEvidence = 'Auto-detected from your Class 12 education record';
          }
        } else if (titleNorm.includes('computer science') || titleNorm.includes('prerequisite') || titleNorm.includes('runtime foundations')) {
          const hasTechDegree = education.some(e => {
            const deg = (e.degree || e.current_program || e.level || '').toLowerCase();
            return deg.includes('bca') || deg.includes('b.tech') || deg.includes('btech') || deg.includes('b.sc computer') || deg.includes('bsc computer');
          });
          if (hasTechDegree) {
            finalStatus = 'completed';
            completionSource = 'auto_detected';
            autoEvidence = 'Auto-detected from your technical qualification (BCA / Computer Science)';
          }
        } else if (titleNorm.includes('master') || descNorm.includes('master s degree')) {
          const hasMasters = education.some(e => {
            const l = (e.level || e.degree || '').toLowerCase();
            return (l.includes('master') || l.includes('mca') || l.includes('msc') || l.includes('mtech')) &&
                   (!e.status || e.status === 'completed' || e.status === 'passed');
          });
          if (hasMasters) {
            finalStatus = 'completed';
            completionSource = 'auto_detected';
            autoEvidence = 'Auto-detected from your postgraduate degree record';
          }
        }
      }

      // 4. For experienced users, foundational stages (Stage 1 & 2) may be demonstrated through work experience
      if (!autoEvidence && isExperienced && (metaStageOrder === 1 || metaStageOrder === 2)) {
        const titleNorm = normalizeText(rawStep.title);
        if (titleNorm.includes('foundations') || titleNorm.includes('basics') || titleNorm.includes('readiness')) {
          finalStatus = 'completed';
          completionSource = 'auto_detected';
          autoEvidence = `Demonstrated through ${totalExperienceYears}+ years of professional experience`;
        }
      }
    }

    if (finalStatus === 'completed') {
      completedStepsTitles.push(rawStep.title);
    }

    // Check prerequisites & blocking status
    // Allow parallel practice: practical projects are not blocked by unrelated steps if their explicit prerequisites are met
    let isBlocked = false;
    let blockReason = null;

    if (finalStatus !== 'completed' && finalStatus !== 'skipped') {
      if (isProjectOrPortfolioStage) {
        if (prereqs.length > 0) {
          for (const prereq of prereqs) {
            const normPrereq = normalizeText(prereq);
            const satisfiedInPrior = processedSteps.some(priorStep => {
              return priorStep.status === 'completed' && normalizeText(priorStep.title).includes(normPrereq);
            });
            const satisfiedInSkills = Array.from(acquiredSkillNames).some(sk => sk.includes(normPrereq) || normPrereq.includes(sk));

            if (!satisfiedInPrior && !satisfiedInSkills) {
              isBlocked = true;
              blockReason = `Prerequisite required: Complete "${prereq}" before starting this step.`;
              break;
            }
          }
        }
      } else if (prereqs.length > 0) {
        // If there's an unsatisfied prerequisite from an earlier non-completed step
        for (const prereq of prereqs) {
          const normPrereq = normalizeText(prereq);
          const satisfiedInPrior = processedSteps.some(priorStep => {
            return priorStep.status === 'completed' && normalizeText(priorStep.title).includes(normPrereq);
          });
          const satisfiedInSkills = Array.from(acquiredSkillNames).some(sk => sk.includes(normPrereq) || normPrereq.includes(sk));

          if (!satisfiedInPrior && !satisfiedInSkills && i > 0 && processedSteps[i - 1].status !== 'completed') {
            isBlocked = true;
            blockReason = `Prerequisite required: Complete "${prereq}" before starting this step.`;
            break;
          }
        }
      }
    }

    // Assign Current Focus / Starting Point to first non-completed, non-skipped, non-blocked step
    let isCurrentFocus = false;
    if (!foundStartingPoint && finalStatus !== 'completed' && finalStatus !== 'skipped' && !isBlocked) {
      isCurrentFocus = true;
      foundStartingPoint = true;
      startingPointStep = {
        ...rawStep,
        order: i + 1,
        step_order: i + 1,
        stage: metaStage,
        metadata: { ...metadata, stage: metaStage, stage_order: metaStageOrder }
      };

      if (i === 0) {
        startingPointReason = `Starting at ${metaStage}. As a ${experienceTier} learner, this builds essential baseline competencies first.`;
      } else {
        const skippedCount = processedSteps.filter(s => s.status === 'completed').length;
        startingPointReason = `Starting at ${metaStage}. Foundational requirements (${skippedCount} step${skippedCount > 1 ? 's' : ''}) are satisfied by your profile evidence and demonstrated competencies.`;
      }
    }

    processedSteps.push({
      ...rawStep,
      step_order: i + 1,
      status: isBlocked ? 'blocked' : finalStatus,
      completion_source: completionSource,
      auto_evidence: autoEvidence,
      is_blocked: isBlocked,
      block_reason: blockReason,
      is_current_focus: isCurrentFocus,
      metadata: {
        ...metadata,
        stage: metaStage,
        stage_order: metaStageOrder,
        why_it_matters: metadata.why_it_matters || rawStep.why_it_matters || `Essential progression step for ${careerTitle || 'this career'}.`,
        what_to_do: metadata.what_to_do || rawStep.what_to_do || rawStep.description || 'Complete the documented learning objectives and practical tasks.',
        prerequisites: prereqs,
        deliverable: metadata.deliverable || rawStep.deliverable || 'Documented completion evidence or project artifact.',
        action_link: metadata.action_link || rawStep.action_link || '/skills/gap',
        action_label: metadata.action_label || rawStep.action_label || 'Assess Skills',
        estimated_duration: metadata.estimated_duration || rawStep.estimated_duration || '2-4 weeks',
        is_optional: Boolean(metadata.is_optional ?? rawStep.is_optional),
        skills: stepSkills
      }
    });
  }

  // Fallback starting point if all prior were completed
  if (!foundStartingPoint && processedSteps.length > 0) {
    const last = processedSteps[processedSteps.length - 1];
    if (last.status !== 'completed') {
      last.is_current_focus = true;
      startingPointReason = `You are at the final stage: ${last.metadata.stage}. Complete the final portfolio and role applications!`;
    } else {
      startingPointReason = 'All steps in this pathway are completed! You are ready to explore and apply for active opportunities.';
    }
  }

  // Calculate metrics
  const total = processedSteps.length;
  const completed = processedSteps.filter(s => s.status === 'completed').length;
  const skipped = processedSteps.filter(s => s.status === 'skipped').length;
  const inProgress = processedSteps.filter(s => s.status === 'in_progress').length;
  const blocked = processedSteps.filter(s => s.status === 'blocked').length;
  const remaining = total - completed - skipped;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    steps: processedSteps,
    experience_tier: experienceTier,
    total_experience_years: totalExperienceYears,
    starting_point: {
      step_order: startingPointStep?.step_order || 1,
      title: startingPointStep?.title || processedSteps[0]?.title || '',
      stage: startingPointStep?.metadata?.stage || startingPointStep?.stage || 'Stage 1',
      reason: startingPointReason
    },
    metrics: {
      total,
      completed,
      skipped,
      in_progress: inProgress,
      blocked,
      remaining,
      percentage
    }
  };
}
