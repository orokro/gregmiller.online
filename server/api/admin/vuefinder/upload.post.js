/*
	vuefinder/upload.post.js
	------------------------

	API endpoint to handle file uploads for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe } from '../../../utils/assetsRoot.js';
import { fromVuePath } from './_utils.js';

function sanitizeFilename(name) {

	return String(name || 'file')
		.replace(/\\/g, '/')
		.split('/')
		.pop()
		.replace(/[^\w.\-()+ ]+/g, '_')
		.trim();
}

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	const form = await readMultipartFormData(event);
	if (!form) {
		throw createError({ statusCode: 400, statusMessage: 'Expected multipart/form-data' });
	}

	const files = [];
	for (const part of form) {
		if (part.name === 'file' && part.filename) {
			files.push(part);
		}
	}

	const absDir = resolveSafe(root, relDir);
	await fs.mkdir(absDir, { recursive: true });

	for (const f of files) {
		const fname = sanitizeFilename(f.filename);
		const abs = path.join(absDir, fname);
		await fs.writeFile(abs, f.data);
	}

	// VueFinder expects empty object on success per docs
	return {};
});
