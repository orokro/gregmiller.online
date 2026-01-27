/*
	vuefinder/delete.post.js
	------------------------

	API endpoint to delete files/directories for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir } from './_utils.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	const body = await readBody(event);
	const items = Array.isArray(body?.items) ? body.items : [];

	for (const it of items) {
		const rel = fromVuePath(it?.path || '');
		if (!rel) continue;

		const abs = resolveSafe(root, rel);
		await fs.rm(abs, { recursive: true, force: true });
	}

	return await listDir({ root, relDir, toPublicUrl });
});
