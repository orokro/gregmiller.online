/*
	poc/src/main.js
	---------------

	Boots the document-anchored 3D proof of concept on a snapshotted page.

	Tier selection (see Capability.js):
		1. instant hardware check   -> 2D theme for obviously weak devices (no 3D download)
		2. cached result per device -> skip straight to that tier
		3. first visit: benchmark the real scene -> parallax / flat / 2D, cached
		4. watchdog while scrolling -> step down a tier if it turns out choppy

	URL params:
		?tier=parallax|flat|2d   force a tier (skips checks, benchmark, and watchdog)
		?rebench=1        forget the cached result and test again
		?hud=0            hide the debug panel
		?parallax=0       same as ?tier=flat
		?eye=1600         eye distance in px (bigger = subtler parallax, live site = 1000)
		?fps=30           cap parallax renders per second (0 = every frame)
		?dpr=1.5          device pixel ratio cap
		?refraction=half  render the glass refraction buffer at half res (full/half)
		?borders=1        outline the strip / tiles
		?underlay=0       disable the low-res safety net
		?mouselight=1     enable the desktop cursor light
*/

// app
import { TileEngine } from './TileEngine.js';
import { GlassTheme } from './GlassTheme.js';
import { Hud } from './Hud.js';
import {
	staticCheck,
	tierFromBenchmark,
	loadCachedTier,
	saveCachedTier,
	clearCachedTier,
	apply2D,
	toast,
} from './Capability.js';


/**
 * Same device heuristic as useDeviceContext.js (simplified), so the site's
 * is-mobile / is-desktop css applies like it does live.
 *
 * @returns {boolean} true if this looks like a phone/tablet
 */
function detectMobile() {

	const uaData = navigator.userAgentData;
	if (uaData && typeof uaData.mobile === 'boolean' && uaData.mobile)
		return true;

	const ua = navigator.userAgent || '';
	const isIpadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
	const uaLooksMobile = /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua);
	const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

	return Boolean(uaLooksMobile || isIpadDesktopMode || ((navigator.maxTouchPoints || 0) > 0 && coarse));
}


/**
 * Reads a numeric URL param, falling back when missing/invalid.
 *
 * @param {URLSearchParams} params - url params
 * @param {string} name - param name
 * @param {number} fallback - default
 * @returns {number}
 */
function numParam(params, name, fallback) {
	const v = params.get(name);
	if (v === null || v === '' || isNaN(Number(v)))
		return fallback;
	return Number(v);
}


/**
 * Entry point.
 */
async function main() {

	const params = new URLSearchParams(location.search);
	const isMobile = detectMobile();
	const showHud = params.get('hud') !== '0';

	document.documentElement.classList.add(isMobile ? 'is-mobile' : 'is-desktop');

	// forced tier?
	let forced = params.get('tier');
	if (!['parallax', 'flat', '2d'].includes(forced))
		forced = params.get('parallax') === '0' ? 'flat' : null;

	if (params.get('rebench') === '1')
		clearCachedTier();

	// what we know about this device (shown in the HUD)
	const sc = staticCheck();
	const info = { tier: null, reason: '', gpu: sc.gpu, benchMs: null, forced: !!forced };

	/**
	 * Falls back to the 2D theme.
	 *
	 * @param {string} reason - why
	 * @param {boolean} announce - show a toast
	 */
	const go2D = (reason, announce = false) => {
		info.tier = '2d';
		info.reason = reason;
		apply2D(reason);
		if (announce)
			toast('Using the 2D theme on this device');
		if (showHud)
			new Hud(null, null, info);
	};

	// 1. forced 2D, or obviously weak hardware: never download the 3D assets
	if (forced === '2d')
		return go2D('forced by ?tier=2d');
	if (!forced && !sc.ok)
		return go2D(`hardware check: ${sc.reason}`);

	// 2. cached result
	const cached = forced ? null : loadCachedTier(sc.gpu);
	if (cached && cached.tier === '2d')
		return go2D(`cached ${cached.source} result${cached.ms ? ` (${cached.ms.toFixed(1)} ms)` : ''}`);

	const startTier = forced || (cached && cached.tier) || 'parallax';
	info.tier = startTier;
	info.reason = forced ? `forced by ?tier=${forced}` : cached ? `cached ${cached.source} result` : 'benchmark';
	if (cached)
		info.benchMs = cached.ms;

	// mobile defaults are lighter: phones have huge screens and shared GPU bandwidth
	const refraction = params.get('refraction') || (isMobile ? 'half' : 'full');

	const engine = new TileEngine({
		parallax: startTier === 'parallax',
		cameraZ: numParam(params, 'eye', 1000),
		liveFpsCap: numParam(params, 'fps', isMobile ? 60 : 0),
		dprCap: numParam(params, 'dpr', isMobile ? 1.5 : 2),
		halfResRefraction: refraction === 'half',
		underlay: params.get('underlay') !== '0',
		showBorders: params.get('borders') === '1',
		mouseLight: params.get('mouselight') === '1' && !isMobile,
	});
	engine.layer.classList.toggle('show-borders', engine.opts.showBorders);

	const theme = new GlassTheme();
	await engine.setTheme(theme);
	theme.enableMouseLight(engine.opts.mouseLight);

	// wait for fonts so the first measurement matches the final layout
	if (document.fonts && document.fonts.ready)
		await document.fonts.ready;

	await engine.collect();

	// 3. first visit: benchmark the real scene
	if (!forced && !cached) {

		const ms = engine.benchmark();
		const tier = tierFromBenchmark(ms);

		info.benchMs = ms;
		info.tier = tier;
		info.reason = `benchmark ${ms.toFixed(1)} ms`;
		saveCachedTier(sc.gpu, tier, ms, 'benchmark');

		if (tier === '2d') {
			engine.destroy();
			return go2D(info.reason, true);
		}

		if (tier === 'flat')
			engine.setParallax(false);
	}

	let hud = null;

	// 4. watchdog: step down if scrolling turns out choppy (not when forced)
	if (!forced) {
		engine.onDowngrade = (tier, median) => {

			saveCachedTier(sc.gpu, tier, median, 'watchdog');
			info.tier = tier;
			info.reason = `watchdog: ${median.toFixed(0)} ms per scroll frame`;

			if (tier === 'flat') {
				engine.setParallax(false);
				toast('Simplified 3D for smoother scrolling');
				if (hud)
					hud.syncControls();
				return;
			}

			engine.destroy();
			if (hud)
				hud.el.remove();
			go2D(info.reason, true);
		};
	}

	engine.start();

	if (showHud)
		hud = new Hud(engine, theme, info);

	// handy for poking at it from the console
	window.poc = { engine, theme, info };
}

main().catch((err) => {
	console.error('POC failed to start', err);
	const box = document.createElement('pre');
	box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;background:#300;color:#fff;padding:8px;max-width:90vw;white-space:pre-wrap;font:12px monospace';
	box.textContent = `POC failed to start:\n${err && err.stack || err}`;
	document.body.appendChild(box);
});
