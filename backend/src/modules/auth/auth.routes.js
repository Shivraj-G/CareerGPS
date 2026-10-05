import { Router } from 'express';
import { registerSchema, loginSchema } from './auth.validation.js';
import { register, login, verifyRefreshToken, signAccessToken } from './auth.service.js';
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

function setRefreshTokenCookie(res, token) {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
}

function getCookie(req, name) {
  const match = req.headers.cookie?.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

router.post('/register', authRateLimit, async (req, res, next) => {
  try {
    const input = validate(registerSchema, req, res);
    if (!input) return;
    const { user, accessToken, refreshToken } = await register(input);
    setRefreshTokenCookie(res, refreshToken);
    res.status(201).json({ user, accessToken });
  } catch (error) { next(error); }
});

router.post('/login', authRateLimit, async (req, res, next) => {
  try {
    const input = validate(loginSchema, req, res);
    if (!input) return;
    const { user, accessToken, refreshToken } = await login(input);
    setRefreshTokenCookie(res, refreshToken);
    res.json({ user, accessToken });
  } catch (error) { next(error); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = getCookie(req, 'refreshToken');
    if (!token) {
      return res.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'No refresh token provided.' } });
    }
    const userPayload = await verifyRefreshToken(token);
    const newAccessToken = signAccessToken(userPayload);
    res.json({ accessToken: newAccessToken });
  } catch (error) { next(error); }
});

export default router;
