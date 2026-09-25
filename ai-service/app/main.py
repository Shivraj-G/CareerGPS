import os
from typing import Any
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="Goa Career Intelligence AI Service", version="0.1.0")
TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN")

class RecommendationRequest(BaseModel):
    profile: dict[str, Any] | None = None
    skills: list[dict[str, Any]] = Field(default_factory=list)
    careers: list[dict[str, Any]] = Field(default_factory=list)
    goal: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)

class GapRequest(BaseModel):
    profile: dict[str, Any] | None = None
    skills: list[dict[str, Any]] = Field(default_factory=list)
    career: dict[str, Any]


def authorize(token: str | None):
    if TOKEN and token != TOKEN:
        raise HTTPException(status_code=401, detail="Invalid internal service token")


def norm(value: str | None) -> str:
    return (value or "").strip().lower()


def recommend(payload: RecommendationRequest):
    owned = {norm(s.get("name")) for s in payload.skills}
    goal = norm(payload.goal)
    locations = {norm(x) for x in payload.preferences.get("preferred_locations", [])}
    results = []
    for career in payload.careers:
        required = career.get("required_skills", [])
        matched = [s for s in required if norm(s.get("name")) in owned]
        missing = [s for s in required if norm(s.get("name")) not in owned]
        title = career.get("title", "")
        description = career.get("description") or ""
        text = f"{title} {description}".lower()
        goal_match = bool(goal and any(part in text for part in goal.split() if len(part) > 2))
        # Internal matching score only; it is not a hiring probability.
        score = len(matched) * 3 + sum(2 if s.get("importance") == "required" else 1 for s in required if norm(s.get("name")) in owned)
        if goal_match: score += 2
        if not required and goal_match: score += 1
        reasons = []
        if matched: reasons.append(f"Your profile contains {len(matched)} listed career skill(s).")
        if goal_match: reasons.append("The career description is related to your stated goal.")
        if not reasons: reasons.append("This career is available in the structured career catalogue.")
        results.append({"career_id": career["id"], "title": title, "match_reasons": reasons, "skill_gaps": [s.get("name") for s in missing], "internal_match_score": score, "confidence": "moderate" if required else "low"})
    results.sort(key=lambda x: (-x["internal_match_score"], x["title"]))
    return results[:20]

@app.get("/internal/v1/health")
def health():
    return {"status": "ok", "service": "ai-service"}

@app.post("/internal/v1/recommendations/careers")
def career_recommendations(payload: RecommendationRequest, x_internal_service_token: str | None = Header(default=None)):
    authorize(x_internal_service_token)
    return {"results": recommend(payload), "matching_mode": "structured_mvp"}

@app.post("/internal/v1/skills/gap-analysis")
def skill_gap(payload: GapRequest, x_internal_service_token: str | None = Header(default=None)):
    authorize(x_internal_service_token)
    owned = {norm(s.get("name")) for s in payload.skills}
    required = payload.career.get("required_skills", [])
    return {"target_career_id": payload.career.get("id"), "matched_skills": [s.get("name") for s in required if norm(s.get("name")) in owned], "missing_skills": [{"skill": s.get("name"), "importance": s.get("importance")} for s in required if norm(s.get("name")) not in owned]}
