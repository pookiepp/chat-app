import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
	username: { type: String, required: true },
	text: { type: String, default: '' },
	fileId: { type: String, default: null },
	fileName: { type: String, default: null },
	fileMime: { type: String, default: null },
	createdAt: { type: Date, default: Date.now },
	deleted: { type: Boolean, default: false },
	edited: { type: Boolean, default: false },
	editedAt: { type: Date, default: null },
	originalText: { type: String, default: '' }
	,likes: { type: [String], default: [] }
}, { versionKey: false });

export const Message = mongoose.model('Message', MessageSchema);


