import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, _next) {
  const status = Number.isInteger(err.statusCode) ? err.statusCode : 500;
  const code = err.code ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'REQUEST_ERROR');

  logger.error('Unhandled request error', {
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    error: err.message
  });

  res.status(status).json({
    error: {
      code,
      message: status >= 500 ? 'An unexpected server error occurred.' : err.message,
      ...(err.details ? { details: err.details } : {})
    }
  });
}
