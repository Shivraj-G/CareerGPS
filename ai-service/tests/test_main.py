import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADERS = {"x-internal-service-token": os.environ["INTERNAL_SERVICE_TOKEN"]}


# ---------------------------------------------------------------------------
# Internal auth (handoff doc section 28: missing/wrong/correct token)
# ---------------------------------------------------------------------------

def test_health_rejects_missing_token():
    resp = client.get("/internal/v1/health")
    assert resp.status_code == 401


def test_health_rejects_wrong_token():
    resp = client.get("/internal/v1/health", headers={"x-internal-service-token": "wrong-token"})
    assert resp.status_code == 401


def test_health_accepts_correct_token():
    resp = client.get("/internal/v1/health", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# recommendations/careers
# ---------------------------------------------------------------------------

def _career(career_id, title, required_skills):
    return {"id": career_id, "title": title, "required_skills": required_skills}


def test_recommendations_full_skill_overlap_ranks_first():
    payload = {
        "profile": {"career_goal": "Backend Developer"},
        "skills": [
            {"id": "s1", "name": "JavaScript"},
            {"id": "s2", "name": "Node.js"},
        ],
        "careers": [
            _career("c1", "Backend Developer", [
                {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
                {"skill_id": "s2", "name": "Node.js", "importance": "required"},
            ]),
            _career("c2", "Data Analyst", [
                {"skill_id": "s3", "name": "SQL", "importance": "required"},
            ]),
        ],
        "goal": "Backend Developer",
    }
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["recommendations"][0]["career_id"] == "c1"
    assert body["grounded"] is True


def test_recommendations_partial_overlap_scores_lower_than_full_match():
    full_match_payload = {
        "profile": {},
        "skills": [{"id": "s1", "name": "JavaScript"}, {"id": "s2", "name": "Node.js"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
            {"skill_id": "s2", "name": "Node.js", "importance": "required"},
        ])],
    }
    partial_match_payload = {
        "profile": {},
        "skills": [{"id": "s1", "name": "JavaScript"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
            {"skill_id": "s2", "name": "Node.js", "importance": "required"},
        ])],
    }
    full_score = client.post("/internal/v1/recommendations/careers", json=full_match_payload, headers=HEADERS).json()["recommendations"][0]["score"]
    partial_score = client.post("/internal/v1/recommendations/careers", json=partial_match_payload, headers=HEADERS).json()["recommendations"][0]["score"]
    assert partial_score < full_score


def test_recommendations_zero_overlap_still_returns_candidate_with_zero_score():
    payload = {
        "profile": {},
        "skills": [{"id": "sX", "name": "Excel"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
        ])],
    }
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    body = resp.json()
    assert body["recommendations"][0]["score"] == 0
    assert "no strong skill overlap" in body["recommendations"][0]["reasoning"]


def test_recommendations_empty_careers_list_is_safe():
    payload = {"profile": {}, "skills": [], "careers": []}
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    body = resp.json()
    assert body["recommendations"] == []
    assert body["grounded"] is False
    assert body["considered"] == 0


def test_recommendations_skips_candidate_missing_id_without_crashing():
    payload = {
        "profile": {},
        "skills": [{"id": "s1", "name": "JavaScript"}],
        "careers": [{"title": "No ID Career", "required_skills": []}],  # malformed: no "id"
    }
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["recommendations"] == []
    assert body["considered"] == 1  # still counted as seen, just not scoreable


def test_recommendations_required_skill_missing_skill_id_does_not_match():
    payload = {
        "profile": {},
        "skills": [{"id": "s1", "name": "JavaScript"}],
        "careers": [_career("c1", "Backend Developer", [
            {"name": "JavaScript", "importance": "required"},  # malformed: no skill_id
        ])],
    }
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["recommendations"][0]["score"] == 0


# ---------------------------------------------------------------------------
# skills/gap-analysis
# ---------------------------------------------------------------------------

def test_gap_analysis_no_missing_skills():
    payload = {
        "career": {"id": "c1", "title": "Backend Developer"},
        "user_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "level": "intermediate"}],
        "required_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
        "matched_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
        "missing_skills": [],
    }
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    assert "cover every listed requirement" in resp.json()["explanation"]


def test_gap_analysis_all_required_skills_missing():
    payload = {
        "career": {"id": "c1", "title": "Backend Developer"},
        "user_skills": [],
        "required_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
        "matched_skills": [],
        "missing_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
    }
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    body = resp.json()
    assert "JavaScript" in body["explanation"]
    assert body["missing_skills"] == payload["missing_skills"]  # passed through, not re-derived


def test_gap_analysis_mixed_required_and_preferred_importance():
    payload = {
        "career": {"id": "c1", "title": "Backend Developer"},
        "user_skills": [],
        "required_skills": [
            {"skill_id": "s1", "skill_name": "Node.js", "importance": "required"},
            {"skill_id": "s2", "skill_name": "Docker", "importance": "preferred"},
        ],
        "matched_skills": [],
        "missing_skills": [
            {"skill_id": "s1", "skill_name": "Node.js", "importance": "required"},
            {"skill_id": "s2", "skill_name": "Docker", "importance": "preferred"},
        ],
    }
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    body = resp.json()
    assert "required skill(s) still missing: Node.js" in body["explanation"]
    assert "additional recommended skill(s) not yet listed: Docker" in body["explanation"]


def test_gap_analysis_no_required_skills_recorded_for_career():
    payload = {
        "career": {"id": "c1", "title": "Mystery Career"},
        "user_skills": [],
        "required_skills": [],
        "matched_skills": [],
        "missing_skills": [],
    }
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    assert "No structured skill requirements are recorded" in resp.json()["explanation"]
