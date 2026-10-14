import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.statusCode) 
    ? err.statusCode 
    : (Number.isInteger(err.status) ? err.status : 500);
  const code = err.code ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');
  const correlationId = req.headers['x-request-id'] || req.id || req.requestId || crypto.randomUUID();

  logger.error('Unhandled request error', {
    correlationId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    error: err.message,
    stack: status >= 500 ? err.stack : undefined,
    user: req.user?.id
  });

  const safeServiceMessage = status === 503 && (code === 'AI_SERVICE_UNAVAILABLE' || code === 'AI_SERVICE_TIMEOUT');
  res.status(status).json({
    error: {
      code,
      message: status >= 500 && !safeServiceMessage ? 'An unexpected server error occurred.' : err.message,
      correlation_id: correlationId,
      ...(err.details ? { details: err.details } : {})
    }
  });
}
