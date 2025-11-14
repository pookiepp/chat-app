import React, { useState } from 'react';
import axios from 'axios';

export default function Login({ onLoggedIn }) {
	const [password, setPassword] = useState('');
	const [username, setUsername] = useState('');
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);

	const submit = async (e) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await axios.post('/api/auth/login', { password, username });
			if (res.data?.ok) {
				const me = await axios.get('/api/auth/me');
				onLoggedIn(me.data);
			}
		} catch (err) {
			setError(err?.response?.data?.error || 'Login failed');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white/60 dark:bg-zinc-800/60 backdrop-blur p-6 shadow">
			<h1 className="text-2xl font-semibold mb-2">Private Chat</h1>
			<p className="text-sm text-zinc-500 mb-6">Enter the shared password to unlock.</p>
			<form onSubmit={submit} className="space-y-3">
				<input
					type="text"
					className="w-full px-3 py-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
					placeholder="Name (optional)"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
				/>
				<input
					type="password"
					className="w-full px-3 py-2 rounded-md bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-indigo-500"
					placeholder="Password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					required
				/>
				<button
					type="submit"
					disabled={loading}
					className="w-full py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium"
				>
					{loading ? 'Unlocking…' : 'Unlock'}
				</button>
				{error && <div className="text-sm text-red-500">{error}</div>}
			</form>
		</div>
	);
}


