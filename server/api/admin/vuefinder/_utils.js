/*
	_utils.js
	---------

	Utility functions for VueFinder file management in admin.
*/

// imports
import fs from 'node:fs/promises';
import path from 'node:path';


/**
 * Get file extension from filename
 *
 * @param {String} name - filename
 * @returns {String} - extension without dot, lowercased
 */
function extFromName(name) {
	const m = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/);
	return m ? m[1] : '';
}


/**
 * Help guess mime type from filename
 *
 * @param {String} name - filename
 * @returns {String} - mime type
 */
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


/**
 * Format a relative path as a VueFinder local:// path
 *
 * @param {String} rel - relative path
 * @returns {String} - VueFinder local path
 */
export function toVuePath(rel) {

	const p = String(rel || '').replace(/^\/+/, '');
	return p ? `local://${p}` : 'local://';
}


/**
 * Convert a VueFinder local:// path to a relative path
 *
 * @param {String} p - VueFinder local:// path
 * @returns {String} - relative path
 */
export function fromVuePath(p) {
	let s = String(p || '').trim();
	s = s.replace(/^local:\/\//, '');
	s = s.replace(/^\/+/, '');
	return s;
}


/**
 * Read request body, handling both JSON/urlencoded and multipart/form-data
 *
 * @param {Object} event - H3 event
 * @returns
 */
export async function readAnyBody(event) {

	const ct = String(getHeader(event, 'content-type') || '').toLowerCase();

	if (ct.includes('multipart/form-data')) {

		const form = await readMultipartFormData(event);
		const out = {};

		for (const part of (form || [])) {

			// files come through as { filename, data } – ignore here
			if (part.filename)
				continue;

			const key = String(part.name || '').trim();
			if (!key)
				continue;

			out[key] = part.data ? part.data.toString('utf8') : '';
		}

		// If VueFinder sent JSON strings inside fields, parse when possible
		for (const k of Object.keys(out)) {
			const v = out[k];
			if (typeof v === 'string' && v.trim().startsWith('{')) {
				try { out[k] = JSON.parse(v); } catch {}
			}
			if (typeof v === 'string' && v.trim().startsWith('[')) {
				try { out[k] = JSON.parse(v); } catch {}
			}
		}

		return out;
	}

	// JSON or urlencoded: Nitro/H3 readBody handles both
	return await readBody(event);
}


/**
 * List directory contents for VueFinder
 *
 * @param {Object} param0 - parameters
 * @returns {Object} - directory listing
 */
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

	// pack and return
	return {
		storages: [ 'local' ],
		dirname: toVuePath(relDir),
		read_only: false,
		files,
	};
}
