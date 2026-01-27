/*
	vuefinder/create-folder.post.js
	-------------------------------

	API endpoint to create folders for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir } from './_utils.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const body = await readBody(event);

	const relDir = fromVuePath(q.path || body?.path || 'local://');
	const name = String(body?.name || '').trim();

	if (!name) {
		throw createError({ statusCode: 400, statusMessage: 'Missing name' });
	}

	const absParent = resolveSafe(root, relDir);
	const abs = path.join(absParent, name);

	await fs.mkdir(abs, { recursive: true });

	return await listDir({ root, relDir, toPublicUrl });
});
