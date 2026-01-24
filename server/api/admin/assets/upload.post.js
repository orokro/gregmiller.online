/*
	admin/assets/upload.post.js
	---------------------------

	API endpoint to upload one or more asset files to a specified directory.

	params:
		path (string, form field) - the relative directory path to upload files to
		file (file, form field) - one or more files to upload
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';

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

	const form = await readMultipartFormData(event);
	if (!form) {
		throw createError({ statusCode: 400, statusMessage: 'Expected multipart/form-data' });
	}

	let relDir = '';
	const files = [];

	for (const part of form) {
		if (part.type === 'field' && part.name === 'path') {
			relDir = String(part.data || '').trim();
		}
		if (part.type === 'file' && part.name === 'file') {
			files.push(part);
		}
	}

	const absDir = resolveSafe(root, relDir);
	await fs.mkdir(absDir, { recursive: true });

	const saved = [];

	for (const f of files) {
		const fname = sanitizeFilename(f.filename);
		const abs = path.join(absDir, fname);

		await fs.writeFile(abs, f.data);

		const relFile = relDir ? `${relDir}/${fname}` : fname;
		saved.push({
			name: fname,
			path: relFile,
			url: toPublicUrl(relFile),
		});
	}

	return { ok: true, saved };
});
