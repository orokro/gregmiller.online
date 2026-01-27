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

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	const body = await readBody(event);

	const fromPath =
		fromVuePath(body?.item?.path || body?.from || body?.path || '');

	const toName =
		String(body?.name || body?.toName || '').trim();

	if (!fromPath || !toName) {
		throw createError({ statusCode: 400, statusMessage: 'Missing item/name' });
	}

	const absFrom = resolveSafe(root, fromPath);

	const parentRel = fromPath.split('/').slice(0, -1).join('/');
	const absParent = resolveSafe(root, parentRel);

	const absTo = path.join(absParent, toName);

	await fs.rename(absFrom, absTo);

	return await listDir({ root, relDir, toPublicUrl });
});
