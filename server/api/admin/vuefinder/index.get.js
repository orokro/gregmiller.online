/*
	vuefinder/index.get.js
	----------------------

	API endpoint to list files/directories for VueFinder in admin.
*/

// imports
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir } from './_utils.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	// enforce safety / normalize
	resolveSafe(root, relDir);

	return await listDir({ root, relDir, toPublicUrl });
});
