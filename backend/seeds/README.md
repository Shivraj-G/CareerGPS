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
