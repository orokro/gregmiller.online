/*
	flickr/photoset/[setId].get.js
	------------------------------

	API endpoint to get Flickr photoset (album) info and photos by setId.

	Params:
	- setId (string): The ID of the Flickr photoset to retrieve.

	Returns:
	- Object containing photoset info and an array of photos.
*/

// imports
import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3';


// Cache settings
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map();


/**
 * Makes a call to the Flickr API and returns parsed JSON
 *
 * @param {String} url - Flickr API URL to call
 * @returns {Promise<Object>} - Parsed JSON response
 */
async function flickrCall(url) {

	const res = await fetch(url);

	if (!res.ok) {
		throw createError({
			statusCode: res.status,
			statusMessage: `Flickr HTTP ${res.status}`
		});
	}

	const json = await res.json();

	if (json?.stat !== 'ok') {
		throw createError({
			statusCode: 502,
			statusMessage: `Flickr error: ${json?.message || 'unknown'}`
		});
	}

	return json;
}


/**
 * API handler
 *
 * @param {import('h3').H3Event} event - H3 event object
 * @returns {Promise<Object>} - Photoset info and photos
 */
export default defineEventHandler(async (event) => {

	const setId = getRouterParam(event, 'setId');
	if (!setId)
		throw createError({ statusCode: 400, statusMessage: 'Missing setId' });

	// Query params
	const query = getQuery(event);
	const nocache = query.nocache === '1' || query.nocache === 'true';

	const { flickrApiKey, flickrName } = useRuntimeConfig();
	if (!flickrApiKey)
		throw createError({ statusCode: 500, statusMessage: 'Missing runtimeConfig.flickrApiKey' });

	if (!flickrName)
		throw createError({ statusCode: 500, statusMessage: 'Missing runtimeConfig.flickrName (owner NSID)' });

	// Cache
	const cached = cache.get(setId);
	if (!nocache && cached && (Date.now() - cached.ts) < CACHE_TTL_MS)
		return cached.data;

	const base = 'https://api.flickr.com/services/rest/';
	const common = `&api_key=${encodeURIComponent(flickrApiKey)}&format=json&nojsoncallback=1`;

	const extras = 'url_q,url_n,url_m,url_z,url_c,url_l,url_o,title';
	const photosUrl =
		`${base}?method=flickr.photosets.getPhotos` +
		`${common}` +
		`&photoset_id=${encodeURIComponent(setId)}` +
		`&per_page=500` +
		`&extras=${encodeURIComponent(extras)}`;

	const photosRes = await flickrCall(photosUrl);

	const photos = (photosRes?.photoset?.photo || [])
		.map((p) => {
			// Find best available source and thumb
			// Source: Prefer c (800), then l (1024), then z (640), then m (500), then o (original)
			const src = p.url_c || p.url_l || p.url_z || p.url_m || p.url_o || p.url_n || p.url_q;
			// Thumb: Prefer n (320), then q (150 sq), then m (500)
			const thumb = p.url_n || p.url_q || p.url_m || p.url_z || src;
			
			return {
				id: p.id,
				title: p.title,
				thumb,
				src,
				large: p.url_l || p.url_o || p.url_c || src,
				width: p.width_c || p.width_l || p.width_z || p.width_m || p.width_o || null,
				height: p.height_c || p.height_l || p.height_z || p.height_m || p.height_o || null
			};
		})
		.filter((p) => p.thumb && p.src);

	const payload = {
		id: setId,
		owner: photosRes?.photoset?.owner || flickrName,
		title: photosRes?.photoset?.title || '',
		total: photosRes?.photoset?.total ?? photos.length,
		photos
	};

	cache.set(setId, { ts: Date.now(), data: payload });
	return payload;

});
