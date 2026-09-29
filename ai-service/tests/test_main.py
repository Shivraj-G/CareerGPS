import os

import pytest
from fastapi.testclient import TestClient

from app import llm
from app.main import app

client = TestClient(app)
HEADERS = {"x-internal-service-token": os.environ["INTERNAL_SERVICE_TOKEN"]}


# ---------------------------------------------------------------------------
# Internal auth + health
# ---------------------------------------------------------------------------

def test_health_rejects_missing_token():
    assert client.get("/internal/v1/health").status_code == 401


def test_health_rejects_wrong_token():
    resp = client.get("/internal/v1/health", headers={"x-internal-service-token": "wrong-token"})
    assert resp.status_code == 401


def test_health_accepts_correct_token_and_reports_llm_disabled_in_tests():
    resp = client.get("/internal/v1/health", headers=HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["llm"]["enabled"] is False


def test_llm_ping_requires_token_and_reports_no_provider():
    assert client.get("/internal/v1/llm/ping").status_code == 401
    resp = client.get("/internal/v1/llm/ping", headers=HEADERS)
    assert resp.status_code == 200
    assert resp.json()["ok"] is False


# ---------------------------------------------------------------------------
# recommendations/careers - deterministic fallback (LLM off)
# ---------------------------------------------------------------------------

def _career(career_id, title, required_skills, description=None):
    return {"id": career_id, "title": title, "description": description, "required_skills": required_skills}


def test_recommendations_full_skill_overlap_ranks_first():
    payload = {
        "profile": {"career_goal": "Backend Developer"},
        "skills": [{"id": "s1", "name": "JavaScript"}, {"id": "s2", "name": "Node.js"}],
        "careers": [
            _career("c1", "Backend Developer", [
                {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
                {"skill_id": "s2", "name": "Node.js", "importance": "required"},
            ]),
            _career("c2", "Data Analyst", [{"skill_id": "s3", "name": "SQL", "importance": "required"}]),
        ],
        "goal": "Backend Developer",
    }
    resp = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS)
    assert resp.status_code == 200
    body = resp.json()
    assert body["recommendations"][0]["career_id"] == "c1"
    assert body["grounded"] is True
    assert body["ai_generated"] is False


def test_recommendations_returns_results_key_that_node_reads():
    """Node reads `ai.results` - this is the field-name bug found in the audit."""
    payload = {
        "profile": {},
        "skills": [{"id": "s1", "name": "JavaScript"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"}])],
    }
    body = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()
    assert body["results"] == body["recommendations"]
    assert body["results"][0]["career_id"] == "c1"
    # fields the frontend's normalizeRecommendationResult() reads
    for key in ("career_id", "title", "reasoning", "match_score", "missing_skills"):
        assert key in body["results"][0]


def test_recommendations_partial_overlap_scores_lower_than_full_match():
    def score_for(skills):
        payload = {
            "profile": {}, "skills": skills,
            "careers": [_career("c1", "Backend Developer", [
                {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
                {"skill_id": "s2", "name": "Node.js", "importance": "required"},
            ])],
        }
        return client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()["results"][0]["score"]

    full = score_for([{"id": "s1", "name": "JavaScript"}, {"id": "s2", "name": "Node.js"}])
    partial = score_for([{"id": "s1", "name": "JavaScript"}])
    assert partial < full
    assert full == 100 and partial == 50


def test_recommendations_lists_missing_skills_from_data_not_from_a_model():
    payload = {
        "profile": {}, "skills": [{"id": "s1", "name": "JavaScript"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
            {"skill_id": "s2", "name": "Node.js", "importance": "required"},
            {"skill_id": "s3", "name": "Docker", "importance": "useful"},
        ])],
    }
    item = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()["results"][0]
    assert item["missing_skills"] == ["Node.js", "Docker"]  # required first, then useful


def test_recommendations_zero_overlap_still_returns_candidate_with_zero_score():
    payload = {
        "profile": {}, "skills": [{"id": "sX", "name": "Excel"}],
        "careers": [_career("c1", "Backend Developer", [
            {"skill_id": "s1", "name": "JavaScript", "importance": "required"}])],
    }
    item = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()["recommendations"][0]
    assert item["score"] == 0
    assert "no strong skill overlap" in item["reasoning"]


def test_recommendations_empty_careers_list_is_safe():
    body = client.post("/internal/v1/recommendations/careers",
                       json={"profile": {}, "skills": [], "careers": []}, headers=HEADERS).json()
    assert body["recommendations"] == [] and body["results"] == []
    assert body["grounded"] is False
    assert body["considered"] == 0


def test_recommendations_accepts_null_profile():
    """Node sends profile: null when the user has no profile row yet."""
    resp = client.post("/internal/v1/recommendations/careers",
                       json={"profile": None, "skills": [], "careers": []}, headers=HEADERS)
    assert resp.status_code == 200


def test_recommendations_skips_candidate_missing_id_without_crashing():
    payload = {"profile": {}, "skills": [{"id": "s1", "name": "JavaScript"}],
               "careers": [{"title": "No ID Career", "required_skills": []}]}
    body = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()
    assert body["recommendations"] == []
    assert body["considered"] == 1


def test_recommendations_required_skill_missing_skill_id_does_not_match():
    payload = {"profile": {}, "skills": [{"id": "s1", "name": "JavaScript"}],
               "careers": [_career("c1", "Backend Developer", [{"name": "JavaScript", "importance": "required"}])]}
    body = client.post("/internal/v1/recommendations/careers", json=payload, headers=HEADERS).json()
    assert body["recommendations"][0]["score"] == 0


# ---------------------------------------------------------------------------
# recommendations/careers - LLM path
# ---------------------------------------------------------------------------

def _rec_payload():
    return {
        "profile": {"career_goal": "Doctor", "interests": ["biology", "helping people"],
                    "education": [{"qualification": "12th Science", "status": "completed", "year": 2026}]},
        "skills": [{"id": "s1", "name": "JavaScript", "level": "beginner"}],
        "careers": [
            _career("c1", "Backend Developer", [
                {"skill_id": "s1", "name": "JavaScript", "importance": "required"},
                {"skill_id": "s2", "name": "Node.js", "importance": "required"}], "Builds server side systems."),
            _career("c2", "Data Analyst", [{"skill_id": "s3", "name": "SQL", "importance": "required"}]),
        ],
        "goal": "Doctor",
    }


def test_llm_recommendations_include_beyond_catalogue_career_flagged_and_without_id(fake_llm):
    fake_llm["reply"] = {"recommendations": [
        {"ref": None, "title": "Doctor (MBBS)", "reasoning": "Your biology interest and science background fit medicine.",
         "skills_to_build": ["NEET preparation", "Biology", "Empathy"]},
        {"ref": "C1", "title": "Backend Developer", "reasoning": "You already know some JavaScript."},
    ]}
    body = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is True
    doctor, backend = body["results"]

    assert doctor["career_id"] is None
    assert doctor["source"] == "ai_general" and doctor["verified"] is False
    assert doctor["reasoning"].startswith("AI suggestion, not yet in the verified catalogue")
    assert doctor["missing_skills"] == ["NEET preparation", "Biology", "Empathy"]

    assert backend["career_id"] == "c1"  # id comes from Node's data, not the model
    assert backend["source"] == "catalogue" and backend["verified"] is True
    assert backend["missing_skills"] == ["Node.js"]  # from data, not from the model
    assert backend["reasoning"] == "You already know some JavaScript."
    assert body["results"] == body["recommendations"]


def test_llm_recommendations_never_return_an_id_that_node_did_not_send(fake_llm):
    fake_llm["reply"] = {"recommendations": [
        {"ref": "C99", "career_id": "made-up-uuid", "title": "Astronaut", "reasoning": "Fits your curiosity."}]}
    body = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()
    item = body["results"][0]
    assert item["career_id"] is None  # invalid ref: treated as beyond-catalogue, never given an id
    assert item["source"] == "ai_general"
    assert "made-up-uuid" not in str(body)


def test_llm_recommendations_map_title_match_back_to_real_catalogue_id(fake_llm):
    fake_llm["reply"] = {"recommendations": [
        {"ref": None, "title": "data analyst", "reasoning": "Good fit for analytical thinkers."}]}
    item = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()["results"][0]
    assert item["career_id"] == "c2" and item["source"] == "catalogue"


def test_llm_recommendations_drop_items_with_unverifiable_figures(fake_llm):
    fake_llm["reply"] = {"recommendations": [
        {"ref": None, "title": "Neurosurgeon", "reasoning": "Earns a salary of Rs 40 lakh per annum."},
        {"ref": "C1", "title": "Backend Developer", "reasoning": "Salary is Rs 12 LPA at entry level."}]}
    results = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()["results"]
    assert [r["title"] for r in results] == ["Backend Developer"]
    assert "LPA" not in results[0]["reasoning"]  # falls back to the deterministic reasoning


def test_llm_recommendations_cap_beyond_catalogue_suggestions_at_three(fake_llm):
    fake_llm["reply"] = {"recommendations": [
        {"ref": None, "title": f"Career {i}", "reasoning": "A reasonable fit for you."} for i in range(6)]}
    results = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()["results"]
    assert len(results) == 3


def test_llm_recommendations_fall_back_to_rules_when_llm_returns_nothing(fake_llm):
    fake_llm["reply"] = None  # timeout / rate limit / invalid JSON
    body = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is False
    assert {r["career_id"] for r in body["results"]} == {"c1", "c2"}


def test_llm_recommendations_fall_back_when_llm_returns_wrong_shape(fake_llm):
    fake_llm["reply"] = {"recommendations": "not a list"}
    body = client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is False and body["results"]


def test_llm_recommendations_stay_inside_node_time_budget(fake_llm):
    fake_llm["reply"] = None
    client.post("/internal/v1/recommendations/careers", json=_rec_payload(), headers=HEADERS)
    assert fake_llm["calls"][0]["budget"] < 8  # Node aborts recommendations at 8s


# ---------------------------------------------------------------------------
# skills/gap-analysis (Node does not call it today; kept working)
# ---------------------------------------------------------------------------

def test_gap_analysis_no_missing_skills():
    payload = {"career": {"id": "c1", "title": "Backend Developer"},
               "required_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
               "matched_skills": [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}],
               "missing_skills": []}
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    assert "cover every listed requirement" in resp.json()["explanation"]


def test_gap_analysis_all_required_skills_missing():
    missing = [{"skill_id": "s1", "skill_name": "JavaScript", "importance": "required"}]
    payload = {"career": {"id": "c1", "title": "Backend Developer"}, "required_skills": missing, "missing_skills": missing}
    body = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS).json()
    assert "JavaScript" in body["explanation"]
    assert body["missing_skills"] == missing


def test_gap_analysis_mixed_required_and_preferred_importance():
    missing = [{"skill_id": "s1", "skill_name": "Node.js", "importance": "required"},
               {"skill_id": "s2", "skill_name": "Docker", "importance": "preferred"}]
    payload = {"career": {"title": "Backend Developer"}, "required_skills": missing, "missing_skills": missing}
    text = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS).json()["explanation"]
    assert "required skill(s) still missing: Node.js" in text
    assert "additional recommended skill(s) not yet listed: Docker" in text


def test_gap_analysis_accepts_the_field_name_node_actually_uses():
    """Node's calculateSkillGap() returns {skill_id, skill, importance}, not skill_name."""
    missing = [{"skill_id": "s1", "skill": "Node.js", "importance": "required"}]
    payload = {"career": {"title": "Backend Developer"}, "required_skills": missing, "missing_skills": missing}
    text = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS).json()["explanation"]
    assert "Node.js" in text


def test_gap_analysis_no_required_skills_recorded_for_career():
    payload = {"career": {"title": "Mystery Career"}, "required_skills": [], "missing_skills": []}
    resp = client.post("/internal/v1/skills/gap-analysis", json=payload, headers=HEADERS)
    assert "No structured skill requirements are recorded" in resp.json()["explanation"]


# ---------------------------------------------------------------------------
# pathways/reason
# ---------------------------------------------------------------------------

def _pathway_payload():
    return {
        "goal": "Backend Developer",
        "preferences": {"preferred_locations": ["Goa"], "constraints": {}},
        "template": {"id": "p1", "career_id": "c1", "title": "Backend Developer Pathway", "description": "A route.",
                     "steps": [{"title": "Learn JavaScript"}, {"title": "Build a REST API"}]},
        "profile": {"education": [{"qualification": "BCA", "status": "ongoing", "year": 2027}],
                    "experience": [], "interests": ["software"]},
    }


def test_pathway_reason_deterministic_fallback_when_llm_off():
    body = client.post("/internal/v1/pathways/reason", json=_pathway_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is False
    assert body["used_template_steps"] == 2
    assert "No new qualification" in body["reasoning"]


def test_pathway_reason_uses_llm_text_and_strips_urls(fake_llm):
    fake_llm["reply"] = {"reasoning": "As a BCA student, start with Learn JavaScript, then Build a REST API. "
                                      "See https://evil.example/apply for more details on this route."}
    body = client.post("/internal/v1/pathways/reason", json=_pathway_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is True
    assert "Learn JavaScript" in body["reasoning"]
    assert "http" not in body["reasoning"]


def test_pathway_reason_falls_back_when_llm_text_too_short(fake_llm):
    fake_llm["reply"] = {"reasoning": "ok"}
    body = client.post("/internal/v1/pathways/reason", json=_pathway_payload(), headers=HEADERS).json()
    assert body["ai_generated"] is False


def test_pathway_reason_prompt_contains_only_the_verified_steps(fake_llm):
    fake_llm["reply"] = None
    client.post("/internal/v1/pathways/reason", json=_pathway_payload(), headers=HEADERS)
    prompt = fake_llm["calls"][0]["messages"][0]["content"]
    assert "Learn JavaScript" in prompt and "Build a REST API" in prompt
    assert fake_llm["calls"][0]["budget"] < 8


# ---------------------------------------------------------------------------
# eligibility/explain - the LLM may explain the outcome but never change it
# ---------------------------------------------------------------------------

def _elig(outcome, status):
    return {"outcome": outcome, "results": [{"requirement_id": "r1", "requirement_type": "qualification",
                                             "requirement_text": "Must hold a BCA degree", "status": status,
                                             "reason": "Profile lists BCom."}]}


def test_eligibility_deterministic_texts_when_llm_off():
    meets = client.post("/internal/v1/eligibility/explain", json=_elig("meets_listed_requirements", "satisfied"), headers=HEADERS).json()
    assert "1 satisfied requirement(s)" in meets["explanation"]
    unknown = client.post("/internal/v1/eligibility/explain", json=_elig("unable_to_determine", "unable_to_determine"), headers=HEADERS).json()
    assert "could not determine" in unknown["explanation"]


def test_eligibility_llm_explanation_used_when_consistent(fake_llm):
    fake_llm["reply"] = {"explanation": "The check found that the BCA degree requirement is not met, because your "
                                        "profile lists a BCom. Read the official notice and update your profile."}
    body = client.post("/internal/v1/eligibility/explain",
                       json=_elig("does_not_meet_listed_requirements", "not_satisfied"), headers=HEADERS).json()
    assert body["ai_generated"] is True and "BCom" in body["explanation"]


def test_eligibility_rejects_llm_text_that_contradicts_a_negative_outcome(fake_llm):
    fake_llm["reply"] = {"explanation": "Good news, you are eligible for this job and should apply right away today."}
    body = client.post("/internal/v1/eligibility/explain",
                       json=_elig("does_not_meet_listed_requirements", "not_satisfied"), headers=HEADERS).json()
    assert body["ai_generated"] is False
    assert "eligible" not in body["explanation"].lower()


def test_eligibility_rejects_llm_text_that_promises_selection(fake_llm):
    fake_llm["reply"] = {"explanation": "You meet the listed requirements and you will be selected for the role."}
    body = client.post("/internal/v1/eligibility/explain",
                       json=_elig("meets_listed_requirements", "satisfied"), headers=HEADERS).json()
    assert body["ai_generated"] is False


def test_eligibility_positive_outcome_always_carries_the_no_guarantee_note(fake_llm):
    fake_llm["reply"] = {"explanation": "Your profile satisfies the BCA degree requirement listed for this post."}
    body = client.post("/internal/v1/eligibility/explain",
                       json=_elig("meets_listed_requirements", "satisfied"), headers=HEADERS).json()
    assert "does not guarantee selection" in body["explanation"]


def test_eligibility_explanation_is_cached_so_repeat_gets_do_not_call_the_llm_again(fake_llm):
    fake_llm["reply"] = {"explanation": "The BCA requirement is not met because your profile lists a BCom degree."}
    payload = _elig("does_not_meet_listed_requirements", "not_satisfied")
    first = client.post("/internal/v1/eligibility/explain", json=payload, headers=HEADERS).json()
    second = client.post("/internal/v1/eligibility/explain", json=payload, headers=HEADERS).json()
    assert first["explanation"] == second["explanation"]
    assert len(fake_llm["calls"]) == 1


# ---------------------------------------------------------------------------
# assistant/answer - deterministic fallback (LLM off)
# ---------------------------------------------------------------------------

def test_assistant_grounded_career_answer_with_real_payload():
    payload = {
        "question": "What career options are available for someone interested in technology?",
        "context": {
            "profile": {"education": [{"qualification": "BCA", "status": "ongoing", "year": 2027}], "experience": [],
                        "interests": ["technology", "software development"], "preferred_locations": ["Goa"],
                        "career_goal": "Software Developer"},
            "careers": [{"id": "11111111-1111-1111-1111-111111111111", "title": "Software Developer",
                         "description": "Develops and maintains software applications.",
                         "source_url": "https://example.com/career", "source_document_url": None,
                         "verified_at": "2026-09-25T10:00:00Z"}],
            "opportunities": [], "pathways": [], "courses": [],
        },
    }
    body = client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()
    assert body["grounded"] is True
    assert body["citations"][0]["entity_id"] == "11111111-1111-1111-1111-111111111111"
    assert body["citations"][0]["source_url"] == "https://example.com/career"


def test_assistant_routes_to_opportunities_when_keyword_matches():
    payload = {"question": "Are there any government job vacancies right now?",
               "context": {"careers": [{"id": "c1", "title": "Software Developer"}],
                           "opportunities": [{"id": "o1", "title": "Junior Clerk", "organization": "Goa Govt", "status": "open"}]}}
    assert client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()["citations"][0]["entity_type"] == "opportunity"


def test_assistant_routes_to_pathways_when_keyword_matches():
    payload = {"question": "What steps do I need to become a backend developer?",
               "context": {"pathways": [{"id": "p1", "title": "Backend Developer Pathway", "career_title": "Backend Developer"}]}}
    assert client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()["citations"][0]["entity_type"] == "pathway"


def test_assistant_routes_to_courses_when_keyword_matches():
    payload = {"question": "What course should I study to learn programming?",
               "context": {"courses": [{"id": "co1", "title": "Diploma in Computer Applications", "location": "Panaji"}]}}
    assert client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()["citations"][0]["entity_type"] == "course"


def test_assistant_returns_unavailable_when_no_context_supports_answer():
    payload = {"question": "What is the minimum wage in Goa this year?",
               "context": {"careers": [], "opportunities": [], "pathways": [], "courses": []}}
    body = client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()
    assert body["grounded"] is False and body["citations"] == []
    assert "unavailable" in body["answer"].lower() or "needs verification" in body["answer"].lower()


def test_assistant_deterministic_fallback_does_not_list_careers_for_an_unrelated_question():
    """Node's broad fallback sends careers even for unrelated questions."""
    payload = {"question": "What is the minimum wage in Goa this year?",
               "context": {"careers": [{"id": "c1", "title": "Software Developer"}]}}
    body = client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()
    assert body["citations"] == []


def test_assistant_answers_a_greeting_without_needing_records():
    body = client.post("/internal/v1/assistant/answer",
                       json={"question": "Hello", "context": {"careers": [], "history": []}}, headers=HEADERS).json()
    assert "CareerGPS Assistant" in body["answer"]


# ---------------------------------------------------------------------------
# assistant/answer - LLM path
# ---------------------------------------------------------------------------

def _assistant_context():
    return {
        "profile": {"career_goal": "Doctor", "interests": ["biology"], "education": [], "experience": [],
                    "preferred_locations": ["Goa"]},
        "careers": [{"id": "career-uuid-1", "title": "Software Developer", "description": "Builds software.",
                     "source_url": "https://careers.example/sd", "source_document_url": None,
                     "verified_at": "2026-09-25T10:00:00Z"}],
        "opportunities": [{"id": "opp-uuid-1", "title": "Junior Clerk", "organization": "Goa Govt",
                           "status": "open", "application_deadline": "2026-12-01T00:00:00Z",
                           "source_url": "https://goa.example/notice", "source_document_url": None,
                           "verified_at": "2026-09-20T00:00:00Z"}],
        "pathways": [], "courses": [],
        "history": [{"role": "user", "content": "Hi"}, {"role": "assistant", "content": "Hello! How can I help?"},
                    {"role": "user", "content": "How do I become a doctor?"}],
    }


def test_llm_assistant_builds_citations_from_node_records_not_from_model_output(fake_llm):
    fake_llm["reply"] = {"answer": "Here is what I found about clerk posts in Goa.",
                         "sources": ["O1", "O7", "Z3", "made-up"], "used_general_knowledge": False}
    body = client.post("/internal/v1/assistant/answer",
                       json={"question": "Any clerk jobs?", "context": _assistant_context()}, headers=HEADERS).json()
    assert body["ai_generated"] is True and body["grounded"] is True
    assert len(body["citations"]) == 1  # O7, Z3 and made-up do not exist and were dropped
    citation = body["citations"][0]
    assert citation["entity_type"] == "opportunity" and citation["entity_id"] == "opp-uuid-1"
    assert citation["source_url"] == "https://goa.example/notice"


def test_llm_assistant_answers_beyond_the_catalogue_and_labels_it_general_guidance(fake_llm):
    fake_llm["reply"] = {"answer": "To become a doctor in India you usually study MBBS after Class 12 science.",
                         "sources": [], "used_general_knowledge": True}
    body = client.post("/internal/v1/assistant/answer",
                       json={"question": "How do I become a doctor?", "context": _assistant_context()}, headers=HEADERS).json()
    assert body["ai_generated"] is True
    assert body["citations"] == [] and body["grounded"] is False
    assert "general guidance" in body["answer"].lower()


def test_llm_assistant_removes_urls_that_are_not_in_the_records(fake_llm):
    fake_llm["reply"] = {"answer": "Apply at https://fake-jobs.example/apply or read https://goa.example/notice today.",
                         "sources": ["O1"], "used_general_knowledge": False}
    answer = client.post("/internal/v1/assistant/answer",
                         json={"question": "Any clerk jobs?", "context": _assistant_context()}, headers=HEADERS).json()["answer"]
    assert "fake-jobs.example" not in answer
    assert "https://goa.example/notice" in answer


def test_llm_assistant_sends_history_as_turns_and_puts_records_in_the_last_message(fake_llm):
    fake_llm["reply"] = {"answer": "Answer.", "sources": [], "used_general_knowledge": False}
    client.post("/internal/v1/assistant/answer",
                json={"question": "How do I become a doctor?", "context": _assistant_context()}, headers=HEADERS)
    call = fake_llm["calls"][0]
    messages = call["messages"]
    assert messages[0] == {"role": "user", "content": "Hi"}
    assert messages[1]["role"] == "assistant"
    last = messages[-1]["content"]
    assert "[O1]" in last and "Junior Clerk" in last and "How do I become a doctor?" in last
    assert last.count("How do I become a doctor?") == 1  # current question not duplicated from history
    assert call["budget"] < 15  # Node aborts the assistant at 15s
    assert "Today's date is" in call["system"]


def test_llm_assistant_falls_back_to_the_rule_based_answer_when_llm_fails(fake_llm):
    fake_llm["reply"] = None
    payload = {"question": "Are there any government job vacancies right now?", "context": _assistant_context()}
    body = client.post("/internal/v1/assistant/answer", json=payload, headers=HEADERS).json()
    assert body["ai_generated"] is False
    assert body["citations"][0]["entity_type"] == "opportunity"


def test_llm_assistant_falls_back_when_model_returns_an_empty_answer(fake_llm):
    fake_llm["reply"] = {"answer": "   ", "sources": []}
    body = client.post("/internal/v1/assistant/answer",
                       json={"question": "Any clerk jobs?", "context": _assistant_context()}, headers=HEADERS).json()
    assert body["ai_generated"] is False and body["answer"].strip()
