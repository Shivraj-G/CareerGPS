# Phase 2 seed strategy

The PDF requires an initial career seed dataset, but it does not provide a complete verified dataset in the project specification. Therefore this phase does **not** invent production career, course, institution, or opportunity facts.

When the data owner supplies a verified dataset, import it through versioned seed files. Each factual record should carry the PDF-required source and verification metadata, and records that are only discovered or partially extracted should remain marked for review rather than being treated as verified facts.

Recommended seed order:
1. `sources`
2. `skills`
3. `careers`
4. `career_skills`
5. `career_qualifications`
6. `institutions`
7. `courses`
8. `course_eligibility_rules`
9. `course_careers`
10. `pathways` and `pathway_steps`
11. `opportunities` and `opportunity_requirements`
12. relationship/source-evidence records


## Current foundation seed

`001_foundation_catalogue.sql` is the first executable seed for this repository.

It currently adds:

- official Goa source registry entries for the Government of Goa recruitment page, Goa Staff Selection Commission, and Directorate of Technical Education;
- a controlled skill catalogue using skills explicitly present in the project specification examples;
- six career titles explicitly used in the project specification/demo.

The career and skill records are intentionally marked `needs_review`/`unverified`. The public catalogue APIs only expose `published` records, so this seed does **not** silently publish unverified catalogue information.

Do not add course fees, admission criteria, vacancy counts, deadlines, or detailed career requirements unless they are supported by an appropriate source and reviewed.

Run from `backend/`:

```bash
npm run seed
```

The seed runner executes all `.sql` files in lexical order inside one transaction.

## Complete development dataset

`002_complete_development_dataset.sql` extends the foundation seed into a connected development dataset. It populates every application table in the schema, including:

- users, user_profiles, user_skills
- skills, careers, career_skills, career_qualifications
- institutions, courses, course_eligibility_rules, course_careers
- pathways, pathway_steps, user_pathways, user_pathway_steps
- opportunities, opportunity_requirements, career_opportunities
- sources, source_documents, source_evidence
- ingestion_runs, ingestion_candidates, audit_logs
- saved_items, conversations, conversation_messages
- recommendations, recommendation_feedback, eligibility_checks

The source-backed Goa records remain `needs_review`/`unverified` where the project workflow requires human verification. The development user/recommendation/conversation/progress records are intentionally demo data.

Run the normal migration + seed flow from `backend/`:

```bash
npm run migrate
npm run seed
```

The seed runner applies SQL files in lexical order, so `001_foundation_catalogue.sql` runs before `002_complete_development_dataset.sql`.

Demo accounts created by the complete dataset:

- `user@careergps.local` / `password`
- `reviewer@careergps.local` / `password`
- `admin@careergps.local` / `password`

Do not use these demo credentials in production.

## Final development seed

`002_complete_development_dataset.sql` is the final large development/demo dataset. It is designed to exercise the full relational graph and frontend:

- 6 demo users/profiles
- 50+ skills
- 12 careers
- career-skill and career-qualification relationships
- 8 official Goa DTE institutions
- 31 official DTE diploma course entries
- course eligibility rules
- course-career relationships
- 12 career pathways with 6 ordered steps each
- 20 Government of Goa recruitment listings represented on the recruitment page
- opportunity requirements and career-opportunity relationships
- source documents/evidence
- ingestion runs/candidates
- user skills and pathway progress
- recommendations and feedback
- eligibility checks
- saved items
- conversations/messages
- audit log

The official Goa institution/course records are based on the DTE technical diploma catalogue. Recruitment listing metadata is based on the Government of Goa recruitment page. Detailed post-specific eligibility is deliberately not invented.

This is a development/demo seed. Review workflow should be used before treating source-sensitive data as production-verified.
