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


/**
 * Sanitize a filename by removing unsafe characters
 *
 * @param {String} name - original filename
 * @returns	{String} sanitized filename
 */
function sanitizeFilename(name) {
	return String(name || 'file')
		.replace(/\\/g, '/')
		.split('/')
		.pop()
		.replace(/[^\w.\-()+ ]+/g, '_')
		.trim();
}


/**
 * Handle upload requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);

	const form = await readMultipartFormData(event);
	if (!form) {
		throw createError({ statusCode: 400, statusMessage: 'Expected multipart/form-data' });
	}

	// VueFinder SHOULD pass ?path=local://..., but be tolerant:
	// - query path
	// - a multipart field named "path"
	let relDir = fromVuePath(q.path || 'local://');

	for (const part of form) {
		if (part.name === 'path' && part.data) {
			const raw = part.data.toString('utf8').trim();
			if (raw) {
				relDir = fromVuePath(raw);
			}
		}
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

	return {};
});
