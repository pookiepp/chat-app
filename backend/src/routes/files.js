import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import crypto from 'crypto';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const uploadsDir = path.join(process.cwd(), 'backend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
	destination: (_req, _file, cb) => {
		cb(null, uploadsDir);
	},
	filename: (_req, file, cb) => {
		const id = crypto.randomBytes(16).toString('hex');
		const ext = path.extname(file.originalname || '');
		cb(null, `${id}${ext}`);
	}
});
const upload = multer({
	storage,
	limits: {
		fileSize: 15 * 1024 * 1024 // 15 MB
	}
});

// Allow uploads even if the HTTP session is not present. The chat socket
// requires authentication to announce the uploaded file; however allowing the
// file to be uploaded increases robustness for users with flaky sessions.
router.post('/upload', upload.single('file'), (req, res) => {
	if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
	const fileId = path.basename(req.file.filename);
	return res.json({
		ok: true,
		fileId,
		fileName: req.file.originalname,
		fileMime: req.file.mimetype
	});
});

// Protect file downloads: only authenticated sessions may download uploaded files.
router.get('/:fileId', requireAuth, (req, res) => {
	const { fileId } = req.params;
	const filePath = path.join(uploadsDir, fileId);
	if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Not found' });
	const mimeType = mime.lookup(filePath) || 'application/octet-stream';
	res.setHeader('Content-Type', mimeType);
	res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data: blob:; media-src 'self' data: blob:;");
	fs.createReadStream(filePath).pipe(res);
});

export default router;


