/*
	vuefinder/copy.post.js
	----------------------

	API endpoint to copy files/directories for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, listDir, readAnyBody } from './_utils.js';


async function exists(p) {
	try { await fs.stat(p); return true; } catch { return false; }
}


export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);

	let body = await readAnyBody(event);
	body = body && typeof body === 'object' ? body : {};

	// IMPORTANT: VueFinder sends current directory as body.path (not querystring)
	const relDir = fromVuePath(q.path || body.path || 'local://');

	// VueFinder sends sources as array of strings
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

		// prevent copying a folder into itself / its child
		if (destRel === srcRel || destRel.startsWith(`${srcRel}/`)) {
			continue;
		}

		let absTo = path.join(absDestDir, base);

		// If destination exists, create "copy" name
		if (await exists(absTo)) {
			const dot = base.lastIndexOf('.');
			const name = dot >= 0 ? base.slice(0, dot) : base;
			const ext = dot >= 0 ? base.slice(dot) : '';
			let n = 2;

			while (await exists(absTo)) {
				absTo = path.join(absDestDir, `${name} (${n})${ext}`);
				n++;
			}
		}

		await fs.cp(absFrom, absTo, { recursive: true });
	}

	// Return listing for current dir (so UI stays where it is)
	return await listDir({ root, relDir, toPublicUrl });
});
