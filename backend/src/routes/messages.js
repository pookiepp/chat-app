import express from 'express';
import { Message } from '../models/Message.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// DELETE /api/messages/:id - Delete a message (soft delete)
router.delete('/:id', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const msg = await Message.findById(id);
		if (!msg) {
			return res.status(404).json({ error: 'Message not found' });
		}
		// Only the sender can delete their own message
		if (msg.username !== req.session.username) {
			return res.status(403).json({ error: 'Not authorized' });
		}
		msg.deleted = true;
		msg.text = '[deleted]';
		msg.fileId = null;
		msg.fileName = null;
		await msg.save();
		res.json({ ok: true, msg });
	} catch (e) {
		console.error('Error deleting message:', e);
		res.status(500).json({ error: 'Failed to delete message' });
	}
});

// PATCH /api/messages/:id - Edit a message
router.patch('/:id', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const { text } = req.body;
		if (!text || typeof text !== 'string') {
			return res.status(400).json({ error: 'Invalid text' });
		}
		const msg = await Message.findById(id);
		if (!msg) {
			return res.status(404).json({ error: 'Message not found' });
		}
		// Only the sender can edit their own message
		if (msg.username !== req.session.username) {
			return res.status(403).json({ error: 'Not authorized' });
		}
		// Cannot edit deleted messages
		if (msg.deleted) {
			return res.status(400).json({ error: 'Cannot edit deleted message' });
		}
		// Save original text if not already saved
		if (!msg.originalText) {
			msg.originalText = msg.text;
		}
		msg.text = text.toString().slice(0, 4000);
		msg.edited = true;
		msg.editedAt = new Date();
		await msg.save();
		res.json({ ok: true, msg });
	} catch (e) {
		console.error('Error editing message:', e);
		res.status(500).json({ error: 'Failed to edit message' });
	}
});

// POST /api/messages/:id/like - toggle like
router.post('/:id/like', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const msg = await Message.findById(id);
		if (!msg) return res.status(404).json({ error: 'Message not found' });
		const user = req.session.username;
		const idx = msg.likes.indexOf(user);
		if (idx === -1) msg.likes.push(user);
		else msg.likes.splice(idx, 1);
		await msg.save();
		res.json({ ok: true, likes: msg.likes });
	} catch (e) {
		console.error('Error toggling like:', e);
		res.status(500).json({ error: 'Failed to toggle like' });
	}
});

// DELETE /api/messages/:id/unsend - permanently remove a message (only sender)
router.delete('/:id/unsend', requireAuth, async (req, res) => {
	try {
		const { id } = req.params;
		const msg = await Message.findById(id);
		if (!msg) return res.status(404).json({ error: 'Message not found' });
		if (msg.username !== req.session.username) return res.status(403).json({ error: 'Not authorized' });
		await Message.deleteOne({ _id: id });
		res.json({ ok: true });
	} catch (e) {
		console.error('Error unsending message:', e);
		res.status(500).json({ error: 'Failed to unsend message' });
	}
});

export default router;
