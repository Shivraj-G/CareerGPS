import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Goa Career Intelligence AI Service", version="0.3.0")
TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN")


def check_token(token: str | None):
    if TOKEN and token != TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal service token")


class PathwayReasonRequest(BaseModel):
    goal: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    template: dict[str, Any]
    profile: dict[str, Any] = Field(default_factory=dict)


class EligibilityExplainRequest(BaseModel):
    outcome: str
    results: list[dict[str, Any]] = Field(default_factory=list)


class RecommendationRequest(BaseModel):
    profile: dict[str, Any] = Field(default_factory=dict)
    skills: list[dict[str, Any]] = Field(default_factory=list)
    careers: list[dict[str, Any]] = Field(default_factory=list)
    goal: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)
    limit: int = 5


class SkillGapExplainRequest(BaseModel):
    career: dict[str, Any] = Field(default_factory=dict)
    user_skills: list[dict[str, Any]] = Field(default_factory=list)
    required_skills: list[dict[str, Any]] = Field(default_factory=list)
    matched_skills: list[dict[str, Any]] = Field(default_factory=list)
    missing_skills: list[dict[str, Any]] = Field(default_factory=list)


@app.get("/internal/v1/health")
def health(x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)
    return {"status": "ok", "service": "ai-service"}


@app.post("/internal/v1/pathways/reason")
def pathway_reason(request: PathwayReasonRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)
    steps = request.template.get("steps", [])
    goal = request.goal or "the selected career goal"
    reasoning = (
        f"This personalized pathway is based on the verified template '{request.template.get('title', 'selected pathway')}'. "
        f"It keeps the template's {len(steps)} structured step(s) and frames them around {goal}. "
        "No new qualification, eligibility rule, institution, or opportunity requirement was invented."
    )
    return {"reasoning": reasoning, "used_template_steps": len(steps)}


@app.post("/internal/v1/eligibility/explain")
def eligibility_explain(request: EligibilityExplainRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)
    satisfied = sum(1 for item in request.results if item.get("status") == "satisfied")
    missing = sum(1 for item in request.results if item.get("status") == "not_satisfied")
    unknown = sum(1 for item in request.results if item.get("status") == "unable_to_determine")
    if request.outcome == "meets_listed_requirements":
        text = f"The structured check found {satisfied} satisfied requirement(s) and no unresolved requirement(s)."
    elif request.outcome == "does_not_meet_listed_requirements":
        text = f"The structured check found {missing} requirement(s) not met. Review each listed reason and its source evidence."
    else:
        text = f"The structured check could not determine all requirements ({unknown} unresolved). Verify the missing or unstructured information before drawing a conclusion."
    return {"explanation": text}


@app.post("/internal/v1/recommendations/careers")
def recommendations_careers(request: RecommendationRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)

    user_skill_ids = {s.get("id") for s in request.skills if s.get("id")}
    goal = request.goal or request.profile.get("career_goal")

    scored: list[dict[str, Any]] = []
    for candidate in request.careers:
        # Never fabricate a candidate — only ever score/return what Node supplied.
        candidate_id = candidate.get("id")
        if candidate_id is None:
            continue

        # Match on skill_id, not name — the confirmed payload gives both sides a
        # stable id, which avoids casing/typo mismatches a name-string match risks.
        # importance="required" (the confirmed value) is weighted higher; this only
        # emphasizes what Node already sent, it doesn't add a new requirement.
        weighted_matches: list[tuple[str, int]] = []
        for entry in candidate.get("required_skills", []):
            skill_id = entry.get("skill_id")
            if skill_id and skill_id in user_skill_ids:
                weight = 2 if entry.get("importance") == "required" else 1
                weighted_matches.append((entry.get("name", skill_id), weight))

        score = sum(weight for _, weight in weighted_matches)
        matched_names = sorted({name for name, _ in weighted_matches})

        reasons = []
        if matched_names:
            reasons.append(f"matches on {', '.join(matched_names)}")
        else:
            reasons.append("included as a structurally available option; no strong skill overlap found")

        title = candidate.get("title")
        if goal and title and goal.strip().lower() == title.strip().lower():
            reasons.append(f"directly matches your stated goal of {goal}")
            score += 1  # small nudge toward a stated goal — not a fabricated requirement

        scored.append({
            "career_id": candidate_id,
            "title": title,
            "score": score,
            "reasoning": "; ".join(reasons) + ".",
        })

    scored.sort(key=lambda item: item["score"], reverse=True)
    top = scored[: max(request.limit, 0)]

    return {
        "recommendations": top,
        "considered": len(request.careers),
        "grounded": len(top) > 0,
    }


@app.post("/internal/v1/skills/gap-analysis")
def skills_gap_analysis(request: SkillGapExplainRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)

    career_title = request.career.get("title") or "this career"

    if not request.required_skills:
        explanation = f"No structured skill requirements are recorded for {career_title} yet, so a gap cannot be explained."
    elif not request.missing_skills:
        explanation = f"Your recorded skills cover every listed requirement for {career_title}."
    else:
        # Node already computed matched/missing — Python only explains it,
        # using the confirmed "importance" field to prioritize the wording.
        required_missing = [s.get("skill_name") for s in request.missing_skills if s.get("importance") == "required"]
        other_missing = [s.get("skill_name") for s in request.missing_skills if s.get("importance") != "required"]

        parts = []
        if required_missing:
            parts.append(f"required skill(s) still missing: {', '.join(required_missing)}")
        if other_missing:
            parts.append(f"additional recommended skill(s) not yet listed: {', '.join(other_missing)}")

        explanation = (
            f"To meet the listed requirements for {career_title}, the following applies — "
            + "; ".join(parts)
            + ". This reflects the structured requirement list as recorded; it is not a re-derived or AI-estimated requirement."
        )

    return {
        "explanation": explanation,
        "missing_skills": request.missing_skills,
        "matched_count": len(request.matched_skills),
        "required_count": len(request.required_skills),
    }


class AssistantRequest(BaseModel):
    question: str
    context: dict[str, Any] = Field(default_factory=dict)


def _citation(item: dict[str, Any], entity_type: str):
    return {
        "entity_type": entity_type,
        "entity_id": item.get("id"),
        "title": item.get("title"),
        "source_url": item.get("source_url"),
        "source_document_url": item.get("source_document_url"),
        "verified_at": item.get("verified_at"),
    }


@app.post("/internal/v1/assistant/answer")
def assistant_answer(request: AssistantRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)
    q = request.question.lower()
    context = request.context or {}
    citations: list[dict[str, Any]] = []
    careers = context.get("careers", [])
    opportunities = context.get("opportunities", [])
    pathways = context.get("pathways", [])
    courses = context.get("courses", [])

    if opportunities and any(word in q for word in ["job", "government", "recruit", "vacan", "opportun"]):
        items = opportunities[:5]
        lines = [f"{x.get('title')} at {x.get('organization') or 'the listed organization'} — status: {x.get('status') or 'unknown'}" for x in items]
        answer = "Based on the published opportunity records I could retrieve:\n" + "\n".join(f"- {line}" for line in lines)
        citations = [_citation(x, "opportunity") for x in items]
    elif pathways and any(word in q for word in ["pathway", "route", "steps", "become"]):
        items = pathways[:5]
        lines = [f"{x.get('title')} ({x.get('career_title')})" for x in items]
        answer = "Based on the published pathway templates:\n" + "\n".join(f"- {line}" for line in lines)
        citations = [_citation(x, "pathway") for x in items]
    elif courses and any(word in q for word in ["course", "learn", "study", "training"]):
        items = courses[:5]
        lines = [f"{x.get('title')} — {x.get('location') or 'location not listed'}" for x in items]
        answer = "Based on the published course records:\n" + "\n".join(f"- {line}" for line in lines)
        citations = [_citation(x, "course") for x in items]
    elif careers:
        items = careers[:5]
        lines = [x.get("title") for x in items]
        answer = "Based on the published career records matching your question:\n" + "\n".join(f"- {line}" for line in lines)
        citations = [_citation(x, "career") for x in items]
    else:
        answer = "I could not find enough published structured data to answer that reliably. The information may be unavailable or needs verification. I will not invent a qualification, opportunity, source, or deadline."

    return {"answer": answer, "citations": citations, "grounded": bool(citations)}
