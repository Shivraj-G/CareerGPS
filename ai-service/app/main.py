import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Goa Career Intelligence AI Service", version="0.2.0")
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
