import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import {
  getUserNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  checkAndGenerateClosingSoonNotifications
} from './notification.service.js';

const router = Router();
router.use(authenticate);

/**
 * GET /api/v1/notifications
 * Query params: page, limit, unread_only (boolean)
 */
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const unreadOnly = req.query.unread_only === 'true' || req.query.unread === 'true';

    const result = await getUserNotifications(req.user.id, { page, limit, unreadOnly });
    res.json({
      data: result.notifications,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/notifications/unread-count
 * Quick counter for notification badge.
 */
router.get('/unread-count', async (req, res, next) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({
      data: {
        unread_count: count
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/v1/notifications/:id/read
 * Marks a single notification as read (with authenticated user ownership check).
 */
router.patch('/:id/read', async (req, res, next) => {
  try {
    const updated = await markAsRead(req.user.id, req.params.id);
    if (!updated) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Notification not found or access denied.'
        }
      });
    }
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/notifications/mark-all-read (and /read-all)
 * Marks all notifications for the current authenticated user as read.
 */
const markAllHandler = async (req, res, next) => {
  try {
    const result = await markAllAsRead(req.user.id);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
};

router.post('/mark-all-read', markAllHandler);
router.post('/read-all', markAllHandler);

/**
 * POST /api/v1/notifications/check-closing-soon
 * Triggers an immediate closing soon check for testing or on-demand worker runs.
 */
router.post('/check-closing-soon', async (req, res, next) => {
  try {
    const result = await checkAndGenerateClosingSoonNotifications();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
