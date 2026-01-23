import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);

	const root = getAssetsRoot();
	const q = getQuery(event);
	const rel = String(q.path || '').trim(); // relative under wp-content

	const abs = resolveSafe(root, rel);

	const entries = await fs.readdir(abs, { withFileTypes: true });

	const items = [];
	for (const ent of entries) {
		const childRel = rel ? `${rel}/${ent.name}` : ent.name;
		const childAbs = path.join(abs, ent.name);

		let stat = null;
		try {
			stat = await fs.stat(childAbs);
		} catch {}

		const isDir = ent.isDirectory();

		items.push({
			name: ent.name,
			type: isDir ? 'dir' : 'file',
			path: childRel,
			url: isDir ? null : toPublicUrl(childRel),
			size: stat ? stat.size : null,
			mtime: stat ? stat.mtimeMs : null,
		});
	}

	// Dirs first, then alpha
	items.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
		return a.name.localeCompare(b.name);
	});

	return {
		path: rel,
		items,
	};
});
