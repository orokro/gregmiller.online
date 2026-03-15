
import path from 'node:path';
import fs from 'node:fs';
import { defineEventHandler, sendStream, createError } from 'h3';

export default defineEventHandler(async (event) => {
	
	const userPath = event.context.params.path || '';
	const root = path.resolve(process.cwd(), 'storage');
	const filePath = path.resolve(root, userPath);

	// Security: prevent directory traversal
	if (!filePath.startsWith(root)) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid path' });
	}

	if (!fs.existsSync(filePath)) {
		throw createError({ statusCode: 404, statusMessage: 'File not found' });
	}

	const stats = fs.statSync(filePath);
	if (stats.isDirectory()) {
		throw createError({ statusCode: 403, statusMessage: 'Directory listing not allowed' });
	}

	// Set content-type based on extension
	const ext = path.extname(filePath).toLowerCase();
	const mimes = {
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.mp3': 'audio/mpeg',
		'.zip': 'application/zip',
		'.pdf': 'application/pdf',
		'.html': 'text/html',
		'.css': 'text/css',
		'.js': 'application/javascript',
		'.json': 'application/json'
	};
	
	if (mimes[ext]) {
		setHeader(event, 'Content-Type', mimes[ext]);
	}

	return sendStream(event, fs.createReadStream(filePath));
});
