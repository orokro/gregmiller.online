/*
	_utils.js
	---------

	Utility functions for VueFinder file management in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';

function extFromName(name) {
	const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
	return m ? m[1] : '';
}

// Minimal mime resolver (good enough for thumbnails + embeds)
export function guessMime(name) {
	const ext = extFromName(name);
	if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
	if (ext === 'png') return 'image/png';
	if (ext === 'gif') return 'image/gif';
	if (ext === 'webp') return 'image/webp';
	if (ext === 'svg') return 'image/svg+xml';
	if (ext === 'mp4') return 'video/mp4';
	if (ext === 'webm') return 'video/webm';
	if (ext === 'pdf') return 'application/pdf';
	if (ext === 'txt') return 'text/plain';
	if (ext === 'html' || ext === 'htm') return 'text/html';
	if (ext === 'json') return 'application/json';
	return 'application/octet-stream';
}

export function toVuePath(rel) {
	const p = String(rel || '').replace(/^\/+/, '');
	return p ? `local://${p}` : 'local://';
}

export function fromVuePath(p) {
	let s = String(p || '').trim();
	s = s.replace(/^local:\/\//, '');
	s = s.replace(/^\/+/, '');
	return s;
}

export async function listDir({ root, relDir, toPublicUrl }) {

	const abs = path.join(root, relDir);
	const entries = await fs.readdir(abs, { withFileTypes: true });

	const files = [];

	for (const ent of entries) {

		const childRel = relDir ? `${relDir}/${ent.name}` : ent.name;
		const childAbs = path.join(abs, ent.name);

		let stat = null;
		try { stat = await fs.stat(childAbs); } catch {}

		const isDir = ent.isDirectory();
		const ext = extFromName(ent.name);

		files.push({
			dir: toVuePath(relDir),
			basename: ent.name,
			extension: isDir ? '' : ext,
			path: toVuePath(childRel),
			storage: 'local',
			type: isDir ? 'dir' : 'file',
			file_size: stat ? stat.size : 0,
			last_modified: stat ? Math.floor(stat.mtimeMs / 1000) : 0,
			mime_type: isDir ? 'directory' : guessMime(ent.name),
			visibility: 'public',
			// This is non-standard but harmless; VueFinder mainly needs `path`.
			url: isDir ? null : toPublicUrl(childRel),
		});
	}

	// dirs first, then alpha (matches your current list behavior) :contentReference[oaicite:7]{index=7}
	files.sort((a, b) => {
		if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
		return a.basename.localeCompare(b.basename);
	});

	return {
		storages: [ 'local' ],
		dirname: toVuePath(relDir),
		read_only: false,
		files,
	};
}
