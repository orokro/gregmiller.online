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
import { fromVuePath, listDir, readAnyBody } from './_utils.js';


function pickFirst(v) {
	if (!v) return null;
	if (Array.isArray(v)) return v[0] || null;
	return v;
}


export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);

	let body = await readAnyBody(event);
	body = body && typeof body === 'object' ? body : {};

	const relDir = fromVuePath(q.path || body.path || 'local://');

	// VueFinder v4 sends { item: "local://dir/file.ext", name: "new.ext", path: "local://dir" }
	const itemPathRaw =
		pickFirst(body?.item?.path)
		|| pickFirst(body?.items?.[0]?.path)
		|| pickFirst(body?.item)			// <-- IMPORTANT (string form)
		|| pickFirst(body?.from)
		|| pickFirst(body?.itemPath);

	const name =
		String(pickFirst(body?.name) || pickFirst(body?.newName) || pickFirst(body?.toName) || '').trim();

	if (!itemPathRaw || !name) {
		throw createError({ statusCode: 400, statusMessage: 'Missing item/name' });
	}

	const fromPath = fromVuePath(itemPathRaw);

	// prevent accidental “rename the current directory”
	if (fromPath === relDir) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Rename payload pointed at current dir; expected item path',
		});
	}

	const absFrom = resolveSafe(root, fromPath);

	const parentRel = fromPath.split('/').slice(0, -1).join('/');
	const absParent = resolveSafe(root, parentRel);

	const absTo = path.join(absParent, name);

	await fs.rename(absFrom, absTo);

	return await listDir({ root, relDir, toPublicUrl });
});
