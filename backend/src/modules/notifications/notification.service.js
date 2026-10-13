import { pool } from '../../config/database.js';
import { logger } from '../../utils/logger.js';

/**
 * Format a deadline timestamp into a readable date string.
 */
function formatDeadline(date) {
  if (!date) return 'Soon';
  try {
    const d = new Date(date);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(date);
  }
}

/**
 * Human-readable label for opportunity types.
 */
function getOppTypeLabel(type) {
  const map = {
    government: 'Government Recruitment',
    job: 'Job Opportunity',
    internship: 'Internship',
    scholarship: 'Scholarship',
    scheme: 'Scheme',
    training: 'Training Programme'
  };
  return map[type] || 'Opportunity';
}

/**
 * Helper to test if an opportunity matches a user's profile relevance criteria.
 *
 * Rules:
 * - Location: Goa/state opportunities match Goa-seeking or unspecified users (portal default).
 *   Remote opportunities match remote-seeking users.
 * - Interests/Goal: If user has defined interests or a goal, match title/org/type.
 *   If user has no specified interests/goal, match all published opportunities in their area.
 *   Broad categories (government recruitment, scholarships, schemes) are always relevant to active users.
 */
export function isOpportunityRelevantToUser(opp, profile = {}) {
  const preferredLocations = Array.isArray(profile.preferred_locations) ? profile.preferred_locations : [];
  const interests = Array.isArray(profile.interests) ? profile.interests : [];
  const careerGoal = typeof profile.career_goal === 'string' ? profile.career_goal : '';
  const currentGoalTitle = profile.current_goal && typeof profile.current_goal.title === 'string' 
    ? profile.current_goal.title 
    : '';

  const oppLocation = (opp.location || '').toLowerCase();
  const isGoaOpp = oppLocation.includes('goa') || 
                   oppLocation.includes('panaji') || 
                   oppLocation.includes('margao') || 
                   oppLocation.includes('vasco') || 
                   oppLocation.includes('mapusa') || 
                   oppLocation.includes('ponda') ||
                   oppLocation === ''; // Unspecified defaults to Goa

  const isRemoteOpp = oppLocation.includes('remote') || oppLocation.includes('anywhere');

  // Location filter check
  if (preferredLocations.length > 0) {
    const wantsGoa = preferredLocations.some(loc => String(loc).toLowerCase().includes('goa'));
    const wantsRemote = preferredLocations.some(loc => String(loc).toLowerCase().includes('remote'));

    if (wantsRemote && isRemoteOpp) {
      // Remote match
    } else if (wantsGoa && isGoaOpp) {
      // Goa match
    } else if (!isGoaOpp && !isRemoteOpp) {
      // Specified other locations
      const matchesSpecificLoc = preferredLocations.some(loc => oppLocation.includes(String(loc).toLowerCase()));
      if (!matchesSpecificLoc) return false;
    }
  }

  // If user has specific interests or career goals, check keyword relevance
  const userKeywords = [
    ...interests,
    careerGoal,
    currentGoalTitle
  ]
    .filter(Boolean)
    .map(k => String(k).toLowerCase().trim())
    .filter(k => k.length > 2);

  // If user has defined keywords, check if this opportunity matches
  if (userKeywords.length > 0) {
    const oppText = `${opp.title || ''} ${opp.organization || ''} ${opp.opportunity_type || ''} ${opp.description || ''}`.toLowerCase();
    const hasKeywordMatch = userKeywords.some(keyword => oppText.includes(keyword));

    if (hasKeywordMatch) return true;

    // High-impact categories (government jobs, scholarships, official schemes) are relevant state-wide
    const broadCategories = ['government', 'scholarship', 'scheme', 'training'];
    if (broadCategories.includes(opp.opportunity_type)) {
      return true;
    }

    // Default to true if Goa opportunity and user is in Goa (NaviGoa Goa-first principle)
    return isGoaOpp;
  }

  // User has not set specific interests: match all open local opportunities
  return true;
}

/**
 * Fetch paginated notifications for a specific user.
 */
export async function getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
  const p = Math.max(1, parseInt(page, 10) || 1);
  const l = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (p - 1) * l;

  const countResult = await pool.query(
    `SELECT 
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE read_at IS NULL)::int AS unread_count
     FROM user_notifications
     WHERE user_id = $1 ${unreadOnly ? 'AND read_at IS NULL' : ''}`,
    [userId]
  );

  const total = countResult.rows[0]?.total || 0;
  const unreadCount = countResult.rows[0]?.unread_count || 0;
  const totalPages = Math.ceil(total / l) || 1;

  const itemsResult = await pool.query(
    `SELECT 
       n.id, n.opportunity_id, n.type, n.urgency, n.title, n.message, n.action_url,
       n.metadata, n.read_at, n.created_at, n.updated_at,
       o.title AS opportunity_title, o.organization, o.location, 
       o.application_deadline, o.status AS opportunity_status, o.opportunity_type
     FROM user_notifications n
     LEFT JOIN opportunities o ON o.id = n.opportunity_id
     WHERE n.user_id = $1 ${unreadOnly ? 'AND n.read_at IS NULL' : ''}
     ORDER BY n.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, l, offset]
  );

  return {
    notifications: itemsResult.rows,
    pagination: {
      page: p,
      limit: l,
      total,
      total_pages: totalPages,
      unread_count: unreadCount
    }
  };
}

/**
 * Quick unread notification count for authenticated header bell.
 */
export async function getUnreadCount(userId) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS unread_count
     FROM user_notifications
     WHERE user_id = $1 AND read_at IS NULL`,
    [userId]
  );
  return result.rows[0]?.unread_count || 0;
}

/**
 * Mark a single notification as read, enforcing user ownership.
 */
export async function markAsRead(userId, notificationId) {
  const result = await pool.query(
    `UPDATE user_notifications
     SET read_at = COALESCE(read_at, NOW()), updated_at = NOW()
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [notificationId, userId]
  );
  return result.rows[0] || null;
}

/**
 * Mark all unread notifications as read for a user.
 */
export async function markAllAsRead(userId) {
  const result = await pool.query(
    `UPDATE user_notifications
     SET read_at = NOW(), updated_at = NOW()
     WHERE user_id = $1 AND read_at IS NULL
     RETURNING id`,
    [userId]
  );
  return { marked_read_count: result.rowCount };
}

/**
 * Create notifications for a newly published opportunity (Notification Type A).
 * Safely idempotent per user per opportunity via unique idempotency_key.
 */
export async function createOpportunityNotifications(opportunity) {
  if (!opportunity || !opportunity.id) return { notified_count: 0 };

  // Only published active opportunities generate new notifications
  if (opportunity.record_status !== 'published') return { notified_count: 0 };
  if (opportunity.status === 'closed' || opportunity.status === 'cancelled') return { notified_count: 0 };

  try {
    // Fetch all active users with their profile data
    const usersRes = await pool.query(
      `SELECT u.id AS user_id, 
              p.preferred_locations, p.interests, p.career_goal, p.current_goal
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.account_status = 'active'`
    );

    const activeUsers = usersRes.rows;
    if (activeUsers.length === 0) return { notified_count: 0 };

    const typeLabel = getOppTypeLabel(opportunity.opportunity_type);
    const deadlineStr = opportunity.application_deadline ? ` Deadline: ${formatDeadline(opportunity.application_deadline)}.` : '';
    const locationStr = opportunity.location ? ` in ${opportunity.location}` : '';

    const title = `New ${typeLabel}: ${opportunity.title}`;
    const message = `${opportunity.organization || 'NaviGoa'}${locationStr} is now accepting applications.${deadlineStr}`;
    const actionUrl = `/opportunities/${opportunity.id}`;
    const idempotencyKey = `new_opp_${opportunity.id}`;
    const metadata = {
      organization: opportunity.organization,
      location: opportunity.location,
      deadline: opportunity.application_deadline,
      opportunity_type: opportunity.opportunity_type
    };

    let notifiedCount = 0;
    for (const user of activeUsers) {
      if (!isOpportunityRelevantToUser(opportunity, user)) continue;

      let insertRes;
      try {
        insertRes = await pool.query(
          `INSERT INTO user_notifications 
             (user_id, opportunity_id, type, urgency, title, message, action_url, idempotency_key, metadata)
           SELECT $1, o.id, 'new_opportunity', 'normal', $3, $4, $5, $6, $7::jsonb
           FROM opportunities o
           WHERE o.id = $2
           ON CONFLICT (user_id, idempotency_key) DO NOTHING
           RETURNING id`,
          [user.user_id, opportunity.id, title, message, actionUrl, idempotencyKey, JSON.stringify(metadata)]
        );
      } catch (err) {
        // A concurrent deduplication/delete can invalidate the snapshot between
        // the SELECT and FK check. The opportunity is no longer notify-able.
        if (err.code === '23503') continue;
        throw err;
      }

      if (insertRes.rowCount > 0) {
        notifiedCount++;
      }
    }

    logger.info('Created new opportunity notifications', {
      opportunity_id: opportunity.id,
      notified_count: notifiedCount,
      total_active_users: activeUsers.length
    });

    return { notified_count: notifiedCount, total_active_users: activeUsers.length };
  } catch (err) {
    logger.error('Error creating new opportunity notifications', {
      opportunity_id: opportunity.id,
      error: err.message
    });
    return { notified_count: 0, error: err.message };
  }
}

/**
 * Check and generate Closing Soon notifications (Notification Type B).
 * Urgency stages: '7_days', '3_days', '24_hours'.
 * Idempotency key per stage: closing_${opportunity.id}_${stage}.
 */
export async function checkAndGenerateClosingSoonNotifications() {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    // Query published open opportunities with valid deadlines within the 7-day window
    const oppsRes = await pool.query(
      `SELECT id, title, organization, opportunity_type, location, application_deadline, status
       FROM opportunities
       WHERE record_status = 'published'
         AND status NOT IN ('closed', 'cancelled')
         AND application_deadline IS NOT NULL
         AND application_deadline > NOW()
         AND application_deadline <= $1
       ORDER BY application_deadline ASC
       LIMIT 100`,
      [sevenDaysFromNow.toISOString()]
    );

    const expiringOpps = oppsRes.rows;
    if (expiringOpps.length === 0) {
      return { processed_opportunities: 0, generated_notifications: 0 };
    }

    // Fetch all active users and their profiles
    const usersRes = await pool.query(
      `SELECT u.id AS user_id, 
              p.preferred_locations, p.interests, p.career_goal, p.current_goal
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.account_status = 'active'`
    );
    const activeUsers = usersRes.rows;

    let generatedCount = 0;

    for (const opp of expiringOpps) {
      const deadline = new Date(opp.application_deadline);
      const msRemaining = deadline.getTime() - now.getTime();
      if (msRemaining <= 0) continue; // Already passed

      const hoursRemaining = msRemaining / (1000 * 60 * 60);

      // Determine urgency stage
      let urgencyStage;
      let stageLabel;
      let title;

      if (hoursRemaining <= 24) {
        urgencyStage = '24_hours';
        stageLabel = 'under 24 hours';
        title = `Deadline Alert: ${opp.title} closes in 24 hours!`;
      } else if (hoursRemaining <= 72) {
        urgencyStage = '3_days';
        stageLabel = '3 days';
        title = `Closing Soon: ${opp.title} (3 days left)`;
      } else {
        urgencyStage = '7_days';
        stageLabel = '7 days';
        title = `Upcoming Deadline: ${opp.title} closes in 7 days`;
      }

      const formattedDate = formatDeadline(opp.application_deadline);
      const message = `Application deadline for ${opp.organization} is ${formattedDate} (${stageLabel} remaining). Submit your application before it closes.`;
      const actionUrl = `/opportunities/${opp.id}`;
      const idempotencyKey = `closing_${opp.id}_${urgencyStage}`;
      const metadata = {
        deadline: opp.application_deadline,
        urgency_stage: urgencyStage,
        organization: opp.organization,
        location: opp.location
      };

      for (const user of activeUsers) {
        if (!isOpportunityRelevantToUser(opp, user)) continue;

        let insertRes;
        try {
          insertRes = await pool.query(
            `INSERT INTO user_notifications
               (user_id, opportunity_id, type, urgency, title, message, action_url, idempotency_key, metadata)
             SELECT $1, o.id, 'closing_soon', $3, $4, $5, $6, $7, $8::jsonb
             FROM opportunities o
             WHERE o.id = $2
             ON CONFLICT (user_id, idempotency_key) DO NOTHING
             RETURNING id`,
            [user.user_id, opp.id, urgencyStage, title, message, actionUrl, idempotencyKey, JSON.stringify(metadata)]
          );
        } catch (err) {
          if (err.code === '23503') continue;
          throw err;
        }

        if (insertRes.rowCount > 0) {
          generatedCount++;
        }
      }
    }

    logger.info('Closing-soon check completed', {
      processed_opportunities: expiringOpps.length,
      generated_notifications: generatedCount
    });

    return {
      processed_opportunities: expiringOpps.length,
      generated_notifications: generatedCount
    };
  } catch (err) {
    logger.error('Error running closing-soon check', { error: err.message });
    return { error: err.message, processed_opportunities: 0, generated_notifications: 0 };
  }
}
