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


function normalizeItems(items) {
	if (!Array.isArray(items)) return [];
	return items.map((it) => {
		if (typeof it === 'string') return { path: it };
		return it;
	});
}


async function exists(p) {
	try { await fs.stat(p); return true; } catch { return false; }
}


export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);
	const relDir = fromVuePath(q.path || 'local://');

	let body = await readAnyBody(event);
	body = body && typeof body === 'object' ? body : {};

	const items = normalizeItems(body.items || body.item || body.selected || []);

	const destRaw =
		body.destination
		|| body.target
		|| body.to
		|| body.dst
		|| body.toPath;

	if (!destRaw) {
		throw createError({ statusCode: 400, statusMessage: 'Missing destination' });
	}

	const destRel = fromVuePath(destRaw);
	const absDestDir = resolveSafe(root, destRel);

	for (const it of items) {

		const srcRaw = it?.path || it?.item?.path;
		if (!srcRaw) continue;

		const srcRel = fromVuePath(srcRaw);
		const absFrom = resolveSafe(root, srcRel);

		const base = srcRel.split('/').pop();
		if (!base) continue;

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

	return await listDir({ root, relDir, toPublicUrl });
});
