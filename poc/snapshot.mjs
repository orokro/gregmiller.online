/*
	poc/snapshot.mjs
	----------------

	Grabs a static snapshot of a few pages from the live site so the proof of concept
	can run without MongoDB, Nuxt, or any of the real app's runtime.

	For each page it:
		- downloads the server-rendered HTML
		- downloads the page's CSS bundles into poc/snapshot/_nuxt/
		- strips every Nuxt <script> (no hydration, the page stays static)
		- removes the "no-3d" class everywhere, so the 3D-mode layout is used
		- tags the 3D text header with the word it should spell
		- injects the POC's own CSS + engine script

	Thumbnails and other /storage/ media are NOT downloaded, the POC server proxies them
	from the live site on demand.

	Usage:
		node poc/snapshot.mjs
*/

// node imports
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// where the live site lives
const LIVE = 'https://gregmiller.online';

// pages to snapshot, and the word their DynamicText3D header spells
// (the word is a prop in the Vue page, so it isn't in the rendered HTML)
const PAGES = [
	{ route: '/', file: 'home.html', text3d: 'gmiller' },
	{ route: '/graffiti-yards', file: 'graffiti-yards.html', text3d: 'Graffiti' },
];

// paths
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, 'snapshot');
const CSS_DIR = path.join(OUT_DIR, '_nuxt');


/**
 * Fetch a URL as text, throwing on non-200 responses.
 *
 * @param {string} url - absolute URL to fetch
 * @returns {Promise<string>} the response body
 */
async function fetchText(url) {

	const res = await fetch(url);
	if (!res.ok)
		throw new Error(`${res.status} fetching ${url}`);

	return await res.text();
}


/**
 * Removes a single class token from every class="..." attribute in an HTML string.
 *
 * @param {string} html - the html to scrub
 * @param {string} token - the class name to remove
 * @returns {string} html without that class
 */
function removeClassToken(html, token) {

	return html.replace(/class="([^"]*)"/g, (match, list) => {
		const kept = list.split(/\s+/).filter((c) => c && c !== token);
		return `class="${kept.join(' ')}"`;
	});
}


/**
 * Turns the live SSR html into a static POC page.
 *
 * @param {string} html - raw html from the live site
 * @param {Object} page - entry from PAGES
 * @returns {string} transformed html
 */
function transformPage(html, page) {

	// drop all scripts (module entry, inline nuxt config, __NUXT_DATA__ payload)
	html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

	// drop module preloads / prefetches (they'd pull the Nuxt app back in)
	html = html.replace(/<link[^>]*rel="(modulepreload|prefetch|preload)"[^>]*>/gi, '');

	// 3D mode everywhere
	html = removeClassToken(html, 'no-3d');

	// the <html> element gets its device class from the POC at runtime
	html = html.replace(/(<html[^>]*?)\sclass="[^"]*"/i, '$1');

	// tell the POC what the 3D header should spell
	html = html.replace(
		/class="container-custom-3d dynamic-text-container"/,
		`class="container-custom-3d dynamic-text-container" data-text3d="${page.text3d}"`
	);

	// the hero carousel is client-rendered; drop in its first slide as a static image
	if (page.carouselSlide) {
		html = html.replace(
			'<div class="carousel-placeholder" data-v-6f0dc927></div>',
			`<div class="carousel-inner" data-v-6f0dc927><div class="slide" data-v-6f0dc927>` +
			`<img class="slide-img" data-v-6f0dc927 src="/${page.carouselSlide}" alt=""></div></div>`
		);
	}

	// inject POC css + engine
	const inject = [
		'<link rel="stylesheet" href="/poc/poc.css">',
		'<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>',
		'<script type="module" src="/poc/src/main.js"></script>',
	].join('\n');
	html = html.replace('</head>', `${inject}\n</head>`);

	return html;
}


/**
 * Main entry: snapshot every page + its CSS.
 */
async function main() {

	fs.mkdirSync(CSS_DIR, { recursive: true });

	// keep track of css we've already downloaded
	const cssDone = new Set();

	for (const page of PAGES) {

		console.log(`Snapshotting ${LIVE}${page.route}`);
		const raw = await fetchText(LIVE + page.route);

		// first carousel slide (public API, read-only)
		if (raw.includes('carousel-placeholder')) {
			try {
				const slides = JSON.parse(await fetchText(`${LIVE}/api/carousel`));
				page.carouselSlide = slides?.[0]?.imageUrl || null;
			} catch (e) {
				console.warn('  could not fetch carousel slides, leaving it empty');
			}
		}

		// download css bundles this page links to
		const cssLinks = [...raw.matchAll(/href="(\/_nuxt\/[^"]+\.css)"/g)].map((m) => m[1]);
		for (const href of cssLinks) {

			if (cssDone.has(href))
				continue;
			cssDone.add(href);

			const css = await fetchText(LIVE + href);
			fs.writeFileSync(path.join(CSS_DIR, path.basename(href)), css);
			console.log(`  css ${href}`);
		}

		fs.writeFileSync(path.join(OUT_DIR, page.file), transformPage(raw, page));
		console.log(`  wrote snapshot/${page.file}`);
	}

	console.log('Done.');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
