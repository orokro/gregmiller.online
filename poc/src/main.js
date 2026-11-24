/*
	poc/src/main.js
	---------------

	Boots the sliding-window 3D proof of concept on a snapshotted page.

	URL params:
		?hud=0           hide the debug panel
		?borders=1       outline tiles on load
		?dpr=1.5         device pixel ratio cap
		?underlay=0      disable the low-res safety net
		?mouselight=1    enable the desktop cursor light
		?copy=bitmap     hand frames to tiles via OffscreenCanvas/ImageBitmap instead of drawImage
*/

// app
import { TileEngine } from './TileEngine.js';
import { GlassTheme } from './GlassTheme.js';
import { Hud } from './Hud.js';


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
 * Entry point.
 */
async function main() {

	const params = new URLSearchParams(location.search);
	const isMobile = detectMobile();

	document.documentElement.classList.add(isMobile ? 'is-mobile' : 'is-desktop');

	// phones have 3x screens; 2x is plenty for a soft background
	const dprCap = Number(params.get('dpr')) || 2;

	const engine = new TileEngine({
		dprCap,
		underlay: params.get('underlay') !== '0',
		showBorders: params.get('borders') === '1',
		mouseLight: params.get('mouselight') === '1' && !isMobile,
		copyMode: params.get('copy') === 'bitmap' ? 'bitmap' : 'draw',
	});
	engine.layer.classList.toggle('show-borders', engine.opts.showBorders);

	const theme = new GlassTheme();
	await engine.setTheme(theme);
	theme.enableMouseLight(engine.opts.mouseLight);

	// wait for fonts so the first measurement matches the final layout
	if (document.fonts && document.fonts.ready)
		await document.fonts.ready;

	await engine.collect();
	engine.start();

	if (params.get('hud') !== '0')
		new Hud(engine, theme);

	// handy for poking at it from the console
	window.poc = { engine, theme };
}

main().catch((err) => {
	console.error('POC failed to start', err);
	const box = document.createElement('pre');
	box.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:100000;background:#300;color:#fff;padding:8px;max-width:90vw;white-space:pre-wrap;font:12px monospace';
	box.textContent = `POC failed to start:\n${err && err.stack || err}`;
	document.body.appendChild(box);
});
