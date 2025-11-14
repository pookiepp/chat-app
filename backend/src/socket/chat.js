import { Message } from '../models/Message.js';
import mongoose from 'mongoose';

// In-memory fallback for development when MongoDB is not available.
// This lets chat still work (messages broadcast) even if DB is down.
const fallbackMessages = [];

// Track presence and typing state
const usernameToCount = new Map(); // username -> socket count
const typingUsers = new Set(); // usernames currently typing

function broadcastPresence(io) {
	const online = Array.from(usernameToCount.entries())
		.filter(([_, count]) => count > 0)
		.map(([username]) => username);
	io.emit('presence:update', { online });
}

export function registerChatHandlers(io) {
	io.on('connection', async (socket) => {
		const username = socket.request.session?.username || 'User';

		// Presence: increment user socket count
		const current = usernameToCount.get(username) || 0;
		usernameToCount.set(username, current + 1);
		broadcastPresence(io);

		// Load recent messages
		let recent = [];
		try {
			recent = await Message.find({}).sort({ createdAt: 1 }).limit(200).lean();
		} catch (e) {
			// DB unavailable: use fallback in-memory messages (dev)
			recent = fallbackMessages.slice(-200);
		}
		socket.emit('chat:init', recent);

			socket.on('chat:message', async (payload, ack) => {
				try {
					if (!socket.request.session?.isAuthenticated) return;
					const text = (payload?.text || '').toString().slice(0, 4000);
					try {
						const msg = await Message.create({ username, text });
						io.emit('chat:new', msg);
						ack?.({ ok: true });
					} catch (e) {
						// DB write failed (likely disconnected). Fall back to in-memory message so chat remains functional in dev.
						const msg = {
							_id: `${Date.now()}-${Math.random().toString(36).slice(2,9)}`,
							username,
							text,
							createdAt: new Date().toISOString()
						};
						fallbackMessages.push(msg);
						io.emit('chat:new', msg);
						ack?.({ ok: true });
					}
				} catch (e) {
					ack?.({ ok: false });
				}
			});

		socket.on('chat:file', async (payload, ack) => {
			try {
				if (!socket.request.session?.isAuthenticated) return;
				const { fileId, fileName, fileMime } = payload || {};
				if (!fileId) return ack?.({ ok: false });
				const msg = await Message.create({
					username,
					text: '',
					fileId,
					fileName: (fileName || '').toString().slice(0, 256),
					fileMime: (fileMime || '').toString().slice(0, 128)
				});
				io.emit('chat:new', msg);
				ack?.({ ok: true });
			} catch (e) {
				ack?.({ ok: false });
			}
		});

		// Like / Unlike message
		socket.on('chat:message-like', async (payload, ack) => {
			try {
				if (!socket.request.session?.isAuthenticated) return ack?.({ ok: false });
				const { messageId } = payload || {};
				if (!messageId) return ack?.({ ok: false });
				const msg = await Message.findById(messageId);
				if (!msg) return ack?.({ ok: false });
				const user = username;
				const idx = msg.likes.indexOf(user);
				if (idx === -1) msg.likes.push(user);
				else msg.likes.splice(idx, 1);
				await msg.save();
				io.emit('chat:message-liked', { messageId, likes: msg.likes });
				ack?.({ ok: true, likes: msg.likes });
			} catch (e) {
				ack?.({ ok: false });
			}
		});

		// Call signaling relay (WebRTC)
		socket.on('call:initiate', (payload) => {
			// payload: { to: username }
			io.emit('call:incoming', { from: username, to: payload?.to });
		});
		socket.on('call:offer', (payload) => {
			// payload: { to, offer }
			io.emit('call:offer', { from: username, to: payload?.to, offer: payload?.offer });
		});
		socket.on('call:answer', (payload) => {
			io.emit('call:answer', { from: username, to: payload?.to, answer: payload?.answer });
		});
		socket.on('call:ice-candidate', (payload) => {
			io.emit('call:ice-candidate', { from: username, to: payload?.to, candidate: payload?.candidate });
		});
		socket.on('call:end', (payload) => {
			io.emit('call:end', { from: username, to: payload?.to });
		});

		// Typing indicator
		socket.on('chat:typing', (isTyping) => {
			if (!socket.request.session?.isAuthenticated) return;
			if (isTyping) {
				typingUsers.add(username);
			} else {
				typingUsers.delete(username);
			}
			io.emit('typing:update', { users: Array.from(typingUsers) });
		});

		// Delete message event
		socket.on('chat:message-delete', async (payload, ack) => {
			try {
				if (!socket.request.session?.isAuthenticated) return ack?.({ ok: false });
				const { messageId } = payload || {};
				if (!messageId) return ack?.({ ok: false });
				const msg = await Message.findById(messageId);
				if (!msg || msg.username !== username) {
					return ack?.({ ok: false });
				}
				msg.deleted = true;
				msg.text = '[deleted]';
				msg.fileId = null;
				msg.fileName = null;
				await msg.save();
				io.emit('chat:message-deleted', { messageId, msg });
				ack?.({ ok: true });
			} catch (e) {
				ack?.({ ok: false });
			}
		});

		// Edit message event
		socket.on('chat:message-edit', async (payload, ack) => {
			try {
				if (!socket.request.session?.isAuthenticated) return ack?.({ ok: false });
				const { messageId, text } = payload || {};
				if (!messageId || !text) return ack?.({ ok: false });
				const msg = await Message.findById(messageId);
				if (!msg || msg.username !== username || msg.deleted) {
					return ack?.({ ok: false });
				}
				if (!msg.originalText) {
					msg.originalText = msg.text;
				}
				msg.text = text.toString().slice(0, 4000);
				msg.edited = true;
				msg.editedAt = new Date();
				await msg.save();
				io.emit('chat:message-edited', { messageId, msg });
				ack?.({ ok: true });
			} catch (e) {
				ack?.({ ok: false });
			}
		});

		socket.on('disconnect', () => {
			// Remove typing state
			typingUsers.delete(username);
			io.emit('typing:update', { users: Array.from(typingUsers) });

			// Decrement presence
			const count = usernameToCount.get(username) || 0;
			if (count <= 1) {
				usernameToCount.delete(username);
			} else {
				usernameToCount.set(username, count - 1);
			}
			broadcastPresence(io);
		});
	});
}


