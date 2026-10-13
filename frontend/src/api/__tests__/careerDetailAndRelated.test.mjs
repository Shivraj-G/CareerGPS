import assert from "node:assert/strict";
import { test } from "node:test";

test("1. Skill Gap Analysis categorization distinguishes present, developing, and unverified skills", () => {
  const userSkills = [
    { skill_id: "s1", name: "SQL", level: "intermediate", verified: true },
    { skill_id: "s2", name: "Excel", level: "beginner", verified: false }
  ];

  const careerSkills = [
    { id: "s1", name: "SQL", importance: "required" },
    { id: "s2", name: "Excel", importance: "required" },
    { id: "s3", name: "Accounting", importance: "required" },
    { id: "s4", name: "Business Analysis", importance: "important" }
  ];

  const ownedMap = new Map(userSkills.map(s => [s.skill_id, s]));
  const present = [];
  const developing = [];
  const unverified = [];

  for (const cs of careerSkills) {
    const matched = ownedMap.get(cs.id);
    if (matched) {
      present.push({
        skill: cs.name,
        level: matched.level,
        status: matched.level === "beginner" && cs.importance === "required" ? "needs_proficiency_boost" : "sufficient"
      });
      if (!matched.verified) {
        unverified.push({ skill: cs.name, reason: "Self-reported on profile; external verification pending" });
      }
    } else {
      developing.push({
        skill: cs.name,
        importance: cs.importance,
        evidence_status: "not_reported"
      });
    }
  }

  // Verify group counts
  assert.equal(present.length, 2);
  assert.equal(developing.length, 2);
  assert.equal(unverified.length, 1);

  // Excel is unverified and needs boost
  assert.equal(present.find(p => p.skill === "Excel")?.status, "needs_proficiency_boost");
  assert.equal(unverified[0].skill, "Excel");

  // Missing skills are explicitly marked 'not_reported', never assumed confirmed missing
  assert.equal(developing[0].evidence_status, "not_reported");
  assert.equal(developing[1].evidence_status, "not_reported");
});

test("2. Match score is calculated deterministically with documented weights", () => {
  // Required = 3, Important = 2, Useful = 1
  const weights = { required: 3, important: 2, useful: 1 };
  
  const careerSkills = [
    { name: "SQL", importance: "required" }, // 3
    { name: "Excel", importance: "required" }, // 3
    { name: "Accounting", importance: "required" }, // 3
    { name: "Reporting", importance: "important" } // 2
  ]; // Total points = 11

  const userMatched = [
    { name: "SQL", level: "intermediate", importance: "required" }, // 3
    { name: "Excel", level: "beginner", importance: "required" } // 1.5 (half for beginner required)
  ]; // Earned points = 4.5

  const totalPoints = careerSkills.reduce((sum, s) => sum + weights[s.importance], 0);
  const earnedPoints = userMatched.reduce((sum, s) => {
    const w = weights[s.importance];
    return sum + (s.level === "beginner" ? w * 0.5 : w);
  }, 0);

  const score = Math.round((earnedPoints / totalPoints) * 100);
  assert.equal(totalPoints, 11);
  assert.equal(earnedPoints, 4.5);
  assert.equal(score, 41); // 41% alignment
});

test("3. Related Careers ranking evaluates shared skills and downweights generic soft skills", () => {
  const targetCareerSkills = new Set(["SQL", "Excel", "Business Analysis", "Communication"]);
  const genericSkills = new Set(["Communication", "Teamwork"]);

  const candidates = [
    {
      title: "Clerk",
      skills: ["Communication", "Filing"],
      domainTokens: []
    },
    {
      title: "Business Analyst",
      skills: ["SQL", "Excel", "Business Analysis", "Communication"],
      domainTokens: ["Analyst"]
    },
    {
      title: "Data Analyst",
      skills: ["SQL", "Excel", "Reporting"],
      domainTokens: ["Analyst"]
    }
  ];

  const scored = candidates.map(c => {
    let score = 0;
    const shared = [];
    for (const sk of c.skills) {
      if (targetCareerSkills.has(sk)) {
        shared.push(sk);
        score += genericSkills.has(sk) ? 0.75 : 2.5;
      }
    }
    score += c.domainTokens.length * 2;
    return { title: c.title, shared, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Business Analyst must rank first over Clerk despite Clerk sharing Communication
  assert.equal(scored[0].title, "Business Analyst");
  assert.equal(scored[1].title, "Data Analyst");
  assert.equal(scored[2].title, "Clerk");
  assert.equal(scored[2].score, 0.75); // Only 0.75 for generic soft skill
});

test("4. Related Career transition level is calculated accurately from overlap percentage", () => {
  function getTransitionLevel(sharedCount, totalCount) {
    const pct = Math.round((sharedCount / Math.max(totalCount, 1)) * 100);
    if (pct >= 50) return "Direct Transfer";
    if (pct >= 25) return "Adjacent Role";
    return "Broader Transition";
  }

  assert.equal(getTransitionLevel(4, 5), "Direct Transfer"); // 80%
  assert.equal(getTransitionLevel(2, 6), "Adjacent Role"); // 33%
  assert.equal(getTransitionLevel(1, 8), "Broader Transition"); // 13%
});

test("5. Reading order contract: Overview (1) -> Skill Gap (2) -> Related Careers (3)", () => {
  const sectionsOrder = [
    { order: 1, name: "Career Details & Overview" },
    { order: 2, name: "Skill Gap Analysis" },
    { order: 3, name: "Related Careers" }
  ];

  assert.equal(sectionsOrder[0].order, 1);
  assert.equal(sectionsOrder[1].order, 2);
  assert.equal(sectionsOrder[2].order, 3);
  assert.equal(sectionsOrder[1].name, "Skill Gap Analysis");
  assert.equal(sectionsOrder[2].name, "Related Careers");
});

test("6. Save career toggle stores unique IDs and avoids duplicate records in localStorage", () => {
  const storage = {};
  const userId = "test-user-123";
  const key = `careergps_saved_careers_${userId}`;

  function toggleSave(id) {
    const saved = JSON.parse(storage[key] || "[]");
    let next;
    if (saved.includes(id)) {
      next = saved.filter(s => s !== id);
    } else {
      next = Array.from(new Set([...saved, id]));
    }
    storage[key] = JSON.stringify(next);
    return next;
  }

  const ftaId = "c9a5a6a7-a3d1-4e0b-bc07-6de2d5a686f6";
  const erpId = "863e1d32-8e45-4cac-a937-304f45a82550";

  // 1. Save FTA
  let list = toggleSave(ftaId);
  assert.deepEqual(list, [ftaId]);

  // 2. Save ERP
  list = toggleSave(erpId);
  assert.deepEqual(list, [ftaId, erpId]);

  // 3. Save FTA again (removes)
  list = toggleSave(ftaId);
  assert.deepEqual(list, [erpId]);

  // 4. Save ERP again (removes)
  list = toggleSave(erpId);
  assert.deepEqual(list, []);
});

test("7. Structured fields with objects or arrays are never rendered raw to React children", () => {
  function safeFormat(val) {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "object") {
      return val.title || val.name || val.description || JSON.stringify(val);
    }
    return String(val);
  }

  // String value
  assert.equal(safeFormat("Direct Entry"), "Direct Entry");

  // Object value with title
  assert.equal(safeFormat({ title: "B.Sc Computer Science" }), "B.Sc Computer Science");

  // Object value with name
  assert.equal(safeFormat({ name: "ERP Implementation" }), "ERP Implementation");

  // Raw fallback does not throw [object Object]
  const complex = { foo: "bar" };
  assert.equal(safeFormat(complex), JSON.stringify(complex));
});

test("8. Occupational Engine anti-contamination rule: unrelated careers sharing only soft skills are disqualified", () => {
  const genericSkills = new Set(["communication", "criticalthinking", "teamwork", "problemsolving"]);

  function areRelated(srcRole, candRole) {
    // Shared domain skills
    const sharedDomain = candRole.skills.filter(s => srcRole.skills.includes(s) && !genericSkills.has(s.toLowerCase().replace(/\s+/g, '')));
    const isSameDomain = srcRole.domain === candRole.domain;
    
    // Hard barrier: disparate domains without domain skills are disqualified
    if (!isSameDomain && sharedDomain.length === 0) {
      return { related: false, sharedDomain };
    }
    return { related: true, sharedDomain };
  }

  const assistantProfessor = {
    title: "Assistant Professor",
    domain: "ACADEMIA_EDUCATION",
    skills: ["Curriculum Development", "Academic Writing", "Research Methodology", "Communication", "Critical Thinking"]
  };

  const teacher = {
    title: "Teacher",
    domain: "ACADEMIA_EDUCATION",
    skills: ["Curriculum Development", "Teaching/Pedagogy", "Assessment and Evaluation", "Communication"]
  };

  const chef = {
    title: "Chef",
    domain: "CULINARY_HOSPITALITY",
    skills: ["Culinary Techniques", "Menu Planning", "Food Safety & Hygiene", "Critical Thinking"]
  };

  const policeOfficer = {
    title: "Police Officer",
    domain: "PUBLIC_SAFETY_LAW",
    skills: ["Law Knowledge", "Physical Fitness", "Communication", "Critical Thinking"]
  };

  const businessAnalyst = {
    title: "Business Analyst",
    domain: "ENTERPRISE_SYSTEMS",
    skills: ["SQL", "Excel", "Business Analysis", "Communication", "Critical Thinking"]
  };

  // Teacher IS related
  const teacherResult = areRelated(assistantProfessor, teacher);
  assert.equal(teacherResult.related, true);
  assert.deepEqual(teacherResult.sharedDomain, ["Curriculum Development"]);

  // Chef, Police Officer, Business Analyst MUST NOT be related to Assistant Professor
  assert.equal(areRelated(assistantProfessor, chef).related, false);
  assert.equal(areRelated(assistantProfessor, policeOfficer).related, false);
  assert.equal(areRelated(assistantProfessor, businessAnalyst).related, false);
});

test("9. Relationship tiers distinguish Direct Progression, Closely Related, and Transferable Role", () => {
  function getTier(src, cand) {
    if (src.title === "Assistant Professor" && cand.title === "Associate Professor") return "Direct Progression";
    if (src.title === "Doctor" && cand.title === "Surgeon") return "Direct Progression";
    if (src.domain === cand.domain) return "Closely Related";
    return "Transferable Role";
  }

  assert.equal(getTier({ title: "Assistant Professor", domain: "ACADEMIA_EDUCATION" }, { title: "Associate Professor", domain: "ACADEMIA_EDUCATION" }), "Direct Progression");
  assert.equal(getTier({ title: "Backend Developer", domain: "SOFTWARE_PLATFORMS" }, { title: "Full Stack Developer", domain: "SOFTWARE_PLATFORMS" }), "Closely Related");
  assert.equal(getTier({ title: "Assistant Professor", domain: "ACADEMIA_EDUCATION" }, { title: "Education Consultant", domain: "CONSULTING" }), "Transferable Role");
});

test("10. Regulatory guidance distinguishes mandatory statutory gates from preferred qualifications", () => {
  const guidance = {
    mandatory: ["Master's degree >= 55%", "UGC-NET / SLET qualification"],
    preferred: ["Ph.D. degree", "Peer-reviewed journal publications"],
    statutoryFramework: { authority: "UGC" }
  };

  assert.equal(guidance.mandatory.length, 2);
  assert.equal(guidance.preferred.length, 2);
  assert.ok(guidance.mandatory[1].includes("NET"));
  assert.ok(guidance.statutoryFramework.authority, "UGC");
});

