export function evaluateCourseEligibility(course, profile) {
  const education = Array.isArray(profile.education) ? profile.education : [];
  
  const bachelors = education.find(e => e.level === 'Undergraduate' || (e.education_stage === 'HIGHER_EDUCATION' && e.degree && !e.level));
  const masters = education.find(e => e.level === 'Postgraduate');
  const school12 = education.find(e => e.education_stage === 'SCHOOL_12' || e.level === '12th / Higher Secondary' || e.level === '12th');

  const courseTitle = course.title?.toUpperCase() || "";
  
  const result = {
    outcome: "Unable to Determine",
    reason: "Deterministic eligibility rules for this course are not fully mapped yet.",
    matched_requirements: [],
    unmet_requirements: [],
    missing_information: [],
    entrance_exam: null,
    rule_source: "AI_INFERRED_RULES",
    is_verified: false
  };

  const hasMarks = (edu) => {
    return edu && edu.marks !== undefined && edu.marks !== null && edu.marks !== '';
  };
  const getMarks = (edu) => {
    if (!edu) return 0;
    return parseFloat(edu.marks) || 0;
  };

  // M.Sc Mathematics Rules
  if (courseTitle.includes("M.SC MATHEMATICS")) {
    result.rule_source = "UNIVERSITY_ADMISSION_GUIDELINES_2024";
    result.is_verified = true;
    
    if (!bachelors) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing bachelor's qualification.";
      result.missing_information.push("Bachelor's degree details");
      return result;
    }

    const bDegree = bachelors.degree?.toUpperCase() || "";
    if (bDegree.includes("B.SC MATH") || bDegree.includes("B.SC (MATH")) {
      result.matched_requirements.push("B.Sc Mathematics degree");
      
      if (!hasMarks(bachelors)) {
        result.outcome = "Conditionally Eligible";
        result.reason = "Eligible subject to meeting minimum marks criteria (usually 50%).";
        result.missing_information.push("Bachelor's graduation marks/CGPA");
        return result;
      }
      
      const marks = getMarks(bachelors);
      if (marks >= 50) {
        result.outcome = "Eligible";
        result.reason = "B.Sc Mathematics with >=50% satisfies M.Sc Mathematics eligibility.";
        result.matched_requirements.push("Minimum 50% aggregate marks");
      } else {
        result.outcome = "Not Eligible under verified rules";
        result.reason = "Aggregate marks below the required 50% threshold.";
        result.unmet_requirements.push("Minimum 50% aggregate marks (Provided: " + marks + "%)");
      }
      return result;
    }
    
    result.outcome = "Not Eligible under verified rules";
    result.reason = "M.Sc Mathematics requires a relevant B.Sc Mathematics degree.";
    result.unmet_requirements.push("B.Sc Mathematics or equivalent degree");
    return result;
  }
  
  // MBA Rules
  if (courseTitle === "MBA" || courseTitle.includes("MASTER OF BUSINESS ADMINISTRATION")) {
    result.rule_source = "AICTE_MBA_GUIDELINES_2024";
    result.is_verified = true;
    result.entrance_exam = "CAT/MAT/XAT/CMAT/State CET";
    
    if (!bachelors) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing bachelor's qualification.";
      result.missing_information.push("Bachelor's degree details");
      return result;
    }

    result.matched_requirements.push("Bachelor's Degree (Any Discipline)");
    
    if (!hasMarks(bachelors)) {
      result.outcome = "Conditionally Eligible";
      result.reason = "Eligible subject to meeting minimum marks criteria (usually 50% for general, 45% for reserved) and valid entrance score.";
      result.missing_information.push("Bachelor's graduation marks/CGPA", "Entrance exam score");
      return result;
    }
    
    const marks = getMarks(bachelors);
    if (marks >= 50) {
      result.outcome = "Conditionally Eligible";
      result.reason = "Academic eligibility met (>=50%). Final admission requires a valid entrance exam score (CAT/MAT/CET etc.).";
      result.matched_requirements.push("Minimum 50% aggregate marks");
      result.missing_information.push("Valid entrance exam score");
    } else {
      result.outcome = "Not Eligible under verified rules";
      result.reason = "Aggregate marks below the required 50% threshold for general category.";
      result.unmet_requirements.push("Minimum 50% aggregate marks (Provided: " + marks + "%)");
    }
    return result;
  }

  // M.Com Rules
  if (courseTitle.includes("M.COM") || courseTitle === "M.COM") {
    result.rule_source = "UNIVERSITY_GRANTS_COMMISSION_MCOM";
    result.is_verified = true;
    if (!bachelors) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing bachelor's qualification.";
      result.missing_information.push("Bachelor's degree details");
      return result;
    }
    const bDegree = bachelors.degree?.toUpperCase() || "";
    if (bDegree.includes("B.COM") || bDegree.includes("BBA") || bDegree.includes("BMS") || bDegree.includes("BBM")) {
      result.outcome = "Eligible";
      result.reason = "B.Com/BBA/BMS satisfies M.Com eligibility.";
      result.matched_requirements.push("Commerce/Management Bachelor's degree");
      return result;
    }
    result.outcome = "Not Eligible under verified rules";
    result.reason = "M.Com requires a commerce or management-related bachelor's degree.";
    result.unmet_requirements.push("B.Com, BBA, BMS or equivalent degree");
    return result;
  }
  
  // M.Tech Rules
  if (courseTitle.includes("M.TECH") || courseTitle === "M.TECH" || courseTitle.includes("M.E.")) {
    result.rule_source = "AICTE_MTECH_GUIDELINES";
    result.is_verified = true;
    result.entrance_exam = "GATE / State PGCET";
    
    if (!bachelors) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing bachelor's qualification.";
      result.missing_information.push("Bachelor's degree details");
      return result;
    }
    const bDegree = bachelors.degree?.toUpperCase() || "";
    if (bDegree.includes("B.TECH") || bDegree.includes("B.E")) {
      result.outcome = "Conditionally Eligible";
      result.reason = "B.Tech/B.E satisfies academic eligibility. Final admission depends on GATE/PGCET score and specific discipline match.";
      result.matched_requirements.push("B.Tech/B.E degree");
      result.missing_information.push("Discipline compatibility check", "GATE/PGCET score");
      return result;
    }
    if (bDegree.includes("BCA") || masters?.degree?.toUpperCase().includes("MCA") || bDegree.includes("B.SC")) {
      result.outcome = "Potentially Eligible / Verify";
      result.reason = "MCA or specific B.Sc (e.g. B.Sc Comp Science) might be eligible depending on the university and specific M.Tech program.";
      result.missing_information.push("University specific MCA/B.Sc acceptance rules for this M.Tech branch");
      return result;
    }
    result.outcome = "Not Eligible under verified rules";
    result.reason = "M.Tech requires a relevant technical bachelor's degree (e.g. B.Tech, B.E, or sometimes MCA/M.Sc).";
    result.unmet_requirements.push("Relevant Technical Degree");
    return result;
  }

  // MCA Rules
  if (courseTitle.includes("MCA") || courseTitle === "MCA") {
    result.rule_source = "AICTE_MCA_GUIDELINES_2020";
    result.is_verified = true;
    result.entrance_exam = "NIMCET / State CET";
    if (!bachelors) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing bachelor's qualification.";
      result.missing_information.push("Bachelor's degree details");
      return result;
    }
    const bDegree = bachelors.degree?.toUpperCase() || "";
    if (bDegree.includes("BCA") || bDegree.includes("B.SC IT") || bDegree.includes("B.SC COMP")) {
      result.outcome = "Conditionally Eligible";
      result.reason = "BCA/B.Sc IT satisfies academic eligibility. Final admission depends on entrance exam.";
      result.matched_requirements.push("BCA/B.Sc IT/Computer Science degree");
      result.missing_information.push("Entrance exam score (NIMCET/CET)");
      return result;
    }
    result.outcome = "Conditionally Eligible";
    result.reason = "Any bachelor's degree is eligible provided you had Mathematics at 12th or graduation level. Bridge course applies.";
    result.matched_requirements.push("Bachelor's Degree");
    result.missing_information.push("Proof of Mathematics at 10+2 or Graduation level", "Entrance exam score");
    return result;
  }

  // B.Tech Rules
  if (courseTitle.includes("B.TECH") || courseTitle.includes("B.E.") || courseTitle === "B.TECH") {
    result.rule_source = "AICTE_BTECH_GUIDELINES";
    result.is_verified = true;
    result.entrance_exam = "JEE Main / State CET";
    if (!school12) {
      result.outcome = "Unable to Determine";
      result.reason = "Missing 12th standard information.";
      result.missing_information.push("12th Standard Details");
      return result;
    }
    const stream = school12.school_12_stream?.toUpperCase() || school12.stream?.toUpperCase() || "";
    if (stream.includes("SCIENCE") && (stream.includes("PCM") || stream.includes("PCMB"))) {
      result.outcome = "Conditionally Eligible";
      result.reason = "12th Science with PCM/PCMB satisfies B.Tech basic eligibility. Admission requires JEE/CET.";
      result.matched_requirements.push("12th Science with PCM");
      result.missing_information.push("Entrance exam score (JEE/CET)", "12th aggregate marks (usually >=45%)");
      return result;
    }
    if (stream.includes("SCIENCE")) {
      result.outcome = "Conditionally Eligible";
      result.reason = "12th Science requires Mathematics and Physics as compulsory subjects for B.Tech.";
      result.matched_requirements.push("12th Science");
      result.missing_information.push("Proof of Mathematics and Physics subjects");
      return result;
    }
    result.outcome = "Not Eligible under verified rules";
    result.reason = "B.Tech requires 12th Science with Physics and Mathematics.";
    result.unmet_requirements.push("12th Science with PCM");
    return result;
  }

  return result;
}
