/*
	poc/src/TileEngine.js
	---------------------

	Sliding-window ("tiled") 3D renderer for DOM-synced backgrounds.

	The core idea:
		- World space == document space (1 unit = 1 CSS px, y flipped so +y is up).
		- Geometry is built ONCE at document positions and only rebuilt on reflow.
		- One offscreen WebGLRenderer draws horizontal "tiles" of the document.
		- Each tile is a plain 2D <canvas> that sits INSIDE the document
		  (position: absolute, top = tileIndex * tileHeight).
		- Because the tiles are ordinary document content, the browser's compositor
		  scrolls / flings / pinch-zooms them together with the DOM.
		  JS never has to "catch up" with scrolling for things to stay aligned.
		- JS decides which tiles should exist (current view + lookahead in the scroll
		  direction) and renders missing ones.
		- A very low-res render of the whole page sits underneath as a safety net
		  in case a hard flick outruns the sharp tiles.

	Two camera modes:

		PARALLAX (default)
			An off-axis perspective camera whose eye sits over the current viewport
			(+100px to the right, like the old perspectiveX). Its "window" is always a
			rectangle on the z = 0 document plane, so anything AT z = 0 lands on exactly
			the same pixels no matter where the eye is: the base of every frame stays
			locked to the DOM. Only things above/below the plane (glass bevels, letters,
			shadows) shift with the eye, which is the parallax.

			While scrolling, the visible part of the page is re-rendered once per frame
			with the new eye and copied into the tiles under it. If that render is late,
			only the depth effect lags by a frame; alignment can't drift.

		FLAT (parallax off)
			Orthographic camera with a small oblique shear. Tiles never need
			re-rendering on scroll, so it's the cheapest mode.
*/

// three
import * as THREE from 'three';


/**
 * The tiled renderer.
 */
export class TileEngine {

	/**
	 * @param {Object} opts - options, see defaults below
	 */
	constructor(opts = {}) {

		// options (most are tweakable from the HUD)
		this.opts = Object.assign({
			parallax: true,          // live perspective that follows the viewport
			dprCap: 2,               // max device pixel ratio for tiles
			tileVh: 1.0,             // tile height as a fraction of the viewport height
			aheadVh: 1.25,           // how far ahead (in viewports) to pre-render in the scroll direction
			behindVh: 0.35,          // how far behind to keep rendered
			minPool: 5,              // minimum number of tile canvases kept around
			frameBudgetMs: 10,       // after the first render, stop rendering lookahead tiles past this
			underlay: true,          // low-res whole page safety net
			underlayScale: 0.125,    // underlay resolution relative to CSS px
			showBorders: false,      // outline tiles (debug)
			mouseLight: false,       // desktop cursor light
			cameraZ: 1000,           // eye distance from the page (bigger = flatter)
			eyeOffsetX: 100,         // eye offset from viewport center (old perspectiveX = -100)
			eyeOffsetY: 0,           // eye offset from viewport center (old perspectiveY)
			obliqueX: -0.1,          // flat mode: screen-x shift per unit of height
			obliqueY: 0.0,           // flat mode: screen-y shift per unit of height
			copyMode: 'draw',        // 'draw' or 'bitmap' (bitmap only works with parallax off)
		}, opts);

		// partial (live) updates need 2D tiles
		if (this.opts.parallax)
			this.opts.copyMode = 'draw';

		// the theme (set via setTheme)
		this.theme = null;

		// registered DOM items: { el, kind, group, empties, rect, themeData }
		this.items = [];

		// layout state
		this.docW = 0;
		this.docH = 0;
		this.dpr = 1;
		this.tileWpx = 0;      // tile width in device px
		this.tilePx = 0;       // tile height in device px
		this.tileH = 0;        // tile height in css px (tilePx / dpr, may be fractional)

		// tiles: index -> { index, canvas, ctx, hasContent, fresh, lastUsed }
		this.tiles = new Map();

		// eye (world coords) for parallax mode
		this.eye = new THREE.Vector3();
		this._liveEyeY = null;
		this._liveDirty = true;

		// scroll tracking
		this._lastTop = window.scrollY;
		this._dir = 1;
		this._raf = 0;

		// state flags
		this.underlayDirty = true;
		this._underlayTimer = 0;
		this._reflowTimer = 0;
		this._started = false;

		// stats for the HUD
		this.stats = {
			tileRenders: 0,
			lastTileMs: 0,
			maxTileMs: 0,
			avgTileMs: 0,
			liveRenders: 0,
			lastLiveMs: 0,
			avgLiveMs: 0,
			maxLiveMs: 0,
			underlayMs: 0,
			outrunFrames: 0,
			reflows: 0,
		};

		// optional HUD hook
		this.onStats = null;

		this._initRenderer();
		this._initLayer();
		this._bindEvents();
	}


	/* ==========================================================================
	   SETUP
	   ========================================================================== */

	/**
	 * Builds the offscreen renderer, scene and cameras.
	 */
	_initRenderer() {

		// how finished frames get into the tile canvases:
		//   'draw'   - normal canvas + 2D drawImage() copy (works everywhere, allows partial copies)
		//   'bitmap' - OffscreenCanvas + transferToImageBitmap() into a 'bitmaprenderer' tile
		if (this.opts.copyMode === 'bitmap' && typeof OffscreenCanvas === 'undefined')
			this.opts.copyMode = 'draw';
		this.copyMode = this.opts.copyMode === 'bitmap' ? 'bitmap' : 'draw';

		// offscreen canvas: never inserted into the DOM, we copy its pixels into tiles
		this.glCanvas = this.copyMode === 'bitmap'
			? new OffscreenCanvas(1, 1)
			: document.createElement('canvas');

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.glCanvas,
			alpha: false,
			antialias: true,
			preserveDrawingBuffer: true,   // so drawImage() always sees the finished frame
			powerPreference: 'high-performance',
		});

		// we manage device pixels ourselves
		this.renderer.setPixelRatio(1);

		// shadows only update when we render, not every frame
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.shadowMap.autoUpdate = false;

		// scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(0xf0f0f0);

		// cameras (projection matrices are built by hand per render)
		this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
		this.perspCam = new THREE.PerspectiveCamera();
		this.camera = this.perspCam;

		// reusable temps
		this._shear = new THREE.Matrix4();
		this._size = new THREE.Vector2();

		// remember GPU limits
		const gl = this.renderer.getContext();
		this.maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
		this.maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
	}


	/**
	 * Creates the in-document layer that holds the tile canvases.
	 */
	_initLayer() {

		this.layer = document.createElement('div');
		this.layer.id = 'poc-gl-layer';
		document.body.prepend(this.layer);

		// low-res whole page underlay
		this.underlayCanvas = document.createElement('canvas');
		this.underlayCanvas.className = 'poc-underlay';
		this.underlayCtx = this.underlayCanvas.getContext(this.copyMode === 'bitmap' ? 'bitmaprenderer' : '2d');
		this.layer.appendChild(this.underlayCanvas);
	}


	/**
	 * Hook up scroll / resize / reflow / mouse events.
	 */
	_bindEvents() {

		// scroll only schedules work; the compositor already moved the tiles
		const kick = () => this.kick();
		window.addEventListener('scroll', kick, { passive: true });
		if (window.visualViewport) {
			window.visualViewport.addEventListener('scroll', kick, { passive: true });
			window.visualViewport.addEventListener('resize', kick, { passive: true });
		}

		// width changes (rotation / window resize) need a full relayout;
		// height-only changes (iOS URL bar showing/hiding) just need bookkeeping
		window.addEventListener('resize', () => {
			if (document.documentElement.clientWidth !== this.docW)
				this.requestReflow();
			else
				this.kick();
		});

		// content reflow (images loading, fonts, etc.)
		this.resizeObserver = new ResizeObserver(() => this.requestReflow());
		this.resizeObserver.observe(document.body);

		// desktop cursor light
		window.addEventListener('pointermove', (e) => {

			if (!this.opts.mouseLight || e.pointerType !== 'mouse' || !this.theme)
				return;

			this.theme.setMouseLight(e.pageX, e.pageY);

			if (this.opts.parallax) {
				// the live pass repaints what's on screen
				this._liveDirty = true;
				this.kick();
			} else {
				this.tiles.forEach((t) => { t.fresh = false; });
				this.kick();
			}
		}, { passive: true });
	}


	/**
	 * Sets the theme. The theme gets build/update hooks for each registered item.
	 *
	 * @param {Object} theme - theme instance
	 */
	async setTheme(theme) {
		this.theme = theme;
		await theme.init(this);
	}


	/* ==========================================================================
	   ITEMS (DOM elements that get 3D geometry)
	   ========================================================================== */

	/**
	 * Finds every 3D container in the page and builds geometry for it.
	 */
	async collect() {

		const found = [];
		document.querySelectorAll('.container-3d').forEach((el) => found.push({ el, kind: 'box' }));
		document.querySelectorAll('.container-custom-3d.bg-cover-container').forEach((el) => found.push({ el, kind: 'cover' }));
		document.querySelectorAll('.container-custom-3d.dynamic-text-container').forEach((el) => found.push({ el, kind: 'text3d' }));

		for (const f of found) {

			// root group positioned at the element's center + corner empties (same contract as ThreeManager)
			const group = new THREE.Group();
			const empties = {
				center: new THREE.Group(),
				tl: new THREE.Group(),
				tr: new THREE.Group(),
				bl: new THREE.Group(),
				br: new THREE.Group(),
			};
			Object.values(empties).forEach((g) => group.add(g));
			this.scene.add(group);

			const item = {
				el: f.el,
				kind: f.kind,
				group,
				empties,
				rect: null,
				themeData: {},
				corners: {
					tl: f.el.querySelector(':scope > .measure-wrapper > .corner.top-left'),
					br: f.el.querySelector(':scope > .measure-wrapper > .corner.bottom-right'),
				},
			};

			this.items.push(item);
			this.resizeObserver.observe(f.el);
		}

		// measure first so builds know their size
		this._measureLayout();
		this.items.forEach((item) => this._measureItem(item));

		// build (some builds load assets, so await them all)
		await Promise.all(this.items.map((item) => this.theme.build(item)));
		this.items.forEach((item) => this.theme.update(item));
	}


	/**
	 * Measures an item's document-space rect from its corner markers and positions its group.
	 *
	 * @param {Object} item - registered item
	 */
	_measureItem(item) {

		const { tl, br } = item.corners;
		if (!tl || !br) {
			item.group.visible = false;
			return;
		}

		const a = tl.getBoundingClientRect();
		const b = br.getBoundingClientRect();

		const rect = {
			left: a.left + window.scrollX,
			top: a.top + window.scrollY,
			width: b.left - a.left,
			height: b.top - a.top,
		};
		item.rect = rect;

		// hidden / collapsed elements get no geometry
		item.group.visible = rect.width > 0 && rect.height > 0;

		// world: x = doc x, y = -doc y
		const halfW = rect.width / 2;
		const halfH = rect.height / 2;
		item.group.position.set(rect.left + halfW, -(rect.top + halfH), 0);

		item.empties.center.position.set(0, 0, 0);
		item.empties.tl.position.set(-halfW, halfH, 0);
		item.empties.tr.position.set(halfW, halfH, 0);
		item.empties.bl.position.set(-halfW, -halfH, 0);
		item.empties.br.position.set(halfW, -halfH, 0);
	}


	/**
	 * Measures document size and (re)configures tile geometry if the width changed.
	 */
	_measureLayout() {

		// collapse our own layer first so it doesn't hold the document height open
		this.layer.style.height = '0px';

		const docW = document.documentElement.clientWidth;
		const docH = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
		const widthChanged = docW !== this.docW;

		this.docW = docW;
		this.docH = docH;
		this.layer.style.width = `${docW}px`;
		this.layer.style.height = `${docH}px`;

		// tile size is only re-derived when the width changes, so the iOS URL bar
		// growing/shrinking mid-scroll never throws away every tile.
		// tiles are 15% taller than the viewport so the live pass covers the screen
		// even when the URL bar collapses.
		if (widthChanged || !this.tilePx) {

			this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.dprCap);

			const vh = Math.max(window.innerHeight, document.documentElement.clientHeight);
			const tileCss = Math.max(300, vh * this.opts.tileVh * 1.15);

			this.tileWpx = Math.round(docW * this.dpr);
			this.tilePx = Math.round(tileCss * this.dpr);
			this.tileH = this.tilePx / this.dpr;

			// throw away all tile canvases, their sizes are wrong now
			this.tiles.forEach((t) => t.canvas.remove());
			this.tiles.clear();
		}
	}


	/* ==========================================================================
	   REFLOW / INVALIDATION
	   ========================================================================== */

	/**
	 * Debounced full re-measure. Reflows are rare compared to scrolling, so this is
	 * where we're allowed to spend time.
	 */
	requestReflow() {

		if (!this._started)
			return;

		clearTimeout(this._reflowTimer);
		this._reflowTimer = setTimeout(() => this.reflow(), 120);
	}


	/**
	 * Re-measures everything, updates geometry, and invalidates all tiles.
	 */
	reflow() {

		this.stats.reflows++;

		this._measureLayout();
		this.items.forEach((item) => {
			this._measureItem(item);
			this.theme.update(item);
		});

		this.invalidateAll();
	}


	/**
	 * Marks every tile + the underlay as needing a re-render. Tiles keep showing their old
	 * pixels until replaced (slightly stale beats blank).
	 */
	invalidateAll() {

		this.tiles.forEach((t) => { t.fresh = false; });
		this.underlayDirty = true;
		this._liveDirty = true;
		this.kick();
	}


	/**
	 * Full rebuild of tile canvases (used when DPR or tile size options change).
	 */
	rebuildTiles() {
		this.docW = -1;
		this.reflow();
	}


	/* ==========================================================================
	   CAMERAS
	   ========================================================================== */

	/**
	 * Flat mode: orthographic camera over a document region, with oblique shear.
	 *
	 * @param {number} x - region left (doc px)
	 * @param {number} y - region top (doc px)
	 * @param {number} w - region width (doc px)
	 * @param {number} h - region height (doc px)
	 */
	_aimOrtho(x, y, w, h) {

		const cam = this.orthoCam;
		const D = this.opts.cameraZ;

		cam.left = -w / 2;
		cam.right = w / 2;
		cam.top = h / 2;
		cam.bottom = -h / 2;
		cam.near = 1;
		cam.far = D * 4;
		cam.position.set(x + w / 2, -(y + h / 2), D);
		cam.updateProjectionMatrix();
		cam.updateMatrixWorld();

		// oblique shear: screen offset proportional to world height above the z=0 plane.
		// in view space z_world = z_view + D
		const kx = this.opts.obliqueX;
		const ky = this.opts.obliqueY;
		this._shear.set(
			1, 0, kx, kx * D,
			0, 1, ky, ky * D,
			0, 0, 1, 0,
			0, 0, 0, 1
		);
		cam.projectionMatrix.multiply(this._shear);
		cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

		this.camera = cam;
	}


	/**
	 * Parallax mode: off-axis perspective. The eye is wherever this.eye says (over the
	 * viewport); the frustum is cut so the region's rectangle ON THE z=0 PLANE fills the
	 * output exactly. That's what keeps z=0 locked to the DOM regardless of eye position,
	 * and why every tile/strip rendered from the same eye lines up seamlessly.
	 *
	 * @param {number} x - region left (doc px)
	 * @param {number} y - region top (doc px)
	 * @param {number} w - region width (doc px)
	 * @param {number} h - region height (doc px)
	 */
	_aimPerspective(x, y, w, h) {

		const cam = this.perspCam;
		const D = this.opts.cameraZ;
		const E = this.eye;

		const near = 10;
		const far = D * 4;
		const k = near / D;

		// region edges on the z=0 plane (world coords)
		const x0 = x;
		const x1 = x + w;
		const yTop = -y;
		const yBot = -(y + h);

		cam.near = near;
		cam.far = far;
		cam.position.set(E.x, E.y, D);
		cam.rotation.set(0, 0, 0);
		cam.updateMatrixWorld();

		cam.projectionMatrix.makePerspective(
			(x0 - E.x) * k,
			(x1 - E.x) * k,
			(yTop - E.y) * k,
			(yBot - E.y) * k,
			near,
			far
		);
		cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

		this.camera = cam;
	}


	/**
	 * Puts the eye over the current viewport (+ the old perspective offsets).
	 *
	 * @param {{top:number, height:number}} view - visible region in doc px
	 */
	_updateEye(view) {
		this.eye.set(
			this.docW / 2 + this.opts.eyeOffsetX,
			-(view.top + view.height / 2 + this.opts.eyeOffsetY),
			this.opts.cameraZ
		);
	}


	/* ==========================================================================
	   RENDERING
	   ========================================================================== */

	/**
	 * Renders a document region into the offscreen canvas at a given pixel size.
	 *
	 * @param {number} x - region left (doc px)
	 * @param {number} y - region top (doc px)
	 * @param {number} w - region width (doc px)
	 * @param {number} h - region height (doc px)
	 * @param {number} pxW - output width in device pixels
	 * @param {number} pxH - output height in device pixels
	 * @param {boolean} perspective - use the parallax camera
	 */
	_renderRegion(x, y, w, h, pxW, pxH, perspective) {

		// only resize the drawing buffer when needed (it's an allocation)
		this.renderer.getSize(this._size);
		if (this._size.x !== pxW || this._size.y !== pxH)
			this.renderer.setSize(pxW, pxH, false);

		if (perspective)
			this._aimPerspective(x, y, w, h);
		else
			this._aimOrtho(x, y, w, h);

		// let the theme move its light rig / shadow frustum / view-dependent bits
		if (this.theme) {
			this.theme.prepareRegion({ x, y, w, h });
			this.theme.prepareView(perspective ? { eye: this.eye, D: this.opts.cameraZ } : null);
		}

		this.renderer.shadowMap.needsUpdate = true;
		this.renderer.render(this.scene, this.camera);
	}


	/**
	 * Gets (or creates / recycles) the tile object for a given index.
	 *
	 * @param {number} index - tile index
	 * @param {number} keepFirst - first index we must not evict
	 * @param {number} keepLast - last index we must not evict
	 * @returns {Object} tile
	 */
	_acquireTile(index, keepFirst, keepLast) {

		let tile = this.tiles.get(index);
		if (tile)
			return tile;

		// pool size: enough for everything we keep + slack for scrolling back
		const span = keepLast - keepFirst + 1;
		const poolSize = Math.max(this.opts.minPool, span + 2);

		let canvas = null;

		// evict least-recently-used tile outside the keep range if the pool is full
		if (this.tiles.size >= poolSize) {

			let victim = null;
			this.tiles.forEach((t) => {
				if (t.index >= keepFirst && t.index <= keepLast)
					return;
				if (!victim || t.lastUsed < victim.lastUsed)
					victim = t;
			});

			if (victim) {
				this.tiles.delete(victim.index);
				canvas = victim.canvas;
			}
		}

		// otherwise make a fresh canvas
		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.className = 'poc-tile';
			canvas.width = this.tileWpx;
			canvas.height = this.tilePx;
			canvas.style.width = `${this.docW}px`;
			canvas.style.height = `${this.tileH}px`;
			this.layer.appendChild(canvas);
		}

		// move it into place, hidden until it has real pixels for this index
		canvas.style.top = `${index * this.tileH}px`;
		canvas.style.visibility = 'hidden';
		canvas.dataset.index = index;

		// reuse the context the canvas already has (a canvas can only ever have one type)
		if (!canvas._pocCtx) {
			canvas._pocCtx = this.copyMode === 'bitmap'
				? canvas.getContext('bitmaprenderer')
				: canvas.getContext('2d');
		} else if (this.copyMode === 'draw') {
			canvas._pocCtx.clearRect(0, 0, canvas.width, canvas.height);
		}

		tile = {
			index,
			canvas,
			ctx: canvas._pocCtx,
			hasContent: false,
			fresh: false,
			lastUsed: 0,
		};
		this.tiles.set(index, tile);

		return tile;
	}


	/**
	 * Renders one whole tile and copies it into its canvas.
	 *
	 * @param {Object} tile - tile to render
	 */
	_renderTile(tile) {

		const t0 = performance.now();

		this._renderRegion(0, tile.index * this.tileH, this.docW, this.tileH, this.tileWpx, this.tilePx, this.opts.parallax);
		this._present(tile.ctx, this.tileWpx, this.tilePx);

		tile.hasContent = true;
		tile.fresh = true;
		tile.canvas.style.visibility = 'visible';

		// stats (the copy waits for the GPU, so this is close to real cost)
		const ms = performance.now() - t0;
		const s = this.stats;
		s.tileRenders++;
		s.lastTileMs = ms;
		s.maxTileMs = Math.max(s.maxTileMs, ms);
		s.avgTileMs = s.avgTileMs ? s.avgTileMs * 0.9 + ms * 0.1 : ms;
	}


	/**
	 * Parallax live pass: renders one tile-sized strip starting at the top of the
	 * viewport from the current eye, then copies the overlapping slices into whichever
	 * tiles sit under it.
	 *
	 * @param {{top:number, height:number}} view - visible region in doc px
	 * @param {number} keepFirst - first tile index we're keeping
	 * @param {number} keepLast - last tile index we're keeping
	 * @param {number} now - rAF timestamp
	 */
	_renderLive(view, keepFirst, keepLast, now) {

		const t0 = performance.now();

		const dpr = this.dpr;
		const Tpx = this.tilePx;
		const Wpx = this.tileWpx;

		// strip in device pixels, snapped to whole pixels so copies line up exactly
		const topPx = Math.max(0, Math.round(view.top * dpr));
		const botPx = topPx + Tpx;

		this._renderRegion(0, topPx / dpr, this.docW, this.tileH, Wpx, Tpx, true);

		const maxIdx = Math.max(0, Math.ceil(this.docH / this.tileH) - 1);
		const iFirst = Math.min(maxIdx, Math.floor(topPx / Tpx));
		const iLast = Math.min(maxIdx, Math.floor((botPx - 1) / Tpx));

		for (let i = iFirst; i <= iLast; i++) {

			const tile = this._acquireTile(i, Math.min(keepFirst, iFirst), Math.max(keepLast, iLast));
			tile.lastUsed = now;

			const tileTop = i * Tpx;
			const a = Math.max(topPx, tileTop);
			const b = Math.min(botPx, tileTop + Tpx);
			if (b <= a)
				continue;

			tile.ctx.drawImage(this.glCanvas, 0, a - topPx, Wpx, b - a, 0, a - tileTop, Wpx, b - a);
			tile.hasContent = true;
			tile.canvas.style.visibility = 'visible';

			// a strip that covered the whole tile counts as a full render
			if (a === tileTop && b === tileTop + Tpx)
				tile.fresh = true;
		}

		this._liveEyeY = this.eye.y;
		this._liveDirty = false;

		const ms = performance.now() - t0;
		const s = this.stats;
		s.liveRenders++;
		s.lastLiveMs = ms;
		s.maxLiveMs = Math.max(s.maxLiveMs, ms);
		s.avgLiveMs = s.avgLiveMs ? s.avgLiveMs * 0.9 + ms * 0.1 : ms;
	}


	/**
	 * Renders the low-res whole-document underlay (always flat; it's only a safety net).
	 */
	_renderUnderlay() {

		this.underlayDirty = false;

		if (!this.opts.underlay) {
			this.underlayCanvas.style.display = 'none';
			return;
		}

		const t0 = performance.now();

		// keep inside GPU limits: the doc can be 60k+ px tall
		const cap = Math.min(this.maxRenderbuffer || 4096, this.maxViewport?.[1] || 4096, 8192);
		const s = Math.min(this.opts.underlayScale, cap / this.docH);
		const pxW = Math.max(1, Math.round(this.docW * s));
		const pxH = Math.max(1, Math.round(this.docH * s));

		this._renderRegion(0, 0, this.docW, this.docH, pxW, pxH, false);

		const c = this.underlayCanvas;
		c.width = pxW;
		c.height = pxH;
		c.style.width = `${this.docW}px`;
		c.style.height = `${this.docH}px`;
		c.style.display = 'block';
		this._present(this.underlayCtx, pxW, pxH);

		this.stats.underlayMs = performance.now() - t0;

		// the underlay render moved the shared view-dependent state; make the next
		// live pass repaint so nothing on screen is left with it
		this._liveDirty = true;
	}


	/**
	 * Hands the just-rendered frame to a tile/underlay canvas context.
	 *
	 * @param {CanvasRenderingContext2D|ImageBitmapRenderingContext} ctx - destination
	 * @param {number} pxW - frame width
	 * @param {number} pxH - frame height
	 */
	_present(ctx, pxW, pxH) {

		if (this.copyMode === 'bitmap') {
			ctx.transferFromImageBitmap(this.glCanvas.transferToImageBitmap());
			return;
		}

		ctx.clearRect(0, 0, pxW, pxH);
		ctx.drawImage(this.glCanvas, 0, 0, pxW, pxH, 0, 0, pxW, pxH);
	}


	/* ==========================================================================
	   FRAME SCHEDULING
	   ========================================================================== */

	/**
	 * Starts the engine (after theme + items are ready).
	 */
	start() {
		this._started = true;
		this.kick();
	}


	/**
	 * Schedule a frame (cheap if nothing needs rendering).
	 */
	kick() {
		if (!this._raf && this._started)
			this._raf = requestAnimationFrame((now) => this._frame(now));
	}


	/**
	 * Current visible region in document coordinates.
	 *
	 * @returns {{top:number, height:number}}
	 */
	_getView() {

		const vv = window.visualViewport;
		if (vv)
			return { top: vv.pageTop, height: vv.height };

		return { top: window.scrollY, height: window.innerHeight };
	}


	/**
	 * One scheduling frame:
	 *   1. parallax mode: if the eye moved, re-render the visible strip (live pass)
	 *   2. render missing lookahead tiles in the scroll direction, within a time budget
	 *
	 * @param {number} now - rAF timestamp
	 */
	_frame(now) {

		this._raf = 0;

		const T = this.tileH;
		const view = this._getView();
		const vh = window.innerHeight;

		// scroll direction (sticky, so a pause doesn't flip lookahead)
		const dy = view.top - this._lastTop;
		this._lastTop = view.top;
		if (Math.abs(dy) > 0.5)
			this._dir = Math.sign(dy);

		// fast flicks get a longer lookahead
		const speedBoost = Math.min(2, Math.abs(dy) / Math.max(1, vh) * 4);
		const ahead = (this.opts.aheadVh + speedBoost) * vh;
		const behind = this.opts.behindVh * vh;

		const lo = view.top - (this._dir < 0 ? ahead : behind);
		const hi = view.top + view.height + (this._dir < 0 ? behind : ahead);

		const maxIdx = Math.max(0, Math.ceil(this.docH / T) - 1);
		const clamp = (i) => Math.max(0, Math.min(maxIdx, i));

		const first = clamp(Math.floor(lo / T));
		const last = clamp(Math.floor(hi / T));
		const visFirst = clamp(Math.floor(view.top / T));
		const visLast = clamp(Math.floor((view.top + view.height - 1) / T));

		// outrun detection: a visible tile with no pixels at all at the start of this frame
		let outrun = false;
		for (let i = visFirst; i <= visLast; i++) {
			const t = this.tiles.get(i);
			if (!t || !t.hasContent)
				outrun = true;
		}
		if (outrun && (this.stats.tileRenders + this.stats.liveRenders) > 0)
			this.stats.outrunFrames++;

		const t0 = performance.now();
		let rendered = 0;

		// 1. parallax live pass
		if (this.opts.parallax) {

			this._updateEye(view);

			if (this._liveDirty || this._liveEyeY === null || Math.abs(this.eye.y - this._liveEyeY) > 0.25) {
				this._renderLive(view, first, last, now);
				rendered++;
			}
		}

		// 2. lookahead: visible first (flat mode), then outward in the scroll direction
		const order = [];
		for (let i = visFirst; i <= visLast; i++)
			order.push(i);
		if (this._dir >= 0) {
			for (let i = visLast + 1; i <= last; i++) order.push(i);
			for (let i = visFirst - 1; i >= first; i--) order.push(i);
		} else {
			for (let i = visFirst - 1; i >= first; i--) order.push(i);
			for (let i = visLast + 1; i <= last; i++) order.push(i);
		}

		let pending = false;

		for (const i of order) {

			const tile = this._acquireTile(i, first, last);
			tile.lastUsed = now;

			if (tile.fresh)
				continue;

			// in flat mode visible tiles always render; everything else respects the budget
			const visible = i >= visFirst && i <= visLast;
			const mustRender = visible && !this.opts.parallax;
			if (!mustRender && rendered > 0 && performance.now() - t0 > this.opts.frameBudgetMs) {
				pending = true;
				break;
			}

			this._renderTile(tile);
			rendered++;
		}

		// parallax: lookahead tiles were rendered from the current eye, so the strip
		// on screen still matches; nothing else to do here

		if (pending) {
			this.kick();
		} else if (this.underlayDirty) {

			// underlay waits until things are quiet
			clearTimeout(this._underlayTimer);
			this._underlayTimer = setTimeout(() => {
				this._renderUnderlay();
				this.kick();
			}, 250);
		}

		if (this.onStats)
			this.onStats(this);
	}

}
