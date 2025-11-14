// Load environment variables from .env file FIRST, before any other imports.
// This must be a side-effect import so it runs before other modules evaluate process.env.
import 'dotenv/config';

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import cors from 'cors';
import cookieSession from 'cookie-session';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';

import authRouter from './src/routes/auth.js';
import filesRouter from './src/routes/files.js';
import messagesRouter from './src/routes/messages.js';
import { requireAuth, sessionMiddleware } from './src/middleware/auth.js';
import { registerChatHandlers } from './src/socket/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
	// Restrict origins in production via env
	cors: {
		origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) ?? ['http://localhost:5173'],
		credentials: true
	}
});

// Database
const mongoUrl = process.env.MONGODB_URI || '';
if (!mongoUrl) {
	console.error('Missing MONGODB_URI in environment');
	process.exit(1);
}
// Don't buffer mongoose commands when the DB is down (avoids long delays)
mongoose.set('bufferCommands', false);

// Shorten server selection timeout so failed connections fail fast in dev
mongoose.connect(mongoUrl, { serverSelectionTimeoutMS: 2000, connectTimeoutMS: 2000 }).then(() => {
	console.log('✓ MongoDB connected');
}).catch(err => {
	if (process.env.NODE_ENV === 'production') {
		console.error('MongoDB connection error', err);
		process.exit(1);
	} else {
		// Development: warn but continue so you can test the app without MongoDB
		console.warn('⚠ MongoDB connection failed (dev mode - continuing anyway):', err.message);
	}
});

// Ensure mongoose errors don't crash the app in dev
mongoose.connection.on('error', (err) => {
	console.warn('⚠ MongoDB error event:', err.message);
});

// Sessions
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
	console.error('Missing SESSION_SECRET in environment');
	process.exit(1);
}

// Use cookie-session so session data is stored in a signed cookie. This
// keeps sessions working across server restarts in development (no in-memory
// store lost when nodemon restarts). Cookie storage is fine here because we
// only store a small auth flag and username.
const sessionConfig = cookieSession({
	name: 'sid',
	keys: [sessionSecret],
	signed: true,
	httpOnly: true,
	secure: process.env.NODE_ENV === 'production',
	sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'lax',
	maxAge: 1000 * 60 * 60 * 8 // 8 hours
});

// Security & utilities
app.disable('x-powered-by');
app.use(helmet({
	contentSecurityPolicy: false
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cors({
	origin: process.env.CORS_ORIGIN?.split(',').map(s => s.trim()) ?? ['http://localhost:5173'],
	credentials: true
}));
app.use(sessionConfig);

// Routes
app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/messages', requireAuth, messagesRouter);
// Files router: allow uploads without requiring the HTTP session to be present
// (helps when sessions are out-of-sync across tabs during dev). The files
// router itself will protect downloads where necessary.
app.use('/api/files', filesRouter);

// Socket.IO with session
io.engine.use((req, res, next) => sessionConfig(req, res, next));
io.use((socket, next) => {
	// Ensure session auth
	const req = socket.request;
	if (req.session?.isAuthenticated) return next();
	return next(new Error('Unauthorized'));
});
registerChatHandlers(io);

// Production static serving (optional)
const clientDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
	if (req.path.startsWith('/api')) return next();
	res.sendFile(path.join(clientDist, 'index.html'));
});

const port = process.env.PORT || 8080;
server.listen(port, () => {
	console.log(`Server listening on port ${port}`);
});

// Handle unhandled promise rejections and exceptions
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	if (process.env.NODE_ENV === 'production') {
		process.exit(1);
	}
});

// Handle server close
server.on('close', () => {
	console.log('Server closed');
	mongoose.connection.close();
});


