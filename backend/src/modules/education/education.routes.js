import { Router } from 'express';
import { getCompatiblePrograms, validateProgramCompatibility } from './education.service.js';

const router = Router();

router.get('/programs', (req, res, next) => {
  try {
    const stream = req.query.stream || '';
    const programs = getCompatiblePrograms(stream);
    res.json({ data: programs });
  } catch (e) {
    next(e);
  }
});

router.post('/validate', (req, res, next) => {
  try {
    const { stream, program } = req.body;
    const isValid = validateProgramCompatibility(stream, program);
    if (!isValid) {
      return res.status(400).json({ error: { code: 'INVALID_EDUCATION_COMBINATION', message: `${program} is not compatible with the selected 12th stream.` } });
    }
    res.json({ data: { valid: true } });
  } catch (e) {
    next(e);
  }
});

export default router;
