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


def _is_greeting(q: str) -> bool:
    greetings = ["hello", "hi ", "hi!", "hey", "howdy", "good morning", "good afternoon", "good evening", "who are you", "what are you", "what can you do", "how can you help", "help me", "what is careergps"]
    return any(q.strip().startswith(g) or q.strip() == g.strip() for g in greetings)


def _last_topic(history: list[dict[str, Any]]) -> str | None:
    """Scan conversation history for the most recently discussed topic."""
    for msg in reversed(history):
        content = (msg.get("content") or "").lower()
        if any(w in content for w in ["backend", "frontend", "developer", "engineer", "data", "analyst", "ai ", "cloud"]):
            # Extract first recognised career keyword
            for kw in ["backend developer", "frontend developer", "ai engineer", "data scientist", "data engineer",
                        "cloud engineer", "full stack developer", "devops engineer", "software developer"]:
                if kw in content:
                    return kw
    return None


@app.post("/internal/v1/assistant/answer")
def assistant_answer(request: AssistantRequest, x_internal_service_token: str | None = Header(default=None)):
    check_token(x_internal_service_token)
    q = request.question.strip()
    q_lower = q.lower()
    context = request.context or {}
    citations: list[dict[str, Any]] = []
    careers = context.get("careers", [])
    opportunities = context.get("opportunities", [])
    pathways = context.get("pathways", [])
    courses = context.get("courses", [])
    profile = context.get("profile") or {}
    history = context.get("history", [])

    # ── Greeting / meta question ───────────────────────────────────────────────
    if _is_greeting(q_lower):
        career_titles = [c.get("title") for c in careers if c.get("title")]
        career_list = ", ".join(career_titles[:8]) if career_titles else "several tech and government careers"
        goal = profile.get("career_goal")
        goal_line = f" I can see your current career goal is: **{goal}**." if goal else ""
        answer = (
            f"Hello! I'm the CareerGPS assistant, here to help you navigate career opportunities in Goa.{goal_line}\n\n"
            f"I can help you with:\n"
            f"- 🎯 **Career exploration** — I have information on careers like {career_list}\n"
            f"- 📋 **Government job opportunities** — published recruitment listings from Goa government departments\n"
            f"- 🎓 **Courses and training** — diploma and degree programmes from Goa institutions\n"
            f"- 🗺️ **Career pathways** — step-by-step routes to reach your career goal\n\n"
            f"What would you like to explore today?"
        )
        return {"answer": answer, "citations": [], "grounded": True}

    # ── Follow-up: resolve pronouns using conversation history ─────────────────
    is_followup = any(w in q_lower for w in ["it", "that", "this", "them", "those", "they", "same", "more about", "tell me more", "what about", "and what", "how about"])
    resolved_topic = _last_topic(history) if is_followup and history else None

    # ── Government / job / recruitment / vacancy ───────────────────────────────
    if any(word in q_lower for word in ["government", "govt", "sarkari", "recruitment", "vacancy", "vacan", "recruit", "job opening", "job vacanc", "post of", "advertisement"]):
        if opportunities:
            items = opportunities[:8]
            lines = []
            for x in items:
                org = x.get("organization") or "Government department"
                status = x.get("status") or "status not confirmed"
                deadline = x.get("application_deadline")
                deadline_str = f", deadline: {deadline}" if deadline else ""
                lines.append(f"**{x.get('title')}** — {org} (status: {status}{deadline_str})")
            answer = (
                "Based on the published recruitment records available in CareerGPS from the Government of Goa:\n\n"
                + "\n".join(f"- {line}" for line in lines)
                + "\n\n⚠️ Please verify current status and deadlines directly on the official Goa government recruitment portal (goa.gov.in) before applying, as listings may have changed."
            )
            citations = [_citation(x, "opportunity") for x in items]
        else:
            answer = (
                "CareerGPS tracks published Government of Goa recruitment listings, but I couldn't find matching open records for your query right now.\n\n"
                "I recommend checking:\n"
                "- **goa.gov.in/citizen/recruitment/** — Official Goa government recruitment page\n"
                "- **gssc.goa.gov.in** — Goa Staff Selection Commission\n\n"
                "I will not invent vacancy details, deadlines, or eligibility criteria."
            )
        return {"answer": answer, "citations": citations, "grounded": bool(citations)}

    # ── Career question ────────────────────────────────────────────────────────
    career_keywords = ["career", "job", "profession", "work as", "become a", "what is a", "what does a", "developer", "engineer", "scientist", "analyst", "designer", "programmer", "coder"]
    if careers and any(word in q_lower for word in career_keywords):
        # If asking about a specific career, show that one with detail
        matched = [c for c in careers if c.get("title") and c["title"].lower() in q_lower]
        items = matched[:3] if matched else careers[:5]
        lines = []
        for c in items:
            desc = (c.get("description") or "")[:200]
            desc_str = f" — {desc}" if desc else ""
            lines.append(f"**{c.get('title')}**{desc_str}")
        if resolved_topic and not matched:
            answer = f"Continuing from our discussion about {resolved_topic}:\n\n" + "Based on the CareerGPS career catalogue:\n" + "\n".join(f"- {line}" for line in lines)
        else:
            answer = "Based on the published CareerGPS career catalogue:\n\n" + "\n".join(f"- {line}" for line in lines)
        citations = [_citation(c, "career") for c in items]
        return {"answer": answer, "citations": citations, "grounded": True}

    # ── Skills question ────────────────────────────────────────────────────────
    if any(word in q_lower for word in ["skill", "learn", "what should i", "how do i get", "what do i need", "required for", "needed for", "technology", "tech stack", "tools"]):
        if careers:
            items = careers[:4]
            lines = []
            for c in items:
                qual = c.get("qualifications") or c.get("entry_routes") or ""
                qual_str = f" (Entry: {str(qual)[:120]})" if qual else ""
                lines.append(f"**{c.get('title')}**{qual_str}")
            topic_prefix = f"For a career as a {resolved_topic}:" if resolved_topic else "Based on the published career records:"
            answer = (
                f"{topic_prefix}\n\n"
                + "\n".join(f"- {line}" for line in lines)
                + "\n\nYou can also explore the Careers and Skills sections of CareerGPS for more detail on each role."
            )
            citations = [_citation(c, "career") for c in items]
        elif courses:
            items = courses[:5]
            lines = [f"**{x.get('title')}** — {x.get('location') or 'Goa'}" for x in items]
            answer = "Based on published course records in CareerGPS:\n\n" + "\n".join(f"- {line}" for line in lines)
            citations = [_citation(x, "course") for x in items]
        else:
            answer = "I don't have enough published skill or course data matching your question. Try browsing the Careers or Courses sections of CareerGPS for details on required skills."
        return {"answer": answer, "citations": citations, "grounded": bool(citations)}

    # ── Pathway / steps / how to become ───────────────────────────────────────
    if any(word in q_lower for word in ["pathway", "path", "route", "steps", "become", "how to become", "roadmap", "progression", "career path"]):
        if pathways:
            items = pathways[:5]
            lines = [f"**{x.get('title')}** (for {x.get('career_title') or 'career'})" for x in items]
            answer = "Based on published pathway templates in CareerGPS:\n\n" + "\n".join(f"- {line}" for line in lines) + "\n\nOpen any pathway in CareerGPS to see the detailed step-by-step progression."
            citations = [_citation(x, "pathway") for x in items]
        else:
            answer = "I couldn't find pathway templates matching your query. Try visiting the Pathways section of CareerGPS to browse all available career routes."
        return {"answer": answer, "citations": citations, "grounded": bool(citations)}

    # ── Course / study / training / institution ────────────────────────────────
    if any(word in q_lower for word in ["course", "study", "college", "institution", "diploma", "degree", "training", "certification", "education", "where can i"]):
        if courses:
            items = courses[:5]
            lines = [f"**{x.get('title')}** — {x.get('location') or 'Goa'}" for x in items]
            answer = "Based on published course and institution records in CareerGPS:\n\n" + "\n".join(f"- {line}" for line in lines)
            citations = [_citation(x, "course") for x in items]
        else:
            answer = "I couldn't find course records matching your query. Try the Courses section of CareerGPS to browse all available programmes."
        return {"answer": answer, "citations": citations, "grounded": bool(citations)}

    # ── Profile / user goal ────────────────────────────────────────────────────
    if any(word in q_lower for word in ["my goal", "my career", "my profile", "my education", "my skills", "what should i do", "suggest for me", "recommend"]):
        if profile:
            goal = profile.get("career_goal")
            interests = profile.get("interests") or []
            edu = profile.get("education") or []
            edu_str = edu[0].get("qualification", "") if edu else ""
            parts = []
            if goal:
                parts.append(f"Your stated career goal is: **{goal}**")
            if edu_str:
                parts.append(f"Your education: {edu_str}")
            if interests:
                parts.append(f"Your interests: {', '.join(interests)}")
            if careers:
                parts.append("Relevant careers from the CareerGPS catalogue: " + ", ".join(c.get("title", "") for c in careers[:5]))
            answer = "\n".join(f"- {p}" for p in parts) if parts else "I don't have enough profile information to give personalised recommendations. Please complete your profile in CareerGPS."
        else:
            answer = "I couldn't retrieve your profile. Please make sure you're logged in and have completed your CareerGPS profile."
        return {"answer": answer, "citations": citations, "grounded": bool(profile)}

    # ── General fallback with available context ────────────────────────────────
    if careers:
        items = careers[:6]
        career_list = ", ".join(c.get("title") for c in items if c.get("title"))
        answer = (
            f"I'm CareerGPS, your Goa career guidance assistant. Based on your question, here are some published careers in our database that may be relevant: {career_list}.\n\n"
            f"Ask me about specific careers, government job openings, available courses, or how to reach your career goal — I'll use the verified CareerGPS data to help."
        )
        citations = [_citation(c, "career") for c in items]
        return {"answer": answer, "citations": citations, "grounded": True}

    return {
        "answer": (
            "I'm CareerGPS, your career guidance assistant for Goa. I can help with:\n"
            "- Career exploration (Backend Developer, Data Scientist, AI Engineer, etc.)\n"
            "- Government job recruitment listings\n"
            "- Courses and diploma programmes from Goa institutions\n"
            "- Step-by-step career pathways\n\n"
            "I don't have enough published data to specifically answer that question. "
            "I will not invent qualifications, deadlines, or vacancies."
        ),
        "citations": [],
        "grounded": False
    }

