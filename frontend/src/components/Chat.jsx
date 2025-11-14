import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import SimplePeer from 'simple-peer';

export default function Chat({ socket, messages, me, onLogout, theme, setTheme }) {
	const [text, setText] = useState('');
	const [sending, setSending] = useState(false);
	const [typingUsers, setTypingUsers] = useState([]);
	const [online, setOnline] = useState([]);
	const endRef = useRef(null);
	const heartContainerRef = useRef(null);
	const fileRef = useRef(null);
	const typingTimerRef = useRef(null);

	// WebRTC / call state
	const [inCall, setInCall] = useState(false);
	const [callWith, setCallWith] = useState(null);
	const localVideoRef = useRef(null);
	const remoteVideoRef = useRef(null);
	const peerRef = useRef(null);
	const localStreamRef = useRef(null);

	async function getLocalStream({ video = false, audio = true } = {}) {
		const constraints = { audio, video };
		const s = await navigator.mediaDevices.getUserMedia(constraints);
		localStreamRef.current = s;
		if (localVideoRef.current) localVideoRef.current.srcObject = s;
		return s;
	}

	function cleanupPeer() {
		if (peerRef.current) {
			try { peerRef.current.destroy(); } catch (e) {}
			peerRef.current = null;
		}
		if (localStreamRef.current) {
			localStreamRef.current.getTracks().forEach(t => t.stop());
			localStreamRef.current = null;
		}
		setInCall(false);
		setCallWith(null);
		if (localVideoRef.current) localVideoRef.current.srcObject = null;
		if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
	}

	function startPeer(initiator, otherUser, remoteSignal) {
		const opts = { initiator, trickle: true, stream: localStreamRef.current || undefined };
		const p = new SimplePeer(opts);
		peerRef.current = p;
		p.on('signal', data => {
			// forward SDP/candidates via socket
			if (data) {
				socket?.emit(data.type === 'offer' || data.type === 'answer' ? `call:${data.type || 'offer'}` : 'call:ice-candidate', { to: otherUser, [data.type === 'answer' ? 'answer' : (data.type === 'offer' ? 'offer' : 'candidate')]: data });
			}
		});
		p.on('stream', remoteStream => {
			if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;
			setInCall(true);
		});
		p.on('error', err => console.error('Peer error', err));
		p.on('close', () => cleanupPeer());
		if (remoteSignal) p.signal(remoteSignal);
		return p;
	}

	async function startCall({ to = null, video = false } = {}) {
		try {
			await getLocalStream({ video, audio: true });
			startPeer(true, to, null);
			setCallWith(to);
		} catch (e) {
			console.error('startCall failed', e);
			alert('Unable to access mic/camera');
		}
	}

	function endCall() {
		socket?.emit('call:end', { to: callWith });
		cleanupPeer();
	}

	useEffect(() => {
		endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
	}, [messages.length]);

	// show a floating heart when a new message arrives
	useEffect(() => {
		if (!heartContainerRef.current) return;
		if (messages.length === 0) return;
		// create a heart element
		const el = document.createElement('div');
		el.className = 'floating-heart';
		heartContainerRef.current.appendChild(el);
		setTimeout(() => {
			try { heartContainerRef.current.removeChild(el); } catch (e) {}
		}, 1800);
	}, [messages.length]);

	useEffect(() => {
		if (!socket) return;
		const onPresence = (payload) => setOnline(payload?.online || []);
		const onTyping = (payload) => setTypingUsers(payload?.users || []);
		socket.on('presence:update', onPresence);
		socket.on('typing:update', onTyping);
		return () => {
			socket.off('presence:update', onPresence);
			socket.off('typing:update', onTyping);
		};
	}, [socket]);

	const sendText = async (e) => {
		e?.preventDefault?.();
		if (!text.trim() || !socket) return;
		setSending(true);
		socket.emit('chat:message', { text }, (ack) => {
			setSending(false);
			if (ack?.ok) setText('');
		});
	};

	const emitTyping = (isTyping) => {
		if (!socket) return;
		socket.emit('chat:typing', Boolean(isTyping));
	};

	const onFileChange = async (e) => {
		const file = e.target.files?.[0];
		if (!file) return;
		const form = new FormData();
		form.append('file', file);
		try {
			const res = await axios.post('/api/files/upload', form, {
				headers: { 'Content-Type': 'multipart/form-data' },
				withCredentials: true
			});
			const { fileId, fileName, fileMime } = res.data || {};
			socket.emit('chat:file', { fileId, fileName, fileMime }, () => {});
			fileRef.current.value = '';
		} catch (err) {
			console.error('File upload failed', err?.response?.data || err.message);
			alert('File upload failed: ' + (err?.response?.data?.error || err?.message || 'unknown'));
		}
	};

	const onChangeText = (e) => {
		const v = e.target.value;
		setText(v);
		emitTyping(true);
		if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
		typingTimerRef.current = setTimeout(() => emitTyping(false), 1200);
	};

	const typingOthers = typingUsers.filter(u => u !== me?.username);
	const onlineCount = online.length;

	useEffect(() => {
		if (!socket) return;
		const onNewLike = ({ messageId, likes }) => {
			// update local messages via event from parent (App) or trigger a refresh
			// we'll emit a custom event on window so parent can pick it up if needed
			window.dispatchEvent(new CustomEvent('chat:message-liked', { detail: { messageId, likes } }));
		};
		const onDeleted = ({ messageId }) => {
			window.dispatchEvent(new CustomEvent('chat:message-deleted', { detail: { messageId } }));
		};
		const onEdited = ({ messageId, msg }) => {
			window.dispatchEvent(new CustomEvent('chat:message-edited', { detail: { messageId, msg } }));
		};
		socket.on('chat:message-liked', onNewLike);
		socket.on('chat:message-deleted', onDeleted);
		socket.on('chat:message-edited', onEdited);

		// call signaling
		const handleIncoming = ({ from, to }) => {
			if (to && to !== me?.username) return;
			// prompt accept
			if (confirm(`${from} is calling you. Accept?`)) {
				getLocalStream({ video: false }).then(() => {
					startPeer(false, from, null);
				});
			} else {
				socket.emit('call:end', { to: from });
			}
		};
		const handleOffer = ({ from, to, offer }) => {
			if (to !== me?.username) return;
			// ensure we have local stream and then create peer as non-initiator and signal offer
			getLocalStream({ video: false }).then(() => {
				startPeer(false, from, offer);
			}).catch(() => {});
		};
		const handleAnswer = ({ from, to, answer }) => {
			if (to !== me?.username) return;
			if (peerRef.current) peerRef.current.signal(answer);
		};
		const handleCandidate = ({ from, to, candidate }) => {
			if (to !== me?.username) return;
			if (peerRef.current) peerRef.current.signal(candidate);
		};
		const handleCallEnd = ({ from, to }) => {
			if (to !== me?.username && from !== me?.username) return;
			cleanupPeer();
		};

		socket.on('call:incoming', handleIncoming);
		socket.on('call:offer', handleOffer);
		socket.on('call:answer', handleAnswer);
		socket.on('call:ice-candidate', handleCandidate);
		socket.on('call:end', handleCallEnd);
		return () => {
			socket.off('chat:message-liked', onNewLike);
			socket.off('chat:message-deleted', onDeleted);
			socket.off('chat:message-edited', onEdited);

			// call cleanup
			socket.off('call:incoming', handleIncoming);
			socket.off('call:offer', handleOffer);
			socket.off('call:answer', handleAnswer);
			socket.off('call:ice-candidate', handleCandidate);
			socket.off('call:end', handleCallEnd);
		};
	}, [socket]);

	return (
		<div className="h-full max-w-5xl mx-auto flex flex-col heart-container" ref={heartContainerRef}>
			{inCall && (
				<div className="p-2 flex gap-2 items-start">
					<video ref={localVideoRef} autoPlay muted className="w-28 h-20 bg-black rounded" />
					<video ref={remoteVideoRef} autoPlay className="w-64 h-48 bg-black rounded" />
				</div>
			)}
			<header className="px-4 py-3 romantic-header flex items-center justify-between">
				<div className="font-semibold">Private Chat</div>
				<div className="flex items-center gap-2">
					<div className="text-sm text-zinc-500 hidden sm:block">
						{onlineCount} online
						{onlineCount > 0 && (
							<span className="ml-2 text-zinc-400 truncate max-w-[220px] inline-block align-top">
								{online.join(', ')}
							</span>
						)}
					</div>
					<button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700">
						{theme === 'dark' ? 'Light' : 'Dark'}
					</button>
					<button onClick={onLogout} className="px-3 py-1.5 rounded-md bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900">
						Logout
					</button>
				</div>
			</header>

			<main className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
				{messages.map((m) => (
					<MessageItem key={m._id || `${m.username}-${m.createdAt}-${m.text}`} msg={m} socket={socket} me={me} />
				))}
				{typingOthers.length > 0 && (
					<div className="text-sm text-zinc-500">{typingOthers.join(', ')} {typingOthers.length === 1 ? 'is' : 'are'} typing…</div>
				)}
				<div ref={endRef} />
			</main>

			<footer className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800">
				<form onSubmit={sendText} className="flex items-center gap-2">
					<input
						type="text"
						value={text}
						onChange={onChangeText}
						placeholder="Type a message"
						className="flex-1 px-3 py-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
					/>
					<input ref={fileRef} onChange={onFileChange} type="file" className="hidden" id="file" />
					<label htmlFor="file" className="px-3 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 cursor-pointer">
						Upload
					</label>
					<button disabled={sending} className="romantic-btn">
						Send
					</button>
					{/* simple call buttons */}
					<button type="button" onClick={() => startCall({ to: null, video: false })} className="px-3 py-2 ml-2 rounded-md border">Call</button>
					<button type="button" onClick={() => startCall({ to: null, video: true })} className="px-3 py-2 ml-2 rounded-md border">Video</button>
					{inCall && <button type="button" onClick={endCall} className="px-3 py-2 ml-2 rounded-md border">End</button>}
				</form>
			</footer>
		</div>
	);
}

function MessageItem({ msg, socket, me }) {
	const isFile = Boolean(msg.fileId);
	const time = msg.createdAt ? format(new Date(msg.createdAt), 'PP p') : '';
	const [editing, setEditing] = useState(false);
	const [editText, setEditText] = useState(msg.text || '');
	const my = msg.username === (me?.username || '');

	const toggleLike = async () => {
		try {
			await axios.post(`/api/messages/${msg._id}/like`, null, { withCredentials: true });
			socket?.emit('chat:message-like', { messageId: msg._id }, () => {});
		} catch (e) {
			console.error('Like failed', e?.response?.data || e.message);
		}
	};

	const doDelete = async () => {
		if (!confirm('Delete message?')) return;
		try {
			await axios.delete(`/api/messages/${msg._id}`, { withCredentials: true });
			socket?.emit('chat:message-delete', { messageId: msg._id }, () => {});
		} catch (e) {
			console.error('Delete failed', e?.response?.data || e.message);
			alert('Delete failed');
		}
	};

	const doUnsend = async () => {
		if (!confirm('Unsend (permanently remove) this message?')) return;
		try {
			await axios.delete(`/api/messages/${msg._id}/unsend`, { withCredentials: true });
			// notify via socket so others can remove
			socket?.emit('chat:message-deleted', { messageId: msg._id }, () => {});
		} catch (e) {
			console.error('Unsend failed', e?.response?.data || e.message);
			alert('Unsend failed');
		}
	};

	const startEdit = () => { setEditing(true); setEditText(msg.text || ''); };
	const submitEdit = async () => {
		try {
			await axios.patch(`/api/messages/${msg._id}`, { text: editText }, { withCredentials: true });
			socket?.emit('chat:message-edit', { messageId: msg._id, text: editText }, () => {});
			setEditing(false);
		} catch (e) {
			console.error('Edit failed', e?.response?.data || e.message);
			alert('Edit failed');
		}
	};
	return (
		<div className="max-w-[80%]">
			<div className="text-xs text-zinc-500 mb-1">{msg.username} • {time}</div>
				<div className={`rounded-lg p-3 romantic-bubble ${msg.username === (me?.username||'') ? 'me' : ''}`}>
				{isFile ? (
					<div className="space-y-2">
						<div className="text-sm text-zinc-500">{msg.fileName || 'File'}</div>
						{msg.fileMime?.startsWith('image/') ? (
							<img
								src={`/api/files/${msg.fileId}`}
								alt={msg.fileName || 'image'}
								className="rounded-md max-h-72 object-contain"
							/>
						) : (
							<a
								className="text-indigo-600 hover:underline"
								href={`/api/files/${msg.fileId}`}
								target="_blank"
								rel="noreferrer"
							>
								Download file
							</a>
						)}
					</div>
				) : (
					<div>
						{editing ? (
							<div>
								<textarea value={editText} onChange={(e) => setEditText(e.target.value)} className="w-full p-2 border rounded-md" />
								<div className="flex gap-2 mt-2">
									<button onClick={submitEdit} className="px-3 py-1 bg-indigo-600 text-white rounded-md">Save</button>
									<button onClick={() => setEditing(false)} className="px-3 py-1 border rounded-md">Cancel</button>
								</div>
							</div>
						) : (
							<div className="whitespace-pre-wrap break-words">{msg.text}</div>
						)}
					</div>
				)}
				<div className="mt-2 flex gap-2 text-xs">
					<button onClick={toggleLike} className="romantic-small">{msg.likes?.length || 0} ❤️</button>
					{my && (
						<>
							<button onClick={startEdit} className="romantic-small">Edit</button>
							<button onClick={doDelete} className="romantic-small">Delete</button>
							<button onClick={doUnsend} className="romantic-small">Unsend</button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}


