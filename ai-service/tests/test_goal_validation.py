from fastapi.testclient import TestClient

from app.main import app, llm

client = TestClient(app)
HEADERS = {"x-internal-service-token": "test-secret-token"}


def test_unlisted_legitimate_goal_returns_ai_suggested_unverified_routes(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *args, **kwargs: {
        "classification": "YELLOW",
        "goal_resolution": "VALID",
        "goal_validity": "VALID",
        "goal_type": "career",
        "career_name": "High Court Judge",
        "profile_fit": "BRIDGE_NEEDED",
        "twelfth_foundation": {"status": "UNKNOWN", "reason": "Exact subject requirements need route-specific verification."},
        "bachelors_alignment": {"status": "DETOUR", "reason": "The current BCA route is not a law qualification."},
        "foundational_conflict": False,
        "detour_required": True,
        "career_requirements": ["Verify the current legal education and judicial-entry requirements for the relevant jurisdiction."],
        "formal_barriers": ["Current qualification and jurisdiction-specific eligibility are not verified."],
        "additional_steps": ["Research the relevant legal education pathway."],
        "skill_gaps": ["Legal education and court-procedure knowledge to be assessed."],
        "next_steps": ["Identify the applicable official judicial-service or judicial-appointment rules."],
        "suggested_routes": [{
            "title": "Verify the legal education route",
            "route_type": "verification",
            "summary": "Check the official criteria for the relevant jurisdiction.",
            "steps": ["Identify the jurisdiction", "Read the official criteria"],
            "verification_status": "UNVERIFIED",
        }],
        "profile_gaps": ["Target jurisdiction"],
        "clarification_question": "Which state or jurisdiction do you want to practise in?",
        "reason": "Your goal is recognized. A legal qualification and jurisdiction-specific route need careful verification; this result is not an eligibility decision.",
        "confidence": "medium",
        "requires_acknowledgement": False,
        "can_continue": True,
        "can_generate_pathway": True,
    })

    response = client.post("/internal/v1/profiles/validate-goal", headers=HEADERS, json={
        "goal": "High court judge",
        "profile": {"education": [{"current_program": "BCA", "status": "pursuing", "school_12_stream": "Commerce without Mathematics"}]},
        "skills": [],
        "careers": [],
    })

    assert response.status_code == 200
    body = response.json()
    assert body["goal_resolution"] == "VALID"
    assert body["goal_validity"] == "VALID"
    assert body["classification"] == "YELLOW"
    assert body["career_resolution"] == "AI_SUGGESTED"
    assert body["can_continue"] is True
    assert body["suggested_routes"][0]["verification_status"] == "UNVERIFIED"


def test_ai_unavailable_does_not_claim_green_or_verified_eligibility(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: False)
    response = client.post("/internal/v1/profiles/validate-goal", headers=HEADERS, json={
        "goal": "Backend Developer",
        "profile": {"education": [{"current_program": "BCA", "status": "pursuing"}]},
        "skills": [],
        "careers": [],
    })

    assert response.status_code == 200
    body = response.json()
    assert body["classification"] == "UNKNOWN"
    assert body["goal_validity"] == "UNVERIFIED"
    assert body["verified"] is False
    assert body["can_continue"] is True
    assert "not verified" in body["reason"].lower()


def test_unsupported_goal_is_not_relabelled_as_green(monkeypatch):
    monkeypatch.setattr(llm, "llm_enabled", lambda: True)
    monkeypatch.setattr(llm, "chat_json", lambda *args, **kwargs: {
        "classification": "INVALID_GOAL",
        "goal_resolution": "UNSUPPORTED",
        "goal_validity": "INVALID",
        "goal_type": "unknown",
        "career_name": "Beggar",
        "profile_fit": "UNKNOWN",
        "reason": "Please clarify what kind of career or goal you mean.",
        "confidence": "medium",
        "can_continue": False,
        "can_generate_pathway": False,
    })
    response = client.post("/internal/v1/profiles/validate-goal", headers=HEADERS, json={
        "goal": "Beggar", "profile": {}, "skills": [], "careers": []
    })
    assert response.status_code == 200
    body = response.json()
    assert body["goal_resolution"] == "UNSUPPORTED"
    assert body["classification"] == "INVALID_GOAL"
    assert body["can_continue"] is False
