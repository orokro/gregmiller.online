/*
	vuefinder/preview.get.js
	------------------------

	API endpoint to preview files for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe } from '../../../utils/assetsRoot.js';
import { fromVuePath, guessMime } from './_utils.js';


/**
 * Handle preview requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const rel = fromVuePath(q.path || '');

	if (!rel) {
		throw createError({ statusCode: 400, statusMessage: 'Missing path' });
	}

	const abs = resolveSafe(root, rel);

	const data = await fs.readFile(abs);

	setHeader(event, 'Content-Type', guessMime(rel));
	return data;
});
