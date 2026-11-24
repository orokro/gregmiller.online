/*
	poc/server.mjs
	--------------

	Zero-dependency dev server for the sliding-window 3D proof of concept.
	No Vite, no Nuxt, no database: just plain Node so it behaves the same on Windows,
	Mac and Linux without reinstalling node_modules.

	Serves:
		/                   -> poc/snapshot/home.html
		/graffiti-yards     -> poc/snapshot/graffiti-yards.html
		/poc/*              -> poc/*                (engine source + css)
		/three/*            -> node_modules/three/*  (three.js as native ES modules)
		/_nuxt/*.css        -> poc/snapshot/_nuxt/*  (snapshotted css)
		anything else       -> public/* if it exists locally
		                       otherwise proxied from the live site (thumbnails etc.)

	Listens on 0.0.0.0 so phones/tablets on the same network can reach it.

	Usage:
		node poc/server.mjs              (port 5199)
		PORT=6000 node poc/server.mjs
*/

// node imports
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

// config
const LIVE = 'https://gregmiller.online';
const PORT = Number(process.env.PORT) || 5199;

// paths
const POC_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_DIR = path.resolve(POC_DIR, '..');
const SNAP_DIR = path.join(POC_DIR, 'snapshot');
const PUBLIC_DIR = path.join(REPO_DIR, 'public');
const THREE_DIR = path.join(REPO_DIR, 'node_modules', 'three');

// snapshot routes
const PAGES = {
	'/': 'home.html',
	'/graffiti-yards': 'graffiti-yards.html',
};

// content types we care about
const MIME = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.mjs': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json',
	'.wasm': 'application/wasm',
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp',
	'.svg': 'image/svg+xml',
	'.ico': 'image/x-icon',
	'.glb': 'model/gltf-binary',
	'.hdr': 'application/octet-stream',
	'.exr': 'application/octet-stream',
	'.pdf': 'application/pdf',
	'.webmanifest': 'application/manifest+json',
};


/**
 * Resolve a url path inside a base directory, refusing anything that escapes it.
 *
 * @param {string} base - directory to serve from
 * @param {string} rel - url path relative to that directory
 * @returns {string|null} absolute file path, or null if it escapes / doesn't exist
 */
function safeFile(base, rel) {

	const abs = path.resolve(base, '.' + path.posix.normalize('/' + rel));
	if (abs !== base && !abs.startsWith(base + path.sep))
		return null;

	try {
		if (fs.statSync(abs).isFile())
			return abs;
	} catch (e) {
		// doesn't exist
	}

	return null;
}


/**
 * Stream a local file to the response.
 *
 * @param {http.ServerResponse} res - response
 * @param {string} file - absolute file path
 * @param {boolean} cache - whether the browser may cache it
 */
function sendFile(res, file, cache) {

	const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
	res.writeHead(200, {
		'Content-Type': type,
		'Cache-Control': cache ? 'public, max-age=3600' : 'no-store',
	});
	fs.createReadStream(file).pipe(res);
}


/**
 * Proxy a GET from the live site (used for /storage thumbnails and anything not in public/).
 *
 * @param {http.ServerResponse} res - response
 * @param {string} url - path + query to fetch from the live site
 */
async function proxyLive(res, url) {

	try {
		const upstream = await fetch(LIVE + url, { redirect: 'follow' });

		res.writeHead(upstream.status, {
			'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
			'Cache-Control': 'public, max-age=86400',
		});

		if (!upstream.body)
			return res.end();

		Readable.fromWeb(upstream.body).pipe(res);

	} catch (err) {
		res.writeHead(502, { 'Content-Type': 'text/plain' });
		res.end(`Proxy error: ${err.message}`);
	}
}


/**
 * Main request handler.
 *
 * @param {http.IncomingMessage} req - request
 * @param {http.ServerResponse} res - response
 */
async function handle(req, res) {

	const url = new URL(req.url, 'http://localhost');
	const p = decodeURIComponent(url.pathname);
	let file = null;

	// snapshot pages
	if (PAGES[p]) {
		file = safeFile(SNAP_DIR, PAGES[p]);
		if (!file) {
			res.writeHead(500, { 'Content-Type': 'text/plain' });
			return res.end('Snapshot missing. Run: npm run poc:snapshot');
		}
		return sendFile(res, file, false);
	}

	// POC source
	if (p.startsWith('/poc/')) {
		file = safeFile(POC_DIR, p.slice('/poc/'.length));
		if (file)
			return sendFile(res, file, false);
	}

	// three.js modules
	if (p.startsWith('/three/')) {
		file = safeFile(THREE_DIR, p.slice('/three/'.length));
		if (file)
			return sendFile(res, file, true);
	}

	// snapshotted css
	if (p.startsWith('/_nuxt/')) {
		file = safeFile(path.join(SNAP_DIR, '_nuxt'), p.slice('/_nuxt/'.length));
		if (file)
			return sendFile(res, file, true);
	}

	// local public assets (models, textures, env maps, img)
	file = safeFile(PUBLIC_DIR, p.slice(1));
	if (file)
		return sendFile(res, file, true);

	// other site pages aren't part of the POC: send the browser to the real site
	const looksLikePage = !path.extname(p) && (req.headers.accept || '').includes('text/html');
	if (looksLikePage) {
		res.writeHead(302, { Location: LIVE + p + url.search });
		return res.end();
	}

	// everything else (thumbnails, media) comes from the live site
	return proxyLive(res, p + url.search);
}


// start up
http.createServer((req, res) => {
	handle(req, res).catch((err) => {
		console.error(err);
		res.writeHead(500);
		res.end();
	});
}).listen(PORT, '0.0.0.0', () => {

	console.log('\n  gregmiller.online 3D sliding-window POC\n');
	console.log(`  Local:   http://localhost:${PORT}/`);

	// list LAN addresses so a phone can connect
	for (const list of Object.values(os.networkInterfaces())) {
		for (const a of list || []) {
			if (a.family === 'IPv4' && !a.internal)
				console.log(`  Network: http://${a.address}:${PORT}/`);
		}
	}

	console.log('\n  Pages: /  and  /graffiti-yards   (add ?hud=0 to hide the debug panel)\n');
});
