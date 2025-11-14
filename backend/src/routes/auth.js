import express from 'express';
import bcrypt from 'bcrypt';
import { loginLimiter } from '../middleware/auth.js';

const router = express.Router();

const PASSWORD_HASH = process.env.CHAT_PASSWORD_HASH || '';
const MAX_USERS = Number(process.env.MAX_USERS || '5');

if (!PASSWORD_HASH) {
	console.error('Missing CHAT_PASSWORD_HASH in environment');
}

router.post('/login', loginLimiter, async (req, res) => {
	try {
		const { password, username } = req.body || {};
		if (!password) return res.status(400).json({ error: 'Password required' });
		if (!PASSWORD_HASH) return res.status(500).json({ error: 'Server not configured' });

		const ok = await bcrypt.compare(password, PASSWORD_HASH);
		if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

		// Enforce small private room policy
		req.session.isAuthenticated = true;
		req.session.username = (username || 'User').toString().slice(0, 24);
		return res.json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'Login failed' });
	}
});

router.post('/logout', (req, res) => {
	req.session.destroy(() => {
		res.clearCookie('sid');
		return res.json({ ok: true });
	});
});

router.get('/me', (req, res) => {
	if (!req.session?.isAuthenticated) return res.status(401).json({ error: 'Unauthorized' });
	return res.json({ ok: true, username: req.session.username });
});

export default router;


