from fastapi.testclient import TestClient
from app.main import app, llm

client = TestClient(app)
HEADERS = {"x-internal-service-token": "test-secret-token"}


def test_ai_engineer_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_id": "2a7f4d18-6335-472c-aaef-ae9547bfc1e2",
        "career_title": "AI Engineer",
        "profile": {"education": [{"degree": "BCA"}], "experience": []},
        "user_skills": [{"name": "Python"}],
        "skill_gaps": [{"name": "PyTorch"}]
    })

    assert response.status_code == 200
    data = response.json()
    assert data["career_title"] == "AI Engineer"
    assert len(data["recommended_projects"]) == 3
    levels = [p["difficulty_level"] for p in data["recommended_projects"]]
    assert levels == [1, 2, 3]
    labels = [p["difficulty_label"] for p in data["recommended_projects"]]
    assert labels == ["Starter", "Practical", "Career-Ready"]
    assert any("Prediction" in p["title"] or "ML" in p["title"] for p in data["recommended_projects"])
    assert any("RAG" in p["title"] or "Production" in p["title"] for p in data["recommended_projects"])


def test_backend_developer_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Backend Developer",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    titles = [p["title"] for p in data["recommended_projects"]]
    assert any("CRUD REST API" in t for t in titles)
    assert any("PostgreSQL" in t for t in titles)
    assert any("Cloud Microservice" in t or "Docker" in str(p.get("skills", [])) for t, p in zip(titles, data["recommended_projects"]))


def test_data_analyst_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Data Analyst",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    assert any("Dataset Analysis" in p["title"] or "Insights" in p["title"] for p in data["recommended_projects"])
    assert any("Dashboard" in p["title"] for p in data["recommended_projects"])
    assert any("Capstone" in p["title"] for p in data["recommended_projects"])


def test_geography_gis_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Geo Analyst",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    types = [p["project_type"] for p in data["recommended_projects"]]
    assert all(t == "geospatial" for t in types)
    assert any("Thematic Map" in p["title"] for p in data["recommended_projects"])
    assert any("Suitability Analysis" in p["title"] for p in data["recommended_projects"])
    assert any("Remote Sensing" in p["title"] or "PostGIS" in p["title"] for p in data["recommended_projects"])


def test_assistant_professor_portfolio_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Assistant Professor",
        "profile": {"education": [{"degree": "Master of Science"}]},
        "user_skills": [{"name": "Teaching/Pedagogy"}]
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    types = [p["project_type"] for p in data["recommended_projects"]]
    assert all(t == "academic" for t in types)
    assert any("Lesson Plan" in p["title"] for p in data["recommended_projects"])
    assert any("Teaching Dossier" in p["title"] or "Portfolio" in p["title"] for p in data["recommended_projects"])


def test_marketing_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Marketing Specialist",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    types = [p["project_type"] for p in data["recommended_projects"]]
    assert all(t == "marketing" for t in types)
    assert any("Campaign Brief" in p["title"] for p in data["recommended_projects"])
    assert any("Multi-Channel" in p["title"] for p in data["recommended_projects"])
    assert any("Growth Case Study" in p["title"] for p in data["recommended_projects"])


def test_business_finance_project_recommendations(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Business Analyst",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert len(data["recommended_projects"]) == 3
    assert any("Business Scenario" in p["title"] for p in data["recommended_projects"])
    assert any("Financial Model" in p["title"] for p in data["recommended_projects"])
    assert any("Feasibility" in p["title"] for p in data["recommended_projects"])


def test_beginner_vs_experienced_personalization(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    
    # Beginner: 0 years exp, no degree
    beginner_res = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Backend Developer",
        "profile": {"experience": []},
        "user_skills": []
    })
    assert beginner_res.status_code == 200
    b_data = beginner_res.json()
    assert b_data["user_tier"] == "beginner"
    assert b_data["recommended_level"] == 1

    # Experienced: 4 years exp
    experienced_res = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Backend Developer",
        "profile": {"experience": [{"years": 4.0, "role": "Senior Engineer"}]},
        "user_skills": [{"name": "Node.js"}, {"name": "PostgreSQL"}, {"name": "Docker"}]
    })
    assert experienced_res.status_code == 200
    e_data = experienced_res.json()
    assert e_data["user_tier"] == "experienced"
    assert e_data["recommended_level"] == 3


def test_ai_generated_projects_with_mocked_llm(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *args, **kwargs: {
        "career_title": "Bioinformatics Analyst",
        "recommended_level": 2,
        "recommendation_rationale": "Recommended practical genomic analysis project for your biology background.",
        "projects": [
            {
                "title": "Level 1 — FASTA Sequence Parser",
                "difficulty_level": 1,
                "difficulty_label": "Starter",
                "project_type": "bioinformatics",
                "estimated_effort": "1 week",
                "brief": "Parse genomic sequences and compute GC content.",
                "problem_statement": "Sequence files are massive and require fast stream parsing.",
                "learning_objectives": ["BioPython syntax"],
                "prerequisites": ["Python"],
                "tasks": [{"order": 1, "title": "Parse FASTA", "description": "Stream lines", "deliverable_hint": "parser.py"}],
                "deliverables": [{"type": "code_repo", "title": "GitHub Repo", "description": "Code", "format_hint": "URL", "required": True}],
                "acceptance_criteria": ["GC content calculated accurately"],
                "evaluation_rubric": [{"dimension": "Accuracy", "criteria": "Passes test sequences"}],
                "skills": ["Python", "Bioinformatics"],
                "starter_template": {"title": "BioPython Starter", "description": "Template", "free_alternative": "Free", "url": ""},
                "reflection_prompts": ["What was difficult?"],
                "next_step": "Level 2"
            },
            {
                "title": "Level 2 — RNA-Seq Differential Expression Pipeline",
                "difficulty_level": 2,
                "difficulty_label": "Practical",
                "project_type": "bioinformatics",
                "estimated_effort": "2 weeks",
                "brief": "Process RNA count matrices.",
                "problem_statement": "Identify genes with statistically significant expression changes.",
                "learning_objectives": ["DESeq2", "Statistical testing"],
                "prerequisites": ["Level 1"],
                "tasks": [{"order": 1, "title": "Run DESeq2", "description": "Differential test", "deliverable_hint": "R script"}],
                "deliverables": [{"type": "report_doc", "title": "Volcano Plot Report", "description": "Visuals", "format_hint": "PDF", "required": True}],
                "acceptance_criteria": ["Volcano plots generated"],
                "evaluation_rubric": [{"dimension": "Statistics", "criteria": "P-values adjusted for FDR"}],
                "skills": ["R", "Statistics", "Bioinformatics"],
                "starter_template": {"title": "RNA-Seq Scaffold", "description": "Template", "free_alternative": "Free", "url": ""},
                "reflection_prompts": ["How did FDR correction affect significant count?"],
                "next_step": "Level 3"
            },
            {
                "title": "Level 3 — Genomic Variant Calling Pipeline with Snakemake",
                "difficulty_level": 3,
                "difficulty_label": "Career-Ready",
                "project_type": "bioinformatics",
                "estimated_effort": "4 weeks",
                "brief": "Reproducible workflow calling SNPs from raw FASTQ reads.",
                "problem_statement": "Clinical genomic pipelines must be 100% reproducible.",
                "learning_objectives": ["Snakemake", "GATK"],
                "prerequisites": ["Level 2"],
                "tasks": [{"order": 1, "title": "Workflow Design", "description": "Author Snakefile", "deliverable_hint": "Snakefile"}],
                "deliverables": [{"type": "code_repo", "title": "Snakemake Repo", "description": "Repo", "format_hint": "URL", "required": True}],
                "acceptance_criteria": ["Pipeline executes end-to-end"],
                "evaluation_rubric": [{"dimension": "Reproducibility", "criteria": "Containerized execution"}],
                "skills": ["Snakemake", "Docker", "Genomics"],
                "starter_template": {"title": "GATK Scaffold", "description": "Template", "free_alternative": "Free", "url": ""},
                "reflection_prompts": ["What pipeline bottlenecks did you observe?"],
                "next_step": "Portfolio ready"
            }
        ]
    })

    response = client.post("/internal/v1/projects/recommend", headers=HEADERS, json={
        "career_title": "Bioinformatics Analyst",
        "profile": {},
        "user_skills": []
    })

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ai_generated"
    assert len(data["recommended_projects"]) == 3
    assert data["recommended_projects"][0]["title"] == "Level 1 — FASTA Sequence Parser"
