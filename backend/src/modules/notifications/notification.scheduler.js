import { checkAndGenerateClosingSoonNotifications } from './notification.service.js';
import { logger } from '../../utils/logger.js';

let intervalHandle = null;
let initialTimeoutHandle = null;
let isCheckRunning = false;

/**
 * Execute a single safe, non-overlapping closing-soon check run.
 */
export async function runClosingSoonCheck() {
  if (isCheckRunning) {
    logger.warn('Skipping closing-soon check: previous check run is still active');
    return null;
  }

  isCheckRunning = true;
  try {
    const result = await checkAndGenerateClosingSoonNotifications();
    return result;
  } catch (err) {
    logger.error('Error during scheduled closing-soon check', { error: err.message });
    return { error: err.message };
  } finally {
    isCheckRunning = false;
  }
}

/**
 * Start recurring scheduler for closing-soon notifications.
 * @param {number} intervalMs - Frequency in milliseconds (default: 15 minutes)
 */
export function startNotificationScheduler(intervalMs = 15 * 60 * 1000) {
  if (intervalHandle) {
    logger.info('Notification scheduler is already running');
    return;
  }

  logger.info('Starting notification scheduler', {
    cadenceMs: intervalMs,
    cadenceMinutes: Math.round(intervalMs / 60000)
  });

  // Run an initial check 5 seconds after server startup
  initialTimeoutHandle = setTimeout(() => {
    runClosingSoonCheck().catch((err) => {
      logger.error('Initial notification check failed', { error: err.message });
    });
  }, 5000);
  initialTimeoutHandle.unref();

  // Set recurring interval
  intervalHandle = setInterval(() => {
    runClosingSoonCheck().catch((err) => {
      logger.error('Scheduled notification check failed', { error: err.message });
    });
  }, intervalMs);
  intervalHandle.unref();
}

/**
 * Gracefully stop recurring scheduler.
 */
export function stopNotificationScheduler() {
  if (initialTimeoutHandle) {
    clearTimeout(initialTimeoutHandle);
    initialTimeoutHandle = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info('Notification scheduler stopped');
  }
}
