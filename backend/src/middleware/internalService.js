import crypto from 'node:crypto';
import { env } from '../config/env.js';

export function requireInternalService(req, res, next) {
  const expected = env.INTERNAL_SERVICE_TOKEN;
  const received = req.get('x-internal-service-token');

  if (!expected || !received) {
    return res.status(401).json({
      error: { code: 'INTERNAL_UNAUTHORIZED', message: 'Internal service authentication is required.' }
    });
  }

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)) {
    return res.status(401).json({
      error: { code: 'INTERNAL_UNAUTHORIZED', message: 'Internal service authentication failed.' }
    });
  }

  req.internalService = true;
  return next();
}
