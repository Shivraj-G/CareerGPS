import { Router } from 'express';
import { registerSchema, loginSchema } from './auth.validation.js';
import { register, login } from './auth.service.js';
import { authRateLimit } from './rateLimit.js';

const router = Router();

function validate(schema, req, res) {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'The request contains invalid fields.', details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })) }
    });
    return null;
  }
  return parsed.data;
}

router.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const input = validate(registerSchema, req, res);
    if (!input) return;
    res.status(201).json(await register(input));
  } catch (error) { next(error); }
});

router.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const input = validate(loginSchema, req, res);
    if (!input) return;
    res.json(await login(input));
  } catch (error) { next(error); }
});

export default router;
