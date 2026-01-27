/*
	vuefinder/rename.post.js
	------------------------

	API endpoint to rename files/directories for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir } from './_utils.js';

function asObject(v) {
	if (!v) return null;
	if (typeof v === 'object') return v;
	if (typeof v === 'string') {
		try { return JSON.parse(v); } catch { return null; }
	}
	return null;
}

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	let body = await readBody(event);
	body = asObject(body) || {};

	// VueFinder-like shapes (be tolerant):
	// - { item: { path }, name }
	// - { items: [{ path }], name }
	// - { from: 'local://...', name: 'new' }
	const itemPathRaw =
		body?.item?.path
		|| body?.items?.[0]?.path
		|| body?.from
		|| body?.itemPath;

	const name =
		String(body?.name || body?.toName || body?.newName || '').trim();

	if (!itemPathRaw || !name) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing item/name',
		});
	}

	const fromPath = fromVuePath(itemPathRaw);

	// IMPORTANT: prevent renaming the *current directory* accidentally
	// (this is what happened to you when the folder renamed instead of the file)
	if (fromPath === relDir) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Refusing to rename current directory. Missing item path?',
		});
	}

	const absFrom = resolveSafe(root, fromPath);

	const parentRel = fromPath.split('/').slice(0, -1).join('/');
	const absParent = resolveSafe(root, parentRel);

	const absTo = path.join(absParent, name);

	await fs.rename(absFrom, absTo);

	return await listDir({ root, relDir, toPublicUrl });
});
