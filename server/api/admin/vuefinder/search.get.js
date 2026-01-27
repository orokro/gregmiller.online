/*
	vuefinder/search.get.js
	-----------------------

	API endpoint to search files for VueFinder in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe, toPublicUrl } from '../../../utils/assetsRoot.js';
import { fromVuePath, toVuePath, guessMime } from './_utils.js';


function extFromName(name) {
	const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
	return m ? m[1] : '';
}


function matches(termLower, filter, name) {

	const nl = name.toLowerCase();

	// If VueFinder uses "filter" as the term, accept plain strings
	if (termLower && nl.includes(termLower)) return true;

	// Basic glob support for common patterns like "*.jpg" or "*.pdf"
	if (filter && typeof filter === 'string') {
		const f = filter.trim().toLowerCase();
		if (f.startsWith('*.')) {
			const wantExt = f.slice(2);
			return extFromName(name) === wantExt;
		}
		// if filter is not a glob, treat it like a substring
		if (f && !f.includes('*') && nl.includes(f)) return true;
	}

	return false;
}


async function walk(absDir, relDir, opts, out) {

	const entries = await fs.readdir(absDir, { withFileTypes: true });

	for (const ent of entries) {

		const childRel = relDir ? `${relDir}/${ent.name}` : ent.name;
		const childAbs = path.join(absDir, ent.name);

		if (ent.isDirectory()) {

			// include matching folders too
			if (matches(opts.termLower, opts.filter, ent.name)) {
				let stat = null;
				try { stat = await fs.stat(childAbs); } catch {}

				out.push({
					dir: toVuePath(relDir),
					basename: ent.name,
					extension: '',
					path: toVuePath(childRel),
					storage: 'local',
					type: 'dir',
					file_size: 0,
					last_modified: stat ? Math.floor(stat.mtimeMs / 1000) : 0,
					mime_type: 'directory',
					visibility: 'public',
				});
			}

			if (opts.deep) {
				await walk(childAbs, childRel, opts, out);
			}

			continue;
		}

		if (!matches(opts.termLower, opts.filter, ent.name)) {
			continue;
		}

		let stat = null;
		try { stat = await fs.stat(childAbs); } catch {}

		out.push({
			dir: toVuePath(relDir),
			basename: ent.name,
			extension: extFromName(ent.name),
			path: toVuePath(childRel),
			storage: 'local',
			type: 'file',
			file_size: stat ? stat.size : 0,
			last_modified: stat ? Math.floor(stat.mtimeMs / 1000) : 0,
			mime_type: guessMime(ent.name),
			visibility: 'public',
			url: toPublicUrl(childRel),
		});
	}
}


export default defineEventHandler(async (event) => {

	requireAdmin(event);

	const root = getAssetsRoot();

	const q = getQuery(event);

	const relDir = fromVuePath(q.path || 'local://');

	// VueFinder params (varies):
	// - q=term
	// - query=term
	// - search=term
	// - filter=term or filter=*.ext
	const rawTerm = String(q.q || q.query || q.search || '').trim();
	const filter = String(q.filter || '').trim();

	const deep = String(q.deep || '').toLowerCase() === 'true';

	const termLower = rawTerm ? rawTerm.toLowerCase() : '';

	const absDir = resolveSafe(root, relDir);

	const files = [];
	await walk(absDir, relDir, { deep, termLower, filter }, files);

	return {
		storages: [ 'local' ],
		dirname: toVuePath(relDir),
		read_only: false,
		files,
	};
});
