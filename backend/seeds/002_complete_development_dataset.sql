-- CareerGPS FINAL DEVELOPMENT SEED
-- Purpose: populate the complete relational database with a large, connected
-- development/demo catalogue for frontend + backend integration testing.
--
-- Public/demo content policy:
--   * Generic career/skill/pathway content is platform-authored demo content.
--   * Goa institution/course records are taken from the official DTE catalogue.
--   * Recruitment listings are taken from the Government of Goa recruitment page.
--   * Recruitment/course requirements are NOT invented; detailed eligibility stays needs_review.
--   * Official records can be displayed by the frontend because record_status is published,
--     while verification_status remains needs_review where a human review is still appropriate.
--
-- This seed is intended for DEVELOPMENT / DEMO databases, not production.

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Sources
-- ---------------------------------------------------------------------------
INSERT INTO sources (name, source_type, base_url, organization, is_approved, access_notes)
SELECT x.name,x.source_type,x.url,x.org,x.approved,x.notes
FROM (VALUES
('Government of Goa - Recruitment','official_government','https://www.goa.gov.in/citizen/recruitment/','Government of Goa',TRUE,'Official recruitment listing source.'),
('Directorate of Technical Education, Goa','official_government','https://dte.goa.gov.in/','Government of Goa - Directorate of Technical Education',TRUE,'Official diploma/institution source.'),
('DTE Technical Diploma Catalogue','official_government','https://dte.goa.gov.in/about-us/technical-diploma-courses','Government of Goa - Directorate of Technical Education',TRUE,'Official technical diploma catalogue.'),
('Goa Staff Selection Commission','official_government','https://gssc.goa.gov.in/','Goa Staff Selection Commission',TRUE,'Official commission source; use official advertisements for detailed requirements.'),
('Goa Public Service Commission','official_government','https://gpsc.goa.gov.in/','Goa Public Service Commission',TRUE,'Official commission source.'),
('Goa Online Recruitment System','official_government','https://cbes.goa.gov.in/advertisement','Government of Goa - Department of IT, Electronics & Communications',TRUE,'Official online recruitment system.'),
('CareerGPS Development Catalogue','internal_demo','https://careergps.local/catalogue','CareerGPS','FALSE','Platform-authored development/demo catalogue; not an external authority.')
) x(name,source_type,url,org,approved,notes)
WHERE NOT EXISTS (SELECT 1 FROM sources s WHERE s.name=x.name AND s.base_url=x.url);

-- ---------------------------------------------------------------------------
-- 1. Users / profiles
-- ---------------------------------------------------------------------------
INSERT INTO users (email,password_hash,role,account_status) VALUES
('admin@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','ADMIN','active'),
('reviewer@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','REVIEWER','active'),
('user@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','USER','active'),
('student2@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','USER','active'),
('student3@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','USER','active'),
('student4@careergps.local','$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy','USER','active')
ON CONFLICT (email) DO UPDATE SET role=EXCLUDED.role,account_status=EXCLUDED.account_status;

INSERT INTO user_profiles (user_id,education,experience,interests,preferred_locations,career_goal,profile_status,constraints)
SELECT u.id,x.education::jsonb,x.experience::jsonb,x.interests::jsonb,x.locations::jsonb,x.goal,'complete',x.constraints::jsonb
FROM (VALUES
('user@careergps.local','[{"qualification":"BCA","status":"in_progress","year":2027,"focus":"software development"}]','[{"role":"Accounts Department Office Assistant","type":"part_time"}]','["software development","data analytics","AI","web development"]','["Goa","Hyderabad","Bengaluru"]','Build a software development career with data and AI skills.','{"work_mode":"hybrid","entry_level":true}'),
('student2@careergps.local','[{"qualification":"BSc Computer Science","status":"completed","year":2026}]','[{"role":"Intern","type":"internship"}]','["backend","cloud","databases"]','["Goa","Pune","Bengaluru"]','Become a backend developer.','{"work_mode":"any"}'),
('student3@careergps.local','[{"qualification":"BCom","status":"completed","year":2025}]','[{"role":"Accounts Assistant","type":"full_time"}]','["analytics","finance","reporting"]','["Goa","Mumbai","Pune"]','Move into data and business analysis.','{"work_mode":"hybrid"}'),
('student4@careergps.local','[{"qualification":"BCA","status":"in_progress","year":2027}]','[]','["AI","Python","machine learning"]','["Goa","Bengaluru","Hyderabad"]','Explore AI engineering.','{"work_mode":"remote_or_hybrid"}')
) x(email,education,experience,interests,locations,goal,constraints)
JOIN users u ON u.email=x.email
ON CONFLICT (user_id) DO UPDATE SET education=EXCLUDED.education,experience=EXCLUDED.experience,interests=EXCLUDED.interests,preferred_locations=EXCLUDED.preferred_locations,career_goal=EXCLUDED.career_goal,profile_status=EXCLUDED.profile_status,constraints=EXCLUDED.constraints;

-- ---------------------------------------------------------------------------
-- 2. Skills (40+)
-- ---------------------------------------------------------------------------
INSERT INTO skills (name,description,category,record_status) VALUES
('Python','General-purpose programming language commonly used for automation, data and AI projects.','programming','published'),
('SQL','Language for querying and manipulating relational databases.','database','published'),
('JavaScript','Programming language used for web applications and Node.js services.','programming','published'),
('TypeScript','Typed superset of JavaScript for larger application codebases.','programming','published'),
('HTML','Markup language used to structure web pages.','web','published'),
('CSS','Stylesheet language used to design web interfaces.','web','published'),
('React','JavaScript library for building user interfaces.','frontend','published'),
('Node.js','JavaScript runtime used for server-side applications.','backend','published'),
('Express.js','Node.js web framework commonly used for HTTP APIs.','backend','published'),
('REST APIs','Design and integration of HTTP-based application interfaces.','backend','published'),
('PostgreSQL','Relational database system for structured application data.','database','published'),
('MongoDB','Document database used in web application development.','database','published'),
('Git','Distributed version control system.','tools','published'),
('GitHub','Platform for source control, collaboration and project hosting.','tools','published'),
('Docker','Containerisation technology for packaging applications and services.','cloud_devops','published'),
('Linux','Operating system environment widely used in servers and development.','systems','published'),
('Cloud Computing','Concepts and services for deploying software on cloud infrastructure.','cloud_devops','published'),
('AWS','Cloud platform skill covering common compute, storage and application services.','cloud_devops','published'),
('Azure','Microsoft cloud platform and service ecosystem.','cloud_devops','published'),
('CI/CD','Practices for automating software build, test and deployment pipelines.','devops','published'),
('Data Structures','Core structures for organizing and processing data in programs.','computer_science','published'),
('Algorithms','Methods for solving computational problems efficiently.','computer_science','published'),
('OOP','Object-oriented programming concepts and design.','programming','published'),
('DBMS','Database management concepts including schema, queries and transactions.','database','published'),
('Computer Networks','Fundamentals of networking, addressing, protocols and services.','systems','published'),
('Cybersecurity','Security principles for protecting applications, systems and data.','security','published'),
('Machine Learning','Methods for learning predictive patterns from data.','AI','published'),
('Statistics','Descriptive and inferential methods for analysing data.','data','published'),
('Power BI','Business intelligence and dashboarding platform skill.','data','published'),
('Excel','Spreadsheet analysis, formulas, data cleaning and reporting.','data','published'),
('Tableau','Data visualisation and dashboarding platform skill.','data','published'),
('Data Cleaning','Preparing inconsistent or incomplete data for analysis.','data','published'),
('Data Visualisation','Communicating data through charts and dashboards.','data','published'),
('ETL','Extract, transform and load concepts for data pipelines.','data_engineering','published'),
('Data Analysis','Process of exploring data to answer business questions.','data','published'),
('Figma','Interface design and prototyping tool.','design','published'),
('UI/UX Design','Design of usable, accessible and consistent digital experiences.','design','published'),
('Agile','Iterative software development practices.','delivery','published'),
('Project Management','Planning, tracking and coordinating project delivery.','delivery','published'),
('Communication','Professional written, verbal and stakeholder communication.','soft_skill','published'),
('Problem Solving','Structured approach to analysing and resolving problems.','soft_skill','published'),
('Critical Thinking','Evaluating information and alternatives systematically.','soft_skill','published'),
('Reporting','Creating clear written and visual reports from information.','business','published'),
('Business Analysis','Understanding business needs, processes and requirements.','business','published'),
('Requirements Gathering','Collecting and documenting stakeholder requirements.','business','published'),
('Financial Analysis','Interpreting financial information for decision support.','finance','published'),
('Accounting','Core accounting concepts and transaction recording.','finance','published'),
('ERP Concepts','Understanding enterprise resource planning workflows and modules.','enterprise','published'),
('Prompt Engineering','Designing effective instructions for generative AI systems.','AI','published'),
('LLM Concepts','Foundational concepts behind large language model applications.','AI','published'),
('RAG','Retrieval-augmented generation application patterns.','AI','published'),
('Vector Search','Similarity search over vector representations.','AI','published'),
('API Testing','Testing HTTP APIs for correctness and integration behaviour.','backend','published'),
('Postman','Tool for developing and testing APIs.','tools','published')
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description,category=EXCLUDED.category,record_status='published';

-- ---------------------------------------------------------------------------
-- 3. Careers (12)
-- ---------------------------------------------------------------------------
INSERT INTO careers (title,description,responsibilities,qualifications,entry_routes,record_status,verification_status,source_id,source_url)
SELECT x.title,x.description,x.responsibilities::jsonb,x.qualifications::jsonb,x.routes::jsonb,'published','needs_review',s.id,'https://careergps.local/catalogue'
FROM (VALUES
('Backend Developer','Builds server-side applications, APIs, data access layers and integrations.','["design APIs","build backend services","work with databases","test and deploy services"]','["programming fundamentals","databases","API development"]','["degree plus projects","internship","skills-based portfolio"]'),
('Frontend Developer','Builds responsive and interactive web interfaces.','["build UI components","integrate APIs","optimise accessibility","test interfaces"]','["HTML/CSS","JavaScript","frontend framework"]','["portfolio","internship","degree or equivalent learning"]'),
('Full Stack Developer','Works across frontend, backend, databases and deployment.','["build web applications","integrate APIs","manage data","deploy applications"]','["frontend","backend","database fundamentals"]','["MERN/other stack projects","internship","portfolio"]'),
('Data Analyst','Turns structured data into reports, dashboards and actionable findings.','["clean data","query data","analyse trends","build dashboards","present findings"]','["SQL","spreadsheet analysis","visualisation","statistics"]','["portfolio","internship","degree plus skills"]'),
('Business Analyst','Connects business needs with processes, requirements and technology solutions.','["gather requirements","map processes","document use cases","support delivery"]','["communication","analysis","requirements documentation"]','["degree","domain experience","case-study portfolio"]'),
('AI Engineer','Builds and integrates machine-learning and AI capabilities into products.','["prepare data","build model pipelines","evaluate models","integrate AI services"]','["Python","ML fundamentals","data handling"]','["ML projects","internship","degree plus portfolio"]'),
('Data Scientist','Uses statistics, programming and machine learning to answer complex data questions.','["explore data","build models","evaluate experiments","communicate insights"]','["Python","statistics","ML","SQL"]','["projects","research/internship","degree"]'),
('Data Engineer','Builds reliable pipelines and systems for collecting and transforming data.','["build ETL pipelines","manage data stores","monitor jobs","support analytics"]','["SQL","ETL","databases","programming"]','["data projects","cloud practice","internship"]'),
('Cloud / DevOps Engineer','Automates deployment and operates software infrastructure.','["configure cloud services","build CI/CD","containerise apps","monitor systems"]','["Linux","cloud","Docker","CI/CD"]','["cloud projects","certification plus projects","internship"]'),
('Cybersecurity Analyst','Helps monitor, assess and improve the security of systems and applications.','["analyse alerts","review vulnerabilities","support incident response","document findings"]','["networking","security fundamentals","Linux"]','["labs","security internship","certification plus practice"]'),
('ERP Specialist','Supports enterprise software, business processes, configuration and reporting.','["understand workflows","support ERP configuration","analyse business data","document processes"]','["business processes","ERP concepts","data skills"]','["ERP training","business/IT degree","domain experience"]'),
('Finance Technology Analyst','Combines finance/process knowledge with software, data and reporting.','["analyse financial workflows","support technology systems","build reports","improve processes"]','["accounting","Excel/SQL","business analysis"]','["finance plus technology","analytics projects","internship"]')
) x(title,description,responsibilities,qualifications,routes)
CROSS JOIN (SELECT id FROM sources WHERE name='CareerGPS Development Catalogue' LIMIT 1) s
ON CONFLICT (title) DO UPDATE SET description=EXCLUDED.description,responsibilities=EXCLUDED.responsibilities,qualifications=EXCLUDED.qualifications,entry_routes=EXCLUDED.entry_routes,record_status='published',verification_status='needs_review',source_id=EXCLUDED.source_id,source_url=EXCLUDED.source_url;

-- ---------------------------------------------------------------------------
-- 4. Career-skill and qualification graph
-- ---------------------------------------------------------------------------
INSERT INTO career_skills(career_id,skill_id,importance)
SELECT c.id,s.id,x.importance
FROM (VALUES
('Backend Developer','JavaScript','required'),('Backend Developer','Node.js','required'),('Backend Developer','REST APIs','required'),('Backend Developer','SQL','important'),('Backend Developer','PostgreSQL','important'),('Backend Developer','Git','important'),('Backend Developer','Docker','useful'),('Backend Developer','API Testing','useful'),
('Frontend Developer','HTML','required'),('Frontend Developer','CSS','required'),('Frontend Developer','JavaScript','required'),('Frontend Developer','React','important'),('Frontend Developer','Git','important'),('Frontend Developer','Figma','useful'),
('Full Stack Developer','JavaScript','required'),('Full Stack Developer','React','required'),('Full Stack Developer','Node.js','required'),('Full Stack Developer','REST APIs','important'),('Full Stack Developer','PostgreSQL','important'),('Full Stack Developer','Git','important'),('Full Stack Developer','Docker','useful'),
('Data Analyst','SQL','required'),('Data Analyst','Excel','required'),('Data Analyst','Power BI','important'),('Data Analyst','Data Cleaning','important'),('Data Analyst','Data Visualisation','important'),('Data Analyst','Statistics','important'),('Data Analyst','Python','useful'),
('Business Analyst','Business Analysis','required'),('Business Analyst','Requirements Gathering','required'),('Business Analyst','Communication','required'),('Business Analyst','Reporting','important'),('Business Analyst','Critical Thinking','important'),('Business Analyst','SQL','useful'),
('AI Engineer','Python','required'),('AI Engineer','Machine Learning','required'),('AI Engineer','SQL','important'),('AI Engineer','Statistics','important'),('AI Engineer','LLM Concepts','useful'),('AI Engineer','RAG','useful'),
('Data Scientist','Python','required'),('Data Scientist','Statistics','required'),('Data Scientist','Machine Learning','required'),('Data Scientist','SQL','important'),('Data Scientist','Data Analysis','important'),
('Data Engineer','SQL','required'),('Data Engineer','Python','important'),('Data Engineer','ETL','required'),('Data Engineer','PostgreSQL','important'),('Data Engineer','Docker','useful'),('Data Engineer','Cloud Computing','useful'),
('Cloud / DevOps Engineer','Linux','required'),('Cloud / DevOps Engineer','Cloud Computing','required'),('Cloud / DevOps Engineer','Docker','important'),('Cloud / DevOps Engineer','CI/CD','required'),('Cloud / DevOps Engineer','Git','important'),('Cloud / DevOps Engineer','AWS','useful'),
('Cybersecurity Analyst','Computer Networks','required'),('Cybersecurity Analyst','Cybersecurity','required'),('Cybersecurity Analyst','Linux','important'),('Cybersecurity Analyst','SQL','useful'),('Cybersecurity Analyst','Critical Thinking','important'),
('ERP Specialist','ERP Concepts','required'),('ERP Specialist','Business Analysis','important'),('ERP Specialist','SQL','important'),('ERP Specialist','Excel','important'),('ERP Specialist','Reporting','useful'),
('Finance Technology Analyst','Accounting','required'),('Finance Technology Analyst','Financial Analysis','important'),('Finance Technology Analyst','Excel','required'),('Finance Technology Analyst','SQL','important'),('Finance Technology Analyst','Business Analysis','important')
) x(career_title,skill_name,importance)
JOIN careers c ON c.title=x.career_title JOIN skills s ON s.name=x.skill_name
ON CONFLICT (career_id,skill_id) DO UPDATE SET importance=EXCLUDED.importance;

INSERT INTO career_qualifications(career_id,qualification,requirement_type,notes,source_id,source_url,verification_status)
SELECT c.id,x.q,x.t,x.notes,s.id,'https://careergps.local/catalogue','needs_review'
FROM (VALUES
('Backend Developer','Programming and data structures fundamentals','common','Typical development foundation.'),('Backend Developer','API and database project portfolio','preferred','Useful for demonstrating practical ability.'),
('Frontend Developer','HTML, CSS and JavaScript fundamentals','common','Typical frontend foundation.'),('Full Stack Developer','Frontend and backend project experience','common','Demonstrate an end-to-end application.'),
('Data Analyst','SQL and spreadsheet analysis','common','Core analytics foundation.'),('Data Analyst','Dashboard or case-study portfolio','preferred','Demonstrates practical analysis.'),
('Business Analyst','Requirements and process documentation ability','common','Useful across analyst workflows.'),('AI Engineer','Python and machine-learning fundamentals','common','Core technical foundation.'),
('Data Scientist','Statistics and machine-learning foundations','common','Typical foundation for data science.'),('Data Engineer','SQL, programming and data pipeline fundamentals','common','Core engineering foundation.'),
('Cloud / DevOps Engineer','Linux, cloud and deployment fundamentals','common','Core infrastructure foundation.'),('Cybersecurity Analyst','Networking and security fundamentals','common','Core security foundation.'),
('ERP Specialist','Business process and ERP concepts','common','Domain knowledge is useful.'),('Finance Technology Analyst','Accounting and data analysis fundamentals','common','Combines finance and technology.'),
('Finance Technology Analyst','Excel/SQL reporting skills','preferred','Useful for analytics-heavy finance roles.')
) x(career_title,q,t,notes) JOIN careers c ON c.title=x.career_title CROSS JOIN (SELECT id FROM sources WHERE name='CareerGPS Development Catalogue' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM career_qualifications cq WHERE cq.career_id=c.id AND cq.qualification=x.q);

-- ---------------------------------------------------------------------------
-- 5. Official Goa institutions from DTE catalogue
-- ---------------------------------------------------------------------------
INSERT INTO institutions(name,description,location,website_url,record_status,verification_status,source_id,source_url)
SELECT x.name,x.description,x.location,x.website,'published','verified',s.id,'https://dte.goa.gov.in/about-us/technical-diploma-courses'
FROM (VALUES
('GOA COLLEGE OF PHARMACY','DTE-listed diploma institution in Goa.','18th June Road, Panaji, Goa','https://gcp.goa.gov.in/'),
('AGNEL INSTITUTE OF FOOD CRAFTS & CULINARY SCIENCES','DTE-listed diploma institution in Verna, Salcete.','Agnel Technical Education Complex, Agnel Ganv, Verna, Salcete, Goa','https://www.aifccs.com/'),
('GUARDIAN ANGEL INSTITUTE OF HOTEL MANAGEMENT AND CATERING TECHNOLOGY','DTE-listed diploma institution in Curchorem.','Guardian Angel Complex, Curchorem, Goa',NULL),
('AGNEL POLYTECHNIC VERNA','DTE-listed diploma engineering institution.','Agnel Technical Education Complex, Verna, Salcete, Goa','https://www.agnelpolytechnic.ac.in/'),
('GOVERNMENT POLYTECHNIC BICHOLIM','Government Polytechnic listed by DTE.','Mayem, Bicholim, Goa','https://www.gpb.nic.in/'),
('GOVERNMENT POLYTECHNIC CURCHOREM','Government Polytechnic listed by DTE.','Near Kakoda Industrial Estate, Cacora, Goa','https://www.gpc.nic.in/'),
('GOVERNMENT POLYTECHNIC PANAJI','Government Polytechnic listed by DTE.','Altino, Panaji, Goa','https://www.gpp.goa.gov.in/'),
('INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','DTE-listed diploma institution in Vasco-da-Gama.','Bogda, Vasco-da-Gama, Goa','https://www.isbt.ac.in/')
) x(name,description,location,website) CROSS JOIN (SELECT id FROM sources WHERE name='DTE Technical Diploma Catalogue' LIMIT 1) s
ON CONFLICT (name) DO UPDATE SET description=EXCLUDED.description,location=EXCLUDED.location,website_url=COALESCE(EXCLUDED.website_url, institutions.website_url),record_status='published',verification_status='verified',source_id=EXCLUDED.source_id,source_url=EXCLUDED.source_url;

-- ---------------------------------------------------------------------------
-- 6. Official DTE courses (all entries represented on current catalogue page)
-- ---------------------------------------------------------------------------
INSERT INTO courses(institution_id,title,course_type,qualification,duration_text,mode,location,subject,fees_text,description,record_status,verification_status,source_id,source_url)
SELECT i.id,x.title,'diploma','Diploma',x.duration,'offline',x.location,x.subject,NULL,'Course listed in the DTE technical diploma catalogue.','published','verified',s.id,'https://dte.goa.gov.in/about-us/technical-diploma-courses'
FROM (VALUES
('GOA COLLEGE OF PHARMACY','DIPLOMA IN PHARMACY (D.PHARM)','2 YEAR','Panaji, Goa','Pharmacy'),
('AGNEL INSTITUTE OF FOOD CRAFTS & CULINARY SCIENCES','DIPLOMA IN HOTEL MANAGEMENT','3 YEAR','Verna, Salcete, Goa','Hotel Management'),
('GUARDIAN ANGEL INSTITUTE OF HOTEL MANAGEMENT AND CATERING TECHNOLOGY','DIPLOMA IN HOTEL MANAGEMENT','3 YEAR','Curchorem, Goa','Hotel Management'),
('AGNEL POLYTECHNIC VERNA','CIVIL ENGG. (CONSTRUCTION TECH.)','4 YEAR','Verna, Goa','Civil Engineering'),
('AGNEL POLYTECHNIC VERNA','MECHANICAL ENGG.','3 YEAR','Verna, Goa','Mechanical Engineering'),
('AGNEL POLYTECHNIC VERNA','ELECTRONICS ENGG.','3 YEAR','Verna, Goa','Electronics Engineering'),
('AGNEL POLYTECHNIC VERNA','ELECTRONICS & COMMUNICATION ENGG.','3 YEAR','Verna, Goa','Electronics and Communication Engineering'),
('AGNEL POLYTECHNIC VERNA','COMPUTER ENGG.','3 YEAR','Verna, Goa','Computer Engineering'),
('AGNEL POLYTECHNIC VERNA','MEDICAL ELECTRONICS','3 YEAR','Verna, Goa','Medical Electronics'),
('AGNEL POLYTECHNIC VERNA','AUTOMOBILE ENGG.','4 YEAR','Verna, Goa','Automobile Engineering'),
('GOVERNMENT POLYTECHNIC BICHOLIM','ELECTRICAL ENGG.','3 YEAR','Bicholim, Goa','Electrical Engineering'),
('GOVERNMENT POLYTECHNIC BICHOLIM','ELECTRONICS & COMMUNICATION ENGG.','3 YEAR','Bicholim, Goa','Electronics and Communication Engineering'),
('GOVERNMENT POLYTECHNIC BICHOLIM','CIVIL ENGG.','3 YEAR','Bicholim, Goa','Civil Engineering'),
('GOVERNMENT POLYTECHNIC BICHOLIM','MECHANICAL ENGG.','3 YEAR','Bicholim, Goa','Mechanical Engineering'),
('GOVERNMENT POLYTECHNIC CURCHOREM','MECHANICAL ENGG.','3 YEAR','Curchorem, Goa','Mechanical Engineering'),
('GOVERNMENT POLYTECHNIC CURCHOREM','ELECTRICAL & ELECTRONICS ENGG.','3 YEAR','Curchorem, Goa','Electrical and Electronics Engineering'),
('GOVERNMENT POLYTECHNIC CURCHOREM','COMPUTER ENGG.','3 YEAR','Curchorem, Goa','Computer Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','CIVIL ENGG.','3 YEAR','Panaji, Goa','Civil Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','MECHANICAL ENGG.','3 YEAR','Panaji, Goa','Mechanical Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','ELECTRICAL ENGG.','3 YEAR','Panaji, Goa','Electrical Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','ELECTRONICS ENGG.','3 YEAR','Panaji, Goa','Electronics Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','COMPUTER ENGG.','3 YEAR','Panaji, Goa','Computer Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','FABRICATION TECH. & ERECTION ENGG.','4 YEAR','Panaji, Goa','Fabrication Technology'),
('GOVERNMENT POLYTECHNIC PANAJI','FOOD TECH.','3.5 YEAR','Panaji, Goa','Food Technology'),
('GOVERNMENT POLYTECHNIC PANAJI','ELECTRONICS & INSTRUMENTATION ENGG.','3 YEAR','Panaji, Goa','Electronics and Instrumentation Engineering'),
('GOVERNMENT POLYTECHNIC PANAJI','GARMENT TECH.','3 YEAR','Panaji, Goa','Garment Technology'),
('GOVERNMENT POLYTECHNIC PANAJI','ARCHITECTURAL ASSISTANTSHIP','3 YEAR','Panaji, Goa','Architectural Assistantship'),
('GOVERNMENT POLYTECHNIC PANAJI','MODERN OFFICE PRACTICES','3 YEAR','Panaji, Goa','Office Practice'),
('INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','MECHANICAL ENGG.','3 YEAR','Vasco-da-Gama, Goa','Mechanical Engineering'),
('INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','ELECTRONICS & COMMUNICATION ENGG.','3 YEAR','Vasco-da-Gama, Goa','Electronics and Communication Engineering'),
('INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','SHIPBUILDING ENGG.','4 YEAR','Vasco-da-Gama, Goa','Shipbuilding Engineering')
) x(inst,title,duration,location,subject) JOIN institutions i ON i.name=x.inst CROSS JOIN (SELECT id FROM sources WHERE name='DTE Technical Diploma Catalogue' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM courses c WHERE c.institution_id=i.id AND c.title=x.title);

-- ---------------------------------------------------------------------------
-- 7. Course eligibility rules from the 2026 DTE prospectus
-- ---------------------------------------------------------------------------
INSERT INTO course_eligibility_rules(course_id,rule_type,rule_data,source_id,source_url,verification_status)
SELECT c.id,'general_eligibility','{"statement":"For engineering/technology courses including Modern Office Management, the 2026 DTE prospectus states a minimum of 35% aggregate in SSC or equivalent; ITI candidates with SSC equivalence are also eligible. Check the current prospectus for course-specific rules."}'::jsonb,s.id,'https://dte.goa.gov.in/sites/default/files/dipprosp2026.pdf','verified'
FROM courses c CROSS JOIN (SELECT id FROM sources WHERE name='Directorate of Technical Education, Goa' LIMIT 1) s
WHERE c.course_type='diploma' AND c.subject NOT IN ('Hotel Management','Pharmacy')
AND NOT EXISTS (SELECT 1 FROM course_eligibility_rules r WHERE r.course_id=c.id AND r.rule_type='general_eligibility');
INSERT INTO course_eligibility_rules(course_id,rule_type,rule_data,source_id,source_url,verification_status)
SELECT c.id,'admission_notice','{"statement":"Consult the current DTE prospectus/admission notice before applying; course-specific eligibility and category rules may apply."}'::jsonb,s.id,'https://dte.goa.gov.in/sites/default/files/dipprosp2026.pdf','verified'
FROM courses c CROSS JOIN (SELECT id FROM sources WHERE name='Directorate of Technical Education, Goa' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM course_eligibility_rules r WHERE r.course_id=c.id AND r.rule_type='admission_notice');

-- ---------------------------------------------------------------------------
-- 8. Course-career graph
-- ---------------------------------------------------------------------------
INSERT INTO course_careers(course_id,career_id,relation_type)
SELECT c.id,ca.id,x.rel
FROM (VALUES
('COMPUTER ENGG.','Backend Developer','recommended'),('COMPUTER ENGG.','Frontend Developer','related'),('COMPUTER ENGG.','Full Stack Developer','recommended'),('COMPUTER ENGG.','Data Analyst','related'),('COMPUTER ENGG.','AI Engineer','related'),('COMPUTER ENGG.','Data Engineer','related'),
('ELECTRONICS & COMMUNICATION ENGG.','Backend Developer','related'),('ELECTRONICS & COMMUNICATION ENGG.','Cybersecurity Analyst','related'),
('ELECTRICAL ENGG.','Cloud / DevOps Engineer','related'),('ELECTRICAL ENGG.','ERP Specialist','related'),
('ELECTRICAL & ELECTRONICS ENGG.','Cloud / DevOps Engineer','related'),('MECHANICAL ENGG.','Data Analyst','related'),
('MODERN OFFICE PRACTICES','Business Analyst','recommended'),('MODERN OFFICE PRACTICES','ERP Specialist','recommended'),('MODERN OFFICE PRACTICES','Finance Technology Analyst','related'),
('DIPLOMA IN PHARMACY (D.PHARM)','Business Analyst','related'),('DIPLOMA IN HOTEL MANAGEMENT','Business Analyst','related'),
('CIVIL ENGG.','Business Analyst','related'),('CIVIL ENGG. (CONSTRUCTION TECH.)','Business Analyst','related'),
('SHIPBUILDING ENGG.','Data Analyst','related'),('AUTOMOBILE ENGG.','Data Analyst','related'),('ELECTRONICS ENGG.','Backend Developer','related')
) x(course_title,career_title,rel)
JOIN courses c ON c.title=x.course_title JOIN careers ca ON ca.title=x.career_title
ON CONFLICT (course_id,career_id) DO UPDATE SET relation_type=EXCLUDED.relation_type;

-- ---------------------------------------------------------------------------
-- 9. Pathways: 12 published + verified development templates, 6 steps each
-- ---------------------------------------------------------------------------
INSERT INTO pathways(career_id,title,description,pathway_type,record_status,verification_status,source_id,source_url)
SELECT c.id,x.title,x.description,'template','published','verified',s.id,'https://careergps.local/catalogue'
FROM (VALUES
('Backend Developer','Backend Developer — Foundation to Job','Programming → APIs → databases → testing → deployment.'),
('Frontend Developer','Frontend Developer — Foundation to Job','HTML/CSS → JavaScript → React → accessibility → portfolio.'),
('Full Stack Developer','Full Stack Developer — End-to-End Web','Frontend → backend → database → authentication → deployment.'),
('Data Analyst','Data Analyst — Excel to Portfolio','Excel → SQL → cleaning → visualisation → dashboard → case study.'),
('Business Analyst','Business Analyst — Requirements to Delivery','Stakeholders → requirements → process maps → documentation → case study.'),
('AI Engineer','AI Engineer — Python to AI Applications','Python → data → ML → evaluation → AI integration → portfolio.'),
('Data Scientist','Data Scientist — Statistics to ML','Python → statistics → SQL → ML → experiments → portfolio.'),
('Data Engineer','Data Engineer — SQL to Pipelines','SQL → Python → ETL → data modelling → orchestration → cloud.'),
('Cloud / DevOps Engineer','Cloud/DevOps — Linux to Deployment','Linux → networking → containers → cloud → CI/CD → monitoring.'),
('Cybersecurity Analyst','Cybersecurity Analyst — Foundations to SOC','Networks → Linux → security → logs → incident response → portfolio.'),
('ERP Specialist','ERP Specialist — Business Process to Systems','Business process → data → ERP concepts → reporting → implementation support.'),
('Finance Technology Analyst','Finance Technology — Finance to Data','Accounting → Excel → SQL → reporting → automation → case study.')
) x(career_title,title,description) JOIN careers c ON c.title=x.career_title CROSS JOIN (SELECT id FROM sources WHERE name='CareerGPS Development Catalogue' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM pathways p WHERE p.career_id=c.id AND p.title=x.title);

WITH pathway_data AS (
SELECT p.id,p.title,c.title career_title FROM pathways p JOIN careers c ON c.id=p.career_id
), steps AS (
SELECT * FROM (VALUES
('Backend Developer',1,'Programming foundations','Review JavaScript, OOP and problem solving.','skill','{"skills":["JavaScript","OOP","Problem Solving"]}'),
('Backend Developer',2,'Build REST APIs','Create an Express API with validation and error handling.','project','{"skills":["Node.js","Express.js","REST APIs"]}'),
('Backend Developer',3,'Master databases','Practise SQL, schema design, joins and indexes.','skill','{"skills":["SQL","PostgreSQL","DBMS"]}'),
('Backend Developer',4,'Authentication and testing','Implement authentication and test API flows.','project','{"skills":["API Testing","Postman"]}'),
('Backend Developer',5,'Docker and deployment','Containerise and deploy a backend service.','project','{"skills":["Docker","Cloud Computing"]}'),
('Backend Developer',6,'Portfolio project','Document an end-to-end backend project.','portfolio','{"deliverable":"GitHub repository + API documentation"}'),
('Frontend Developer',1,'HTML and CSS','Build responsive page layouts.','skill','{"skills":["HTML","CSS"]}'),('Frontend Developer',2,'JavaScript','Learn DOM, async code and modules.','skill','{"skills":["JavaScript"]}'),('Frontend Developer',3,'React','Build reusable React components and routes.','project','{"skills":["React"]}'),('Frontend Developer',4,'UI/UX and accessibility','Improve usability and accessibility.','skill','{"skills":["UI/UX Design","Figma"]}'),('Frontend Developer',5,'API integration','Connect the frontend to backend APIs.','project','{"skills":["REST APIs"]}'),('Frontend Developer',6,'Portfolio project','Publish a responsive production-style web app.','portfolio','{"deliverable":"deployed web application"}'),
('Full Stack Developer',1,'Frontend foundations','Build the UI and routing layer.','skill','{"skills":["HTML","CSS","JavaScript"]}'),('Full Stack Developer',2,'React application','Create a multi-page React interface.','project','{"skills":["React"]}'),('Full Stack Developer',3,'Backend API','Build a REST backend.','project','{"skills":["Node.js","Express.js","REST APIs"]}'),('Full Stack Developer',4,'Database integration','Connect PostgreSQL and design relational data.','project','{"skills":["PostgreSQL","SQL"]}'),('Full Stack Developer',5,'Auth and deployment','Add auth, testing and deployment.','project','{"skills":["Git","Docker","API Testing"]}'),('Full Stack Developer',6,'Capstone','Ship an end-to-end application.','portfolio','{"deliverable":"full-stack deployed project"}'),
('Data Analyst',1,'Excel foundations','Clean and summarise data with spreadsheets.','skill','{"skills":["Excel"]}'),('Data Analyst',2,'SQL','Practise joins, grouping and analytical queries.','skill','{"skills":["SQL"]}'),('Data Analyst',3,'Data cleaning','Handle missing, duplicate and inconsistent values.','skill','{"skills":["Data Cleaning"]}'),('Data Analyst',4,'Visualisation','Create clear charts and dashboards.','project','{"skills":["Power BI","Data Visualisation"]}'),('Data Analyst',5,'Business case','Answer a realistic business question from data.','project','{"skills":["Data Analysis","Reporting"]}'),('Data Analyst',6,'Portfolio','Publish a complete analytics case study.','portfolio','{"deliverable":"dashboard + written case study"}'),
('Business Analyst',1,'Stakeholders','Identify stakeholders and business goals.','skill','{"skills":["Communication","Critical Thinking"]}'),('Business Analyst',2,'Requirements','Write functional and non-functional requirements.','skill','{"skills":["Requirements Gathering"]}'),('Business Analyst',3,'Process mapping','Map an as-is and to-be process.','project','{"skills":["Business Analysis"]}'),('Business Analyst',4,'Documentation','Create user stories and acceptance criteria.','project','{"skills":["Reporting"]}'),('Business Analyst',5,'Solution analysis','Compare solution options and trade-offs.','project','{"skills":["Critical Thinking"]}'),('Business Analyst',6,'Portfolio case study','Publish a structured BA case study.','portfolio','{"deliverable":"BA case study"}'),
('AI Engineer',1,'Python foundations','Build confidence with Python programming.','skill','{"skills":["Python"]}'),('AI Engineer',2,'Data preparation','Load, clean and explore datasets.','skill','{"skills":["Python","SQL","Data Cleaning"]}'),('AI Engineer',3,'ML foundations','Train and evaluate baseline models.','skill','{"skills":["Machine Learning","Statistics"]}'),('AI Engineer',4,'AI application','Integrate a model or AI service into an application.','project','{"skills":["REST APIs","LLM Concepts"]}'),('AI Engineer',5,'RAG/LLM concepts','Prototype retrieval and evaluation workflows.','project','{"skills":["RAG","Vector Search"]}'),('AI Engineer',6,'Portfolio','Document an end-to-end AI project.','portfolio','{"deliverable":"AI application + evaluation notes"}'),
('Data Scientist',1,'Python and SQL','Strengthen programming and data querying.','skill','{"skills":["Python","SQL"]}'),('Data Scientist',2,'Statistics','Study distributions, inference and experiments.','skill','{"skills":["Statistics"]}'),('Data Scientist',3,'EDA','Perform exploratory analysis and feature preparation.','project','{"skills":["Data Analysis","Data Cleaning"]}'),('Data Scientist',4,'Machine learning','Train and compare models.','project','{"skills":["Machine Learning"]}'),('Data Scientist',5,'Evaluation','Use appropriate metrics and validation.','skill','{"skills":["Statistics","Critical Thinking"]}'),('Data Scientist',6,'Portfolio','Publish a reproducible project.','portfolio','{"deliverable":"notebook + report"}'),
('Data Engineer',1,'SQL foundations','Practise relational modelling and SQL.','skill','{"skills":["SQL","PostgreSQL"]}'),('Data Engineer',2,'Python pipelines','Build data ingestion scripts.','project','{"skills":["Python"]}'),('Data Engineer',3,'ETL','Design extraction, transformation and loading jobs.','project','{"skills":["ETL"]}'),('Data Engineer',4,'Data modelling','Design analytics-friendly schemas.','skill','{"skills":["DBMS","PostgreSQL"]}'),('Data Engineer',5,'Cloud pipeline','Deploy a simple data workflow.','project','{"skills":["Cloud Computing","Docker"]}'),('Data Engineer',6,'Portfolio','Document a pipeline architecture.','portfolio','{"deliverable":"pipeline project"}'),
('Cloud / DevOps Engineer',1,'Linux','Practise shell, processes, files and services.','skill','{"skills":["Linux"]}'),('Cloud / DevOps Engineer',2,'Networking','Learn addressing, DNS, HTTP and TLS concepts.','skill','{"skills":["Computer Networks"]}'),('Cloud / DevOps Engineer',3,'Containers','Containerise a web service.','project','{"skills":["Docker"]}'),('Cloud / DevOps Engineer',4,'Cloud basics','Deploy compute and storage resources.','project','{"skills":["Cloud Computing","AWS"]}'),('Cloud / DevOps Engineer',5,'CI/CD','Automate build and deployment.','project','{"skills":["CI/CD","Git"]}'),('Cloud / DevOps Engineer',6,'Portfolio','Document infrastructure and deployment.','portfolio','{"deliverable":"deployment project"}'),
('Cybersecurity Analyst',1,'Networking','Learn IP, DNS, HTTP, TLS and common protocols.','skill','{"skills":["Computer Networks"]}'),('Cybersecurity Analyst',2,'Linux','Practise command line and permissions.','skill','{"skills":["Linux"]}'),('Cybersecurity Analyst',3,'Security fundamentals','Study common threats and controls.','skill','{"skills":["Cybersecurity"]}'),('Cybersecurity Analyst',4,'Logs and monitoring','Analyse sample logs and alerts.','project','{"skills":["Cybersecurity","Critical Thinking"]}'),('Cybersecurity Analyst',5,'Incident workflow','Practise basic incident triage and documentation.','project','{"skills":["Cybersecurity","Reporting"]}'),('Cybersecurity Analyst',6,'Portfolio','Document a security lab/case study.','portfolio','{"deliverable":"security case study"}'),
('ERP Specialist',1,'Business processes','Understand common business workflows.','skill','{"skills":["Business Analysis","ERP Concepts"]}'),('ERP Specialist',2,'Data fundamentals','Practise structured data and SQL.','skill','{"skills":["SQL","DBMS"]}'),('ERP Specialist',3,'Reporting','Build operational reports.','project','{"skills":["Excel","Reporting"]}'),('ERP Specialist',4,'ERP modules','Explore finance, inventory and sales concepts.','skill','{"skills":["ERP Concepts"]}'),('ERP Specialist',5,'Process improvement','Map and improve a workflow.','project','{"skills":["Business Analysis"]}'),('ERP Specialist',6,'Portfolio','Document an ERP-style process case.','portfolio','{"deliverable":"process + reporting case study"}'),
('Finance Technology Analyst',1,'Accounting basics','Review accounting concepts and statements.','skill','{"skills":["Accounting"]}'),('Finance Technology Analyst',2,'Excel analysis','Build finance-oriented spreadsheets.','skill','{"skills":["Excel","Financial Analysis"]}'),('Finance Technology Analyst',3,'SQL','Query transaction-style datasets.','skill','{"skills":["SQL"]}'),('Finance Technology Analyst',4,'Reporting','Build a finance dashboard.','project','{"skills":["Power BI","Reporting"]}'),('Finance Technology Analyst',5,'Process automation','Identify repetitive finance workflows for automation.','project','{"skills":["Business Analysis"]}'),('Finance Technology Analyst',6,'Portfolio','Publish a finance-tech case study.','portfolio','{"deliverable":"dashboard + process case"}')
) s(career_title,ord,title,description,step_type,metadata))
INSERT INTO pathway_steps(pathway_id,step_order,title,description,step_type,metadata)
SELECT p.id,s.ord,s.title,s.description,s.step_type,s.metadata::jsonb
FROM steps s JOIN pathway_data p ON p.career_title=s.career_title
ON CONFLICT (pathway_id,step_order) DO UPDATE SET title=EXCLUDED.title,description=EXCLUDED.description,step_type=EXCLUDED.step_type,metadata=EXCLUDED.metadata;

-- ---------------------------------------------------------------------------
-- 10. Official Government of Goa recruitment listings visible on current page
-- ---------------------------------------------------------------------------
INSERT INTO opportunities(title,organization,opportunity_type,location,advertisement_number,application_opening,application_deadline,vacancies_total,description,status,record_status,verification_status,source_id,source_url)
SELECT x.title,x.org,'government_recruitment','Goa',x.ad,x.opening::timestamptz,x.deadline::timestamptz,NULL,x.description,CASE WHEN x.deadline IS NOT NULL AND x.deadline::date < CURRENT_DATE THEN 'closed' ELSE 'unknown' END,'published','verified',s.id,'https://www.goa.gov.in/citizen/recruitment/'
FROM (VALUES
('Recruitment for the Post of Company Secretary on Contract Basis','Goa State Scheduled Tribes Finance and Development Corporation Limited',NULL,'2026-09-11',NULL,'Listing shown on the Government of Goa recruitment page; exact closing details are in the notice.'),
('Walk-in Interview – Recruitment for Assistant Professor and Assistant Professor (Farm Manager)','Goa College of Agriculture',NULL,'2026-09-22','2026-10-05','Listing shown on the Government of Goa recruitment page with last date 05/10/2026.'),
('ADVERTISEMENT NO. 3 OF YEAR 2026','Goa Staff Selection Commission',NULL,'2026-09-11',NULL,'Advertisement listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview For The Following Posts','Directorate of Health Services',NULL,'2026-09-11','2026-09-24','Listing shown on the Government of Goa recruitment page; post-specific details are in the notice.'),
('ADVERTISEMENT NO. 09 YEAR 2026','Goa Public Service Commission',NULL,'2026-09-11',NULL,'Advertisement listing shown on the Government of Goa recruitment page.'),
('Advertisement for Recruitment of Accountant and Assistant on Contract Basis','Kushavati District Mineral Foundation (Trust)',NULL,'2026-09-05',NULL,'Listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview For The Postion Of Finance Controller','Goa State Biodiversity Board',NULL,'2026-08-31',NULL,'Listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview For The Following Posts','Samagra Shiksha Govt. of Goa',NULL,'2026-08-28',NULL,'Listing shown on the Government of Goa recruitment page.'),
('ADVERTISEMENT NO. 08 YEAR 2026','Goa Public Service Commission',NULL,'2026-08-14','2026-08-28','Listing shown on the Government of Goa recruitment page.'),
('GHB Recruitment: Following Posts','Goa Housing Board',NULL,'2026-08-10','2026-09-02','Listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview For The Following Posts','Directorate of Health Services',NULL,'2026-08-07',NULL,'Listing shown on the Government of Goa recruitment page.'),
('GHB Recruitment: Accountant Post','Goa Housing Board',NULL,'2026-08-04','2026-08-28','Listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview For The Following Posts','Department of AYUSH',NULL,'2026-07-30',NULL,'Listing shown on the Government of Goa recruitment page.'),
('Advertisement No. 07 Of Year 2026','Goa Public Service Commission',NULL,'2026-07-10','2026-07-24','Listing shown on the Government of Goa recruitment page.'),
('Advertisement for the Post of Multi Tasking Staff (MTS)','Goa College of Agriculture',NULL,'2026-07-08',NULL,'Listing shown on the Government of Goa recruitment page.'),
('Notice for Written Examination for the post of Driver (LMV)','Sewerage & Infrastructure Development Corporation Of Goa Ltd.',NULL,'2026-07-06','2026-07-25','Listing shown on the Government of Goa recruitment page.'),
('Advertisement – Applications invited for filling up following posts on Contract basis','Directorate of Animal Husbandry & Veterinary Services',NULL,'2026-05-29','2026-06-15','Listing shown on the Government of Goa recruitment page.'),
('Advertisement – Applications invited for filling up following posts on Regular basis','Mopa Airport Development Authority',NULL,'2026-05-19','2026-06-05','Listing shown on the Government of Goa recruitment page.'),
('Advertisement – Applications invited for below mentioned posts on contractual basis','Directorate of Planning, Statistics & Evaluation',NULL,'2026-05-11','2026-05-25','Listing shown on the Government of Goa recruitment page.'),
('Walk-In-Interview – Applications invited for Post of Data Entry Operator & Multi Tasking Staff','Directorate of Food & Drugs Administration',NULL,'2026-02-24',NULL,'Listing shown on the Government of Goa recruitment page.')
) x(title,org,ad,opening,deadline,description) CROSS JOIN (SELECT id FROM sources WHERE name='Government of Goa - Recruitment' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM opportunities o WHERE o.title=x.title AND o.organization=x.org);

-- Career ↔ opportunity links (role relevance, not an eligibility claim)
INSERT INTO career_opportunities(career_id,opportunity_id,relation_type)
SELECT c.id,o.id,x.rel
FROM (VALUES
('Finance Technology Analyst','Advertisement for Recruitment of Accountant and Assistant on Contract Basis','related'),
('Finance Technology Analyst','GHB Recruitment: Accountant Post','related'),
('Business Analyst','Advertisement – Applications invited for below mentioned posts on contractual basis','related'),
('Data Analyst','Advertisement – Applications invited for below mentioned posts on contractual basis','related'),
('Backend Developer','ADVERTISEMENT NO. 3 OF YEAR 2026','alternative'),
('Business Analyst','ADVERTISEMENT NO. 3 OF YEAR 2026','alternative'),
('ERP Specialist','ADVERTISEMENT NO. 3 OF YEAR 2026','alternative'),
('Data Analyst','ADVERTISEMENT NO. 09 YEAR 2026','alternative'),
('Finance Technology Analyst','Walk-In-Interview For The Postion Of Finance Controller','related'),
('Business Analyst','GHB Recruitment: Following Posts','alternative'),
('Backend Developer','Advertisement for the Post of Multi Tasking Staff (MTS)','alternative'),
('Data Analyst','Walk-In-Interview – Applications invited for Post of Data Entry Operator & Multi Tasking Staff','related')
) x(career_title,opp_title,rel) JOIN careers c ON c.title=x.career_title JOIN opportunities o ON o.title=x.opp_title AND o.organization IS NOT NULL
ON CONFLICT (career_id,opportunity_id) DO UPDATE SET relation_type=EXCLUDED.relation_type;

-- ---------------------------------------------------------------------------
-- 11. Opportunity requirements: safe, reviewable placeholders
-- ---------------------------------------------------------------------------
INSERT INTO opportunity_requirements(opportunity_id,requirement_type,requirement_text,rule_data,verification_status,source_id,source_url)
SELECT o.id,x.type,x.text,x.rule::jsonb,'needs_review',s.id,'https://www.goa.gov.in/citizen/recruitment/'
FROM opportunities o CROSS JOIN (SELECT id FROM sources WHERE name='Government of Goa - Recruitment' LIMIT 1) s
CROSS JOIN (VALUES
('notice','Consult the official advertisement for post-specific educational qualification.','{"requires_official_notice":true}'),
('age','Consult the official advertisement for age and category conditions.','{"requires_official_notice":true}'),
('documents','Consult the official advertisement for application documents.','{"requires_official_notice":true}')
) x(type,text,rule)
WHERE NOT EXISTS (SELECT 1 FROM opportunity_requirements r WHERE r.opportunity_id=o.id AND r.requirement_type=x.type);

-- ---------------------------------------------------------------------------
-- 12. Source documents / evidence
-- ---------------------------------------------------------------------------
INSERT INTO source_documents(source_id,url,document_title,content_hash,fetched_at,raw_text,extraction_version)
SELECT s.id,x.url,x.title,md5(x.url),NOW(),x.raw_text,'final-seed-v1'
FROM (VALUES
('Government of Goa - Recruitment','https://www.goa.gov.in/citizen/recruitment/','Government of Goa Recruitment Listing','Current recruitment listing page used for title/date metadata.'),
('DTE Technical Diploma Catalogue','https://dte.goa.gov.in/about-us/technical-diploma-courses','DTE Technical Diploma Courses','Official catalogue of diploma institutions and courses.'),
('Directorate of Technical Education, Goa','https://dte.goa.gov.in/sites/default/files/dipprosp2026.pdf','DTE Professional Diploma Prospectus 2026','Official 2026 diploma prospectus used for general eligibility statements.'),
('Goa Staff Selection Commission','https://gssc.goa.gov.in/','Goa Staff Selection Commission','Official commission website registered for future ingestion.'),
('Goa Public Service Commission','https://gpsc.goa.gov.in/','Goa Public Service Commission','Official commission website registered for future ingestion.'),
('Goa Online Recruitment System','https://cbes.goa.gov.in/advertisement','Goa Online Recruitment System','Official online recruitment system registered for future ingestion.'),
('CareerGPS Development Catalogue','https://careergps.local/catalogue','CareerGPS Development Catalogue','Platform-authored demo catalogue.')
) x(source_name,url,title,raw_text) JOIN sources s ON s.name=x.source_name
WHERE NOT EXISTS (SELECT 1 FROM source_documents d WHERE d.source_id=s.id AND d.url=x.url);

INSERT INTO source_evidence(source_document_id,entity_type,entity_id,field_name,evidence_text,reference_locator,extraction_version,review_status)
SELECT d.id,x.entity_type,i.id,x.field,x.evidence,x.locator,'final-seed-v1',x.review_status
FROM (VALUES
('DTE Technical Diploma Courses','institution','GOA COLLEGE OF PHARMACY','name','GOA COLLEGE OF PHARMACY','DTE catalogue','approved'),
('DTE Technical Diploma Courses','institution','AGNEL POLYTECHNIC VERNA','name','AGNEL POLYTECHNIC VERNA','DTE catalogue','approved'),
('DTE Technical Diploma Courses','institution','GOVERNMENT POLYTECHNIC BICHOLIM','name','GOVERNMENT POLYTECHNIC BICHOLIM','DTE catalogue','approved'),
('DTE Technical Diploma Courses','institution','GOVERNMENT POLYTECHNIC CURCHOREM','name','GOVERNMENT POLYTECHNIC CURCHOREM','DTE catalogue','approved'),
('DTE Technical Diploma Courses','institution','GOVERNMENT POLYTECHNIC PANAJI','name','GOVERNMENT POLYTECHNIC PANAJI','DTE catalogue','approved'),
('DTE Technical Diploma Courses','institution','INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','name','INSTITUTE OF SHIPBUILDING TECHNOLOGY GOA','DTE catalogue','approved')
) x(doc_name,entity_type,name,field,evidence,locator,review_status)
JOIN source_documents d ON d.document_title=x.doc_name JOIN institutions i ON i.name=x.name;

-- Recruitment evidence for every opportunity title
INSERT INTO source_evidence(source_document_id,entity_type,entity_id,field_name,evidence_text,reference_locator,extraction_version,review_status)
SELECT d.id,'opportunity',o.id,'title',o.title,'Government of Goa recruitment listing','final-seed-v1','approved'
FROM source_documents d JOIN sources s ON s.id=d.source_id AND s.name='Government of Goa - Recruitment' CROSS JOIN opportunities o
WHERE d.url='https://www.goa.gov.in/citizen/recruitment/'
AND NOT EXISTS (SELECT 1 FROM source_evidence e WHERE e.source_document_id=d.id AND e.entity_id=o.id AND e.field_name='title');

-- ---------------------------------------------------------------------------
-- 13. Ingestion runs + candidates
-- ---------------------------------------------------------------------------
INSERT INTO ingestion_runs(source_id,status,started_at,completed_at,discovered_count,extracted_count,accepted_count,rejected_count,error_message)
SELECT s.id,'completed',NOW()-x.age,NOW()-x.age+INTERVAL '2 minutes',x.discovered,x.extracted,x.accepted,0,NULL
FROM (VALUES
('Government of Goa - Recruitment',INTERVAL '1 day',20,20,20),
('DTE Technical Diploma Catalogue',INTERVAL '2 days',31,31,31),
('Directorate of Technical Education, Goa',INTERVAL '3 days',1,1,1),
('Goa Staff Selection Commission',INTERVAL '4 days',3,3,0),
('Goa Public Service Commission',INTERVAL '5 days',3,3,0)
) x(source_name,age,discovered,extracted,accepted) JOIN sources s ON s.name=x.source_name
WHERE NOT EXISTS (SELECT 1 FROM ingestion_runs r WHERE r.source_id=s.id AND r.started_at > NOW()-INTERVAL '10 days');

INSERT INTO ingestion_candidates(run_id,entity_type,candidate_data,source_document_id,extraction_version,extraction_status,review_status,review_notes)
SELECT r.id,'opportunity',jsonb_build_object('title',o.title,'organization',o.organization,'source_url',o.source_url),d.id,'final-seed-v1','approved','approved','Development candidate seeded from official listing metadata.'
FROM ingestion_runs r JOIN sources s ON s.id=r.source_id AND s.name='Government of Goa - Recruitment' JOIN source_documents d ON d.source_id=s.id AND d.url='https://www.goa.gov.in/citizen/recruitment/' CROSS JOIN opportunities o
WHERE NOT EXISTS (SELECT 1 FROM ingestion_candidates ic WHERE ic.run_id=r.id AND ic.entity_type='opportunity' AND ic.candidate_data->>'title'=o.title);

INSERT INTO ingestion_candidates(run_id,entity_type,candidate_data,source_document_id,extraction_version,extraction_status,review_status,review_notes)
SELECT r.id,'course',jsonb_build_object('title',c.title,'institution',i.name,'source_url',c.source_url),d.id,'final-seed-v1','approved','approved','Development candidate seeded from official DTE catalogue metadata.'
FROM ingestion_runs r JOIN sources s ON s.id=r.source_id AND s.name='DTE Technical Diploma Catalogue' JOIN source_documents d ON d.source_id=s.id JOIN courses c ON c.source_id=s.id JOIN institutions i ON i.id=c.institution_id
WHERE NOT EXISTS (SELECT 1 FROM ingestion_candidates ic WHERE ic.run_id=r.id AND ic.entity_type='course' AND ic.candidate_data->>'title'=c.title AND ic.candidate_data->>'institution'=i.name);

-- ---------------------------------------------------------------------------
-- 14. User skills
-- ---------------------------------------------------------------------------
INSERT INTO user_skills(user_id,skill_id,level,years_experience,verified)
SELECT u.id,s.id,x.level,x.years,FALSE
FROM (VALUES
('user@careergps.local','JavaScript','intermediate',1.0),('user@careergps.local','SQL','intermediate',1.0),('user@careergps.local','Python','beginner',0.5),('user@careergps.local','Excel','intermediate',1.5),('user@careergps.local','React','intermediate',1.0),('user@careergps.local','Node.js','intermediate',1.0),('user@careergps.local','PostgreSQL','beginner',0.5),('user@careergps.local','Git','intermediate',1.0),('user@careergps.local','REST APIs','intermediate',1.0),
('student2@careergps.local','JavaScript','advanced',2.0),('student2@careergps.local','Node.js','intermediate',1.0),('student2@careergps.local','SQL','intermediate',1.0),('student2@careergps.local','Git','intermediate',2.0),('student2@careergps.local','Docker','beginner',0.5),
('student3@careergps.local','Excel','advanced',3.0),('student3@careergps.local','Accounting','advanced',3.0),('student3@careergps.local','Reporting','advanced',2.0),('student3@careergps.local','SQL','beginner',0.5),('student3@careergps.local','Power BI','beginner',0.5),
('student4@careergps.local','Python','intermediate',1.0),('student4@careergps.local','Machine Learning','beginner',0.5),('student4@careergps.local','SQL','beginner',0.5),('student4@careergps.local','Git','intermediate',1.0),('student4@careergps.local','RAG','beginner',0.2)
) x(email,skill_name,level,years) JOIN users u ON u.email=x.email JOIN skills s ON s.name=x.skill_name
ON CONFLICT (user_id,skill_id) DO UPDATE SET level=EXCLUDED.level,years_experience=EXCLUDED.years_experience;

-- ---------------------------------------------------------------------------
-- 15. User pathways + progress
-- ---------------------------------------------------------------------------
INSERT INTO user_pathways(user_id,pathway_id,title,status,generated_context)
SELECT u.id,p.id,'My '||c.title||' pathway','active',jsonb_build_object('generated',TRUE,'demo',TRUE,'career',c.title)
FROM (VALUES
('user@careergps.local','Backend Developer'),('student2@careergps.local','Full Stack Developer'),('student3@careergps.local','Data Analyst'),('student4@careergps.local','AI Engineer')
) x(email,career_title) JOIN users u ON u.email=x.email JOIN careers c ON c.title=x.career_title JOIN pathways p ON p.career_id=c.id
WHERE NOT EXISTS (SELECT 1 FROM user_pathways up WHERE up.user_id=u.id AND up.pathway_id=p.id);

INSERT INTO user_pathway_steps(user_pathway_id,pathway_step_id,status,started_at,completed_at,notes)
SELECT up.id,ps.id,CASE WHEN ps.step_order<=2 THEN 'completed' WHEN ps.step_order=3 THEN 'in_progress' ELSE 'not_started' END,
CASE WHEN ps.step_order<=3 THEN NOW()-((ps.step_order*7)||' days')::interval ELSE NULL END,
CASE WHEN ps.step_order<=2 THEN NOW()-((ps.step_order*3)||' days')::interval ELSE NULL END,
CASE WHEN ps.step_order=1 THEN 'Completed in demo profile.' WHEN ps.step_order=2 THEN 'Practised with a sample project.' WHEN ps.step_order=3 THEN 'Currently working on this step.' ELSE NULL END
FROM user_pathways up JOIN pathway_steps ps ON ps.pathway_id=up.pathway_id
ON CONFLICT (user_pathway_id,pathway_step_id) DO UPDATE SET status=EXCLUDED.status,started_at=EXCLUDED.started_at,completed_at=EXCLUDED.completed_at,notes=EXCLUDED.notes;

-- ---------------------------------------------------------------------------
-- 16. Recommendations + feedback
-- ---------------------------------------------------------------------------
INSERT INTO recommendations(user_id,goal,preferences,results,status)
SELECT u.id,x.goal,x.preferences::jsonb,x.results::jsonb,'completed'
FROM (VALUES
('user@careergps.local','Move into software development and data','{"location":"Goa","entry_level":true}','[{"career":"Backend Developer","match_reason":"JavaScript, APIs and database learning"},{"career":"Data Analyst","match_reason":"SQL and Excel experience"},{"career":"AI Engineer","match_reason":"Python and AI interest"}]'),
('student2@careergps.local','Become a backend developer','{"location":"Goa","work_mode":"hybrid"}','[{"career":"Backend Developer","match_reason":"JavaScript, Node.js and SQL skills"},{"career":"Full Stack Developer","match_reason":"Web development foundation"},{"career":"Cloud / DevOps Engineer","match_reason":"Git and Docker exposure"}]'),
('student3@careergps.local','Transition from finance to analytics','{"location":"Goa","industry":"finance"}','[{"career":"Data Analyst","match_reason":"Excel, reporting and SQL"},{"career":"Finance Technology Analyst","match_reason":"Accounting plus technology"},{"career":"Business Analyst","match_reason":"Business and reporting background"}]'),
('student4@careergps.local','Explore AI engineering','{"location":"Goa","entry_level":true}','[{"career":"AI Engineer","match_reason":"Python and ML interest"},{"career":"Data Scientist","match_reason":"Statistics and ML pathway"},{"career":"Data Engineer","match_reason":"SQL and data foundation"}]')
) x(email,goal,preferences,results) JOIN users u ON u.email=x.email
WHERE NOT EXISTS (SELECT 1 FROM recommendations r WHERE r.user_id=u.id AND r.goal=x.goal);

INSERT INTO recommendation_feedback(recommendation_id,user_id,rating,comment)
SELECT r.id,u.id,CASE WHEN u.email='student3@careergps.local' THEN 'not_helpful' ELSE 'helpful' END,'Demo feedback for frontend testing.'
FROM recommendations r JOIN users u ON u.id=r.user_id
WHERE NOT EXISTS (SELECT 1 FROM recommendation_feedback f WHERE f.recommendation_id=r.id);

-- ---------------------------------------------------------------------------
-- 17. Eligibility checks for the demo users
-- ---------------------------------------------------------------------------
INSERT INTO eligibility_checks(user_id,opportunity_id,outcome,results,evaluated_at)
SELECT u.id,o.id,'unable_to_determine',jsonb_build_array(jsonb_build_object('requirement','Official notice review','status','unknown','reason','Seed intentionally does not infer detailed post eligibility.')),NOW()
FROM users u CROSS JOIN LATERAL (SELECT id FROM opportunities ORDER BY created_at LIMIT 3) o
WHERE u.role='USER'
AND NOT EXISTS (SELECT 1 FROM eligibility_checks e WHERE e.user_id=u.id AND e.opportunity_id=o.id);

-- ---------------------------------------------------------------------------
-- 18. Saved items: one or more per user, respecting composite uniqueness
-- ---------------------------------------------------------------------------
INSERT INTO saved_items(user_id,item_type,item_id)
SELECT u.id,x.item_type,x.item_id
FROM (VALUES
('user@careergps.local','career',(SELECT id FROM careers WHERE title='Backend Developer')),
('student2@careergps.local','pathway',(SELECT id FROM pathways WHERE title LIKE 'Full Stack Developer%')),
('student3@careergps.local','course',(SELECT id FROM courses WHERE title='MODERN OFFICE PRACTICES' LIMIT 1)),
('student4@careergps.local','opportunity',(SELECT id FROM opportunities WHERE title='ADVERTISEMENT NO. 3 OF YEAR 2026' LIMIT 1))
) x(email,item_type,item_id) JOIN users u ON u.email=x.email WHERE x.item_id IS NOT NULL
ON CONFLICT (user_id,item_type,item_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 19. Conversations + messages
-- ---------------------------------------------------------------------------
INSERT INTO conversations(user_id,title)
SELECT u.id,x.title FROM (VALUES
('user@careergps.local','How do I become a backend developer?'),('user@careergps.local','Compare data and software careers'),
('student2@careergps.local','Backend project ideas'),('student3@careergps.local','Moving from accounts to analytics'),
('student4@careergps.local','AI learning roadmap'),('student4@careergps.local','Python and ML questions')
) x(email,title) JOIN users u ON u.email=x.email
WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.user_id=u.id AND c.title=x.title);

INSERT INTO conversation_messages(conversation_id,role,content,citations)
SELECT c.id,x.role,x.content,x.citations::jsonb
FROM conversations c CROSS JOIN LATERAL (VALUES
('user','I want a practical next step for this career path.','[]'),
('assistant','Start with the first pathway step, build a small project, and use the pathway progress tracker to record completion.','[]'),
('user','What should I add to my portfolio?','[]'),
('assistant','Add a concise problem statement, architecture or method, implementation evidence, screenshots, and a short explanation of what you learned.','[]')
) x(role,content,citations)
WHERE NOT EXISTS (SELECT 1 FROM conversation_messages m WHERE m.conversation_id=c.id);


-- ---------------------------------------------------------------------------
-- 19B. Extended conversations and messages for frontend/demo coverage
-- 50 additional conversations × 10 messages = 500 additional messages.
-- Idempotent by user + conversation title and conversation + message content.
-- ---------------------------------------------------------------------------
INSERT INTO conversations(user_id,title)
SELECT u.id,x.title
FROM (VALUES
('user@careergps.local','Career discovery — 1'),
('student2@careergps.local','Backend roadmap — 2'),
('student3@careergps.local','SQL practice — 3'),
('student4@careergps.local','JavaScript growth — 4'),
('reviewer@careergps.local','Data analyst path — 5'),
('admin@careergps.local','Power BI portfolio — 6'),
('user@careergps.local','Python learning — 7'),
('student2@careergps.local','AI engineer path — 8'),
('student3@careergps.local','Machine learning — 9'),
('student4@careergps.local','Cybersecurity transition — 10'),
('reviewer@careergps.local','Cloud basics — 11'),
('admin@careergps.local','PostgreSQL — 12'),
('user@careergps.local','API testing — 13'),
('student2@careergps.local','React frontend — 14'),
('student3@careergps.local','MERN project — 15'),
('student4@careergps.local','Internship preparation — 16'),
('reviewer@careergps.local','Resume project — 17'),
('admin@careergps.local','Interview SQL — 18'),
('user@careergps.local','Interview DSA — 19'),
('student2@careergps.local','OOP fundamentals — 20'),
('student3@careergps.local','DBMS fundamentals — 21'),
('student4@careergps.local','Agile workflow — 22'),
('reviewer@careergps.local','Goa opportunities — 23'),
('admin@careergps.local','Course discovery — 24'),
('user@careergps.local','Pathway progress — 25'),
('student2@careergps.local','Skills gap — 26'),
('student3@careergps.local','Accounts to analytics — 27'),
('student4@careergps.local','Finance technology — 28'),
('reviewer@careergps.local','ERP specialist — 29'),
('admin@careergps.local','Business analyst — 30'),
('user@careergps.local','Portfolio planning — 31'),
('student2@careergps.local','GitHub profile — 32'),
('student3@careergps.local','Deployment — 33'),
('student4@careergps.local','Authentication — 34'),
('reviewer@careergps.local','Validation — 35'),
('admin@careergps.local','Testing strategy — 36'),
('user@careergps.local','Data ingestion — 37'),
('student2@careergps.local','Source verification — 38'),
('student3@careergps.local','Opportunity tracking — 39'),
('student4@careergps.local','Career recommendations — 40'),
('reviewer@careergps.local','Recommendation feedback — 41'),
('admin@careergps.local','Conversation design — 42'),
('user@careergps.local','Student profile — 43'),
('student2@careergps.local','Career comparison — 44'),
('student3@careergps.local','Learning schedule — 45'),
('student4@careergps.local','Project documentation — 46'),
('reviewer@careergps.local','Problem solving — 47'),
('admin@careergps.local','Career mobility — 48'),
('user@careergps.local','CareerGPS demo — 49')
) x(email,title)
JOIN users u ON u.email=x.email
WHERE NOT EXISTS (
  SELECT 1 FROM conversations c WHERE c.user_id=u.id AND c.title=x.title
);

INSERT INTO conversation_messages(conversation_id,role,content,citations)
SELECT c.id,x.role,x.content,x.citations::jsonb
FROM conversations c
JOIN (
  SELECT * FROM (VALUES
('Career discovery — 1',1,'user','Which career path should I explore from my current skills?','[]'),
('Career discovery — 1',2,'assistant','Use the career catalogue to compare required skills, pathways, qualifications, and related opportunities before choosing a next step.','[]'),
('Career discovery — 1',3,'user','What should I do first?','[]'),
('Career discovery — 1',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Career discovery — 1',5,'user','How can I prove that I completed it?','[]'),
('Career discovery — 1',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Career discovery — 1',7,'user','What should I avoid?','[]'),
('Career discovery — 1',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Career discovery — 1',9,'user','What is a useful next milestone?','[]'),
('Career discovery — 1',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Backend roadmap — 2',1,'user','How can I improve my backend development roadmap?','[]'),
('Backend roadmap — 2',2,'assistant','Work through API design, authentication, PostgreSQL, testing, deployment, and one production-style project.','[]'),
('Backend roadmap — 2',3,'user','What should I do first?','[]'),
('Backend roadmap — 2',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Backend roadmap — 2',5,'user','How can I prove that I completed it?','[]'),
('Backend roadmap — 2',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Backend roadmap — 2',7,'user','What should I avoid?','[]'),
('Backend roadmap — 2',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Backend roadmap — 2',9,'user','What is a useful next milestone?','[]'),
('Backend roadmap — 2',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('SQL practice — 3',1,'user','What SQL topics should I practice?','[]'),
('SQL practice — 3',2,'assistant','Focus on joins, grouping, subqueries, CTEs, window functions, indexes, constraints, and query debugging.','[]'),
('SQL practice — 3',3,'user','What should I do first?','[]'),
('SQL practice — 3',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('SQL practice — 3',5,'user','How can I prove that I completed it?','[]'),
('SQL practice — 3',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('SQL practice — 3',7,'user','What should I avoid?','[]'),
('SQL practice — 3',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('SQL practice — 3',9,'user','What is a useful next milestone?','[]'),
('SQL practice — 3',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('JavaScript growth — 4',1,'user','What JavaScript skills matter for full stack work?','[]'),
('JavaScript growth — 4',2,'assistant','Build confidence with asynchronous code, modules, error handling, HTTP APIs, DOM fundamentals, and modern JavaScript patterns.','[]'),
('JavaScript growth — 4',3,'user','What should I do first?','[]'),
('JavaScript growth — 4',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('JavaScript growth — 4',5,'user','How can I prove that I completed it?','[]'),
('JavaScript growth — 4',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('JavaScript growth — 4',7,'user','What should I avoid?','[]'),
('JavaScript growth — 4',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('JavaScript growth — 4',9,'user','What is a useful next milestone?','[]'),
('JavaScript growth — 4',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Data analyst path — 5',1,'user','How can I move toward a data analyst role?','[]'),
('Data analyst path — 5',2,'assistant','Build SQL and spreadsheet skills, add a BI tool, practice data cleaning, and publish a few explainable portfolio projects.','[]'),
('Data analyst path — 5',3,'user','What should I do first?','[]'),
('Data analyst path — 5',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Data analyst path — 5',5,'user','How can I prove that I completed it?','[]'),
('Data analyst path — 5',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Data analyst path — 5',7,'user','What should I avoid?','[]'),
('Data analyst path — 5',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Data analyst path — 5',9,'user','What is a useful next milestone?','[]'),
('Data analyst path — 5',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Power BI portfolio — 6',1,'user','What should a Power BI project contain?','[]'),
('Power BI portfolio — 6',2,'assistant','Include a clear business question, cleaned data, a small model, useful measures, dashboard decisions, and a short interpretation.','[]'),
('Power BI portfolio — 6',3,'user','What should I do first?','[]'),
('Power BI portfolio — 6',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Power BI portfolio — 6',5,'user','How can I prove that I completed it?','[]'),
('Power BI portfolio — 6',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Power BI portfolio — 6',7,'user','What should I avoid?','[]'),
('Power BI portfolio — 6',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Power BI portfolio — 6',9,'user','What is a useful next milestone?','[]'),
('Power BI portfolio — 6',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Python learning — 7',1,'user','What Python topics should I learn first?','[]'),
('Python learning — 7',2,'assistant','Start with functions, collections, modules, file handling, exceptions, testing basics, and then move into data or backend libraries.','[]'),
('Python learning — 7',3,'user','What should I do first?','[]'),
('Python learning — 7',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Python learning — 7',5,'user','How can I prove that I completed it?','[]'),
('Python learning — 7',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Python learning — 7',7,'user','What should I avoid?','[]'),
('Python learning — 7',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Python learning — 7',9,'user','What is a useful next milestone?','[]'),
('Python learning — 7',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('AI engineer path — 8',1,'user','What should I learn for AI engineering?','[]'),
('AI engineer path — 8',2,'assistant','Build Python and software fundamentals, then learn data handling, ML concepts, model evaluation, APIs, retrieval, and deployment.','[]'),
('AI engineer path — 8',3,'user','What should I do first?','[]'),
('AI engineer path — 8',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('AI engineer path — 8',5,'user','How can I prove that I completed it?','[]'),
('AI engineer path — 8',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('AI engineer path — 8',7,'user','What should I avoid?','[]'),
('AI engineer path — 8',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('AI engineer path — 8',9,'user','What is a useful next milestone?','[]'),
('AI engineer path — 8',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Machine learning — 9',1,'user','How should I structure an ML learning plan?','[]'),
('Machine learning — 9',2,'assistant','Learn preprocessing, train/validation/test splits, common supervised models, metrics, feature engineering, and reproducible experiments.','[]'),
('Machine learning — 9',3,'user','What should I do first?','[]'),
('Machine learning — 9',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Machine learning — 9',5,'user','How can I prove that I completed it?','[]'),
('Machine learning — 9',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Machine learning — 9',7,'user','What should I avoid?','[]'),
('Machine learning — 9',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Machine learning — 9',9,'user','What is a useful next milestone?','[]'),
('Machine learning — 9',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Cybersecurity transition — 10',1,'user','Can I combine development with cybersecurity?','[]'),
('Cybersecurity transition — 10',2,'assistant','Yes for a development portfolio, focus on secure authentication, authorization, validation, secrets, logging, and common web vulnerabilities.','[]'),
('Cybersecurity transition — 10',3,'user','What should I do first?','[]'),
('Cybersecurity transition — 10',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Cybersecurity transition — 10',5,'user','How can I prove that I completed it?','[]'),
('Cybersecurity transition — 10',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Cybersecurity transition — 10',7,'user','What should I avoid?','[]'),
('Cybersecurity transition — 10',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Cybersecurity transition — 10',9,'user','What is a useful next milestone?','[]'),
('Cybersecurity transition — 10',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Cloud basics — 11',1,'user','What cloud skills should I learn?','[]'),
('Cloud basics — 11',2,'assistant','Learn deployment fundamentals, environment variables, databases, networking basics, logs, monitoring, and cost-aware architecture.','[]'),
('Cloud basics — 11',3,'user','What should I do first?','[]'),
('Cloud basics — 11',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Cloud basics — 11',5,'user','How can I prove that I completed it?','[]'),
('Cloud basics — 11',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Cloud basics — 11',7,'user','What should I avoid?','[]'),
('Cloud basics — 11',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Cloud basics — 11',9,'user','What is a useful next milestone?','[]'),
('Cloud basics — 11',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('PostgreSQL — 12',1,'user','How do I become stronger with PostgreSQL?','[]'),
('PostgreSQL — 12',2,'assistant','Practice schema design, foreign keys, indexes, transactions, constraints, query plans, and migrations.','[]'),
('PostgreSQL — 12',3,'user','What should I do first?','[]'),
('PostgreSQL — 12',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('PostgreSQL — 12',5,'user','How can I prove that I completed it?','[]'),
('PostgreSQL — 12',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('PostgreSQL — 12',7,'user','What should I avoid?','[]'),
('PostgreSQL — 12',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('PostgreSQL — 12',9,'user','What is a useful next milestone?','[]'),
('PostgreSQL — 12',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('API testing — 13',1,'user','How should I test my REST API?','[]'),
('API testing — 13',2,'assistant','Cover happy paths, validation errors, authentication failures, authorization, pagination, edge cases, and integration tests.','[]'),
('API testing — 13',3,'user','What should I do first?','[]'),
('API testing — 13',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('API testing — 13',5,'user','How can I prove that I completed it?','[]'),
('API testing — 13',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('API testing — 13',7,'user','What should I avoid?','[]'),
('API testing — 13',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('API testing — 13',9,'user','What is a useful next milestone?','[]'),
('API testing — 13',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('React frontend — 14',1,'user','How should I prepare for a React frontend?','[]'),
('React frontend — 14',2,'assistant','Understand components, state, effects, routing, forms, API calls, loading/error states, and reusable UI patterns.','[]'),
('React frontend — 14',3,'user','What should I do first?','[]'),
('React frontend — 14',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('React frontend — 14',5,'user','How can I prove that I completed it?','[]'),
('React frontend — 14',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('React frontend — 14',7,'user','What should I avoid?','[]'),
('React frontend — 14',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('React frontend — 14',9,'user','What is a useful next milestone?','[]'),
('React frontend — 14',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('MERN project — 15',1,'user','What makes a MERN project useful in a portfolio?','[]'),
('MERN project — 15',2,'assistant','Show a real problem, clean architecture, authentication, database relationships, validation, error handling, deployment, and documentation.','[]'),
('MERN project — 15',3,'user','What should I do first?','[]'),
('MERN project — 15',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('MERN project — 15',5,'user','How can I prove that I completed it?','[]'),
('MERN project — 15',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('MERN project — 15',7,'user','What should I avoid?','[]'),
('MERN project — 15',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('MERN project — 15',9,'user','What is a useful next milestone?','[]'),
('MERN project — 15',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Internship preparation — 16',1,'user','How can I prepare for an internship?','[]'),
('Internship preparation — 16',2,'assistant','Keep one polished project, know your stack, practice explaining decisions, revise fundamentals, and prepare concise project walkthroughs.','[]'),
('Internship preparation — 16',3,'user','What should I do first?','[]'),
('Internship preparation — 16',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Internship preparation — 16',5,'user','How can I prove that I completed it?','[]'),
('Internship preparation — 16',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Internship preparation — 16',7,'user','What should I avoid?','[]'),
('Internship preparation — 16',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Internship preparation — 16',9,'user','What is a useful next milestone?','[]'),
('Internship preparation — 16',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Resume project — 17',1,'user','How should I describe my project on a resume?','[]'),
('Resume project — 17',2,'assistant','Use action-oriented bullets that state the feature, technology, and measurable or concrete outcome without exaggerating.','[]'),
('Resume project — 17',3,'user','What should I do first?','[]'),
('Resume project — 17',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Resume project — 17',5,'user','How can I prove that I completed it?','[]'),
('Resume project — 17',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Resume project — 17',7,'user','What should I avoid?','[]'),
('Resume project — 17',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Resume project — 17',9,'user','What is a useful next milestone?','[]'),
('Resume project — 17',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Interview SQL — 18',1,'user','What SQL questions should I expect in interviews?','[]'),
('Interview SQL — 18',2,'assistant','Expect joins, aggregates, normalization, keys, indexes, transactions, query writing, and debugging scenarios.','[]'),
('Interview SQL — 18',3,'user','What should I do first?','[]'),
('Interview SQL — 18',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Interview SQL — 18',5,'user','How can I prove that I completed it?','[]'),
('Interview SQL — 18',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Interview SQL — 18',7,'user','What should I avoid?','[]'),
('Interview SQL — 18',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Interview SQL — 18',9,'user','What is a useful next milestone?','[]'),
('Interview SQL — 18',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Interview DSA — 19',1,'user','How should I prepare DSA with limited time?','[]'),
('Interview DSA — 19',2,'assistant','Practice arrays, strings, hash maps, stacks, queues, linked lists, trees, sorting, searching, and common patterns consistently.','[]'),
('Interview DSA — 19',3,'user','What should I do first?','[]'),
('Interview DSA — 19',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Interview DSA — 19',5,'user','How can I prove that I completed it?','[]'),
('Interview DSA — 19',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Interview DSA — 19',7,'user','What should I avoid?','[]'),
('Interview DSA — 19',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Interview DSA — 19',9,'user','What is a useful next milestone?','[]'),
('Interview DSA — 19',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('OOP fundamentals — 20',1,'user','What OOP concepts should I know well?','[]'),
('OOP fundamentals — 20',2,'assistant','Understand classes, objects, encapsulation, inheritance, polymorphism, abstraction, composition, and when each design is useful.','[]'),
('OOP fundamentals — 20',3,'user','What should I do first?','[]'),
('OOP fundamentals — 20',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('OOP fundamentals — 20',5,'user','How can I prove that I completed it?','[]'),
('OOP fundamentals — 20',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('OOP fundamentals — 20',7,'user','What should I avoid?','[]'),
('OOP fundamentals — 20',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('OOP fundamentals — 20',9,'user','What is a useful next milestone?','[]'),
('OOP fundamentals — 20',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('DBMS fundamentals — 21',1,'user','What DBMS topics are important?','[]'),
('DBMS fundamentals — 21',2,'assistant','Revise relational models, normalization, keys, constraints, joins, transactions, isolation, indexes, and SQL.','[]'),
('DBMS fundamentals — 21',3,'user','What should I do first?','[]'),
('DBMS fundamentals — 21',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('DBMS fundamentals — 21',5,'user','How can I prove that I completed it?','[]'),
('DBMS fundamentals — 21',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('DBMS fundamentals — 21',7,'user','What should I avoid?','[]'),
('DBMS fundamentals — 21',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('DBMS fundamentals — 21',9,'user','What is a useful next milestone?','[]'),
('DBMS fundamentals — 21',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Agile workflow — 22',1,'user','How can I use Agile properly in my project?','[]'),
('Agile workflow — 22',2,'assistant','Break work into small stories, define acceptance criteria, track progress, review completed work, and keep scope controlled.','[]'),
('Agile workflow — 22',3,'user','What should I do first?','[]'),
('Agile workflow — 22',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Agile workflow — 22',5,'user','How can I prove that I completed it?','[]'),
('Agile workflow — 22',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Agile workflow — 22',7,'user','What should I avoid?','[]'),
('Agile workflow — 22',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Agile workflow — 22',9,'user','What is a useful next milestone?','[]'),
('Agile workflow — 22',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Goa opportunities — 23',1,'user','How can I use CareerGPS to find opportunities in Goa?','[]'),
('Goa opportunities — 23',2,'assistant','Use the opportunity feed, filter by location/type/career, open details, and save relevant entries for later review.','[]'),
('Goa opportunities — 23',3,'user','What should I do first?','[]'),
('Goa opportunities — 23',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Goa opportunities — 23',5,'user','How can I prove that I completed it?','[]'),
('Goa opportunities — 23',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Goa opportunities — 23',7,'user','What should I avoid?','[]'),
('Goa opportunities — 23',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Goa opportunities — 23',9,'user','What is a useful next milestone?','[]'),
('Goa opportunities — 23',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Course discovery — 24',1,'user','How do I compare courses?','[]'),
('Course discovery — 24',2,'assistant','Compare institution, course title, eligibility information, career relationships, and the source status before relying on details.','[]'),
('Course discovery — 24',3,'user','What should I do first?','[]'),
('Course discovery — 24',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Course discovery — 24',5,'user','How can I prove that I completed it?','[]'),
('Course discovery — 24',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Course discovery — 24',7,'user','What should I avoid?','[]'),
('Course discovery — 24',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Course discovery — 24',9,'user','What is a useful next milestone?','[]'),
('Course discovery — 24',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Pathway progress — 25',1,'user','How should I use a pathway?','[]'),
('Pathway progress — 25',2,'assistant','Treat each step as an actionable milestone and update progress as you complete learning, projects, applications, or other required work.','[]'),
('Pathway progress — 25',3,'user','What should I do first?','[]'),
('Pathway progress — 25',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Pathway progress — 25',5,'user','How can I prove that I completed it?','[]'),
('Pathway progress — 25',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Pathway progress — 25',7,'user','What should I avoid?','[]'),
('Pathway progress — 25',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Pathway progress — 25',9,'user','What is a useful next milestone?','[]'),
('Pathway progress — 25',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Skills gap — 26',1,'user','How do I identify my skill gaps?','[]'),
('Skills gap — 26',2,'assistant','Compare your current skills with the skills connected to a target career and turn missing skills into pathway steps.','[]'),
('Skills gap — 26',3,'user','What should I do first?','[]'),
('Skills gap — 26',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Skills gap — 26',5,'user','How can I prove that I completed it?','[]'),
('Skills gap — 26',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Skills gap — 26',7,'user','What should I avoid?','[]'),
('Skills gap — 26',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Skills gap — 26',9,'user','What is a useful next milestone?','[]'),
('Skills gap — 26',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Accounts to analytics — 27',1,'user','How can an accounts background lead toward analytics?','[]'),
('Accounts to analytics — 27',2,'assistant','Build on accounting and business knowledge with SQL, Excel, BI, data handling, and portfolio projects.','[]'),
('Accounts to analytics — 27',3,'user','What should I do first?','[]'),
('Accounts to analytics — 27',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Accounts to analytics — 27',5,'user','How can I prove that I completed it?','[]'),
('Accounts to analytics — 27',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Accounts to analytics — 27',7,'user','What should I avoid?','[]'),
('Accounts to analytics — 27',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Accounts to analytics — 27',9,'user','What is a useful next milestone?','[]'),
('Accounts to analytics — 27',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Finance technology — 28',1,'user','What is a finance technology pathway?','[]'),
('Finance technology — 28',2,'assistant','It can combine finance or accounting knowledge with software, data, automation, and enterprise systems skills.','[]'),
('Finance technology — 28',3,'user','What should I do first?','[]'),
('Finance technology — 28',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Finance technology — 28',5,'user','How can I prove that I completed it?','[]'),
('Finance technology — 28',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Finance technology — 28',7,'user','What should I avoid?','[]'),
('Finance technology — 28',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Finance technology — 28',9,'user','What is a useful next milestone?','[]'),
('Finance technology — 28',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('ERP specialist — 29',1,'user','What skills are useful for ERP work?','[]'),
('ERP specialist — 29',2,'assistant','Learn business processes, databases, reporting, enterprise software concepts, requirements analysis, and integration basics.','[]'),
('ERP specialist — 29',3,'user','What should I do first?','[]'),
('ERP specialist — 29',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('ERP specialist — 29',5,'user','How can I prove that I completed it?','[]'),
('ERP specialist — 29',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('ERP specialist — 29',7,'user','What should I avoid?','[]'),
('ERP specialist — 29',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('ERP specialist — 29',9,'user','What is a useful next milestone?','[]'),
('ERP specialist — 29',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Business analyst — 30',1,'user','What should I learn for business analysis?','[]'),
('Business analyst — 30',2,'assistant','Practice requirements gathering, process mapping, stakeholder communication, data analysis, documentation, and solution evaluation.','[]'),
('Business analyst — 30',3,'user','What should I do first?','[]'),
('Business analyst — 30',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Business analyst — 30',5,'user','How can I prove that I completed it?','[]'),
('Business analyst — 30',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Business analyst — 30',7,'user','What should I avoid?','[]'),
('Business analyst — 30',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Business analyst — 30',9,'user','What is a useful next milestone?','[]'),
('Business analyst — 30',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Portfolio planning — 31',1,'user','How many projects should I build?','[]'),
('Portfolio planning — 31',2,'assistant','Prefer a small set of well-documented projects that demonstrate different skills over many unfinished repositories.','[]'),
('Portfolio planning — 31',3,'user','What should I do first?','[]'),
('Portfolio planning — 31',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Portfolio planning — 31',5,'user','How can I prove that I completed it?','[]'),
('Portfolio planning — 31',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Portfolio planning — 31',7,'user','What should I avoid?','[]'),
('Portfolio planning — 31',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Portfolio planning — 31',9,'user','What is a useful next milestone?','[]'),
('Portfolio planning — 31',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('GitHub profile — 32',1,'user','How should I improve my GitHub profile?','[]'),
('GitHub profile — 32',2,'assistant','Pin strong repositories, write useful READMEs, keep commits understandable, document setup, and show deployed work where possible.','[]'),
('GitHub profile — 32',3,'user','What should I do first?','[]'),
('GitHub profile — 32',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('GitHub profile — 32',5,'user','How can I prove that I completed it?','[]'),
('GitHub profile — 32',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('GitHub profile — 32',7,'user','What should I avoid?','[]'),
('GitHub profile — 32',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('GitHub profile — 32',9,'user','What is a useful next milestone?','[]'),
('GitHub profile — 32',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Deployment — 33',1,'user','What should I check before deploying?','[]'),
('Deployment — 33',2,'assistant','Check environment variables, database connectivity, migrations, CORS, authentication, logs, health endpoints, and production error handling.','[]'),
('Deployment — 33',3,'user','What should I do first?','[]'),
('Deployment — 33',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Deployment — 33',5,'user','How can I prove that I completed it?','[]'),
('Deployment — 33',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Deployment — 33',7,'user','What should I avoid?','[]'),
('Deployment — 33',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Deployment — 33',9,'user','What is a useful next milestone?','[]'),
('Deployment — 33',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Authentication — 34',1,'user','What should a secure auth flow include?','[]'),
('Authentication — 34',2,'assistant','Use password hashing, short-lived access tokens where appropriate, validation, rate limiting, secure secret management, and authorization checks.','[]'),
('Authentication — 34',3,'user','What should I do first?','[]'),
('Authentication — 34',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Authentication — 34',5,'user','How can I prove that I completed it?','[]'),
('Authentication — 34',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Authentication — 34',7,'user','What should I avoid?','[]'),
('Authentication — 34',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Authentication — 34',9,'user','What is a useful next milestone?','[]'),
('Authentication — 34',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Validation — 35',1,'user','Why is backend validation important?','[]'),
('Validation — 35',2,'assistant','It protects data integrity and gives predictable API behavior even when clients send invalid or unexpected input.','[]'),
('Validation — 35',3,'user','What should I do first?','[]'),
('Validation — 35',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Validation — 35',5,'user','How can I prove that I completed it?','[]'),
('Validation — 35',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Validation — 35',7,'user','What should I avoid?','[]'),
('Validation — 35',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Validation — 35',9,'user','What is a useful next milestone?','[]'),
('Validation — 35',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Testing strategy — 36',1,'user','What tests should I add first?','[]'),
('Testing strategy — 36',2,'assistant','Start with health and critical API flows, then validation and authorization cases, followed by broader integration coverage.','[]'),
('Testing strategy — 36',3,'user','What should I do first?','[]'),
('Testing strategy — 36',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Testing strategy — 36',5,'user','How can I prove that I completed it?','[]'),
('Testing strategy — 36',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Testing strategy — 36',7,'user','What should I avoid?','[]'),
('Testing strategy — 36',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Testing strategy — 36',9,'user','What is a useful next milestone?','[]'),
('Testing strategy — 36',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Data ingestion — 37',1,'user','How should an ingestion pipeline work?','[]'),
('Data ingestion — 37',2,'assistant','Separate source registration, retrieval, candidate creation, validation, review, approval, publication, and audit logging.','[]'),
('Data ingestion — 37',3,'user','What should I do first?','[]'),
('Data ingestion — 37',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Data ingestion — 37',5,'user','How can I prove that I completed it?','[]'),
('Data ingestion — 37',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Data ingestion — 37',7,'user','What should I avoid?','[]'),
('Data ingestion — 37',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Data ingestion — 37',9,'user','What is a useful next milestone?','[]'),
('Data ingestion — 37',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Source verification — 38',1,'user','Why should seed data have verification status?','[]'),
('Source verification — 38',2,'assistant','A development dataset can support UI testing without presenting unverified facts as authoritative published information.','[]'),
('Source verification — 38',3,'user','What should I do first?','[]'),
('Source verification — 38',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Source verification — 38',5,'user','How can I prove that I completed it?','[]'),
('Source verification — 38',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Source verification — 38',7,'user','What should I avoid?','[]'),
('Source verification — 38',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Source verification — 38',9,'user','What is a useful next milestone?','[]'),
('Source verification — 38',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Opportunity tracking — 39',1,'user','How should opportunity data be represented?','[]'),
('Opportunity tracking — 39',2,'assistant','Keep title, organization, location, status, deadline when known, requirements, source information, and record status connected.','[]'),
('Opportunity tracking — 39',3,'user','What should I do first?','[]'),
('Opportunity tracking — 39',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Opportunity tracking — 39',5,'user','How can I prove that I completed it?','[]'),
('Opportunity tracking — 39',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Opportunity tracking — 39',7,'user','What should I avoid?','[]'),
('Opportunity tracking — 39',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Opportunity tracking — 39',9,'user','What is a useful next milestone?','[]'),
('Opportunity tracking — 39',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Career recommendations — 40',1,'user','How can recommendations be explained?','[]'),
('Career recommendations — 40',2,'assistant','Show the target career, matching skills, missing skills, relevant pathway, and supporting data so the user can understand the recommendation.','[]'),
('Career recommendations — 40',3,'user','What should I do first?','[]'),
('Career recommendations — 40',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Career recommendations — 40',5,'user','How can I prove that I completed it?','[]'),
('Career recommendations — 40',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Career recommendations — 40',7,'user','What should I avoid?','[]'),
('Career recommendations — 40',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Career recommendations — 40',9,'user','What is a useful next milestone?','[]'),
('Career recommendations — 40',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Recommendation feedback — 41',1,'user','What should feedback do?','[]'),
('Recommendation feedback — 41',2,'assistant','Capture whether the recommendation was useful and the user response so the product can evaluate recommendation quality.','[]'),
('Recommendation feedback — 41',3,'user','What should I do first?','[]'),
('Recommendation feedback — 41',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Recommendation feedback — 41',5,'user','How can I prove that I completed it?','[]'),
('Recommendation feedback — 41',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Recommendation feedback — 41',7,'user','What should I avoid?','[]'),
('Recommendation feedback — 41',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Recommendation feedback — 41',9,'user','What is a useful next milestone?','[]'),
('Recommendation feedback — 41',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Conversation design — 42',1,'user','What should the career assistant remember?','[]'),
('Conversation design — 42',2,'assistant','Conversation history should preserve the user question, assistant response, relevant context, and citations when available.','[]'),
('Conversation design — 42',3,'user','What should I do first?','[]'),
('Conversation design — 42',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Conversation design — 42',5,'user','How can I prove that I completed it?','[]'),
('Conversation design — 42',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Conversation design — 42',7,'user','What should I avoid?','[]'),
('Conversation design — 42',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Conversation design — 42',9,'user','What is a useful next milestone?','[]'),
('Conversation design — 42',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Student profile — 43',1,'user','What should my CareerGPS profile contain?','[]'),
('Student profile — 43',2,'assistant','Keep education, skills, interests, target careers, and progress structured so recommendations and pathways can use them.','[]'),
('Student profile — 43',3,'user','What should I do first?','[]'),
('Student profile — 43',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Student profile — 43',5,'user','How can I prove that I completed it?','[]'),
('Student profile — 43',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Student profile — 43',7,'user','What should I avoid?','[]'),
('Student profile — 43',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Student profile — 43',9,'user','What is a useful next milestone?','[]'),
('Student profile — 43',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Career comparison — 44',1,'user','How can I compare two careers?','[]'),
('Career comparison — 44',2,'assistant','Compare skill requirements, qualifications, pathway steps, related courses, and available opportunities without relying on a single metric.','[]'),
('Career comparison — 44',3,'user','What should I do first?','[]'),
('Career comparison — 44',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Career comparison — 44',5,'user','How can I prove that I completed it?','[]'),
('Career comparison — 44',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Career comparison — 44',7,'user','What should I avoid?','[]'),
('Career comparison — 44',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Career comparison — 44',9,'user','What is a useful next milestone?','[]'),
('Career comparison — 44',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Learning schedule — 45',1,'user','How can I turn a pathway into weekly work?','[]'),
('Learning schedule — 45',2,'assistant','Convert each pathway step into small weekly tasks with a concrete output such as a coding exercise, project feature, or portfolio artifact.','[]'),
('Learning schedule — 45',3,'user','What should I do first?','[]'),
('Learning schedule — 45',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Learning schedule — 45',5,'user','How can I prove that I completed it?','[]'),
('Learning schedule — 45',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Learning schedule — 45',7,'user','What should I avoid?','[]'),
('Learning schedule — 45',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Learning schedule — 45',9,'user','What is a useful next milestone?','[]'),
('Learning schedule — 45',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Project documentation — 46',1,'user','What belongs in a project README?','[]'),
('Project documentation — 46',2,'assistant','Include purpose, features, architecture, setup, environment requirements, API or database notes, screenshots, testing, and deployment information.','[]'),
('Project documentation — 46',3,'user','What should I do first?','[]'),
('Project documentation — 46',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Project documentation — 46',5,'user','How can I prove that I completed it?','[]'),
('Project documentation — 46',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Project documentation — 46',7,'user','What should I avoid?','[]'),
('Project documentation — 46',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Project documentation — 46',9,'user','What is a useful next milestone?','[]'),
('Project documentation — 46',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Problem solving — 47',1,'user','How can I improve as a developer?','[]'),
('Problem solving — 47',2,'assistant','Solve small problems regularly, debug systematically, read error messages carefully, and build projects that require integration of multiple concepts.','[]'),
('Problem solving — 47',3,'user','What should I do first?','[]'),
('Problem solving — 47',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Problem solving — 47',5,'user','How can I prove that I completed it?','[]'),
('Problem solving — 47',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Problem solving — 47',7,'user','What should I avoid?','[]'),
('Problem solving — 47',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Problem solving — 47',9,'user','What is a useful next milestone?','[]'),
('Problem solving — 47',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('Career mobility — 48',1,'user','Can skills transfer between careers?','[]'),
('Career mobility — 48',2,'assistant','Some skills are transferable, but the exact transition depends on the target career, missing skills, qualifications, and available pathways.','[]'),
('Career mobility — 48',3,'user','What should I do first?','[]'),
('Career mobility — 48',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('Career mobility — 48',5,'user','How can I prove that I completed it?','[]'),
('Career mobility — 48',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('Career mobility — 48',7,'user','What should I avoid?','[]'),
('Career mobility — 48',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('Career mobility — 48',9,'user','What is a useful next milestone?','[]'),
('Career mobility — 48',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]'),
('CareerGPS demo — 49',1,'user','What should I demonstrate in the CareerGPS frontend?','[]'),
('CareerGPS demo — 49',2,'assistant','Show profile setup, career discovery, recommendations, pathway generation, progress tracking, opportunity search, saved items, and conversations.','[]'),
('CareerGPS demo — 49',3,'user','What should I do first?','[]'),
('CareerGPS demo — 49',4,'assistant','Start with one concrete milestone and use the CareerGPS pathway or profile tools to track it.','[]'),
('CareerGPS demo — 49',5,'user','How can I prove that I completed it?','[]'),
('CareerGPS demo — 49',6,'assistant','Keep a project link, notes, screenshots, code, certificate, or another relevant artifact that demonstrates the completed work.','[]'),
('CareerGPS demo — 49',7,'user','What should I avoid?','[]'),
('CareerGPS demo — 49',8,'assistant','Avoid claiming skills or eligibility that you have not demonstrated or verified. Keep your profile and project evidence accurate.','[]'),
('CareerGPS demo — 49',9,'user','What is a useful next milestone?','[]'),
('CareerGPS demo — 49',10,'assistant','Choose the next pathway step that closes the most relevant skill gap and produces a concrete portfolio or learning artifact.','[]')
  ) v(title,seq,role,content,citations)
) x ON x.title=c.title
WHERE NOT EXISTS (
  SELECT 1 FROM conversation_messages m
  WHERE m.conversation_id=c.id AND m.role=x.role AND m.content=x.content
);

-- ---------------------------------------------------------------------------
-- 20. Audit logs
-- ---------------------------------------------------------------------------
INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,before_data,after_data,metadata)
SELECT u.id,'SEED_DATASET_CREATED','dataset',NULL,NULL,jsonb_build_object('seed','final','environment','development'),jsonb_build_object('version','final-seed-v1','large_catalogue',TRUE)
FROM users u WHERE u.email='admin@careergps.local'
AND NOT EXISTS (SELECT 1 FROM audit_logs a WHERE a.action='SEED_DATASET_CREATED' AND a.actor_user_id=u.id);

COMMIT;
