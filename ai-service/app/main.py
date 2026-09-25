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
