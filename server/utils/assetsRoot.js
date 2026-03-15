/*
	server/utils/assetsRoot.js
	--------------------------

	Utility functions to manage the assets root directory and safe path resolution.

	It provides functions to get the assets root directory, resolve user-provided paths safely,
	and convert paths to public URLs.

	It works by ensuring that any user-provided paths are sanitized and resolved within the designated assets root directory,
	preventing directory traversal attacks.
*/

// imports
import path from 'node:path';
import { createError } from 'h3';

export function getAssetsRoot() {

	const { uploadRoot } = useRuntimeConfig();

	// Default to <project>/storage
	const root = uploadRoot
		? path.resolve(String(uploadRoot))
		: path.resolve(process.cwd(), 'storage');

	return root;
}

export function resolveSafe(root, userPath) {

	const cleaned = String(userPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
	const abs = path.resolve(root, cleaned);

	if (!abs.startsWith(root)) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid path' });
	}

	return abs;
}

export function toPublicUrl(userPath) {
	const cleaned = String(userPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
	return `/storage/${cleaned}`;
}
