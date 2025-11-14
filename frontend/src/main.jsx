import React from 'react';
import ReactDOM from 'react-dom/client';
import axios from 'axios';

// Ensure axios always sends cookies (credentials) for API calls.
// Set this as early as possible before any components mount so uploads and
// other requests include the session cookie.
axios.defaults.withCredentials = true;

// Use `VITE_API_BASE` when provided in production to point the frontend
// at the deployed backend (e.g., Render). In development this will be
// empty so relative `/api` requests work with the Vite proxy.
if (import.meta.env.VITE_API_BASE) {
	axios.defaults.baseURL = import.meta.env.VITE_API_BASE;
}

import App from './App.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);


