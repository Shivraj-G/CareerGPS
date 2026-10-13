import crypto from 'crypto';
import { pool } from '../../config/database.js';

/**
 * Generate a clean, URL-safe random share slug.
 */
function generateShareSlug(displayName = '') {
  const cleanName = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  const suffix = crypto.randomBytes(3).toString('hex');
  return cleanName ? `${cleanName}-${suffix}` : `portfolio-${suffix}`;
}

/**
 * Get or initialize a user's portfolio.
 */
export async function getUserPortfolio(userId) {
  // Check if portfolio already exists
  const existingRes = await pool.query(
    `SELECT * FROM user_portfolios WHERE user_id = $1`,
    [userId]
  );

  let portfolio;
  if (existingRes.rows.length > 0) {
    portfolio = existingRes.rows[0];
  } else {
    // Fetch profile and user details for initial defaults
    const userRes = await pool.query(
      `SELECT u.email, p.career_id as current_career_goal_id, p.career_goal, p.current_goal
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [userId]
    );

    const userRow = userRes.rows[0];
    const emailPrefix = userRow?.email ? userRow.email.split('@')[0] : 'Professional';
    const displayName = emailPrefix ? emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1) : 'CareerGPS Professional';
    const careerTitle = userRow?.career_goal || userRow?.current_goal || 'Professional';
    const careerId = userRow?.current_career_goal_id || null;
    const defaultSlug = generateShareSlug(displayName);

    const insertRes = await pool.query(
      `INSERT INTO user_portfolios (
        user_id, display_name, professional_title, bio, target_career_id,
        target_career_title, contact_email, share_slug, is_public,
        social_links, privacy_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        userId,
        displayName,
        `${careerTitle} Specialist`,
        `Portfolio of practical deliverables and verified evidence developed through CareerGPS learning pathways.`,
        careerId,
        careerTitle,
        userRow?.email || null,
        defaultSlug,
        false,
        JSON.stringify({ github: '', linkedin: '', website: '' }),
        JSON.stringify({
          show_email: false,
          show_education: true,
          show_skills: true,
          allow_download: true
        })
      ]
    );

    portfolio = insertRes.rows[0];
  }

  // Fetch all user projects (completed and in-progress) with deliverables
  const projectsRes = await pool.query(
    `SELECT 
      id, career_id, career_title, title, difficulty_level, difficulty_label,
      project_type, brief, problem_statement, learning_objectives,
      COALESCE(skills, skills_exercised, '[]'::jsonb) AS skills, deliverables, acceptance_criteria, status, reflection,
      completed_at, verification_status, created_at, updated_at
     FROM user_projects
     WHERE user_id = $1
     ORDER BY 
       CASE WHEN status = 'completed' THEN 0 WHEN status = 'in_progress' THEN 1 ELSE 2 END,
       updated_at DESC`,
    [userId]
  );

  // Fetch demonstrated skills from user_skills
  const skillsRes = await pool.query(
    `SELECT 
      us.skill_id, s.name as skill_name, s.category,
      us.level as self_rating, us.level, us.verified, us.evidence_type, us.evidence_notes, us.updated_at
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = $1
     ORDER BY us.verified DESC, us.evidence_type DESC, s.name ASC`,
    [userId]
  );

  return {
    portfolio,
    projects: projectsRes.rows,
    demonstrated_skills: skillsRes.rows
  };
}

/**
 * Update user portfolio details, privacy settings, and public status.
 */
export async function updateUserPortfolio(userId, updateData) {
  // Ensure portfolio exists
  await getUserPortfolio(userId);

  const updates = [];
  const values = [];
  let idx = 1;

  if (updateData.display_name !== undefined) {
    updates.push(`display_name = $${idx++}`);
    values.push(updateData.display_name.trim());
  }
  if (updateData.professional_title !== undefined) {
    updates.push(`professional_title = $${idx++}`);
    values.push(updateData.professional_title ? updateData.professional_title.trim() : null);
  }
  if (updateData.bio !== undefined) {
    updates.push(`bio = $${idx++}`);
    values.push(updateData.bio ? updateData.bio.trim() : null);
  }
  if (updateData.target_career_id !== undefined) {
    updates.push(`target_career_id = $${idx++}`);
    values.push(updateData.target_career_id || null);
  }
  if (updateData.target_career_title !== undefined) {
    updates.push(`target_career_title = $${idx++}`);
    values.push(updateData.target_career_title ? updateData.target_career_title.trim() : null);
  }
  if (updateData.contact_email !== undefined) {
    updates.push(`contact_email = $${idx++}`);
    values.push(updateData.contact_email ? updateData.contact_email.trim().toLowerCase() : null);
  }
  if (updateData.social_links !== undefined) {
    updates.push(`social_links = $${idx++}::jsonb`);
    values.push(JSON.stringify(updateData.social_links));
  }
  if (updateData.is_public !== undefined) {
    updates.push(`is_public = $${idx++}`);
    values.push(Boolean(updateData.is_public));
  }
  if (updateData.share_slug !== undefined && updateData.share_slug) {
    const cleanSlug = updateData.share_slug
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    // Check slug collision
    const slugCheck = await pool.query(
      `SELECT id FROM user_portfolios WHERE share_slug = $1 AND user_id != $2`,
      [cleanSlug, userId]
    );
    if (slugCheck.rows.length > 0) {
      throw new Error(`The share link "${cleanSlug}" is already taken. Please choose another.`);
    }

    updates.push(`share_slug = $${idx++}`);
    values.push(cleanSlug);
  }
  if (updateData.privacy_settings !== undefined) {
    updates.push(`privacy_settings = $${idx++}::jsonb`);
    values.push(JSON.stringify(updateData.privacy_settings));
  }

  updates.push(`updated_at = NOW()`);

  values.push(userId);
  const sql = `
    UPDATE user_portfolios
    SET ${updates.join(', ')}
    WHERE user_id = $${idx}
    RETURNING *
  `;

  const result = await pool.query(sql, values);
  return result.rows[0];
}

/**
 * Fetch a sanitized public portfolio by share_slug.
 * Strict user data isolation: no user_id, no auth tokens, no password hashes,
 * no private emails (unless allowed in privacy_settings), only completed projects.
 */
export async function getPublicPortfolioBySlug(shareSlug) {
  if (!shareSlug || typeof shareSlug !== 'string') {
    return null;
  }

  const cleanSlug = shareSlug.trim().toLowerCase();

  const portfolioRes = await pool.query(
    `SELECT 
      id, user_id, display_name, professional_title, bio,
      target_career_title, contact_email, social_links,
      is_public, share_slug, privacy_settings, created_at, updated_at
     FROM user_portfolios
     WHERE share_slug = $1 AND is_public = TRUE`,
    [cleanSlug]
  );

  if (portfolioRes.rows.length === 0) {
    return null;
  }

  const portfolio = portfolioRes.rows[0];
  const privacy = portfolio.privacy_settings || {};

  // Fetch completed projects only
  const projectsRes = await pool.query(
    `SELECT 
      id, career_title, title, difficulty_level, difficulty_label,
      project_type, brief, problem_statement, learning_objectives,
      COALESCE(skills, skills_exercised, '[]'::jsonb) AS skills, deliverables, acceptance_criteria, reflection,
      completed_at, verification_status
     FROM user_projects
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY difficulty_level DESC, completed_at DESC`,
    [portfolio.user_id]
  );

  // Fetch verified/project-supported skills
  const skillsRes = await pool.query(
    `SELECT 
      s.name as skill_name, s.category,
      us.level as self_rating, us.level, us.verified, us.evidence_type
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = $1 AND (us.verified = TRUE OR us.evidence_type = 'project_supported')
     ORDER BY s.category ASC, s.name ASC`,
    [portfolio.user_id]
  );

  // Filter deliverables: strip any private file metadata, keep validated titles & external URLs
  const sanitizedProjects = projectsRes.rows.map(p => {
    const rawDeliverables = Array.isArray(p.deliverables) ? p.deliverables : [];
    const publicDeliverables = rawDeliverables
      .filter(d => d.link_url || d.file_url)
      .map(d => ({
        type: d.type || 'deliverable',
        title: d.title || 'Project Deliverable',
        description: d.description || '',
        url: d.link_url || d.file_url,
        submitted_at: d.submitted_at || null
      }));

    return {
      id: p.id,
      title: p.title,
      career_title: p.career_title,
      difficulty_label: p.difficulty_label,
      difficulty_level: p.difficulty_level,
      project_type: p.project_type,
      brief: p.brief,
      problem_statement: p.problem_statement,
      learning_objectives: p.learning_objectives,
      skills: p.skills,
      deliverables: publicDeliverables,
      acceptance_criteria: p.acceptance_criteria,
      reflection: p.reflection,
      completed_at: p.completed_at,
      verification_status: p.verification_status
    };
  });

  return {
    display_name: portfolio.display_name,
    professional_title: portfolio.professional_title,
    bio: portfolio.bio,
    target_career_title: portfolio.target_career_title,
    contact_email: privacy.show_email ? portfolio.contact_email : null,
    social_links: portfolio.social_links,
    share_slug: portfolio.share_slug,
    privacy_settings: {
      show_skills: Boolean(privacy.show_skills),
      allow_download: Boolean(privacy.allow_download)
    },
    projects: sanitizedProjects,
    demonstrated_skills: privacy.show_skills ? skillsRes.rows : [],
    updated_at: portfolio.updated_at
  };
}
