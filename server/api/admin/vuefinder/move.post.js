/*
	vuefinder/move.post.js
	----------------------

	API endpoint to move files/directories for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir, readAnyBody } from './_utils.js';


/**
 * Handle move requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);

	let body = await readAnyBody(event);
	body = body && typeof body === 'object' ? body : {};

	const relDir = fromVuePath(q.path || body.path || 'local://');

	const sources = Array.isArray(body.sources) ? body.sources : [];
	const destRaw = body.destination || body.target || body.to || body.dst || body.toPath;

	if (!destRaw) {
		throw createError({ statusCode: 400, statusMessage: 'Missing destination' });
	}

	const destRel = fromVuePath(destRaw);
	const absDestDir = resolveSafe(root, destRel);

	for (const srcRaw of sources) {

		if (!srcRaw)
			continue;

		const srcRel = fromVuePath(srcRaw);
		const absFrom = resolveSafe(root, srcRel);

		const base = srcRel.split('/').pop();
		if (!base)
			continue;

		// prevent moving a folder into itself / its child
		if (destRel === srcRel || destRel.startsWith(`${srcRel}/`)) {
			continue;
		}

		const absTo = path.join(absDestDir, base);

		await fs.rename(absFrom, absTo);
	}

	return await listDir({ root, relDir, toPublicUrl });
});
