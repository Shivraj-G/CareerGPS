-- Migration 020: CareerGPS Project & Portfolio Studio
BEGIN;

-- 1. Ensure Marketing Specialist exists in careers table
INSERT INTO careers (id, title, description, responsibilities, qualifications, entry_routes, origin, verification_status, record_status)
VALUES (
  '3f78a101-7b19-4d62-811c-19d45e092100',
  'Marketing Specialist',
  'Plans and executes multi-channel marketing campaigns, conducts audience research, manages digital promotional assets, and analyzes campaign conversion metrics to drive business growth.',
  '["Design and execute digital marketing campaigns across organic and paid channels", "Conduct target audience segmentation and persona research", "Create campaign briefs, promotional copy, and creative asset specifications", "Analyze traffic, click-through, and conversion funnels using analytics platforms", "Manage marketing budgets and report ROI to stakeholders"]'::jsonb,
  '["Bachelor degree in Marketing, Business Administration, Mass Communication, or related field", "Proficiency in digital marketing platforms, SEO/SEM, and email marketing software", "Familiarity with Google Analytics and social media management suites"]'::jsonb,
  '["BBA / B.Com / BA in Communication with Digital Marketing certification", "Direct entry from junior marketing or social media coordinator role", "Transition from content writing or public relations"]'::jsonb,
  'curated',
  'verified',
  'published'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

-- 2. Expand saved_items constraint to allow 'project'
ALTER TABLE saved_items DROP CONSTRAINT IF EXISTS saved_items_item_type_check;
ALTER TABLE saved_items ADD CONSTRAINT saved_items_item_type_check 
  CHECK (item_type IN ('career', 'course', 'opportunity', 'pathway', 'project'));

-- 3. Extend user_skills to support evidence types and project linking
ALTER TABLE user_skills
  ADD COLUMN IF NOT EXISTS evidence_type VARCHAR(30) DEFAULT 'self_reported' 
    CHECK (evidence_type IN ('self_reported', 'project_supported', 'formally_assessed', 'work_experience')),
  ADD COLUMN IF NOT EXISTS evidence_source_id UUID,
  ADD COLUMN IF NOT EXISTS evidence_notes TEXT;

-- 4. Create career_projects table (catalogue & curated project templates)
CREATE TABLE IF NOT EXISTS career_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  career_id UUID REFERENCES careers(id) ON DELETE CASCADE,
  career_title VARCHAR(200) NOT NULL,
  title VARCHAR(250) NOT NULL,
  slug VARCHAR(250),
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level IN (1, 2, 3)),
  difficulty_label VARCHAR(50) NOT NULL CHECK (difficulty_label IN ('Starter', 'Practical', 'Career-Ready')),
  project_type VARCHAR(50) NOT NULL DEFAULT 'technical',
  estimated_effort VARCHAR(100) NOT NULL DEFAULT '1-2 weeks',
  brief TEXT NOT NULL,
  problem_statement TEXT NOT NULL,
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks JSONB NOT NULL DEFAULT '[]'::jsonb,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  evaluation_rubric JSONB NOT NULL DEFAULT '[]'::jsonb,
  skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  reflection_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_step TEXT,
  origin VARCHAR(30) NOT NULL DEFAULT 'curated' CHECK (origin IN ('curated', 'ai_generated', 'user_defined')),
  verification_status VARCHAR(30) NOT NULL DEFAULT 'verified' CHECK (verification_status IN ('verified', 'unverified', 'needs_review')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_career_projects_career_id ON career_projects(career_id);
CREATE INDEX IF NOT EXISTS idx_career_projects_difficulty ON career_projects(difficulty_level);

-- 5. Create user_projects table (active workspace, progress & submissions)
CREATE TABLE IF NOT EXISTS user_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES career_projects(id) ON DELETE SET NULL,
  career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  career_title VARCHAR(200),
  pathway_id UUID REFERENCES pathways(id) ON DELETE SET NULL,
  user_pathway_step_id UUID REFERENCES user_pathway_steps(id) ON DELETE SET NULL,
  title VARCHAR(250) NOT NULL,
  difficulty_level INTEGER NOT NULL DEFAULT 1 CHECK (difficulty_level IN (1, 2, 3)),
  difficulty_label VARCHAR(50) NOT NULL DEFAULT 'Starter',
  project_type VARCHAR(50) NOT NULL DEFAULT 'technical',
  status VARCHAR(30) NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('suggested', 'planned', 'in_progress', 'paused', 'submitted', 'completed', 'archived')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paused_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  brief TEXT,
  problem_statement TEXT,
  learning_objectives JSONB NOT NULL DEFAULT '[]'::jsonb,
  prerequisites JSONB NOT NULL DEFAULT '[]'::jsonb,
  tasks_progress JSONB NOT NULL DEFAULT '[]'::jsonb,
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  acceptance_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
  reflection JSONB NOT NULL DEFAULT '{}'::jsonb,
  skills_exercised JSONB NOT NULL DEFAULT '[]'::jsonb,
  starter_template JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_step TEXT,
  -- Portfolio presentation controls
  is_in_portfolio BOOLEAN NOT NULL DEFAULT FALSE,
  portfolio_order INTEGER DEFAULT 0,
  portfolio_summary TEXT,
  portfolio_approach TEXT,
  portfolio_tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  portfolio_outcomes TEXT,
  portfolio_limitations TEXT,
  portfolio_lessons TEXT,
  custom_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index prevents duplicate user project records when clicking Start Project repeatedly
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_projects_user_project 
  ON user_projects (user_id, project_id) 
  WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_projects_user_status ON user_projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_projects_portfolio ON user_projects(user_id, is_in_portfolio);

-- 6. Create user_portfolios table (public profile, bio, privacy controls)
CREATE TABLE IF NOT EXISTS user_portfolios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name VARCHAR(200) NOT NULL DEFAULT 'CareerGPS Professional',
  professional_title VARCHAR(250) DEFAULT 'Aspiring Specialist',
  bio TEXT DEFAULT 'Portfolio of practical projects and verified evidence developed through CareerGPS personalized learning pathways.',
  target_career_id UUID REFERENCES careers(id) ON DELETE SET NULL,
  target_career_title VARCHAR(250),
  contact_email VARCHAR(320),
  social_links JSONB NOT NULL DEFAULT '{"github": "", "linkedin": "", "website": ""}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  share_slug VARCHAR(100) UNIQUE,
  privacy_settings JSONB NOT NULL DEFAULT '{"show_email": false, "show_education": true, "show_skills": true, "allow_download": true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_portfolios_share_slug ON user_portfolios(share_slug);

-- 7. Seed Curated Projects for Technical and Non-Technical Career Families

-- Backend Developer (dd929e8c-07b1-4567-a202-384a53b6e254)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000001-0001-4000-8000-000000000001',
  'dd929e8c-07b1-4567-a202-384a53b6e254',
  'Backend Developer',
  'Level 1 — Validated CRUD REST API Service',
  'backend-starter-crud-api',
  1,
  'Starter',
  'technical',
  '1 week (8-12 hours)',
  'Build and document a validated, error-handled HTTP REST API that performs complete CRUD operations on a single domain entity.',
  'Client applications crash or corrupt data when server endpoints fail to validate payloads, return incorrect HTTP status codes, or crash on invalid inputs.',
  '["Design clean REST endpoint contracts using standard HTTP methods", "Implement request body validation using Zod or Joi schemas", "Build standardized error handling middleware returning JSON error payloads"]'::jsonb,
  '["Basic JavaScript / Node.js or Python syntax", "Understanding of HTTP methods (GET, POST, PUT, DELETE)"]'::jsonb,
  '[
    {"order": 1, "title": "Setup Project and Environment", "description": "Initialize a Node.js Express or FastAPI project with clean folder structure and dotenv configuration.", "deliverable_hint": "Repository package.json or requirements.txt"},
    {"order": 2, "title": "Define Domain Model and Validation Schema", "description": "Create strict validation schemas for creating and updating the resource.", "deliverable_hint": "Validation schema module"},
    {"order": 3, "title": "Implement REST Route Handlers", "description": "Implement GET /items, GET /items/:id, POST /items, PUT /items/:id, and DELETE /items/:id.", "deliverable_hint": "Route controllers with status codes"},
    {"order": 4, "title": "Centralized Error Middleware & API Documentation", "description": "Catch unhandled errors and document endpoints in a README or Postman collection.", "deliverable_hint": "README with curl examples"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Source Code Repository", "description": "Public GitHub or GitLab repository with clean commit history.", "format_hint": "https://github.com/username/crud-api", "required": true},
    {"type": "api_doc", "title": "API Documentation / README", "description": "README markdown detailing endpoints, request payloads, and sample curl commands.", "format_hint": "Repository README or Swagger link", "required": true}
  ]'::jsonb,
  '[
    "All 5 CRUD endpoints return correct HTTP status codes (200, 201, 400, 404, 500)",
    "Malformed JSON or missing required fields return 400 with descriptive error messages",
    "Application does not crash on unhandled route or database exceptions",
    "Code is organized into separate routes, controllers, and validation schemas"
  ]'::jsonb,
  '[
    {"dimension": "Code Structure & Modularity", "criteria": "Clear separation of router, controller, and validation logic"},
    {"dimension": "Schema Validation", "criteria": "Strict validation rejects invalid types and missing fields with clear 400 response"},
    {"dimension": "Error Handling", "criteria": "Global error handling middleware catches exceptions without leaking internal stack traces"}
  ]'::jsonb,
  '["REST APIs", "Node.js", "Express.js", "Input Validation"]'::jsonb,
  '{"title": "Express REST API Starter Template", "description": "Pre-configured Node.js Express scaffold with ESLint and dotenv.", "free_alternative": "Run locally without paid cloud services", "url": "https://github.com/expressjs/express"}'::jsonb,
  '["What HTTP edge cases were trickiest to handle?", "How does input validation protect backend stability?"]'::jsonb,
  'Advance to Level 2: Build an authenticated API backed by a PostgreSQL database.',
  'curated',
  'verified'
),
(
  'e1000001-0001-4000-8000-000000000002',
  'dd929e8c-07b1-4567-a202-384a53b6e254',
  'Backend Developer',
  'Level 2 — Authenticated API with PostgreSQL, Transactions & Automated Tests',
  'backend-practical-auth-postgres-api',
  2,
  'Practical',
  'technical',
  '2-3 weeks (20-30 hours)',
  'Build a multi-entity backend service featuring user registration, JWT/bcrypt authentication, normalized PostgreSQL schema with relational queries, and automated integration tests.',
  'Unprotected backend endpoints, SQL injection vulnerabilities, and race conditions in financial or multi-step operations cause severe security breaches and data corruption.',
  '["Implement secure user authentication with salted bcrypt password hashing and JWT access tokens", "Design normalized relational schemas in PostgreSQL with foreign keys and indexes", "Write automated integration tests covering happy and edge-case paths with Supertest/Vitest"]'::jsonb,
  '["Level 1 CRUD API or equivalent experience", "Basic SQL queries (SELECT, INSERT, UPDATE, JOIN)"]'::jsonb,
  '[
    {"order": 1, "title": "Design Database Schema & Migrations", "description": "Write SQL migrations creating users and related resource tables with foreign key constraints.", "deliverable_hint": "SQL migration files"},
    {"order": 2, "title": "Implement Auth & Security Middleware", "description": "Build /auth/register and /auth/login with password hashing and JWT bearer verification middleware.", "deliverable_hint": "Auth controller & authenticate middleware"},
    {"order": 3, "title": "Relational CRUD with Transactions", "description": "Implement business logic requiring relational JOINs and transactional atomicity (BEGIN/COMMIT).", "deliverable_hint": "Service layer with parameterized queries"},
    {"order": 4, "title": "Write Automated Test Suite", "description": "Create automated tests testing auth, validation, and database operations.", "deliverable_hint": "Vitest or Jest integration test suite"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Source Code Repository", "description": "Git repository with migrations, source code, and automated test suite.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "test_results", "title": "Automated Test Suite Output", "description": "Log or screenshot showing passing unit and integration tests.", "format_hint": "Test runner output report", "required": true},
    {"type": "api_doc", "title": "API Specification & Postman Collection", "description": "OpenAPI / Swagger spec or Postman collection with auth headers.", "format_hint": "Link or repository docs", "required": false}
  ]'::jsonb,
  '[
    "Passwords are never stored in plaintext and verified using bcrypt",
    "Protected routes return 401 Unauthorized when token is missing or expired",
    "All database operations use parameterized queries preventing SQL injection",
    "Automated test suite contains at least 8 passing integration tests"
  ]'::jsonb,
  '[
    {"dimension": "Security & Authentication", "criteria": "Proper JWT verification, token expiration, and secure password hashing"},
    {"dimension": "Database Modeling", "criteria": "Clean relational schema with foreign key integrity and parameterized queries"},
    {"dimension": "Test Coverage", "criteria": "Integration tests exercise both successful operations and error boundaries"}
  ]'::jsonb,
  '["PostgreSQL", "SQL", "JWT", "Authentication", "API Testing", "Node.js"]'::jsonb,
  '{"title": "Node-Postgres Auth Scaffold", "description": "Local PostgreSQL Docker Compose and Express template with pg client.", "free_alternative": "Runs on local PostgreSQL without paid databases", "url": "https://node-postgres.com"}'::jsonb,
  '["How did you structure database connection pooling?", "What was the most challenging part of authentication middleware?"]'::jsonb,
  'Advance to Level 3: Deploy a production-ready containerized microservice with CI/CD.',
  'curated',
  'verified'
),
(
  'e1000001-0001-4000-8000-000000000003',
  'dd929e8c-07b1-4567-a202-384a53b6e254',
  'Backend Developer',
  'Level 3 — Production-Ready Cloud Microservice with CI/CD & Observability',
  'backend-career-ready-cloud-service',
  3,
  'Career-Ready',
  'technical',
  '3-4 weeks (40+ hours)',
  'Build, containerize, and deploy a documented production-style backend service with background job processing, Redis caching, GitHub Actions CI/CD, structured logging, and health monitoring.',
  'Production systems fail under high concurrency, lack visibility during incidents, and suffer outages during manual deployments if not architected with automated testing, containerization, and observability.',
  '["Containerize multi-service applications using multi-stage Dockerfiles and Docker Compose", "Integrate Redis caching and async background task queues (BullMQ/RabbitMQ)", "Implement structured logging, health check probes, and GitHub Actions CI/CD deployment"]'::jsonb,
  '["Level 2 Authenticated API with PostgreSQL", "Docker basics and Git fundamentals"]'::jsonb,
  '[
    {"order": 1, "title": "Architecture & Background Worker Integration", "description": "Implement asynchronous job processing with Redis and retry handling for heavy workloads.", "deliverable_hint": "Worker service module"},
    {"order": 2, "title": "Containerization with Docker Compose", "description": "Author multi-stage Dockerfile and docker-compose.yml orchestrating API, Postgres, and Redis.", "deliverable_hint": "Dockerfile & docker-compose.yml"},
    {"order": 3, "title": "CI/CD Pipeline Setup", "description": "Configure GitHub Actions workflow for linting, testing, and automated deployment.", "deliverable_hint": ".github/workflows/ci.yml"},
    {"order": 4, "title": "Live Cloud Deployment & Observability", "description": "Deploy to free/low-cost host (e.g. Render/Railway), expose /health, and record structured logs.", "deliverable_hint": "Live endpoint URL and health check"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Production GitHub Repository", "description": "Repository with Docker configuration, GitHub Actions workflow, and architecture diagrams.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "live_demo", "title": "Deployed Live API Service", "description": "Publicly accessible HTTPS base URL with live health-check endpoint.", "format_hint": "https://api-service.onrender.com", "required": true},
    {"type": "architecture", "title": "System Architecture & Documentation", "description": "Architecture diagram (Mermaid or PNG) explaining data flow, cache invalidation, and worker queue.", "format_hint": "Diagram in README", "required": true}
  ]'::jsonb,
  '[
    "Live API responds over HTTPS with working /health endpoint returning uptime and database status",
    "GitHub Actions workflow runs automated tests and passes on main branch commits",
    "Application uses multi-stage Docker build producing an unprivileged runtime image",
    "Comprehensive README includes architecture diagram, setup instructions, and design trade-offs"
  ]'::jsonb,
  '[
    {"dimension": "System Architecture & Resilience", "criteria": "Demonstrates proper decoupling of web server and background job processing"},
    {"dimension": "DevOps & CI/CD", "criteria": "Automated workflow builds, lints, tests, and deploys without manual intervention"},
    {"dimension": "Documentation & Presentation", "criteria": "Clear architectural diagrams and documented operational trade-offs for employer review"}
  ]'::jsonb,
  '["Docker", "CI/CD", "Redis", "System Design", "Cloud Computing", "PostgreSQL"]'::jsonb,
  '{"title": "Production Microservice Starter", "description": "Complete Docker Compose template with GitHub Actions CI workflow.", "free_alternative": "Free deployment on Render/Railway free tiers", "url": "https://render.com"}'::jsonb,
  '["What trade-offs did you make between sync API responses and background workers?", "How did containerization simplify your deployment pipeline?"]'::jsonb,
  'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- AI Engineer (2a7f4d18-6335-472c-aaef-ae9547bfc1e2)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000002-0002-4000-8000-000000000001',
  '2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
  'AI Engineer',
  'Level 1 — Supervised Data Processing & Prediction Exercise',
  'ai-starter-prediction-exercise',
  1,
  'Starter',
  'technical',
  '1 week (10 hours)',
  'Build a reproducible data preprocessing pipeline and predictive model in Python using Pandas, NumPy, and Scikit-learn on a structured dataset.',
  'Raw tabular datasets contain missing values, inconsistent formats, and outliers that cause model divergence or catastrophic prediction failures.',
  '["Handle messy dataset values, missing fields, and numerical scaling", "Implement baseline linear or classification models in Scikit-Learn", "Evaluate performance using proper metrics (MSE, MAE, or F1-Score) on a held-out test split"]'::jsonb,
  '["Python syntax and basic mathematics (Algebra/Statistics)"]'::jsonb,
  '[
    {"order": 1, "title": "Data Exploration and Cleaning", "description": "Load dataset with Pandas, impute missing values, and encode categorical features.", "deliverable_hint": "Jupyter Notebook or clean_data.py"},
    {"order": 2, "title": "Feature Engineering and Train/Test Split", "description": "Create scaled feature tensors and partition data into 80/20 train/test splits.", "deliverable_hint": "Reproducible preprocessing function"},
    {"order": 3, "title": "Model Training and Evaluation", "description": "Train baseline regression/classification model and compute error metrics on test split.", "deliverable_hint": "Evaluation metric outputs"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Jupyter Notebook or Python Scripts", "description": "Clean, documented notebook or repository with requirements.txt.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "report_doc", "title": "Evaluation Summary", "description": "Brief summary of dataset observations, preprocessing choices, and test set metrics.", "format_hint": "Markdown section in README", "required": true}
  ]'::jsonb,
  '[
    "Preprocessing is completely reproducible with seed-fixed train/test split",
    "Model achieves demonstrably better performance than random baseline",
    "Metrics are evaluated strictly on held-out test data (no data leakage)"
  ]'::jsonb,
  '[
    {"dimension": "Data Preprocessing", "criteria": "Proper handling of missing values, outliers, and feature scaling without leakage"},
    {"dimension": "Model Evaluation", "criteria": "Correct metric choice and objective interpretation of baseline results"}
  ]'::jsonb,
  '["Python", "Machine Learning", "Data Cleaning", "Statistics"]'::jsonb,
  '{"title": "Scikit-Learn Starter Notebook", "description": "Google Colab or local Jupyter notebook with open government/Kaggle dataset.", "free_alternative": "Runs 100% free on Google Colab or local Jupyter", "url": "https://colab.research.google.com"}'::jsonb,
  '["Did your model show signs of overfitting?", "Why is preventing data leakage critical in machine learning?"]'::jsonb,
  'Advance to Level 2: Build an end-to-end ML application with reproducible evaluation pipeline.',
  'curated',
  'verified'
),
(
  'e1000002-0002-4000-8000-000000000002',
  '2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
  'AI Engineer',
  'Level 2 — ML Application with Evaluation & Experiment Tracking',
  'ai-practical-ml-evaluation-pipeline',
  2,
  'Practical',
  'technical',
  '2-3 weeks (25-30 hours)',
  'Build an end-to-end machine learning application that trains and compares multiple model architectures (XGBoost, Random Forest, Neural Net), tracks experiments, and exposes an inference endpoint.',
  'Machine learning experiments often become irreproducible black boxes without clear parameter tracking, metric comparison, and standard deployment artifacts.',
  '["Implement multi-model benchmark comparison with cross-validation", "Track model parameters and metrics using MLflow, Weights & Biases, or JSON logs", "Package the top-performing model with an inference script or REST API"]'::jsonb,
  '["Level 1 Prediction Exercise or Python ML familiarity"]'::jsonb,
  '[
    {"order": 1, "title": "Dataset Pipeline & Feature Transformation", "description": "Build automated feature pipeline with Scikit-learn Pipeline or Polars.", "deliverable_hint": "Pipeline class / module"},
    {"order": 2, "title": "Model Training & Hyperparameter Tuning", "description": "Train 3 candidate models with k-fold cross-validation and hyperparameter search.", "deliverable_hint": "Benchmark comparison table"},
    {"order": 3, "title": "Model Serialization & API Serving", "description": "Save trained weights and create a FastAPI inference endpoint accepting JSON input.", "deliverable_hint": "FastAPI app /predict endpoint"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Source Code & Training Pipeline", "description": "Repository containing data pipeline, training scripts, and FastAPI app.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "report_doc", "title": "Comparative Evaluation Report", "description": "Markdown report with ROC-AUC / F1 curves, confusion matrices, and trade-off analysis.", "format_hint": "Docs or README report", "required": true}
  ]'::jsonb,
  '[
    "At least 3 distinct model algorithms are trained and compared systematically",
    "FastAPI inference endpoint loads serialized model and returns predictions in <200ms",
    "Evaluation report explains why the chosen model outperforms the alternatives"
  ]'::jsonb,
  '[
    {"dimension": "Experimental Rigor", "criteria": "Systematic cross-validation and transparent hyperparameter logging"},
    {"dimension": "Serving & Usability", "criteria": "Working FastAPI inference service with request validation"}
  ]'::jsonb,
  '["Machine Learning", "Model Evaluation", "PyTorch", "Python", "REST APIs"]'::jsonb,
  '{"title": "FastAPI + ML Serving Template", "description": "Starter repository combining Scikit-learn pipeline and FastAPI.", "free_alternative": "Runs locally with zero cloud costs", "url": "https://fastapi.tiangolo.com"}'::jsonb,
  '["Which model architecture performed best on rare classes?", "How did cross-validation prevent overfitting?"]'::jsonb,
  'Advance to Level 3: Build and deploy a complete production AI application with LLM/RAG integration and UI.',
  'curated',
  'verified'
),
(
  'e1000002-0002-4000-8000-000000000003',
  '2a7f4d18-6335-472c-aaef-ae9547bfc1e2',
  'AI Engineer',
  'Level 3 — Production AI Application with RAG, Monitoring & Demonstrable Interface',
  'ai-career-ready-rag-app',
  3,
  'Career-Ready',
  'technical',
  '3-4 weeks (40+ hours)',
  'Build and deploy a full-stack AI application combining Retrieval-Augmented Generation (RAG), vector embeddings, hallucination guardrails, monitoring, and a demonstrable user interface.',
  'Enterprise LLM applications suffer from hallucinations, high latency, context overflow, and lack of citation tracking when not built with vector search and evaluation guardrails.',
  '["Architect a production RAG pipeline using vector databases (pgvector/Chroma) and embeddings", "Implement chunking strategies, prompt engineering, citation tracking, and latency monitoring", "Deploy the application with a clean demonstrable web interface"]'::jsonb,
  '["Level 2 ML Application", "Understanding of embeddings and LLM APIs"]'::jsonb,
  '[
    {"order": 1, "title": "Document Ingestion & Chunking Pipeline", "description": "Ingest domain documents, implement smart chunking, and index vectors in PostgreSQL pgvector or Chroma.", "deliverable_hint": "Ingestion script & vector store"},
    {"order": 2, "title": "RAG Service & Citation Engine", "description": "Build FastAPI service executing hybrid search, prompt assembly, and source citation extraction.", "deliverable_hint": "RAG service module with prompt guardrails"},
    {"order": 3, "title": "Frontend UI & Streaming Interface", "description": "Build responsive React or Streamlit interface showing answers with clickable source citations.", "deliverable_hint": "Web interface with live chat/query"},
    {"order": 4, "title": "Latency, Cost & Evaluation Benchmarking", "description": "Measure query latency, token usage, and evaluate response quality using RAGAS or benchmark test cases.", "deliverable_hint": "Evaluation benchmark report"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "Full-Stack AI GitHub Repository", "description": "Complete repository with backend, vector indexing, frontend, and tests.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "live_demo", "title": "Live Interactive Demonstration", "description": "Publicly accessible demo (e.g. HuggingFace Spaces, Streamlit Community, or Vercel).", "format_hint": "Live application URL", "required": true},
    {"type": "architecture", "title": "RAG Architecture & Benchmark Report", "description": "Documentation detailing vector search strategy, embedding model choices, and evaluation metrics.", "format_hint": "README markdown with diagrams", "required": true}
  ]'::jsonb,
  '[
    "Live application generates responses grounded in retrieved context with verified citations",
    "Vector search returns top-k relevant chunks with similarity scores",
    "Application gracefully handles out-of-domain queries without hallucinating facts",
    "README explains vector indexing strategy, embedding choices, and operational costs"
  ]'::jsonb,
  '[
    {"dimension": "RAG Architecture & Accuracy", "criteria": "Effective chunking, hybrid retrieval, and precise citation attribution"},
    {"dimension": "Engineering & Production Readiness", "criteria": "Clean asynchronous API, error resilience, and responsive UI"},
    {"dimension": "Evaluation & Trade-offs", "criteria": "Documented benchmarks for retrieval accuracy, latency, and token efficiency"}
  ]'::jsonb,
  '["LLM Concepts", "RAG", "Vector Search", "Python", "REST APIs", "System Design"]'::jsonb,
  '{"title": "FastAPI + Chroma RAG Scaffold", "description": "Open-source RAG template with local Ollama or free Gemini API keys.", "free_alternative": "Free tier Gemini API + local vector store on HuggingFace Spaces", "url": "https://huggingface.co/spaces"}'::jsonb,
  '["How did you choose chunk size and overlap for your domain documents?", "What guardrails prevented the LLM from hallucinating answers?"]'::jsonb,
  'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- Data Analyst (549fa435-9499-4e45-bee1-b89a13b3d64e)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000003-0003-4000-8000-000000000001',
  '549fa435-9499-4e45-bee1-b89a13b3d64e',
  'Data Analyst',
  'Level 1 — Exploratory Dataset Analysis & Executive Insights Memo',
  'data-starter-eda-insights',
  1,
  'Starter',
  'analytical',
  '1 week (8-10 hours)',
  'Analyze a real-world business dataset, identify key operational patterns, and write a concise 1-page executive insights memo with actionable takeaways.',
  'Decision makers are flooded with raw numbers and operational data but lack clear narrative synthesis explaining what the data actually means.',
  '["Clean and summarize data distributions using Excel or Python", "Calculate meaningful descriptive statistics and percentage shifts", "Translate numerical findings into plain-English business takeaways"]'::jsonb,
  '["Basic spreadsheet literacy (Excel or Google Sheets)"]'::jsonb,
  '[
    {"order": 1, "title": "Data Audit & Cleaning", "description": "Review data completeness, identify anomalies or missing values, and standardize date/category fields.", "deliverable_hint": "Cleaned dataset"},
    {"order": 2, "title": "Exploratory Pivot & Distribution Analysis", "description": "Create pivot tables and summary aggregations tracking primary metrics across cohorts.", "deliverable_hint": "Pivot tables and summary charts"},
    {"order": 3, "title": "Author 1-Page Executive Memo", "description": "Synthesize the top 3 patterns, 1 major bottleneck, and 2 concrete operational recommendations.", "deliverable_hint": "1-page PDF memo or markdown document"}
  ]'::jsonb,
  '[
    {"type": "report_doc", "title": "Executive Insights Memo", "description": "Concise 1-page report detailing observations, charts, and recommendations.", "format_hint": "PDF document or Google Doc link", "required": true},
    {"type": "dataset", "title": "Analyzed Spreadsheet / Workbook", "description": "Excel or Google Sheets workbook containing formulas and pivot tables.", "format_hint": "Google Sheets link or .xlsx upload", "required": true}
  ]'::jsonb,
  '[
    "All summary figures match underlying raw data with documented formulas",
    "Memo contains at least 3 distinct visual charts (bar, line, or distribution)",
    "Recommendations are specific, measurable, and tied directly to data findings"
  ]'::jsonb,
  '[
    {"dimension": "Analytical Rigor", "criteria": "Accurate calculations, proper handling of missing records, and valid percentage comparisons"},
    {"dimension": "Business Communication", "criteria": "Clear narrative that highlights actionable insights rather than listing raw statistics"}
  ]'::jsonb,
  '["Excel", "Data Handling", "Reporting", "Problem Solving"]'::jsonb,
  '{"title": "Business Dataset & Insights Template", "description": "Google Sheets template with pre-built summary pivot tables.", "free_alternative": "100% free with Google Sheets", "url": "https://docs.google.com/spreadsheets"}'::jsonb,
  '["Which metric showed the most surprising variance across customer segments?", "How did you ensure calculations were free of double-counting?"]'::jsonb,
  'Advance to Level 2: Build an interactive business intelligence dashboard.',
  'curated',
  'verified'
),
(
  'e1000003-0003-4000-8000-000000000002',
  '549fa435-9499-4e45-bee1-b89a13b3d64e',
  'Data Analyst',
  'Level 2 — Interactive BI Dashboard with Power BI, Tableau or Looker Studio',
  'data-practical-bi-dashboard',
  2,
  'Practical',
  'analytical',
  '2-3 weeks (20 hours)',
  'Design and publish an interactive business intelligence dashboard with custom calculated metrics, dynamic filtering, and executive KPI summary cards.',
  'Static monthly reports delay strategic responses; management needs real-time, interactive visibility into revenue, customer retention, and regional performance.',
  '["Design clean star-schema relational data models for analytics", "Write calculated measures (DAX or SQL calculated fields) for ratios and growth rates", "Implement user-friendly filtering by date range, geography, and category"]'::jsonb,
  '["Level 1 Data Analysis or spreadsheet formulas", "Basic understanding of relational tables"]'::jsonb,
  '[
    {"order": 1, "title": "Data Modeling & Relationship Setup", "description": "Import multi-table dataset, define primary/foreign keys, and establish 1-to-many relationships.", "deliverable_hint": "Data model diagram"},
    {"order": 2, "title": "Create Calculated Measures & KPIs", "description": "Write DAX or custom calculations for Year-over-Year growth, churn rate, and margin.", "deliverable_hint": "Calculated field formulas"},
    {"order": 3, "title": "Interactive Visual Layout & UX Design", "description": "Assemble executive dashboard with consistent color palette, KPI scorecards, and interactive slicers.", "deliverable_hint": "Interactive dashboard layout"},
    {"order": 4, "title": "Publish & Write User Guide", "description": "Publish to public web viewer and document user instructions in a brief walkthrough.", "deliverable_hint": "Public link and documentation"}
  ]'::jsonb,
  '[
    {"type": "live_demo", "title": "Public Interactive Dashboard Link", "description": "Public Tableau Public, Power BI Web, or Looker Studio link.", "format_hint": "https://public.tableau.com/... or Looker Studio URL", "required": true},
    {"type": "report_doc", "title": "Dashboard Methodology & User Guide", "description": "Document explaining calculations, data sources, and key findings.", "format_hint": "PDF document or README", "required": true}
  ]'::jsonb,
  '[
    "Dashboard provides working interactive filters (slicers) that update all visual elements correctly",
    "KPI cards display clear comparisons (e.g. current vs target or prior period)",
    "Visual design avoids clutter and follows good data visualization ergonomics",
    "Calculations are documented and mathematically sound"
  ]'::jsonb,
  '[
    {"dimension": "Data Visualization & UI", "criteria": "Effective chart selection, minimal clutter, and intuitive interactive controls"},
    {"dimension": "Technical Metric Design", "criteria": "Complex calculated fields (MoM growth, cohort retention) computed accurately"}
  ]'::jsonb,
  '["Power BI", "Tableau", "Data Visualisation", "SQL", "Reporting"]'::jsonb,
  '{"title": "Looker Studio / Tableau Public Scaffold", "description": "Free cloud dashboard template using public sales/operations data.", "free_alternative": "100% free on Tableau Public or Google Looker Studio", "url": "https://lookerstudio.google.com"}'::jsonb,
  '["How did you prevent cross-filtering from producing misleading percentage values?", "Which chart type best communicated seasonal trends?"]'::jsonb,
  'Advance to Level 3: Complete an end-to-end data analytics capstone with SQL, Python, and strategic recommendations.',
  'curated',
  'verified'
),
(
  'e1000003-0003-4000-8000-000000000003',
  '549fa435-9499-4e45-bee1-b89a13b3d64e',
  'Data Analyst',
  'Level 3 — End-to-End Analytics Capstone: SQL Extraction, Statistical EDA & Strategic Recommendations',
  'data-career-ready-analytics-capstone',
  3,
  'Career-Ready',
  'analytical',
  '3-4 weeks (35+ hours)',
  'Conduct an end-to-end business analytics investigation from raw SQL database extraction and statistical hypothesis testing to reproducible Python notebooks and an executive slide deck.',
  'Companies lose millions on misdiagnosed customer churn or supply chain delays because teams rely on surface-level vanity metrics rather than root-cause data analysis.',
  '["Write advanced SQL queries featuring multi-table joins, subqueries, CTEs, and window functions", "Execute statistical exploratory data analysis in Python (Pandas/Seaborn) with hypothesis testing", "Deliver an executive-ready slide deck presenting root causes, financial implications, and prioritized solutions"]'::jsonb,
  '["Level 2 BI Dashboard", "SQL fundamentals and Python basics"]'::jsonb,
  '[
    {"order": 1, "title": "SQL Database Extraction & Cleaning", "description": "Write documented SQL scripts extracting cohorts, calculating aggregations with CTEs and window functions.", "deliverable_hint": "SQL extraction scripts"},
    {"order": 2, "title": "Python Statistical Analysis & Visualization", "description": "Perform correlation analysis, test statistical significance, and generate publication-quality figures.", "deliverable_hint": "Jupyter Notebook with EDA"},
    {"order": 3, "title": "Business Impact Modeling & Recommendations", "description": "Quantify revenue impact or cost savings under 3 recommended strategic initiatives.", "deliverable_hint": "Financial/operational impact model"},
    {"order": 4, "title": "Executive Slide Deck & Project Portfolio Presentation", "description": "Assemble a 10-slide executive presentation and publish GitHub repository with all artifacts.", "deliverable_hint": "Slide deck PDF and GitHub repo"}
  ]'::jsonb,
  '[
    {"type": "code_repo", "title": "SQL & Python GitHub Repository", "description": "Public repository containing clean SQL queries, Python notebooks, and requirements.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "presentation", "title": "Executive Presentation Slide Deck", "description": "Slide deck (PDF or SlideShare link) highlighting business context, findings, and strategic ROI.", "format_hint": "Slide deck PDF link", "required": true},
    {"type": "report_doc", "title": "Comprehensive Capstone Report", "description": "Written case study detailing assumptions, methodology, limitations, and next steps.", "format_hint": "Detailed report PDF or README", "required": true}
  ]'::jsonb,
  '[
    "SQL scripts execute without syntax errors and utilize CTEs or window functions appropriately",
    "Analysis addresses root causes with statistical confidence rather than superficial correlation",
    "Recommendations include estimated business impact and explicit limitations of the dataset",
    "Presentation deck is clear, visually appealing, and formatted for senior executive review"
  ]'::jsonb,
  '[
    {"dimension": "Technical Execution (SQL & Python)", "criteria": "Performant queries, clean vector manipulation, and reproducible statistical testing"},
    {"dimension": "Business Value & Strategy", "criteria": "Actionable recommendations backed by clear financial or operational modeling"},
    {"dimension": "Executive Communication", "criteria": "Compelling visual storytelling that translates complex numbers into strategic decisions"}
  ]'::jsonb,
  '["SQL", "PostgreSQL", "Python", "Data Visualisation", "Reporting", "Problem Solving"]'::jsonb,
  '{"title": "Data Analyst Capstone Template", "description": "GitHub repository scaffold with structured folders for data, sql, notebooks, and presentations.", "free_alternative": "100% free with open data and local tools", "url": "https://github.com"}'::jsonb,
  '["What confounding variables did you discover during statistical testing?", "How did you translate data patterns into realistic dollar estimates?"]'::jsonb,
  'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- Geo Analyst / Geography / GIS (5b71c777-6a12-4f11-9a7c-3f20d58be101)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000004-0004-4000-8000-000000000001',
  '5b71c777-6a12-4f11-9a7c-3f20d58be101',
  'Geo Analyst',
  'Level 1 — Publication-Ready Thematic Map & Cartographic Layout',
  'geo-starter-thematic-map',
  1,
  'Starter',
  'geospatial',
  '1 week (8-10 hours)',
  'Create a publication-quality thematic map using an open geospatial dataset in QGIS, following professional cartographic composition rules.',
  'Poorly designed maps mislead researchers and planners when coordinate reference systems are mismatched, scales are missing, or color symbology is illegible.',
  '["Import and clean vector shapefiles and GeoJSON in QGIS", "Set and verify appropriate Coordinate Reference Systems (CRS) such as UTM/WGS84", "Design professional cartographic layouts with title, north arrow, scale bar, and legend"]'::jsonb,
  '["Basic understanding of maps, coordinates, and open-source GIS software (QGIS)"]'::jsonb,
  '[
    {"order": 1, "title": "Acquire Data & Verify Projection", "description": "Download district/state boundary shapefile and attribute data (e.g. population or forest cover); reproject to projected CRS.", "deliverable_hint": "Projected geospatial layer"},
    {"order": 2, "title": "Choropleth Symbology & Classification", "description": "Apply graduated color ramps using Jenks natural breaks or quantile classification with readable labels.", "deliverable_hint": "Styled vector map layer"},
    {"order": 3, "title": "Print Layout & Cartographic Compilation", "description": "Build layout composer with title, legend, dynamic scale bar, north arrow, and data source credits; export to PDF.", "deliverable_hint": "High-resolution map PDF"}
  ]'::jsonb,
  '[
    {"type": "map_spatial", "title": "High-Resolution Thematic Map (PDF/PNG)", "description": "300 DPI exported cartographic map with complete layout elements.", "format_hint": "PDF or PNG map file link", "required": true},
    {"type": "report_doc", "title": "Map Metadata & Data Source Notes", "description": "Brief note documenting CRS used, data source, and classification rationale.", "format_hint": "Markdown note or PDF", "required": true}
  ]'::jsonb,
  '[
    "Map includes clear title, author, date, data source attribution, scale bar, and north arrow",
    "Layer coordinate reference system (CRS) is properly projected without distortion",
    "Color ramp is colorblind-safe and class intervals are logically defined",
    "Labels and legend text are crisp and legible at 100% zoom"
  ]'::jsonb,
  '[
    {"dimension": "Cartographic Integrity", "criteria": "Proper CRS projection, accurate scale representation, and complete essential map elements"},
    {"dimension": "Visual Communication", "criteria": "Effective symbology and readable classification intervals"}
  ]'::jsonb,
  '["GIS (Geographic Information Systems)", "Cartography & Map Design", "QGIS / ArcGIS"]'::jsonb,
  '{"title": "QGIS Thematic Map Project Scaffold", "description": "QGIS project file with public India state/district boundaries.", "free_alternative": "100% free using open-source QGIS and public GIS data", "url": "https://qgis.org"}'::jsonb,
  '["Why is selecting a projected coordinate reference system critical before measuring distances?", "How did your classification choice affect the visual story?"]'::jsonb,
  'Advance to Level 2: Conduct a multi-criteria GIS spatial analysis project.',
  'curated',
  'verified'
),
(
  'e1000004-0004-4000-8000-000000000002',
  '5b71c777-6a12-4f11-9a7c-3f20d58be101',
  'Geo Analyst',
  'Level 2 — Multi-Criteria GIS Suitability Analysis & Documented Methodology',
  'geo-practical-suitability-analysis',
  2,
  'Practical',
  'geospatial',
  '2-3 weeks (20 hours)',
  'Execute a multi-criteria spatial suitability analysis (e.g. solar farm site selection or flood vulnerability assessment) combining vector buffers, raster terrain, and documented overlay criteria.',
  'Infrastructure and environmental conservation projects risk high costs or ecological damage when site selection ignores slope constraints, water proximity, and zoning restrictions.',
  '["Perform vector proximity buffering and overlay operations (intersection, clip, dissolve)", "Process Digital Elevation Models (DEM) to generate slope and aspect raster surfaces", "Document weighted overlay scoring methodology and generate final suitability rankings"]'::jsonb,
  '["Level 1 Thematic Map or QGIS vector fundamentals"]'::jsonb,
  '[
    {"order": 1, "title": "Define Multi-Criteria Constraints & Criteria", "description": "Formulate 4 criteria (e.g. slope < 15%, distance to roads < 2km, outside protected areas).", "deliverable_hint": "Criteria matrix document"},
    {"order": 2, "title": "Vector Buffer & Spatial Overlay Operations", "description": "Generate multi-ring buffers and clip feature polygons against zoning boundaries.", "deliverable_hint": "Vector analysis layers"},
    {"order": 3, "title": "Raster Terrain Processing & Scoring", "description": "Process SRTM DEM for slope, reclassify raster layers into 1-5 suitability scores.", "deliverable_hint": "Reclassified raster grid"},
    {"order": 4, "title": "Weighted Overlay & Synthesis Report", "description": "Combine layers via raster calculator, identify top candidate zones, and author analysis report.", "deliverable_hint": "Suitability map and report"}
  ]'::jsonb,
  '[
    {"type": "map_spatial", "title": "Suitability Analysis Map Suite", "description": "Multi-page or multi-panel map showing input layers, constraints, and final suitability ranking.", "format_hint": "PDF document with maps", "required": true},
    {"type": "report_doc", "title": "Documented Methodology Report", "description": "Technical report with workflow diagram, criteria weights, limitations, and recommendations.", "format_hint": "PDF report or Word doc", "required": true}
  ]'::jsonb,
  '[
    "Analysis includes at least 3 distinct spatial layers (e.g. elevation, land use, infrastructure)",
    "Workflow documentation clearly details step-by-step geoprocessing tools used",
    "Final map clearly distinguishes unfeasible exclusion zones from ranked suitable areas",
    "Report outlines limitations of data resolution and ground-truth verification needs"
  ]'::jsonb,
  '[
    {"dimension": "Spatial Analytical Rigor", "criteria": "Proper geoprocessing workflow, correct raster reclassification, and valid overlay logic"},
    {"dimension": "Methodology Documentation", "criteria": "Clear documentation of criteria, assumptions, and data limitations"}
  ]'::jsonb,
  '["Spatial Data Analysis", "QGIS / ArcGIS", "Georeferencing & Projections"]'::jsonb,
  '{"title": "Site Suitability QGIS Workflow Template", "description": "QGIS project with sample DEM, road networks, and land use shapefiles.", "free_alternative": "100% free with open DEMs from USGS EarthExplorer and open OSM data", "url": "https://earthexplorer.usgs.gov"}'::jsonb,
  '["Which criterion had the largest impact on reducing suitable land area?", "What limitations does a 30m DEM introduce into slope calculations?"]'::jsonb,
  'Advance to Level 3: Complete an end-to-end geospatial case study with satellite remote sensing or PostGIS database.',
  'curated',
  'verified'
),
(
  'e1000004-0004-4000-8000-000000000003',
  '5b71c777-6a12-4f11-9a7c-3f20d58be101',
  'Geo Analyst',
  'Level 3 — Geospatial Case Study: Satellite Remote Sensing, PostGIS & Interactive Web-GIS',
  'geo-career-ready-remote-sensing-postgis',
  3,
  'Career-Ready',
  'geospatial',
  '3-4 weeks (35+ hours)',
  'Conduct an end-to-end geospatial case study integrating Sentinel-2 multispectral satellite imagery (NDVI change detection), a PostGIS spatial SQL database, and an interactive web map.',
  'Environmental agencies and spatial consultancies need temporal environmental monitoring and scalable spatial query capabilities rather than static desktop shapefiles.',
  '["Acquire and process multispectral Sentinel-2 imagery to compute temporal vegetation (NDVI) change", "Load, index, and query spatial geometry in PostgreSQL using PostGIS and spatial SQL", "Publish interactive web-GIS maps using Leaflet.js, MapLibre, or QGIS Cloud"]'::jsonb,
  '["Level 2 GIS Suitability Analysis", "Basic SQL knowledge"]'::jsonb,
  '[
    {"order": 1, "title": "Satellite Imagery Acquisition & NDVI Processing", "description": "Download 2 temporal Sentinel-2 scenes for a district; calculate NDVI index and difference map.", "deliverable_hint": "NDVI change raster"},
    {"order": 2, "title": "PostGIS Spatial Database Modeling & Querying", "description": "Load spatial data into PostgreSQL PostGIS; write spatial queries (ST_Intersects, ST_DWithin, ST_Area).", "deliverable_hint": "SQL script with spatial queries"},
    {"order": 3, "title": "Interactive Web-GIS Viewer Build", "description": "Create interactive Leaflet.js or MapLibre web map hosting GeoJSON layers with popup tooltips.", "deliverable_hint": "Web map on GitHub Pages"},
    {"order": 4, "title": "Full Case Study & Portfolio Assembly", "description": "Compile comprehensive case study detailing coastal/agricultural findings, SQL code, and live map.", "deliverable_hint": "Published case study & repo"}
  ]'::jsonb,
  '[
    {"type": "live_demo", "title": "Interactive Web-GIS Map URL", "description": "Live web map on GitHub Pages or web hosting showing layers and popups.", "format_hint": "https://username.github.io/web-gis", "required": true},
    {"type": "code_repo", "title": "PostGIS SQL & Web-GIS Repository", "description": "GitHub repository with spatial SQL scripts, Python scripts, and web map code.", "format_hint": "GitHub repository URL", "required": true},
    {"type": "report_doc", "title": "Geospatial Case Study Document", "description": "Full case study report with maps, methodology, satellite spectral curves, and recommendations.", "format_hint": "PDF document or website link", "required": true}
  ]'::jsonb,
  '[
    "Satellite analysis includes multi-temporal comparison (before vs after) with quantified area change",
    "PostGIS queries demonstrate spatial indexing (GiST) and spatial joins with clean SQL scripts",
    "Interactive web map responds quickly, supports layer toggle, and displays attribute inspection popups",
    "Case study outlines real-world policy or environmental recommendations and explicit sensor limitations"
  ]'::jsonb,
  '[
    {"dimension": "Remote Sensing & PostGIS Integration", "criteria": "Demonstrates mastery of both satellite spectral analysis and relational spatial SQL"},
    {"dimension": "Web-GIS & Presentation", "criteria": "Clean, interactive web mapping delivery that effectively shares findings with non-technical stakeholders"},
    {"dimension": "Case Study Depth", "criteria": "Insightful environmental or regional analysis grounded in verified spatial evidence"}
  ]'::jsonb,
  '["Remote Sensing & Satellite Imagery", "Spatial SQL & PostGIS", "Spatial Data Analysis", "QGIS / ArcGIS"]'::jsonb,
  '{"title": "Geospatial Portfolio Scaffold", "description": "GitHub Pages template with Leaflet.js and sample PostGIS SQL schema.", "free_alternative": "100% free using Copernicus Sentinel browser, local PostgreSQL/PostGIS, and GitHub Pages", "url": "https://browser.dataspace.copernicus.eu"}'::jsonb,
  '["How did cloud cover and seasonal atmospheric moisture affect satellite surface reflectance?", "What performance advantages did PostGIS spatial indexing provide over shapefiles?"]'::jsonb,
  'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- Teacher / Assistant Professor (17e40e2c-763d-496c-8fc8-c18e40bd8ab1 & 9ae2c439-f3eb-4ddc-89d6-f269bcdaf460)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000005-0005-4000-8000-000000000001',
  '17e40e2c-763d-496c-8fc8-c18e40bd8ab1',
  'Assistant Professor',
  'Level 1 — Outcome-Based Lesson Plan & Learning Objectives Design',
  'academic-starter-lesson-plan',
  1,
  'Starter',
  'academic',
  '1 week (6-8 hours)',
  'Design an outcome-based higher education lesson plan for an undergraduate module, mapping Course Outcomes (CO) using Bloom’s Revised Taxonomy.',
  'Lectures that lack structured outcome-based alignment result in low student engagement and fail NAAC/UGC accreditation evaluation benchmarks.',
  '["Formulate measurable student learning outcomes using action verbs from Bloom’s Taxonomy", "Structure a 60-minute interactive university lecture breakdown (Hook, Instruction, Active Learning, Summary)", "Design formative classroom quick-assessment questions"]'::jsonb,
  '["Postgraduate domain knowledge in chosen discipline"]'::jsonb,
  '[
    {"order": 1, "title": "Select Unit Topic & Formulate Course Outcomes", "description": "Choose a core undergraduate topic and write 3 specific learning objectives mapped to Bloom levels.", "deliverable_hint": "Course outcome matrix"},
    {"order": 2, "title": "Structure 60-Minute Lesson Timeline", "description": "Detail pedagogical activities: introductory hook, direct concept instruction, student exercise, and closing.", "deliverable_hint": "Structured lesson outline"},
    {"order": 3, "title": "Design In-Class Formative Check", "description": "Create 3 formative check-for-understanding questions and expected student response guide.", "deliverable_hint": "Assessment questions & answer keys"}
  ]'::jsonb,
  '[
    {"type": "lesson_plan", "title": "Outcome-Based Lesson Plan Document", "description": "Complete lesson plan document with Bloom taxonomy mapping and timing breakdown.", "format_hint": "PDF document or Word template", "required": true},
    {"type": "report_doc", "title": "Pedagogical Rationale Statement", "description": "Brief explanation of active learning strategies selected for this subject.", "format_hint": "Section within lesson plan document", "required": true}
  ]'::jsonb,
  '[
    "Learning objectives use measurable action verbs (e.g. Analyze, Evaluate, Construct rather than Understand)",
    "Lesson timeline accounts for all 60 minutes with dedicated active learning participation",
    "Formative assessment directly evaluates the stated learning outcomes"
  ]'::jsonb,
  '[
    {"dimension": "Pedagogical Rigor", "criteria": "Accurate Bloom taxonomy alignment and outcome-based education (OBE) design"},
    {"dimension": "Instructional Clarity", "criteria": "Practical, step-by-step lecture guidance that another instructor could execute"}
  ]'::jsonb,
  '["Teaching/Pedagogy", "Curriculum Development", "Communication"]'::jsonb,
  '{"title": "OBE Lesson Plan Template", "description": "Standard university lesson plan document aligned with UGC/NAAC guidelines.", "free_alternative": "Free downloadable document template", "url": "https://careergps.local/templates/lesson-plan.docx"}'::jsonb,
  '["How did you ensure the active learning segment engages quiet students?", "Which Bloom taxonomy level does your primary objective target?"]'::jsonb,
  'Advance to Level 2: Design a multi-week course sequence with grading rubrics and sample teaching materials.',
  'curated',
  'verified'
),
(
  'e1000005-0005-4000-8000-000000000002',
  '17e40e2c-763d-496c-8fc8-c18e40bd8ab1',
  'Assistant Professor',
  'Level 2 — Course Module Sequence, Grading Rubric & Sample Teaching Materials',
  'academic-practical-course-sequence',
  2,
  'Practical',
  'academic',
  '2-3 weeks (20 hours)',
  'Develop a comprehensive 4-week undergraduate course sequence complete with lecture slide materials, reading guides, and an analytic assessment grading rubric.',
  'Vague grading criteria create grading bias, student disputes, and fail modern outcome-based assessment standards required by universities.',
  '["Develop a progressive 4-week syllabus module with cumulative competencies", "Author sample lecture presentation slides and supplementary student study guide", "Construct an analytic 4-tier grading rubric (Exemplary, Proficient, Developing, Novice)"]'::jsonb,
  '["Level 1 Outcome-Based Lesson Plan or teaching experience"]'::jsonb,
  '[
    {"order": 1, "title": "4-Week Syllabus Module Map", "description": "Map 12 lecture topics across 4 weeks with weekly reading assignments and milestone outcomes.", "deliverable_hint": "Module syllabus document"},
    {"order": 2, "title": "Sample Teaching Slide Deck & Handout", "description": "Create a clean 15-20 slide presentation deck and a 2-page student summary handout for Week 2.", "deliverable_hint": "Slide deck PDF & Handout PDF"},
    {"order": 3, "title": "Analytic Assessment Rubric Design", "description": "Build a multi-dimensional rubric for a mid-term assignment or seminar presentation.", "deliverable_hint": "Grading rubric matrix"}
  ]'::jsonb,
  '[
    {"type": "lesson_plan", "title": "4-Week Course Sequence Syllabus", "description": "Documented curriculum sequence with weekly readings and learning objectives.", "format_hint": "PDF document", "required": true},
    {"type": "presentation", "title": "Lecture Slide Deck (15-20 slides)", "description": "High-quality academic lecture presentation deck.", "format_hint": "PDF slides or Google Slides link", "required": true},
    {"type": "report_doc", "title": "Analytic Grading Rubric Matrix", "description": "Rubric detailing 4 performance levels across 4 evaluation criteria.", "format_hint": "PDF table or spreadsheet", "required": true}
  ]'::jsonb,
  '[
    "4-week syllabus shows clear pedagogical progression from foundational to analytical concepts",
    "Slide deck is well-formatted, contains clear diagrams/examples, and includes citations",
    "Rubric defines concrete observable behaviors for each performance tier"
  ]'::jsonb,
  '[
    {"dimension": "Curriculum Architecture", "criteria": "Progressive, logically sequenced course design matching university standards"},
    {"dimension": "Assessment Precision", "criteria": "Objective, unambiguous rubric criteria that eliminate subjective bias"}
  ]'::jsonb,
  '["Teaching/Pedagogy", "Curriculum Development", "Academic Writing", "Presentation Skills"]'::jsonb,
  '{"title": "University Module & Rubric Scaffold", "description": "Document templates for semester module design and AAC&U VALUE rubrics.", "free_alternative": "Free templates for Google Docs and Slides", "url": "https://careergps.local/templates/academic-module.docx"}'::jsonb,
  '["How does your rubric clearly distinguish between \"Proficient\" and \"Exemplary\" work?", "What active learning techniques were embedded in the slide deck?"]'::jsonb,
  'Advance to Level 3: Assemble a complete Academic Teaching Portfolio & Research Dossier for college recruitment.',
  'curated',
  'verified'
),
(
  'e1000005-0005-4000-8000-000000000003',
  '17e40e2c-763d-496c-8fc8-c18e40bd8ab1',
  'Assistant Professor',
  'Level 3 — Academic Teaching Dossier, Statement of Philosophy & Research Evidence',
  'academic-career-ready-teaching-portfolio',
  3,
  'Career-Ready',
  'academic',
  '3-4 weeks (30+ hours)',
  'Build a professional Academic Teaching Portfolio containing a Statement of Teaching Philosophy, syllabus design, assessment artifacts, reflective teaching notes, and documented research publications.',
  'College and university selection committees evaluate verified Academic Performance Indicator (API) evidence, pedagogical maturity, and research output before appointing faculty.',
  '["Write a compelling 2-page Statement of Teaching Philosophy grounded in pedagogical theory", "Compile representative course materials, student feedback/rubrics, and reflective practice notes", "Structure an academic CV detailing UGC-NET qualification, publications, and research contributions"]'::jsonb,
  '["Master’s degree in subject discipline", "UGC-NET / SET preparation or qualification"]'::jsonb,
  '[
    {"order": 1, "title": "Author Teaching Philosophy Statement", "description": "Write a 2-page personal philosophy addressing student learning, inclusivity, and instructional methods.", "deliverable_hint": "Philosophy statement document"},
    {"order": 2, "title": "Compile Academic Teaching Artifacts", "description": "Assemble your best course syllabus, sample lecture slides, assessment rubric, and assignment prompts.", "deliverable_hint": "Course artifacts dossier"},
    {"order": 3, "title": "Research Profile & Scholarly Publications Summary", "description": "Document peer-reviewed publications, conference proceedings, or dissertation research synopsis.", "deliverable_hint": "Scholarly publications list"},
    {"order": 4, "title": "Reflective Teaching Practice Notes & Academic CV", "description": "Write reflections on classroom challenges and format an official university-compliant academic CV.", "deliverable_hint": "Reflective notes and Academic CV"}
  ]'::jsonb,
  '[
    {"type": "report_doc", "title": "Academic Teaching Portfolio & Dossier (Complete PDF)", "description": "Comprehensive digital dossier compiling philosophy, syllabi, sample materials, and reflection.", "format_hint": "Consolidated PDF dossier link", "required": true},
    {"type": "presentation", "title": "Recorded Mock Lecture or Presentation Slides", "description": "Link to a 15-minute recorded lecture demonstration or presentation deck.", "format_hint": "Video link or PDF slides", "required": true},
    {"type": "report_doc", "title": "Academic CV & Publications List", "description": "Formatted academic curriculum vitae highlighting qualifications and research contributions.", "format_hint": "Academic CV PDF", "required": true}
  ]'::jsonb,
  '[
    "Teaching philosophy articulates concrete classroom methods rather than generic clichés",
    "Dossier contains verified lesson materials, assessment rubrics, and reflective teaching notes",
    "Academic CV follows UGC standard format documenting qualifying degrees and NET/Ph.D. status",
    "Note clearly explains that formal UGC statutory qualifications are mandatory alongside portfolio work"
  ]'::jsonb,
  '[
    {"dimension": "Academic & Pedagogical Maturity", "criteria": "Thoughtful, evidence-grounded teaching philosophy and rigorous course designs"},
    {"dimension": "Scholarly Integrity & Standards", "criteria": "Accurate publication citations and clear compliance with UGC recruitment guidelines"}
  ]'::jsonb,
  '["Teaching/Pedagogy", "Academic Writing", "Research Methodology", "Presentation Skills", "Communication"]'::jsonb,
  '{"title": "Academic Dossier Portfolio Scaffold", "description": "Standard Indian Higher Education faculty recruitment dossier structure.", "free_alternative": "Free templates formatted to UGC/Goa University standards", "url": "https://careergps.local/templates/faculty-dossier.docx"}'::jsonb,
  '["How has your teaching approach evolved when handling diverse student learning speeds?", "How do you connect your research discipline directly to undergraduate classroom examples?"]'::jsonb,
  'Capstone completed! Feature this teaching dossier prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- Marketing Specialist (3f78a101-7b19-4d62-811c-19d45e092100)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000006-0006-4000-8000-000000000001',
  '3f78a101-7b19-4d62-811c-19d45e092100',
  'Marketing Specialist',
  'Level 1 — Comprehensive Campaign Brief for a Targeted Audience',
  'marketing-starter-campaign-brief',
  1,
  'Starter',
  'marketing',
  '1 week (6-8 hours)',
  'Create an actionable campaign brief defining target customer personas, key value propositions, tone of voice, promotional channels, and measurable KPIs for a product launch.',
  'Marketing campaigns burn budget without generating leads when creative teams operate without a clear brief defining target audience pain points and success metrics.',
  '["Define a detailed buyer persona with demographics, goals, and pain points", "Establish core value propositions and brand messaging hierarchy", "Specify channel allocation and quantifiable campaign metrics (CTR, CPL, ROAS)"]'::jsonb,
  '["Basic marketing concepts and business communication"]'::jsonb,
  '[
    {"order": 1, "title": "Customer Persona Profile", "description": "Develop target persona (e.g. Goan eco-tourists or student coders) detailing motivations and media habits.", "deliverable_hint": "Persona summary sheet"},
    {"order": 2, "title": "Core Messaging & Creative Angle", "description": "Author headline hook, 3 key messaging pillars, and primary call-to-action.", "deliverable_hint": "Messaging hierarchy table"},
    {"order": 3, "title": "Channel Selection & KPI Matrix", "description": "Select 3 marketing channels and define target benchmarks (impressions, conversion rate, cost per lead).", "deliverable_hint": "Completed campaign brief PDF"}
  ]'::jsonb,
  '[
    {"type": "report_doc", "title": "Campaign Brief Document", "description": "Structured 3-page campaign brief document ready for creative execution.", "format_hint": "PDF document or Google Doc", "required": true}
  ]'::jsonb,
  '[
    "Brief clearly defines specific target persona rather than generic everyone audience",
    "Value proposition directly addresses a documented customer pain point",
    "KPIs include realistic target numerical benchmarks rather than vague goals"
  ]'::jsonb,
  '[
    {"dimension": "Audience & Market Insight", "criteria": "Demonstrates sharp understanding of customer behavior and pain points"},
    {"dimension": "Strategic Clarity", "criteria": "Clear channel rationale and concrete measurable performance indicators"}
  ]'::jsonb,
  '["Campaign Management", "Audience Segmentation", "Content Marketing", "Branding"]'::jsonb,
  '{"title": "Industry Standard Campaign Brief Template", "description": "Google Docs campaign brief template used by marketing agencies.", "free_alternative": "100% free with Google Docs", "url": "https://careergps.local/templates/campaign-brief.docx"}'::jsonb,
  '["Why did you choose these specific marketing channels for this persona?", "What single message is most likely to trigger customer action?"]'::jsonb,
  'Advance to Level 2: Develop a multi-channel campaign with creative content samples.',
  'curated',
  'verified'
),
(
  'e1000006-0006-4000-8000-000000000002',
  '3f78a101-7b19-4d62-811c-19d45e092100',
  'Marketing Specialist',
  'Level 2 — Multi-Channel Digital Campaign with Creative Assets & Channel Matrix',
  'marketing-practical-multichannel-campaign',
  2,
  'Practical',
  'marketing',
  '2-3 weeks (20 hours)',
  'Develop an integrated marketing campaign complete with sample ad copy, email nurture sequence, social media creative specifications, and an audience segmentation matrix.',
  'Inconsistent messaging across email, social, and search channels confuses potential customers and lowers conversion rates.',
  '["Author high-converting ad copy and social media creative briefs across platforms", "Write a 3-part email nurture sequence with subject line A/B test hypotheses", "Map audience segments to specific channel touchpoints throughout the buyer journey"]'::jsonb,
  '["Level 1 Campaign Brief or marketing copywriting familiarity"]'::jsonb,
  '[
    {"order": 1, "title": "Audience Segmentation & Journey Map", "description": "Segment audience into Top/Middle/Bottom of funnel cohorts with tailored touchpoints.", "deliverable_hint": "Funnel journey map"},
    {"order": 2, "title": "Social & Search Ad Copy Portfolio", "description": "Write 6 ad variations across Meta and Google Search with headlines and descriptions.", "deliverable_hint": "Ad copy spreadsheet"},
    {"order": 3, "title": "Email Nurture Sequence Design", "description": "Draft a 3-email sequence (Welcome, Value/Proof, Offer) with subject lines and preview text.", "deliverable_hint": "Email campaign drafts"},
    {"order": 4, "title": "Measurement & A/B Testing Plan", "description": "Outline 2 A/B tests with stated hypotheses, testing variables, and success metrics.", "deliverable_hint": "A/B testing protocol"}
  ]'::jsonb,
  '[
    {"type": "report_doc", "title": "Integrated Campaign Package", "description": "Document containing funnel strategy, ad copy, email sequence, and testing plan.", "format_hint": "PDF document or presentation", "required": true},
    {"type": "design_work", "title": "Creative Asset Mockups", "description": "Figma link or image exports showing ad creative layout and visual branding.", "format_hint": "Figma link or PDF visual deck", "required": true}
  ]'::jsonb,
  '[
    "Messaging maintains consistent brand voice across all ad and email touchpoints",
    "Email sequence includes clear calls-to-action and mobile-friendly formatting considerations",
    "A/B testing plans isolate single variables to yield statistically valid conclusions"
  ]'::jsonb,
  '[
    {"dimension": "Copywriting & Creative Quality", "criteria": "Persuasive, engaging copy adhering to platform character limits and best practices"},
    {"dimension": "Channel Strategy & Testing", "criteria": "Well-reasoned funnel progression and rigorous A/B testing methodology"}
  ]'::jsonb,
  '["Content Marketing", "Email Marketing", "Social Media Marketing", "Audience Segmentation"]'::jsonb,
  '{"title": "Multi-Channel Campaign Asset Scaffold", "description": "Canva / Figma ad templates and email sequence structure.", "free_alternative": "100% free with Canva Free tier and Google Docs", "url": "https://canva.com"}'::jsonb,
  '["How did your ad copy change between cold prospects and warm retargeting audiences?", "What was your rationale for the email sequence timing?"]'::jsonb,
  'Advance to Level 3: Deliver a comprehensive marketing case study with strategy, analytics design, and outcomes.',
  'curated',
  'verified'
),
(
  'e1000006-0006-4000-8000-000000000003',
  '3f78a101-7b19-4d62-811c-19d45e092100',
  'Marketing Specialist',
  'Level 3 — End-to-End Marketing Strategy & Growth Case Study',
  'marketing-career-ready-growth-case-study',
  3,
  'Career-Ready',
  'marketing',
  '3-4 weeks (30+ hours)',
  'Produce a comprehensive marketing case study analyzing market positioning, attribution modeling, budget allocation, conversion funnels, and verified lessons learned for a real or simulated business.',
  'Employers look beyond vanity impressions; they want growth marketers who understand customer acquisition cost (CAC), lifetime value (LTV), and full-funnel attribution.',
  '["Design an omni-channel growth strategy with detailed budget allocation and expected ROI", "Set up web analytics tracking architecture (GA4 event taxonomy, UTM governance)", "Document realistic campaign performance, conversion bottlenecks, and strategic lessons learned"]'::jsonb,
  '["Level 2 Multi-Channel Campaign", "Understanding of digital advertising metrics and analytics"]'::jsonb,
  '[
    {"order": 1, "title": "Market Landscape & Competitive Audit", "description": "Analyze 3 competitors, pricing models, content gaps, and unique positioning opportunities.", "deliverable_hint": "Competitive matrix"},
    {"order": 2, "title": "Full-Funnel Growth Strategy & Budget", "description": "Map budget distribution across paid, organic, referral channels with projected CAC and ROAS.", "deliverable_hint": "Budget & ROI projection model"},
    {"order": 3, "title": "Analytics Tracking & UTM Governance Framework", "description": "Design event taxonomy for GA4 (page views, button clicks, lead submissions) and naming conventions.", "deliverable_hint": "Analytics taxonomy document"},
    {"order": 4, "title": "Comprehensive Strategy Presentation & Case Study", "description": "Assemble executive presentation deck detailing campaign design, analysis, limitations, and lessons.", "deliverable_hint": "Slide deck and written case study"}
  ]'::jsonb,
  '[
    {"type": "presentation", "title": "Executive Marketing Strategy Presentation", "description": "Slide deck (PDF or SlideShare) walking through market analysis, creative assets, and numbers.", "format_hint": "Slide deck PDF link", "required": true},
    {"type": "report_doc", "title": "Complete Marketing Case Study Document", "description": "Detailed case study report covering positioning, budget models, analytics setup, and lessons.", "format_hint": "Comprehensive PDF report", "required": true}
  ]'::jsonb,
  '[
    "Strategy includes realistic budget breakdown with transparent financial assumptions",
    "Analytics measurement framework demonstrates clean event tracking without metric vanity",
    "Case study candidly identifies risks, conversion friction points, and optimization remedies",
    "Clearly distinguishes actual verified test results from projected modeling assumptions"
  ]'::jsonb,
  '[
    {"dimension": "Strategic Business Acumen", "criteria": "Sound understanding of customer acquisition unit economics (CAC, LTV, conversion rates)"},
    {"dimension": "Data-Driven Marketing", "criteria": "Rigorous tracking design, realistic attribution reasoning, and honest post-mortem analysis"}
  ]'::jsonb,
  '["Marketing Analytics", "Campaign Management", "Conversion Rate Optimization", "Web Analytics"]'::jsonb,
  '{"title": "Growth Marketing Case Study Template", "description": "Agency-grade deck format for marketing case study presentations.", "free_alternative": "Free templates for Google Slides and Sheets", "url": "https://careergps.local/templates/marketing-case-study.pptx"}'::jsonb,
  '["What was the weakest link in your conversion funnel, and how would you fix it?", "Why is relying solely on last-click attribution misleading?"]'::jsonb,
  'Capstone completed! Feature this project prominently in your CareerGPS Portfolio.',
  'curated',
  'verified'
);

-- Doctor / Medical & Healthcare Clinical Practice Alternative (1fbc7614-cf1f-460b-b167-6eda303bb61e)
INSERT INTO career_projects (
  id, career_id, career_title, title, slug, difficulty_level, difficulty_label,
  project_type, estimated_effort, brief, problem_statement, learning_objectives,
  prerequisites, tasks, deliverables, acceptance_criteria, evaluation_rubric,
  skills, starter_template, reflection_prompts, next_step, origin, verification_status
) VALUES
(
  'e1000007-0007-4000-8000-000000000001',
  '1fbc7614-cf1f-460b-b167-6eda303bb61e',
  'Doctor',
  'Level 1 — Structured Clinical Case History & Differential Diagnosis Exercise',
  'clinical-starter-case-history',
  1,
  'Starter',
  'clinical_case_study',
  '1 week (8-10 hours)',
  'Document a structured, de-identified clinical patient case history following GMC/NMC protocol, formulating chief complaints, timeline of illness, and three reasoned differential diagnoses.',
  'Incomplete clinical history taking is the leading cause of diagnostic delay and medical errors in emergency and outpatient care.',
  '["Record chronological history of presenting illness with pertinent positives and negatives", "Document relevant past medical, surgical, pharmacological, and family history", "Formulate 3 reasoned differential diagnoses supported by clinical examination findings"]'::jsonb,
  '["MBBS / clinical student status or supervised clinical practice modules", "Medical terminology and basic pathophysiology"]'::jsonb,
  '[
    {"order": 1, "title": "History of Presenting Illness Documentation", "description": "Record patient timeline, symptom characteristics (SOCRATES protocol), and aggravating/relieving factors.", "deliverable_hint": "Structured history notes"},
    {"order": 2, "title": "Systemic Review & Relevant Examination Findings", "description": "Document vital signs, general physical exam, and localized system examination (e.g. respiratory/cardiac).", "deliverable_hint": "Physical examination summary"},
    {"order": 3, "title": "Differential Diagnoses & Diagnostic Workup Plan", "description": "List primary and 2 differential diagnoses with required confirmatory lab/imaging investigations.", "deliverable_hint": "Clinical case writeup"}
  ]'::jsonb,
  '[
    {"type": "case_study", "title": "De-Identified Clinical Case Writeup", "description": "Structured medical case summary adhering strictly to patient confidentiality regulations.", "format_hint": "PDF document or medical logbook entry", "required": true}
  ]'::jsonb,
  '[
    "All patient identifying details are completely scrubbed ensuring strict confidentiality",
    "History follows standard medical clerking format with vital signs and systemic examination",
    "Differential diagnoses are substantiated by recorded physical symptoms and clinical history",
    "Note explicitly confirms that formal medical licensure and hospital rotations cannot be bypassed"
  ]'::jsonb,
  '[
    {"dimension": "Clinical Reasoning", "criteria": "Sound physiological explanation connecting presenting symptoms to differential diagnoses"},
    {"dimension": "Medical Ethics & Confidentiality", "criteria": "Zero patient identifiable data leaked; adherence to statutory medical record standards"}
  ]'::jsonb,
  '["Clinical history taking", "Medical terminology", "Clinical Assessment", "Medical ethics"]'::jsonb,
  '{"title": "Standard Medical Clerking Template", "description": "Medical student clinical history taking scaffold following NMC clinical logbook guidelines.", "free_alternative": "Free printable PDF clerking template", "url": "https://careergps.local/templates/medical-clerking.pdf"}'::jsonb,
  '["Which symptom was most valuable in ruling out your secondary differential diagnosis?", "How does structured clerking safeguard patient safety?"]'::jsonb,
  'Advance to Level 2: Conduct a hospital patient handover protocol and clinical audit.',
  'curated',
  'verified'
);

COMMIT;
