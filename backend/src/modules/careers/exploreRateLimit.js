import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

export const exploreRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  keyGenerator: (req, res) => req.user?.id || ipKeyGenerator(req, res),
  message: { error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests. Please try again later.' } }
});
