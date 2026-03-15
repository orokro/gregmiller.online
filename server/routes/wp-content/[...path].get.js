/*
	server/routes/wp-content/[...path].get.js
	-----------------------------------------

	Serve static assets from the wp-content directory at runtime.

	This is necessary because files uploaded to the public/ directory at runtime
	are not automatically served by Nitro's built-in static asset handler in production mode.
*/

// imports
import fs from 'node:fs/promises';
import { getAssetsRoot, resolveSafe } from '../../utils/assetsRoot.js';
import { guessMime } from '../../api/admin/vuefinder/_utils.js';


/**
 * Handle requests for /wp-content/*
 */
export default defineEventHandler(async (event) => {

	const root = getAssetsRoot();

	// In Nitro routes with [...path], the path is available in event.context.params.path
	const relPath = event.context.params.path;

	if (!relPath) {
		throw createError({ statusCode: 400, statusMessage: 'Missing path' });
	}

	try {
		const abs = resolveSafe(root, relPath);
		const data = await fs.readFile(abs);

		// Set the appropriate content-type
		const mime = guessMime(relPath);
		setHeader(event, 'Content-Type', mime);

		// Cache for a long time (1 year) since these are static assets
		setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');

		return data;

	} catch (e) {
		// If file doesn't exist or other error, throw 404
		throw createError({ statusCode: 404, statusMessage: 'Not Found' });
	}
});
