import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate.js';
import { validate } from '../../middleware/validate.js';
import { chatSchema } from './assistant.validation.js';
import { chat, deleteConversation, getConversation, listConversations } from './assistant.service.js';

const router = Router();
router.use(authenticate);
router.post('/chat', validate(chatSchema), async (req, res, next) => { try { res.status(200).json({ data: await chat(req.user.id, req.body) }); } catch (error) { next(error); } });
router.get('/conversations', async (req, res, next) => { try { res.json({ data: await listConversations(req.user.id) }); } catch (error) { next(error); } });
router.get('/conversations/:id', async (req, res, next) => { try { const data = await getConversation(req.user.id, req.params.id); if (!data) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } }); return res.json({ data }); } catch (error) { return next(error); } });
router.delete('/conversations/:id', async (req, res, next) => { try { const deleted = await deleteConversation(req.user.id, req.params.id); if (!deleted) return res.status(404).json({ error: { code: 'CONVERSATION_NOT_FOUND', message: 'Conversation not found.' } }); return res.status(204).send(); } catch (error) { return next(error); } });
export default router;
