/*
	poc/src/Capability.js
	---------------------

	Decides how much 3D a device gets. Three tiers:

		'parallax'  full live perspective (default for capable devices)
		'flat'      3D look, rendered once into tiles, nothing renders while scrolling
		'2d'        the existing non-3D theme (graph paper css background, 2D frames)

	It works in three stages, cheapest first:

		1. staticCheck()   instant, before any 3D assets download.
		                   No WebGL, tiny GPU limits, software renderers, known-weak GPUs,
		                   very low core/memory counts -> straight to 2D.
		2. benchmark       after the scene is built: time a few real renders of the
		                   on-screen strip, synced with a 1px readPixels so GPU time counts
		                   (CPU timers alone miss it, especially on Safari).
		                   The result is cached per device in localStorage.
		3. watchdog        (in TileEngine) if scrolling frames are consistently slow in
		                   practice, step down a tier and remember it.

	On the real site this would feed useDeviceContext's has3DCapability (plus a new
	"parallax allowed" flag) instead of the current WebGL-exists probe.
*/


// bump to invalidate everyone's cached results (e.g. after the renderer gets faster)
const CACHE_VERSION = 'v1';
const CACHE_KEY = 'gm-3d-tier';

// benchmark thresholds: median ms to render + finish one on-screen strip
export const THRESHOLDS = {
	parallaxMaxMs: 14,     // can re-render every frame and still leave room for the page
	flatMaxMs: 40,         // can render a tile without a long hitch
};

// GPU name fragments that are known to struggle with this scene (unmasked renderer strings)
const WEAK_GPUS = [
	/swiftshader/i,
	/llvmpipe/i,
	/softpipe/i,
	/microsoft basic render/i,
	/intel.*hd graphics (2000|2500|3000|4000|4200|4400|4600|5000|5100|5200|5300|5500|6000)\b/i,
	/intel.*gma/i,
	/mali-(2|3|4)\d\d/i,
	/mali-t(6|7)\d\d/i,
	/adreno.*\b(2|3|4)\d\d\b/i,
	/powervr sgx/i,
];


/**
 * Instant checks that don't need any assets.
 *
 * @returns {{ok:boolean, reason:string, gpu:string, maxTexture:number}}
 */
export function staticCheck() {

	const result = { ok: true, reason: '', gpu: 'unknown', maxTexture: 0 };

	// respect "save data" (also skips the asset download entirely)
	if (navigator.connection && navigator.connection.saveData) {
		result.ok = false;
		result.reason = 'save-data is on';
		return result;
	}

	// webgl at all?
	let gl = null;
	try {
		const canvas = document.createElement('canvas');
		gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
	} catch (e) {
		gl = null;
	}

	if (!gl) {
		result.ok = false;
		result.reason = 'no WebGL';
		return result;
	}

	result.maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE);

	// unmasked GPU name (Safari reports a generic "Apple GPU", which is fine)
	const dbg = gl.getExtension('WEBGL_debug_renderer_info');
	if (dbg)
		result.gpu = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || 'unknown');
	else
		result.gpu = String(gl.getParameter(gl.RENDERER) || 'unknown');

	// release the probe context right away
	const lose = gl.getExtension('WEBGL_lose_context');
	if (lose)
		lose.loseContext();

	if (result.maxTexture < 4096) {
		result.ok = false;
		result.reason = `max texture ${result.maxTexture}`;
		return result;
	}

	const weak = WEAK_GPUS.find((re) => re.test(result.gpu));
	if (weak) {
		result.ok = false;
		result.reason = `weak GPU (${result.gpu})`;
		return result;
	}

	// very small machines (Chrome-only hints; undefined elsewhere)
	if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) {
		result.ok = false;
		result.reason = `${navigator.hardwareConcurrency} CPU cores`;
		return result;
	}
	if (navigator.deviceMemory && navigator.deviceMemory <= 2) {
		result.ok = false;
		result.reason = `${navigator.deviceMemory} GB memory`;
		return result;
	}

	return result;
}


/**
 * Turns a benchmark median into a tier.
 *
 * @param {number} medianMs - median strip render time incl. GPU
 * @returns {'parallax'|'flat'|'2d'}
 */
export function tierFromBenchmark(medianMs) {

	if (medianMs <= THRESHOLDS.parallaxMaxMs)
		return 'parallax';
	if (medianMs <= THRESHOLDS.flatMaxMs)
		return 'flat';
	return '2d';
}


/**
 * Cache key for this device: GPU name + screen size + DPR, so a different monitor or
 * browser zoom re-benchmarks.
 *
 * @param {string} gpu - GPU name from staticCheck
 * @returns {string}
 */
function deviceKey(gpu) {
	return [CACHE_VERSION, gpu, `${screen.width}x${screen.height}`, window.devicePixelRatio].join('|');
}


/**
 * Reads a cached tier for this device.
 *
 * @param {string} gpu - GPU name
 * @returns {{tier:string, ms:number, source:string}|null}
 */
export function loadCachedTier(gpu) {

	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw)
			return null;

		const data = JSON.parse(raw);
		if (data.key !== deviceKey(gpu))
			return null;

		// re-test now and then (browser/driver updates, one-off jank tripping the watchdog)
		if (!data.at || Date.now() - data.at > 30 * 24 * 3600 * 1000)
			return null;

		return data;
	} catch (e) {
		return null;
	}
}


/**
 * Saves the tier for this device.
 *
 * @param {string} gpu - GPU name
 * @param {string} tier - tier
 * @param {number} ms - benchmark median (or NaN)
 * @param {string} source - 'benchmark' | 'watchdog'
 */
export function saveCachedTier(gpu, tier, ms, source) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ key: deviceKey(gpu), tier, ms, source, at: Date.now() }));
	} catch (e) {
		// private mode etc.
	}
}


/**
 * Forgets the cached tier (HUD "re-test" button, ?rebench=1).
 */
export function clearCachedTier() {
	try {
		localStorage.removeItem(CACHE_KEY);
	} catch (e) {
		// ignore
	}
}


/**
 * Switches the page to the existing 2D theme. The snapshot renamed every original
 * "no-3d" class to "poc-no3d-slot", so we can put them all back exactly.
 *
 * @param {string} reason - why (shown in the console / toast)
 */
export function apply2D(reason) {

	const html = document.documentElement;
	html.classList.add('no-3d', 'poc-2d');
	html.classList.remove('poc-text-ready');

	document.querySelectorAll('.poc-no3d-slot').forEach((el) => el.classList.add('no-3d'));

	console.info(`[3D] using 2D theme: ${reason}`);
}


/**
 * Small fading message at the top of the screen.
 *
 * @param {string} text - message
 */
export function toast(text) {

	const el = document.createElement('div');
	el.className = 'poc-toast';
	el.textContent = text;
	document.body.appendChild(el);

	setTimeout(() => el.classList.add('gone'), 3500);
	setTimeout(() => el.remove(), 4500);
}
