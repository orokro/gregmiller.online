/*
	RenderCapability.js
	-------------------

	Decides how much 3D a device gets. Three tiers:

		'parallax'  full live perspective that follows the viewport
		'flat'      3D look rendered once into tiles; nothing renders while scrolling
		'2d'        the non-3D theme (css graph paper, 2D frames)

	Three stages, cheapest first:

		1. staticCheck()    instant, before any 3D assets download.
		                    No WebGL, tiny GPU limits, software renderers, known-weak GPUs,
		                    very low core/memory counts, Save-Data -> 2D.
		2. benchmark        (ThreeManager.benchmark) once the scene is built: time a few real
		                    renders of the on-screen strip, synced with a 1px readPixels so GPU
		                    time counts (CPU timers alone miss it, especially on Safari).
		                    tierFromBenchmark() turns that into a tier; it's cached per device.
		3. watchdog         (ThreeManager) if scrolling frames are consistently slow in
		                    practice, step down a tier and remember it.

	The orchestration lives in layouts/default.vue; the tier state lives in useDeviceContext.
*/


// bump to make every device re-test (e.g. after the renderer gets faster)
const CACHE_VERSION = 'v1';
const CACHE_KEY = 'gm-3d-tier';

// cached results expire so devices get re-tested after browser/driver updates
const CACHE_MAX_AGE_MS = 30 * 24 * 3600 * 1000;

// benchmark thresholds: median ms to render + finish one on-screen strip
export const TIER_THRESHOLDS = {
	parallaxMaxMs: 14,     // can re-render every frame and still leave room for the page
	flatMaxMs: 40,         // can render a tile without a long hitch
};

// GPU name fragments that are known to struggle with the 3D themes (unmasked renderer strings)
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

// the static check only needs to run once per page load
let cachedStatic = null;


/**
 * Instant checks that don't need any assets. Cached after the first call.
 *
 * @returns {{ok:boolean, reason:string, gpu:string, maxTexture:number}}
 */
export function staticCheck() {

	if (cachedStatic)
		return cachedStatic;

	const result = { ok: true, reason: '', gpu: 'unknown', maxTexture: 0 };
	cachedStatic = result;

	if (!process.client) {
		result.ok = false;
		result.reason = 'server';
		cachedStatic = null;
		return result;
	}

	// respect "save data" (also skips the 3D asset download entirely)
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

	// unmasked GPU name (Safari reports a generic "Apple GPU", so there the benchmark decides)
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

	if (WEAK_GPUS.some((re) => re.test(result.gpu))) {
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

	if (medianMs <= TIER_THRESHOLDS.parallaxMaxMs)
		return 'parallax';
	if (medianMs <= TIER_THRESHOLDS.flatMaxMs)
		return 'flat';
	return '2d';
}


/**
 * Cache key for this device: GPU name + screen size + DPR, so a different monitor or
 * browser zoom re-benchmarks.
 *
 * @returns {string}
 */
function deviceKey() {
	return [CACHE_VERSION, staticCheck().gpu, `${screen.width}x${screen.height}`, window.devicePixelRatio].join('|');
}


/**
 * Reads the cached tier for this device.
 *
 * @returns {{tier:string, ms:number, source:string, at:number}|null}
 */
export function loadCachedTier() {

	if (!process.client)
		return null;

	try {
		const raw = localStorage.getItem(CACHE_KEY);
		if (!raw)
			return null;

		const data = JSON.parse(raw);
		if (data.key !== deviceKey())
			return null;

		if (!data.at || Date.now() - data.at > CACHE_MAX_AGE_MS)
			return null;

		return data;
	} catch (e) {
		return null;
	}
}


/**
 * Saves the tier for this device.
 *
 * @param {string} tier - tier
 * @param {number} ms - benchmark median / watchdog median
 * @param {string} source - 'benchmark' | 'watchdog'
 */
export function saveCachedTier(tier, ms, source) {
	try {
		localStorage.setItem(CACHE_KEY, JSON.stringify({ key: deviceKey(), tier, ms, source, at: Date.now() }));
	} catch (e) {
		// private mode etc.
	}
}


/**
 * Forgets the cached tier.
 */
export function clearCachedTier() {
	try {
		localStorage.removeItem(CACHE_KEY);
	} catch (e) {
		// ignore
	}
}


/**
 * Small fading message at the top of the screen (used when the tier drops).
 *
 * @param {string} text - message
 */
export function showRenderToast(text) {

	if (!process.client)
		return;

	const el = document.createElement('div');
	el.textContent = text;
	el.style.cssText = [
		'position:fixed', 'top:12px', 'left:50%', 'transform:translateX(-50%)', 'z-index:100001',
		'font:13px/1.3 Quicksand, sans-serif', 'color:#fff', 'background:rgba(10,20,24,0.88)',
		'border:1px solid var(--color-primary, #00ABAE)', 'border-radius:8px', 'padding:6px 12px',
		'transition:opacity 1s ease', 'pointer-events:none',
	].join(';');
	document.body.appendChild(el);

	setTimeout(() => { el.style.opacity = '0'; }, 3500);
	setTimeout(() => el.remove(), 4600);
}
