import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Login from './components/Login.jsx';
import Chat from './components/Chat.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

axios.defaults.withCredentials = true;

export default function App() {
	const [me, setMe] = useState(null);
	const [socket, setSocket] = useState(null);
	const [messages, setMessages] = useState([]);
	const [theme, setTheme] = useState('dark');

	useEffect(() => {
		document.documentElement.classList.toggle('dark', theme === 'dark');
	}, [theme]);

	useEffect(() => {
		axios.get('/api/auth/me').then(res => {
			setMe(res.data);
		}).catch(() => setMe(null));
	}, []);

	useEffect(() => {
		if (!me?.ok) return;
		const s = io('/', { withCredentials: true });
		setSocket(s);
		s.on('connect_error', () => {});
		s.on('chat:init', (msgs) => setMessages(msgs));
		s.on('chat:new', (msg) => setMessages(prev => [...prev, msg]));

		// handle in-app events for edits/likes/deletes
		const onLiked = (e) => {
			const { messageId, likes } = e.detail || {};
			if (!messageId) return;
			setMessages(prev => prev.map(m => m._id === messageId ? { ...m, likes } : m));
		};
		const onDeleted = (e) => {
			const { messageId } = e.detail || {};
			if (!messageId) return;
			setMessages(prev => prev.map(m => m._id === messageId ? { ...m, deleted: true, text: '[deleted]', fileId: null, fileName: null } : m));
		};
		const onEdited = (e) => {
			const { messageId, msg } = e.detail || {};
			if (!messageId) return;
			setMessages(prev => prev.map(m => m._id === messageId ? { ...m, ...msg } : m));
		};
		window.addEventListener('chat:message-liked', onLiked);
		window.addEventListener('chat:message-deleted', onDeleted);
		window.addEventListener('chat:message-edited', onEdited);

		return () => {
			s.close();
			window.removeEventListener('chat:message-liked', onLiked);
			window.removeEventListener('chat:message-deleted', onDeleted);
			window.removeEventListener('chat:message-edited', onEdited);
		};
	}, [me]);

	const handleLoggedIn = (profile) => {
		setMe(profile);
	};

	const handleLogout = async () => {
		try {
			await axios.post('/api/auth/logout');
		} finally {
			setMe(null);
			setSocket(null);
			setMessages([]);
		}
	};

	if (!me?.ok) {
		return (
			<div className="h-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex items-center justify-center px-4">
				<div className="w-full max-w-sm">
					<Login onLoggedIn={handleLoggedIn} />
				</div>
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<div className="h-full bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
				<Chat
					socket={socket}
					messages={messages}
					me={me}
					onLogout={handleLogout}
					theme={theme}
					setTheme={setTheme}
				/>
			</div>
		</ErrorBoundary>
	);
}


