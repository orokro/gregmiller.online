/*
	poc/src/TileEngine.js
	---------------------

	Document-anchored 3D renderer for DOM-synced backgrounds.

	The core idea:
		- World space == document space (1 unit = 1 CSS px, y flipped so +y is up).
		- Geometry is built ONCE at document positions and only rebuilt on reflow.
		- Everything we draw lives INSIDE the document (position: absolute in a layer
		  that spans the whole page), so the browser's compositor scrolls / flings /
		  pinch-zooms it together with the DOM. JS never has to catch up for things
		  to stay aligned.
		- A very low-res render of the whole page sits underneath as a safety net in
		  case a hard flick outruns the sharp render.

	Two modes:

		PARALLAX (default)
			The WebGL canvas itself is a strip in the document a bit taller than the
			viewport (extra margin in the scroll direction). Each frame (fps-capped) JS
			moves the strip to the current view and renders straight into it with an
			off-axis perspective camera whose eye sits over the viewport
			(+100px right, like the old perspectiveX).

			The camera's window is always a rectangle on the z = 0 page plane, so
			anything AT z = 0 lands on the same pixels whatever the eye does: frames stay
			locked to the DOM. Only things above/below the plane (bevels, letters,
			shadows) shift with the eye, which is the parallax. Between renders the strip
			just scrolls with the page, so a late frame only delays the depth effect.

			No per-frame pixel copies: copying WebGL output into 2D canvases is slow on
			Safari and was what made the first version choppy on iPhone.

		FLAT (parallax off)
			Orthographic camera with a small oblique shear. The page is rendered once
			into viewport-sized 2D canvas "tiles" (copied out of the WebGL canvas), with
			lookahead in the scroll direction. Nothing renders while scrolling.
*/

// three
import * as THREE from 'three';


/**
 * The renderer.
 */
export class TileEngine {

	/**
	 * @param {Object} opts - options, see defaults below
	 */
	constructor(opts = {}) {

		// options (most are tweakable from the HUD)
		this.opts = Object.assign({
			parallax: true,          // live perspective that follows the viewport
			dprCap: 2,               // max device pixel ratio
			liveFpsCap: 0,           // parallax: max renders per second (0 = every frame)
			liveAheadVh: 0.35,       // parallax: strip margin in the scroll direction (viewports)
			liveBehindVh: 0.1,       // parallax: strip margin behind (viewports)
			halfResRefraction: false,// render the glass transmission buffer at half resolution
			tileVh: 1.0,             // flat: tile height as a fraction of the viewport height
			aheadVh: 1.25,           // flat: how far ahead (viewports) to pre-render
			behindVh: 0.35,          // flat: how far behind to keep rendered
			minPool: 5,              // flat: minimum number of tile canvases kept around
			frameBudgetMs: 10,       // flat: stop rendering lookahead tiles past this per frame
			underlay: true,          // low-res whole page safety net
			underlayScale: 0.125,    // underlay resolution relative to CSS px
			showBorders: false,      // outline tiles / strip (debug)
			mouseLight: false,       // desktop cursor light
			cameraZ: 1000,           // eye distance from the page (bigger = flatter)
			eyeOffsetX: 100,         // eye offset from viewport center (old perspectiveX = -100)
			eyeOffsetY: 0,           // eye offset from viewport center (old perspectiveY)
			obliqueX: -0.1,          // flat: screen-x shift per unit of height
			obliqueY: 0.0,           // flat: screen-y shift per unit of height
		}, opts);

		// the theme (set via setTheme)
		this.theme = null;

		// registered DOM items: { el, kind, group, empties, rect, themeData }
		this.items = [];

		// layout state
		this.docW = 0;
		this.docH = 0;
		this.dpr = 1;
		this.vhStable = 0;     // viewport height used for sizing (ignores URL bar wobble)
		this.wpx = 0;          // page width in device px
		this.tilePx = 0;       // flat: tile height in device px
		this.tileH = 0;        // flat: tile height in css px (tilePx / dpr)
		this.livePx = 0;       // parallax: strip height in device px

		// flat mode tiles: index -> { index, canvas, ctx, hasContent, fresh, lastUsed }
		this.tiles = new Map();

		// parallax state
		this.eye = new THREE.Vector3();
		this._liveTopPx = null;
		this._liveEyeY = null;
		this._liveDirty = true;
		this._lastLiveTime = 0;
		this._liveTimes = [];

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
			liveFps: 0,
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
	 * Builds the renderer, scene and cameras.
	 */
	_initRenderer() {

		// the WebGL canvas: in parallax mode it IS the visible strip;
		// in flat mode it's hidden and its pixels are copied into tiles
		this.glCanvas = document.createElement('canvas');
		this.glCanvas.className = 'poc-live';

		this.renderer = new THREE.WebGLRenderer({
			canvas: this.glCanvas,
			alpha: false,
			antialias: true,
			preserveDrawingBuffer: false,   // cheaper on mobile GPUs; we copy in the same task
			powerPreference: 'high-performance',
		});

		// we manage device pixels ourselves
		this.renderer.setPixelRatio(1);
		this.renderer.transmissionResolutionScale = this.opts.halfResRefraction ? 0.5 : 1.0;

		// shadows only update when the theme says the light rig moved
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
	 * Creates the in-document layer that holds the underlay, tiles, and live strip.
	 */
	_initLayer() {

		this.layer = document.createElement('div');
		this.layer.id = 'poc-gl-layer';
		document.body.prepend(this.layer);

		// low-res whole page underlay
		this.underlayCanvas = document.createElement('canvas');
		this.underlayCanvas.className = 'poc-underlay';
		this.underlayCtx = this.underlayCanvas.getContext('2d');
		this.layer.appendChild(this.underlayCanvas);

		// live strip (the WebGL canvas itself)
		this.layer.appendChild(this.glCanvas);

		this._applyModeClass();
	}


	/**
	 * Shows the strip or the tiles depending on mode.
	 */
	_applyModeClass() {
		this.layer.classList.toggle('mode-parallax', !!this.opts.parallax);
		this.layer.classList.toggle('mode-flat', !this.opts.parallax);
	}


	/**
	 * Hook up scroll / resize / reflow / mouse events.
	 */
	_bindEvents() {

		// scroll only schedules work; the compositor already moved everything
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

			if (this.opts.parallax)
				this._liveDirty = true;
			else
				this.tiles.forEach((t) => { t.fresh = false; });

			this.kick();
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


	/**
	 * Switches between parallax and flat mode at runtime.
	 *
	 * @param {boolean} on - parallax on
	 */
	setParallax(on) {
		this.opts.parallax = on;
		this._applyModeClass();
		this.invalidateAll();
	}


	/**
	 * Full vs half resolution for the glass refraction buffer.
	 *
	 * @param {boolean} half - half resolution
	 */
	setHalfResRefraction(half) {
		this.opts.halfResRefraction = half;
		this.renderer.transmissionResolutionScale = half ? 0.5 : 1.0;
		this.invalidateAll();
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
	 * Measures document size and (re)configures render sizes if the width changed.
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

		// sizes are only re-derived when the width changes, so the iOS URL bar
		// growing/shrinking mid-scroll never throws everything away.
		// +10% so the strip still covers the screen when the URL bar collapses.
		if (widthChanged || !this.tilePx) {

			this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.dprCap);
			this.vhStable = Math.max(window.innerHeight, document.documentElement.clientHeight) * 1.1;
			this.wpx = Math.round(docW * this.dpr);

			// flat tiles
			const tileCss = Math.max(300, this.vhStable * this.opts.tileVh);
			this.tilePx = Math.round(tileCss * this.dpr);
			this.tileH = this.tilePx / this.dpr;

			// parallax strip
			const liveCss = this.vhStable * (1 + this.opts.liveAheadVh + this.opts.liveBehindVh);
			this.livePx = Math.round(liveCss * this.dpr);

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
	 * Re-measures everything, updates geometry, and invalidates all renders.
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
	 * Marks everything as needing a re-render (keeps old pixels until replaced).
	 */
	invalidateAll() {

		this.tiles.forEach((t) => { t.fresh = false; });
		this.underlayDirty = true;
		this._liveDirty = true;

		// geometry/light settings may have changed: force a shadow pass
		if (this.theme && this.theme.invalidateShadows)
			this.theme.invalidateShadows();

		this.kick();
	}


	/**
	 * Full rebuild of render sizes (used when DPR or tile size options change).
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
	 * Parallax mode: off-axis perspective. The frustum is cut so the region's rectangle
	 * ON THE z=0 PLANE fills the output exactly, which keeps z=0 locked to the DOM
	 * regardless of where the eye is.
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

		cam.near = near;
		cam.far = far;
		cam.position.set(E.x, E.y, D);
		cam.rotation.set(0, 0, 0);
		cam.updateMatrixWorld();

		cam.projectionMatrix.makePerspective(
			(x - E.x) * k,
			(x + w - E.x) * k,
			(-y - E.y) * k,
			(-(y + h) - E.y) * k,
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
	 * Renders a document region into the WebGL canvas at a given pixel size.
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

		// theme positions lights / view-dependent bits; it tells us if the shadow map is stale
		let shadowsStale = true;
		if (this.theme) {
			shadowsStale = this.theme.prepareRegion({ x, y, w, h }) !== false;
			this.theme.prepareView(perspective ? { eye: this.eye, D: this.opts.cameraZ } : null);
		}

		this.renderer.shadowMap.needsUpdate = shadowsStale;
		this.renderer.render(this.scene, this.camera);
	}


	/**
	 * Parallax live pass: moves the strip over the current view and renders into it.
	 *
	 * @param {{top:number, height:number}} view - visible region in doc px
	 */
	_renderLive(view) {

		const t0 = performance.now();
		const dpr = this.dpr;
		const vh = this.vhStable;

		// strip top: more margin in the scroll direction
		const before = (this._dir >= 0 ? this.opts.liveBehindVh : this.opts.liveAheadVh) * vh;
		const topPx = Math.max(0, Math.round((view.top - before) * dpr));
		const top = topPx / dpr;
		const h = this.livePx / dpr;

		this._renderRegion(0, top, this.docW, h, this.wpx, this.livePx, true);

		// move the strip in the same frame the new pixels land
		const c = this.glCanvas;
		c.style.top = `${top}px`;
		c.style.width = `${this.docW}px`;
		c.style.height = `${h}px`;

		this._liveTopPx = topPx;
		this._liveEyeY = this.eye.y;
		this._liveDirty = false;
		this._lastLiveTime = performance.now();

		// stats
		const ms = performance.now() - t0;
		const s = this.stats;
		s.liveRenders++;
		s.lastLiveMs = ms;
		s.maxLiveMs = Math.max(s.maxLiveMs, ms);
		s.avgLiveMs = s.avgLiveMs ? s.avgLiveMs * 0.9 + ms * 0.1 : ms;

		const now = performance.now();
		this._liveTimes.push(now);
		while (this._liveTimes.length && now - this._liveTimes[0] > 1000)
			this._liveTimes.shift();
		s.liveFps = this._liveTimes.length;
	}


	/**
	 * Flat mode: gets (or creates / recycles) the tile object for a given index.
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
			canvas.width = this.wpx;
			canvas.height = this.tilePx;
			canvas.style.width = `${this.docW}px`;
			canvas.style.height = `${this.tileH}px`;
			canvas._pocCtx = canvas.getContext('2d');
			this.layer.insertBefore(canvas, this.glCanvas);
		}

		// move it into place, hidden until it has real pixels for this index
		canvas.style.top = `${index * this.tileH}px`;
		canvas.style.visibility = 'hidden';
		canvas.dataset.index = index;

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
	 * Flat mode: renders one whole tile and copies it into its canvas.
	 *
	 * @param {Object} tile - tile to render
	 */
	_renderTile(tile) {

		const t0 = performance.now();

		this._renderRegion(0, tile.index * this.tileH, this.docW, this.tileH, this.wpx, this.tilePx, false);
		tile.ctx.clearRect(0, 0, this.wpx, this.tilePx);
		tile.ctx.drawImage(this.glCanvas, 0, 0, this.wpx, this.tilePx, 0, 0, this.wpx, this.tilePx);

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
	 * Renders the low-res whole-document underlay (always flat; it's only a safety net).
	 * In parallax mode this borrows the WebGL canvas, so the caller re-renders the strip
	 * right after, in the same task.
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
		this.underlayCtx.drawImage(this.glCanvas, 0, 0, pxW, pxH, 0, 0, pxW, pxH);

		this.stats.underlayMs = performance.now() - t0;
		this._liveDirty = true;
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
	 * One scheduling frame.
	 *
	 * @param {number} now - rAF timestamp
	 */
	_frame(now) {

		this._raf = 0;

		const view = this._getView();

		// scroll direction (sticky, so a pause doesn't flip lookahead)
		const dy = view.top - this._lastTop;
		this._lastTop = view.top;
		if (Math.abs(dy) > 0.5)
			this._dir = Math.sign(dy);

		let pending = false;

		if (this.opts.parallax)
			pending = this._frameParallax(view, now);
		else
			pending = this._frameFlat(view, now, dy);

		if (pending) {
			this.kick();
		} else if (this.underlayDirty) {

			// underlay waits until things are quiet
			clearTimeout(this._underlayTimer);
			this._underlayTimer = setTimeout(() => {
				this._renderUnderlay();
				if (this.opts.parallax)
					this._renderLive(this._getView());
				this.kick();
			}, 250);
		}

		if (this.onStats)
			this.onStats(this);
	}


	/**
	 * Parallax frame: re-render the strip if the eye moved (fps-capped).
	 *
	 * @param {{top:number, height:number}} view - visible region
	 * @param {number} now - rAF timestamp
	 * @returns {boolean} true if another frame is needed
	 */
	_frameParallax(view, now) {

		// outrun: the strip (as last rendered) doesn't cover the current view
		if (this._liveTopPx !== null) {
			const top = this._liveTopPx / this.dpr;
			const bot = top + this.livePx / this.dpr;
			if (view.top < top - 1 || view.top + view.height > bot + 1)
				this.stats.outrunFrames++;
		}

		this._updateEye(view);

		const moved = this._liveEyeY === null || Math.abs(this.eye.y - this._liveEyeY) > 0.25;
		if (!moved && !this._liveDirty)
			return false;

		// fps cap: skip this frame, but come back
		const cap = this.opts.liveFpsCap;
		if (cap > 0 && performance.now() - this._lastLiveTime < 1000 / cap - 2)
			return true;

		this._renderLive(view);
		return false;
	}


	/**
	 * Flat frame: make sure tiles exist around the view, render missing ones within budget.
	 *
	 * @param {{top:number, height:number}} view - visible region
	 * @param {number} now - rAF timestamp
	 * @param {number} dy - scroll delta since last frame
	 * @returns {boolean} true if another frame is needed
	 */
	_frameFlat(view, now, dy) {

		const T = this.tileH;
		const vh = window.innerHeight;

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

		// outrun: a visible tile with no pixels at all
		for (let i = visFirst; i <= visLast; i++) {
			const t = this.tiles.get(i);
			if ((!t || !t.hasContent) && this.stats.tileRenders > 0) {
				this.stats.outrunFrames++;
				break;
			}
		}

		// order: visible, then outward in the scroll direction
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

		const t0 = performance.now();
		let rendered = 0;

		for (const i of order) {

			const tile = this._acquireTile(i, first, last);
			tile.lastUsed = now;

			if (tile.fresh)
				continue;

			const visible = i >= visFirst && i <= visLast;
			if (!visible && rendered > 0 && performance.now() - t0 > this.opts.frameBudgetMs)
				return true;

			this._renderTile(tile);
			rendered++;
		}

		return false;
	}

}
