/*
	ThreeManager.js
	---------------

	The core engine for the 3D website.
	Manages the Scene, Renderer, Asset Loading, and the "Theme" system, and builds 3D
	geometry for DOM elements (Container3D / ContainerCustom3D) at their page positions.

	HOW IT WORKS (document-anchored rendering)
	------------------------------------------
	- World space == document space: 1 unit = 1 CSS px, x = page x, y = -page y, z = up
	  towards the viewer. z = 0 is the page plane.
	- Geometry is built at document positions once, and only re-measured on reflow
	  (resize, content changes, fonts, route changes). Scrolling never moves geometry.
	- Everything we draw lives INSIDE the document: a layer at the top of <body> with
	  position: absolute, as tall as the page. The browser's compositor scrolls, flings and
	  pinch-zooms it together with the content, so JS never has to catch up with scrolling
	  to stay aligned. (The old fixed-canvas approach always lagged by at least one frame,
	  and desynced badly on iOS.)
	- A very low-res render of the whole page sits at the bottom of the layer as a safety
	  net in case a hard flick outruns the sharp render.

	Two render modes:

	PARALLAX (default)
		The WebGL canvas itself is a strip in the layer, a bit taller than the viewport with
		extra margin in the scroll direction. When the view moves, JS moves the strip to it
		and renders straight into it (fps-capped on mobile) with an off-axis perspective
		camera whose eye sits over the viewport (+100px right = the old perspectiveX).
		The camera's window is always a rectangle ON THE z = 0 PLANE, so anything at z = 0
		lands on the same pixels wherever the eye is: frames stay locked to the DOM, and
		only raised / sunken parts (bevels, letters, shadows) shift. That's the parallax.
		A late frame only delays the depth effect, it can't misalign anything.
		There are no per-frame pixel copies (copying WebGL output into 2D canvases is slow
		on Safari and was what made the first prototype choppy on iPhone).

	FLAT (parallax off: weaker devices, prefers-reduced-motion)
		Orthographic camera with a small oblique shear (mimics the old perspective offset).
		The page is rendered into viewport-sized 2D canvas tiles (copied out of the WebGL
		canvas) with lookahead in the scroll direction. Nothing renders while scrolling.

	THEMES
	------
	Same contract as before (init/destroy/buildBox/updateBox/buildCustomBox/
	updateCustomBox/onResize/onScroll/onTick), plus two optional hooks:
		prepareRegion(manager, region) -> boolean   move the light rig for the region about
		                                            to be rendered; return true if the shadow
		                                            map must be re-rendered
		prepareView(manager, view)                  view-dependent tweaks before a render
	Per-element: ContainerCustom3D can pass viewFn(customRoot, manager, view), called before
	every render (CoverBG uses it to keep the paper locked to the page).

	DEVICE TIERS
	------------
	benchmark() and the scroll watchdog (onDowngrade) are used by layouts/default.vue +
	utils/RenderCapability.js to pick parallax / flat / 2D per device.
*/

// imports
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';


// Simple UUID generator (Works everywhere, no crypto requirement)
function uuid() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
		var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
		return v.toString(16);
	});
}


// the money
export class ThreeManager {

	/**
	 * Builds the 3D system. Unlike the old version, the manager creates its own
	 * in-document layer + canvas (appended to <body>), so it doesn't need one passed in.
	 *
	 * @param {Object} opts - options, see defaults below
	 */
	constructor(opts = {}) {

		this.id = uuid();

		// Configuration (kept for themes/components that read it)
		this.config = {
			cameraZ: 1000,       // eye distance from the page plane (bigger = flatter parallax)
			planeZ: 0,           // the plane where 1 unit = 1 pixel
			bgZ: -500,           // legacy
			bgColor: 0xf0f0f0,   // clear color behind everything
			perspectiveX: -100,  // eye sits 100px right of the viewport center
			perspectiveY: 0,
		};

		// Render options
		this.opts = Object.assign({
			parallax: true,           // live perspective that follows the viewport
			dprCap: 2,                // max device pixel ratio for rendering
			liveFpsCap: 0,            // parallax: max renders per second (0 = every frame)
			liveAheadVh: 0.35,        // parallax: strip margin in the scroll direction (viewports)
			liveBehindVh: 0.1,        // parallax: strip margin behind (viewports)
			halfResRefraction: false, // glass transmission buffer at half resolution
			tileVh: 1.0,              // flat: tile height as a fraction of the viewport height
			aheadVh: 1.25,            // flat: how far ahead (viewports) to pre-render
			behindVh: 0.35,           // flat: how far behind to keep rendered
			minPool: 5,               // flat: minimum number of tile canvases kept around
			frameBudgetMs: 10,        // flat: stop rendering lookahead tiles past this per frame
			underlay: true,           // low-res whole page safety net
			underlayScale: 0.125,     // underlay resolution relative to CSS px
			obliqueX: -0.1,           // flat: screen-x shift per unit of height
			obliqueY: 0.0,            // flat: screen-y shift per unit of height
		}, opts);

		// Viewport state (some themes read these)
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.scrollY = window.scrollY;
		this.scrollX = window.scrollX;

		// Document state
		this.docW = 0;
		this.docH = 0;
		this.dpr = 1;
		this.vhStable = 0;
		this.wpx = 0;
		this.tilePx = 0;
		this.tileH = 0;
		this.livePx = 0;

		// Asset Management
		this.assets = new Map();
		this.loadingPromises = new Map();

		// Setup DRACO loader
		this.dracoLoader = new DRACOLoader();
		this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

		// DOM elements synced to 3D
		this.registeredElements = new Map();

		// Theming
		this.currentTheme = null;
		this.envTexture = null;
		this.currentBgConfig = null;

		// Loop Control
		this.isOk = false;
		this.frameMode = 'lazy'; // 'lazy' or 'active' (theme animates every frame)
		this._raf = 0;
		this._started = false;

		// parallax state
		this.eye = new THREE.Vector3();
		this._liveTopPx = null;
		this._liveEyeY = null;
		this._liveDirty = true;
		this._lastLiveTime = 0;
		this._liveTimes = [];

		// flat mode tiles: index -> { index, canvas, ctx, hasContent, fresh, lastUsed }
		this.tiles = new Map();

		// scroll tracking
		this._lastTop = window.scrollY;
		this._dir = 1;

		// deferred work
		this.underlayDirty = true;
		this._underlayTimer = 0;
		this._reflowTimer = 0;

		// Mouse Light Feature
		this.mouseLightEnabled = false;
		this.mouseLightForced = false;
		this.mouseLight = null;
		this.onMouseMove = this._handleMouseLightMove.bind(this);

		// watchdog (frame intervals while actively scrolling)
		this.onDowngrade = null;  // (tier, medianMs) => void
		this._scrollIntervals = [];
		this._lastScrollFrameNow = 0;
		this.watchdogMedianMs = 0;
		this.benchmarkMs = null;

		// stats (debug console "render" command)
		this.stats = {
			tileRenders: 0,
			avgTileMs: 0,
			maxTileMs: 0,
			liveRenders: 0,
			avgLiveMs: 0,
			maxLiveMs: 0,
			underlayMs: 0,
			outrunFrames: 0,
			reflows: 0,
		};

		// Bound handlers
		this._onScrollBound = () => this.kick();
		this._onResizeBound = this._onWindowResize.bind(this);

		this.init();

		// for debugging
		window.tm = this;
	}


	/* ==========================================================================
	   SETUP / TEARDOWN
	   ========================================================================== */

	/**
	 * Sets up the scene, renderer, layer, and events.
	 */
	init() {

		// Capability Check
		if (!window.WebGLRenderingContext)
			return;

		// the WebGL canvas: in parallax mode it IS the visible strip;
		// in flat mode it's hidden and its pixels are copied into tiles
		this.canvas = document.createElement('canvas');
		this.canvas.className = 'tm-live';

		try {
			this.renderer = new THREE.WebGLRenderer({
				canvas: this.canvas,
				alpha: false,
				antialias: true,
				preserveDrawingBuffer: false,   // cheaper on mobile GPUs; copies happen in the same task
				powerPreference: 'high-performance',
			});
		} catch (e) {
			console.warn('ThreeManager: WebGL renderer failed to start', e);
			return;
		}

		// we manage device pixels ourselves
		this.renderer.setPixelRatio(1);
		this.renderer.transmissionResolutionScale = this.opts.halfResRefraction ? 0.5 : 1.0;

		// shadows only update when the theme says the light rig moved
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;
		this.renderer.shadowMap.autoUpdate = false;

		// Scene
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(this.config.bgColor);

		// Cameras (projection matrices are built by hand per render)
		this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 4000);
		this.perspCam = new THREE.PerspectiveCamera();
		this.camera = this.perspCam;
		this.scene.add(this.perspCam);

		// reusable temps
		this._shear = new THREE.Matrix4();
		this._size = new THREE.Vector2();
		this._view = { perspective: true, eye: this.eye, cameraZ: this.config.cameraZ, region: null };

		// GPU limits (underlay sizing)
		const gl = this.renderer.getContext();
		this.maxRenderbuffer = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE);
		this.maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

		this._initLayer();

		// Events
		window.addEventListener('scroll', this._onScrollBound, { passive: true });
		window.addEventListener('resize', this._onResizeBound);
		if (window.visualViewport) {
			window.visualViewport.addEventListener('scroll', this._onScrollBound, { passive: true });
			window.visualViewport.addEventListener('resize', this._onScrollBound, { passive: true });
		}

		// content reflow (images loading, route changes, registered elements resizing)
		this.resizeObserver = new ResizeObserver(() => this.requestRemeasure());
		this.resizeObserver.observe(document.body);

		// fonts change layout once they arrive
		if (document.fonts && document.fonts.ready)
			document.fonts.ready.then(() => this.requestRemeasure());

		// Mouse light (always in the scene so toggling never recompiles shaders)
		this.mouseLight = new THREE.PointLight(0xffffff, 0, 500);
		this.mouseLight.castShadow = false;
		this.scene.add(this.mouseLight);

		// we're good to go!
		this.isOk = true;

		// Load mouse light state from localStorage or URL override
		const savedLightState = localStorage.getItem('gm-mouselight-enabled');
		const params = new URLSearchParams(window.location.search);
		const hash = window.location.hash;
		this.mouseLightForced = params.get('mouselight') === 'true' || params.get('mouselight') === '1' || hash.includes('mouselight') ||
							    params.get('sideitems') === 'true' || params.get('sideitems') === '1' || hash.includes('sideitems');

		if (savedLightState === 'true' || this.mouseLightForced)
			this.enableMouseLight(true);

		this._measureLayout();
		this._started = true;
		this.kick();
	}


	/**
	 * Creates the in-document layer that holds the underlay, flat tiles, and live strip.
	 */
	_initLayer() {

		const layer = document.createElement('div');
		layer.className = 'tm-layer';
		layer.style.cssText = 'position:absolute;top:0;left:0;z-index:-1;overflow:hidden;pointer-events:none;contain:strict;';
		this.layer = layer;

		// low-res whole page underlay
		this.underlayCanvas = document.createElement('canvas');
		this.underlayCanvas.className = 'tm-underlay';
		this.underlayCanvas.style.cssText = 'position:absolute;top:0;left:0;z-index:0;filter:blur(2px);display:none;';
		this.underlayCtx = this.underlayCanvas.getContext('2d');
		layer.appendChild(this.underlayCanvas);

		// live strip
		this.canvas.style.cssText = 'position:absolute;top:0;left:0;z-index:2;display:block;';
		layer.appendChild(this.canvas);

		document.body.prepend(layer);
		this._applyModeVisibility();
	}


	/**
	 * Shows the live strip or the flat tiles depending on mode.
	 */
	_applyModeVisibility() {

		const parallax = !!this.opts.parallax;
		this.canvas.style.display = parallax ? 'block' : 'none';
		this.tiles.forEach((t) => { t.canvas.style.display = parallax ? 'none' : 'block'; });
	}


	/**
	 * Clean up resources and event listeners when destroying the manager.
	 */
	destroy() {

		this._started = false;
		this.isOk = false;

		if (this._raf)
			cancelAnimationFrame(this._raf);
		this._raf = 0;

		clearTimeout(this._underlayTimer);
		clearTimeout(this._reflowTimer);

		if (this.resizeObserver)
			this.resizeObserver.disconnect();

		window.removeEventListener('scroll', this._onScrollBound);
		window.removeEventListener('resize', this._onResizeBound);
		if (window.visualViewport) {
			window.visualViewport.removeEventListener('scroll', this._onScrollBound);
			window.visualViewport.removeEventListener('resize', this._onScrollBound);
		}

		// Cleanup Mouse Light (Stop listeners but DO NOT save to localStorage)
		window.removeEventListener('mousemove', this.onMouseMove);

		if (this.currentTheme && typeof this.currentTheme.destroy === 'function') {
			try {
				this.currentTheme.destroy(this);
			} catch (e) {
				console.warn('ThreeManager: theme destroy error', e);
			}
		}

		if (this.dracoLoader)
			this.dracoLoader.dispose();

		if (this.renderer) {
			this.renderer.dispose();
			this.renderer.forceContextLoss();
			this.renderer = null;
		}

		if (this.layer)
			this.layer.remove();

		if (window.tm === this)
			window.tm = null;
	}


	/* ==========================================================================
	   MODE / QUALITY SWITCHES
	   ========================================================================== */

	/**
	 * Switches between parallax and flat rendering at runtime.
	 *
	 * @param {boolean} on - parallax on
	 */
	setParallax(on) {
		this.opts.parallax = !!on;
		this._applyModeVisibility();
		this.requestRender(true);
	}


	/**
	 * Full vs half resolution for the glass refraction (transmission) buffer.
	 *
	 * @param {boolean} half - half resolution
	 */
	setHalfResRefraction(half) {
		this.opts.halfResRefraction = !!half;
		if (this.renderer)
			this.renderer.transmissionResolutionScale = half ? 0.5 : 1.0;
		this.requestRender(true);
	}


	/**
	 * Sets our render mode to either "active" (theme animates every frame) or "lazy"
	 * (render only when something changes).
	 *
	 * @param {String} mode - 'active' or 'lazy'
	 */
	setFrameMode(mode) {
		this.frameMode = mode === 'active' ? 'active' : 'lazy';
		this.kick();
	}


	/* ==========================================================================
	   THEME SYSTEM
	   ========================================================================== */

	/**
	 * Set the current theme, which defines how 3D elements are built and updated.
	 *
	 * @param {Constructor} ThemeClass - theme class
	 */
	setTheme(ThemeClass) {

		if (!ThemeClass || !this.isOk)
			return;

		// already running this theme
		if (this.currentTheme && this.currentTheme.constructor === ThemeClass)
			return;

		console.log(`ThreeManager: Switching theme to ${ThemeClass.name}`);

		// Clean up old theme if exists
		if (this.currentTheme)
			this.currentTheme.destroy(this);

		// Set new theme & init
		this.currentTheme = new ThemeClass();
		this.currentTheme.init(this);

		// rebuild all registered elements with the new theme
		this.registeredElements.forEach((data) => {
			if (data.type === 'box')
				this.cleanGroupNonEmptyChildren(data.group, data.empties);
		});

		this.registeredElements.forEach((data) => {
			const signalReady = (isReady = true) => {
				data.ready = isReady;
			};
			this.buildRegisteredElement(data, false, signalReady);
		});

		this.onResize();
	}


	/* ==========================================================================
	   MATERIALS / ENVIRONMENT
	   ========================================================================== */

	/**
	 * Loads a PBR material from the textures directory.
	 *
	 * @param {string} baseName - the base name of the texture files (e.g. "mossy_rock")
	 * @param {boolean} normal - whether to expect a normal map
	 * @param {boolean} smooth - whether to expect a smoothness/roughness map
	 * @param {boolean} metal - whether to expect a metalness map
	 * @param {Object} options - additional options for the material
	 * @param {boolean} noCache - if true, forces a reload of the material instead of using the cache
	 * @returns {THREE.MeshStandardMaterial}
	 */
	loadPBR(baseName, normal = false, smooth = false, metal = false, options = {}, noCache = false) {

		if (!this.materialCache)
			this.materialCache = new Map();

		if (!noCache && this.materialCache.has(baseName))
			return this.materialCache.get(baseName);

		const loader = new THREE.TextureLoader();
		const path = `/textures/${baseName}`;
		const done = () => this.requestRender(true);

		const maps = {};

		maps.map = loader.load(`${path}_ALBEDO.png`, done);
		maps.map.colorSpace = THREE.SRGBColorSpace;
		maps.map.wrapS = THREE.RepeatWrapping;
		maps.map.wrapT = THREE.RepeatWrapping;

		if (normal) {
			maps.normalMap = loader.load(`${path}_NORMAL.png`, done);
			maps.normalMap.wrapS = THREE.RepeatWrapping;
			maps.normalMap.wrapT = THREE.RepeatWrapping;
		}

		if (smooth) {
			maps.roughnessMap = loader.load(`${path}_SMOOTH.png`, done);
			maps.roughnessMap.wrapS = THREE.RepeatWrapping;
			maps.roughnessMap.wrapT = THREE.RepeatWrapping;
		}

		if (metal) {
			maps.metalnessMap = loader.load(`${path}_METAL.png`, done);
			maps.metalnessMap.wrapS = THREE.RepeatWrapping;
			maps.metalnessMap.wrapT = THREE.RepeatWrapping;
		}

		const material = new THREE.MeshStandardMaterial(Object.assign({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			...maps
		}, options));

		this.materialCache.set(baseName, material);
		return material;
	}


	/**
	 * Clears the material cache.
	 *
	 * @param {string[]} names - optional list of names to clear. If omitted, clears all.
	 */
	clearCache(names) {

		if (!this.materialCache)
			return;

		const disposeMat = (mat) => {
			if (!mat) return;
			['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'emissiveMap'].forEach(key => {
				if (mat[key] && mat[key].isTexture)
					mat[key].dispose();
			});
			mat.dispose();
		};

		if (Array.isArray(names)) {
			names.forEach(name => {
				const mat = this.materialCache.get(name);
				if (mat) {
					disposeMat(mat);
					this.materialCache.delete(name);
				}
			});
		} else {
			this.materialCache.forEach(disposeMat);
			this.materialCache.clear();
		}
	}


	/**
	 * Updates the background cover component (app-cover-bg) with a new configuration.
	 *
	 * @param {THREE.Material} material - The new material to use
	 * @param {number} depth - The new depth value
	 * @param {number} uvScale - The new UV scale
	 * @param {boolean} catchShadows - Whether to receive shadows
	 */
	setBackground(material, depth, uvScale, catchShadows) {

		// Store globally so it persists if the element re-registers
		this.currentBgConfig = { material, depth, uvScale, catchShadows };

		const data = this.getRegisteredElementByName('app-cover-bg');
		if (!data)
			return;

		data.bgConfig = this.currentBgConfig;
		this.updateElementPosition(data.id);
		this.requestRender(true);
	}


	/**
	 * Set the environment texture for image-based lighting in the scene.
	 *
	 * @param {string} url - location of new texture
	 * @param {Number} exposure - tone mapping exposure to use with it
	 */
	setEnvironmentTexture(url, exposure = 1.0) {

		if (!url || !this.renderer)
			return;

		this.clearEnvironmentTexture();

		const ext = url.split('.').pop().toLowerCase();
		const loader = ext === 'hdr' ? new HDRLoader() : new THREE.TextureLoader();

		loader.load(url, (texture) => {

			if (!this.renderer)
				return;

			texture.mapping = THREE.EquirectangularReflectionMapping;
			if (ext !== 'hdr')
				texture.colorSpace = THREE.SRGBColorSpace;

			this.scene.environment = texture;
			this.envTexture = texture;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = exposure;
			this.requestRender(true);
		});
	}


	/**
	 * Clean up the current environment texture to free GPU memory.
	 */
	clearEnvironmentTexture() {
		if (this.envTexture) {
			this.envTexture.dispose();
			this.envTexture = null;
		}
		if (this.scene)
			this.scene.environment = null;
	}


	/* ==========================================================================
	   ASSET MANAGEMENT
	   ========================================================================== */

	/**
	 * Loads assets (models, textures) asynchronously and returns them as Three.js objects.
	 *
	 * @param {String[]} urls - list of assets to async load
	 * @returns {Object3D[]} - array of loaded assets in the same order as the input URLs.
	 */
	async assetsReady(urls) {

		if (!this.isOk)
			return [];

		const loadOne = (url) => {

			if (this.assets.has(url))
				return Promise.resolve(this.assets.get(url));

			if (this.loadingPromises.has(url))
				return this.loadingPromises.get(url);

			const promise = new Promise((resolve, reject) => {

				const ext = url.split('.').pop().toLowerCase();
				const fail = (err) => {
					this.loadingPromises.delete(url);
					reject(err);
				};

				if (ext === 'glb' || ext === 'gltf') {

					const loader = new GLTFLoader();
					loader.setDRACOLoader(this.dracoLoader);
					loader.load(url, (gltf) => {
						this.assets.set(url, gltf);
						this.loadingPromises.delete(url);
						resolve(gltf);
					}, undefined, fail);

				} else if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {

					new THREE.TextureLoader().load(url, (tex) => {
						this.assets.set(url, tex);
						this.loadingPromises.delete(url);
						resolve(tex);
					}, undefined, fail);

				} else if (ext === 'hdr') {

					new HDRLoader().load(url, (tex) => {
						this.assets.set(url, tex);
						this.loadingPromises.delete(url);
						resolve(tex);
					}, undefined, fail);

				} else {
					fail(new Error(`ThreeManager: unknown asset type ${url}`));
				}
			});

			this.loadingPromises.set(url, promise);
			return promise;
		};

		await Promise.all(urls.map(loadOne));

		// return clones so consumers can't mutate the cache
		return urls.map(url => {
			const asset = this.assets.get(url);

			if (asset.scene) {
				const clone = asset.scene.clone(true);
				clone.animations = asset.animations || [];
				return clone;
			}

			return asset.isTexture ? asset.clone() : asset.clone(true);
		});
	}


	/* ==========================================================================
	   ELEMENT SYNC
	   ========================================================================== */

	/**
	 * Register a DOM element to get 3D geometry at its page position.
	 *
	 * @param {HTMLElement} element - the element to watch in 3d
	 * @param {String} type - 'box' (Container3D) or 'customBox' (ContainerCustom3D)
	 * @param {Object} options - passed to theme/custom build functions
	 * @returns {Object|null} - { id, empties }
	 */
	register(element, type = 'box', options = {}) {

		if (!this.isOk)
			return null;

		if (type === 'backgroundImage3D') {
			console.warn('ThreeManager: backgroundImage3D is not supported by the document-anchored engine.');
			return null;
		}

		const id = uuid();

		const group = new THREE.Group();
		this.scene.add(group);

		// empties for the center and corners (themes position things relative to these)
		const empties = {
			center: new THREE.Group(),
			tl: new THREE.Group(),
			tr: new THREE.Group(),
			bl: new THREE.Group(),
			br: new THREE.Group(),
		};
		Object.values(empties).forEach((g) => group.add(g));

		const data = { id, element, group, type, empties, options, ready: false, rect: null, corners: null };
		this.registeredElements.set(id, data);

		// Apply global background config if this is the background element
		if (options.name === 'app-cover-bg' && this.currentBgConfig)
			data.bgConfig = this.currentBgConfig;

		if (this.resizeObserver)
			this.resizeObserver.observe(element);

		// measure, then build
		this._measureElement(data);

		const signalReady = (isReady = true) => {
			data.ready = isReady;
			this.updateElementPosition(id);
		};
		this.buildRegisteredElement(data, true, signalReady);
		this.updateElementPosition(id);

		// a new element may change the page height (and its frame needs drawing)
		this.requestRemeasure();
		return { id, empties };
	}


	/**
	 * Unregister a DOM element, removing its 3D group and cleaning up resources.
	 *
	 * @param {string} id - id of object to unregister
	 */
	unregister(id) {

		if (!this.registeredElements.has(id))
			return;

		const data = this.registeredElements.get(id);
		const { group, element } = data;

		if (this.resizeObserver && element)
			this.resizeObserver.unobserve(element);

		if (data.type === 'customBox' && data.options && typeof data.options.cleanFn === 'function') {
			try {
				data.options.cleanFn(this._getCustomRoot(data), this);
			} catch (e) {
				console.warn('CustomContainer3D cleanFn error:', e);
			}
		}

		if (group) {
			group.visible = false;
			if (group.parent)
				group.parent.remove(group);
			this.cleanGroupNonEmptyChildren(group, data.empties);
		}

		this.registeredElements.delete(id);
		this.requestRemeasure();
	}


	/**
	 * Measures an element's document-space rect from its corner markers and positions
	 * its group + empties there.
	 *
	 * @param {Object} data - registered element data
	 */
	_measureElement(data) {

		const el = data.element;

		if (!data.corners || !data.corners.tl || !data.corners.tl.isConnected) {
			data.corners = {
				tl: el.querySelector('.top-left'),
				br: el.querySelector('.bottom-right'),
			};
		}

		const { tl, br } = data.corners;
		if (!tl || !br) {
			data.group.visible = false;
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
		data.rect = rect;

		// hidden / collapsed elements get no geometry
		data.group.visible = rect.width > 0 && rect.height > 0;

		// world: x = page x, y = -page y
		const halfW = rect.width / 2;
		const halfH = rect.height / 2;
		data.group.position.set(rect.left + halfW, -(rect.top + halfH), 0);

		const { empties } = data;
		empties.center.position.set(0, 0, 0);
		empties.tl.position.set(-halfW, halfH, 0);
		empties.tr.position.set(halfW, halfH, 0);
		empties.bl.position.set(-halfW, -halfH, 0);
		empties.br.position.set(halfW, -halfH, 0);
	}


	/**
	 * Re-measures a registered element and lets its theme / custom update run.
	 * (The forceHardMeasure flag is kept for compatibility; we always measure.)
	 *
	 * @param {string} id - the id of the registered object
	 * @param {boolean} forceHardMeasure - unused
	 */
	updateElementPosition(id, forceHardMeasure = false) {

		const data = this.registeredElements.get(id);
		if (!data)
			return;

		this._measureElement(data);
		if (data.rect)
			this.updateRegisteredElement(data, data.rect);

		this.requestRender();
	}


	/**
	 * Calls the theme / custom update for an element after its rect changed.
	 *
	 * @param {Object} data - registered element data
	 * @param {Object} rect - { left, top, width, height } in page px
	 */
	updateRegisteredElement(data, rect) {

		if (!data || !this.currentTheme)
			return;

		if (data.type === 'box') {
			if (typeof this.currentTheme.updateBox === 'function')
				this.currentTheme.updateBox(this, data, rect);
			return;
		}

		if (data.type === 'customBox') {

			const customRoot = this._getCustomRoot(data);
			const defaultUpdate = this._getDefaultCustomUpdate(data, rect);

			if (data.options && typeof data.options.updateFn === 'function')
				data.options.updateFn(defaultUpdate, customRoot, this);
			else
				defaultUpdate();
		}
	}


	/**
	 * Builds a registered element by calling the appropriate theme build function.
	 *
	 * @param {Object} data - the data about registered object
	 * @param {boolean} rebuildCustom - whether to rebuild custom boxes
	 * @param {Function} setReady - optional callback to signal readiness
	 */
	buildRegisteredElement(data, rebuildCustom = true, setReady = null) {

		if (!data)
			return;

		// let a custom container dispose its own resources before we wipe the empties
		if (rebuildCustom && data.type === 'customBox' && data.options && typeof data.options.cleanFn === 'function') {
			try {
				data.options.cleanFn(this._getCustomRoot(data), this);
			} catch (e) {
				console.warn('CustomContainer3D cleanFn error:', e);
			}
		}

		// Always clear any existing geometry so rebuilds don't stack
		this.cleanGroupNonEmptyChildren(data.group, data.empties, !rebuildCustom);

		// Regular Container3D always uses theme buildBox
		if (data.type === 'box') {

			if (this.currentTheme && typeof this.currentTheme.buildBox === 'function') {
				const result = this.currentTheme.buildBox(this, data);
				if (result !== false)
					data.ready = true;
			} else {
				data.ready = true;
			}

			this.requestRender();
			return;
		}

		// Custom ContainerCustom3D: theme default is optional, instance overrides possible
		if (data.type === 'customBox') {

			const defaultBuild = () => {
				if (this.currentTheme && typeof this.currentTheme.buildCustomBox === 'function')
					return this.currentTheme.buildCustomBox(this, data);
				return true;
			};

			const customRoot = this._getCustomRoot(data);

			const signalReady = (isReady = true) => {
				data.ready = isReady;
				if (setReady)
					setReady(isReady);
			};

			if (data.options && typeof data.options.buildFn === 'function') {
				data.options.buildFn(defaultBuild, customRoot, this, rebuildCustom, signalReady);
			} else {
				const result = defaultBuild();
				if (result !== false)
					signalReady(true);
			}

			this.requestRender();
		}
	}


	/**
	 * Wrapped default update for a custom box (theme updateCustomBox).
	 *
	 * @param {Object} data - registered element data
	 * @param {Object} rect - element rect
	 * @returns {Function}
	 */
	_getDefaultCustomUpdate(data, rect) {
		return () => {
			if (this.currentTheme && typeof this.currentTheme.updateCustomBox === 'function')
				this.currentTheme.updateCustomBox(this, data, rect);
		};
	}


	/**
	 * Root objects handed to custom build/update/clean/view functions.
	 *
	 * @param {Object} data - registered element data
	 * @returns {{group: THREE.Group, empties: Object}}
	 */
	_getCustomRoot(data) {
		return { group: data.group, empties: data.empties };
	}


	/**
	 * Same as _getCustomRoot, for tick functions.
	 *
	 * @param {Object} data - registered element data
	 * @returns {{group: THREE.Group, empties: Object}}
	 */
	_getElementRoot(data) {
		return { group: data.group, empties: data.empties };
	}


	/**
	 * Helper to find a registered element by its name option.
	 *
	 * @param {String} name - name of element to find
	 * @returns {null|Object} - the registered element object
	 */
	getRegisteredElementByName(name) {
		for (const entry of this.registeredElements.values()) {
			if (entry.options?.name === name)
				return entry;
		}
		return null;
	}


	/* ==========================================================================
	   CLEANUP HELPERS
	   ========================================================================== */

	/**
	 * Recursively removes all children in a group, disposing materials (not geometry,
	 * which may be shared, e.g. the lettering cache).
	 *
	 * @param {THREE.Object3D} group - the group to clean
	 */
	cleanGroupChildren(group) {

		if (!group)
			return;

		[...group.children].forEach((child) => {

			if (child.children && child.children.length > 0)
				this.cleanGroupChildren(child);

			group.remove(child);

			if (child.material) {
				const materials = Array.isArray(child.material) ? child.material : [child.material];
				materials.forEach((mat) => {
					if (typeof mat.dispose === 'function')
						mat.dispose();
				});
			}
		});
	}


	/**
	 * Remove everything under the empties (but keep the empties themselves).
	 *
	 * @param {Object} empties - the empties object
	 */
	cleanEmptiesChildren(empties) {

		if (!empties)
			return;

		[empties.center, empties.tl, empties.tr, empties.bl, empties.br]
			.filter(Boolean)
			.forEach((empty) => this.cleanGroupChildren(empty));
	}


	/**
	 * Clean all children of a group except the 5 empties.
	 *
	 * @param {THREE.Group} group - element root group
	 * @param {Object} empties - its empties
	 * @param {boolean} skipEmpties - leave the empties' children alone
	 */
	cleanGroupNonEmptyChildren(group, empties, skipEmpties = false) {

		if (!group)
			return;

		if (!empties || !empties.center || !empties.tl || !empties.tr || !empties.bl || !empties.br)
			return;

		if (!skipEmpties)
			this.cleanEmptiesChildren(empties);

		const keep = new Set([empties.center, empties.tl, empties.tr, empties.bl, empties.br]);

		[...group.children].forEach((child) => {

			if (keep.has(child))
				return;

			group.remove(child);

			if (child.geometry)
				child.geometry.dispose();

			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
				else child.material.dispose();
			}

			if (child.children && child.children.length)
				this.cleanGroupChildren(child);
		});
	}


	/* ==========================================================================
	   SHADOW HELPERS
	   ========================================================================== */

	/**
	 * Recursively sets castShadow on the object and its children.
	 *
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable casting.
	 */
	setShadowCasting(object, enabled) {
		object.traverse((child) => {
			if (child.isMesh)
				child.castShadow = enabled;
		});
	}


	/**
	 * Recursively sets receiveShadow on the object and its children.
	 *
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable receiving.
	 */
	setShadowReceiving(object, enabled) {
		object.traverse((child) => {
			if (child.isMesh)
				child.receiveShadow = enabled;
		});
	}


	/**
	 * Recursively sets both casting and receiving.
	 *
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable both.
	 */
	setShadows(object, enabled) {
		this.setShadowCasting(object, enabled);
		this.setShadowReceiving(object, enabled);
	}


	/* ==========================================================================
	   MOUSE LIGHT
	   ========================================================================== */

	/**
	 * Toggles the "mouse light" feature (a point light that follows the cursor).
	 *
	 * @param {boolean} enabled - whether to turn the feature on or off
	 * @param {boolean} isManual - if true, the setting is persisted to localStorage and acts as a global override
	 */
	enableMouseLight(enabled = true, isManual = false) {

		if (!isManual) {

			// 1. URL Override is highest priority
			if (this.mouseLightForced) {
				enabled = true;
			} else {
				// 2. LocalStorage override is second priority
				const saved = localStorage.getItem('gm-mouselight-enabled');
				if (saved !== null)
					enabled = (saved === 'true');
			}

		} else {
			localStorage.setItem('gm-mouselight-enabled', enabled);
		}

		this.mouseLightEnabled = enabled;

		if (this.mouseLight)
			this.mouseLight.intensity = enabled ? 500000 : 0;

		window.removeEventListener('mousemove', this.onMouseMove);
		if (enabled)
			window.addEventListener('mousemove', this.onMouseMove, { passive: true });

		this.requestRender(true);
	}


	/**
	 * Moves the mouse light to the cursor (page coordinates, slightly above the page).
	 *
	 * @param {MouseEvent} event - the mouse move event
	 */
	_handleMouseLightMove(event) {

		if (!this.mouseLightEnabled || !this.mouseLight)
			return;

		this.mouseLight.position.set(event.pageX, -event.pageY, this.config.planeZ + 150);
		this.requestRender();
	}


	/* ==========================================================================
	   LAYOUT / REFLOW
	   ========================================================================== */

	/**
	 * Measures the document and (re)configures render sizes if the width changed.
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

		this.width = window.innerWidth;
		this.height = window.innerHeight;

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

			// tile canvases have the wrong size now
			this.tiles.forEach((t) => t.canvas.remove());
			this.tiles.clear();
		}
	}


	/**
	 * Window resize: width changes need a full relayout; height-only changes
	 * (iOS URL bar) just need bookkeeping.
	 */
	_onWindowResize() {

		if (document.documentElement.clientWidth !== this.docW)
			this.requestRemeasure();
		else
			this.kick();
	}


	/**
	 * Requests a (debounced) global remeasure of the page and all registered elements.
	 */
	requestRemeasure() {

		if (!this.isOk)
			return;

		clearTimeout(this._reflowTimer);
		this._reflowTimer = setTimeout(() => this.onResize(), 60);
	}


	/**
	 * Full re-measure: page size, every element, theme hook. Invalidates all renders.
	 */
	onResize() {

		if (!this.isOk)
			return;

		clearTimeout(this._reflowTimer);
		this.stats.reflows++;

		this._measureLayout();

		this.registeredElements.forEach((data) => {
			this._measureElement(data);
			if (data.rect)
				this.updateRegisteredElement(data, data.rect);
		});

		if (this.currentTheme && typeof this.currentTheme.onResize === 'function')
			this.currentTheme.onResize();

		this.requestRender(true);
	}


	/**
	 * Request that the visible picture be re-rendered.
	 *
	 * @param {boolean} everything - also invalidate the underlay + shadows (geometry/material changed)
	 */
	requestRender(everything = false) {

		this._liveDirty = true;
		this.tiles.forEach((t) => { t.fresh = false; });

		if (everything) {
			this.underlayDirty = true;
			if (this.currentTheme && typeof this.currentTheme.invalidateShadows === 'function')
				this.currentTheme.invalidateShadows(this);
			this._forceShadow = true;
		}

		this.kick();
	}


	/* ==========================================================================
	   CAMERAS
	   ========================================================================== */

	/**
	 * Flat mode: orthographic camera over a page region, with oblique shear.
	 *
	 * @param {number} x - region left (page px)
	 * @param {number} y - region top (page px)
	 * @param {number} w - region width
	 * @param {number} h - region height
	 */
	_aimOrtho(x, y, w, h) {

		const cam = this.orthoCam;
		const D = this.config.cameraZ;

		cam.left = -w / 2;
		cam.right = w / 2;
		cam.top = h / 2;
		cam.bottom = -h / 2;
		cam.near = 1;
		cam.far = D * 4;
		cam.position.set(x + w / 2, -(y + h / 2), D);
		cam.updateProjectionMatrix();
		cam.updateMatrixWorld();

		// screen offset proportional to height above the z=0 plane (z_world = z_view + D)
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
	 * on the z=0 plane fills the output exactly, which keeps z=0 locked to the DOM
	 * wherever the eye is.
	 *
	 * @param {number} x - region left (page px)
	 * @param {number} y - region top (page px)
	 * @param {number} w - region width
	 * @param {number} h - region height
	 */
	_aimPerspective(x, y, w, h) {

		const cam = this.perspCam;
		const D = this.config.cameraZ;
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
	 * Puts the eye over the current viewport (+ the perspective offsets).
	 *
	 * @param {{top:number, height:number}} view - visible region in page px
	 */
	_updateEye(view) {
		this.eye.set(
			this.docW / 2 - this.config.perspectiveX,
			-(view.top + view.height / 2) - this.config.perspectiveY,
			this.config.cameraZ
		);
	}


	/* ==========================================================================
	   RENDERING
	   ========================================================================== */

	/**
	 * Calls each registered element's tick function (ready polling, animations).
	 *
	 * @param {Number} time - performance.now()
	 */
	_tickElements(time) {

		this.registeredElements.forEach((data) => {

			if (!data.options || typeof data.options.tickFn !== 'function')
				return;

			try {
				data.options.tickFn(this._getElementRoot(data), this, time);
			} catch (e) {
				console.warn('Element tickFn error:', e);
			}
		});
	}


	/**
	 * Renders a page region into the WebGL canvas at a given pixel size.
	 *
	 * @param {number} x - region left (page px)
	 * @param {number} y - region top (page px)
	 * @param {number} w - region width
	 * @param {number} h - region height
	 * @param {number} pxW - output width in device pixels
	 * @param {number} pxH - output height in device pixels
	 * @param {boolean} perspective - use the parallax camera
	 */
	_renderRegion(x, y, w, h, pxW, pxH, perspective) {

		this.renderer.getSize(this._size);
		if (this._size.x !== pxW || this._size.y !== pxH)
			this.renderer.setSize(pxW, pxH, false);

		if (perspective)
			this._aimPerspective(x, y, w, h);
		else
			this._aimOrtho(x, y, w, h);

		const region = { x, y, w, h };
		const view = this._view;
		view.perspective = perspective;
		view.cameraZ = this.config.cameraZ;
		view.region = region;

		// theme light rig: themes that implement prepareRegion tell us if shadows are stale
		let shadowsStale = true;
		const theme = this.currentTheme;
		if (theme) {
			if (typeof theme.prepareRegion === 'function')
				shadowsStale = theme.prepareRegion(this, region) !== false;
			if (typeof theme.prepareView === 'function')
				theme.prepareView(this, view);
		}

		// per-element view hooks (CoverBG keeps the paper locked to the page)
		this.registeredElements.forEach((data) => {
			if (data.options && typeof data.options.viewFn === 'function') {
				try {
					data.options.viewFn(this._getCustomRoot(data), this, view);
				} catch (e) {
					console.warn('Element viewFn error:', e);
				}
			}
		});

		this.renderer.shadowMap.needsUpdate = shadowsStale || this._forceShadow;
		this._forceShadow = false;
		this.renderer.render(this.scene, this.camera);
	}


	/**
	 * Parallax live pass: moves the strip over the current view and renders into it.
	 *
	 * @param {{top:number, height:number}} view - visible region in page px
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
		const c = this.canvas;
		c.style.top = `${top}px`;
		c.style.width = `${this.docW}px`;
		c.style.height = `${h}px`;

		this._liveTopPx = topPx;
		this._liveEyeY = this.eye.y;
		this._liveDirty = false;
		this._lastLiveTime = performance.now();

		const ms = performance.now() - t0;
		const s = this.stats;
		s.liveRenders++;
		s.maxLiveMs = Math.max(s.maxLiveMs, ms);
		s.avgLiveMs = s.avgLiveMs ? s.avgLiveMs * 0.9 + ms * 0.1 : ms;

		const now = performance.now();
		this._liveTimes.push(now);
		while (this._liveTimes.length && now - this._liveTimes[0] > 1000)
			this._liveTimes.shift();
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

		if (!canvas) {
			canvas = document.createElement('canvas');
			canvas.className = 'tm-tile';
			canvas.width = this.wpx;
			canvas.height = this.tilePx;
			canvas.style.cssText = `position:absolute;left:0;z-index:1;width:${this.docW}px;height:${this.tileH}px;`;
			canvas._tmCtx = canvas.getContext('2d');
			this.layer.insertBefore(canvas, this.canvas);
		}

		canvas.style.top = `${index * this.tileH}px`;
		canvas.style.visibility = 'hidden';
		canvas.style.display = this.opts.parallax ? 'none' : 'block';

		tile = { index, canvas, ctx: canvas._tmCtx, hasContent: false, fresh: false, lastUsed: 0 };
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
		tile.ctx.drawImage(this.canvas, 0, 0, this.wpx, this.tilePx, 0, 0, this.wpx, this.tilePx);

		tile.hasContent = true;
		tile.fresh = true;
		tile.canvas.style.visibility = 'visible';

		const ms = performance.now() - t0;
		const s = this.stats;
		s.tileRenders++;
		s.maxTileMs = Math.max(s.maxTileMs, ms);
		s.avgTileMs = s.avgTileMs ? s.avgTileMs * 0.9 + ms * 0.1 : ms;
	}


	/**
	 * Renders the low-res whole-page underlay (always flat; it's only a safety net).
	 * In parallax mode this borrows the WebGL canvas, so the caller re-renders the strip
	 * right after, in the same task.
	 */
	_renderUnderlay() {

		this.underlayDirty = false;

		if (!this.opts.underlay || !this.docH) {
			this.underlayCanvas.style.display = 'none';
			return;
		}

		const t0 = performance.now();

		// keep inside GPU limits: pages can be 60k+ px tall on phones
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
		this.underlayCtx.drawImage(this.canvas, 0, 0, pxW, pxH, 0, 0, pxW, pxH);

		this.stats.underlayMs = performance.now() - t0;
		this._liveDirty = true;
	}


	/* ==========================================================================
	   FRAME SCHEDULING
	   ========================================================================== */

	/**
	 * Schedule a frame (cheap if nothing needs rendering).
	 */
	kick() {
		if (!this._raf && this._started)
			this._raf = requestAnimationFrame((now) => this._frame(now));
	}


	/**
	 * Current visible region in page coordinates.
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

		if (!this._started || !this.renderer)
			return;

		const view = this._getView();

		this.scrollX = window.scrollX;
		this.scrollY = window.scrollY;

		// scroll direction (sticky, so a pause doesn't flip lookahead)
		const dy = view.top - this._lastTop;
		this._lastTop = view.top;
		if (Math.abs(dy) > 0.5)
			this._dir = Math.sign(dy);

		this._watchdog(now, dy);

		// animated themes / element ticks
		const active = this.frameMode === 'active';
		if (this.currentTheme && typeof this.currentTheme.onTick === 'function' && active)
			this.currentTheme.onTick(this, now);
		if (active)
			this._liveDirty = true;

		let pending = this.opts.parallax
			? this._frameParallax(view, now)
			: this._frameFlat(view, now, dy);

		if (active)
			pending = true;

		if (pending) {
			this.kick();
		} else if (this.underlayDirty) {

			// underlay waits until things are quiet
			clearTimeout(this._underlayTimer);
			this._underlayTimer = setTimeout(() => {
				if (!this._started)
					return;
				this._renderUnderlay();
				if (this.opts.parallax)
					this._renderLive(this._getView());
				this.kick();
			}, 300);
		}
	}


	/**
	 * Parallax frame: re-render the strip if the eye moved or something changed (fps-capped).
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

		this._tickElements(now);
		this._renderLive(view);
		return false;
	}


	/**
	 * Flat frame: make sure tiles exist around the view, render missing/stale ones within budget.
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

			if (rendered === 0)
				this._tickElements(now);

			this._renderTile(tile);
			rendered++;
		}

		return false;
	}


	/* ==========================================================================
	   DEVICE TIERS: BENCHMARK + WATCHDOG
	   ========================================================================== */

	/**
	 * Resolves once the scene looks fully built: theme ready, no assets loading, and at
	 * least one element built, stable for a moment. Gives up waiting after `timeoutMs`.
	 *
	 * @param {number} timeoutMs - max wait
	 * @returns {Promise<void>}
	 */
	whenSceneReady(timeoutMs = 12000) {

		return new Promise((resolve) => {

			const start = performance.now();
			let stableSince = 0;

			const check = () => {

				if (!this.isOk)
					return resolve();

				const theme = this.currentTheme;
				const themeReady = theme && (theme.isReady === undefined || theme.isReady);
				const anyReady = [...this.registeredElements.values()].some((d) => d.ready);
				const settled = themeReady && anyReady && this.loadingPromises.size === 0 && !!this.envTexture;

				const now = performance.now();
				if (settled) {
					if (!stableSince)
						stableSince = now;
					if (now - stableSince > 400)
						return resolve();
				} else {
					stableSince = 0;
				}

				if (now - start > timeoutMs)
					return resolve();

				setTimeout(check, 150);
			};

			check();
		});
	}


	/**
	 * Benchmark: renders the on-screen strip a few times, forcing the GPU to finish each
	 * one with a 1px readPixels so GPU time is included. The first render is a warm-up
	 * (shader compiles, texture uploads) and isn't counted. Uses the current mode's real
	 * settings (DPR, refraction resolution) so the number reflects what the user would get.
	 *
	 * @param {number} runs - timed renders
	 * @returns {number} median ms per render
	 */
	benchmark(runs = 5) {

		if (!this.renderer)
			return Infinity;

		const gl = this.renderer.getContext();
		const px = new Uint8Array(4);
		const view = this._getView();
		this._updateEye(view);

		const once = () => {
			const t0 = performance.now();
			this._renderLive(view);
			gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
			return performance.now() - t0;
		};

		// warm-up (compiles shaders, uploads textures, first shadow pass)
		this._forceShadow = true;
		once();

		const times = [];
		for (let i = 0; i < runs; i++)
			times.push(once());

		times.sort((a, b) => a - b);
		this.benchmarkMs = times[Math.floor(times.length / 2)];

		// leave the screen showing a normal frame in whatever mode we end up in
		this.requestRender();

		return this.benchmarkMs;
	}


	/**
	 * Watchdog: while the page is actively scrolling, frames should arrive every 8-17ms.
	 * If the median interval over a good sample is way above that, this device can't
	 * keep up with the current mode, so ask to step down (parallax -> flat -> 2d).
	 * Only back-to-back scrolling frames count (gaps between wheel notches are ignored).
	 *
	 * @param {number} now - rAF timestamp
	 * @param {number} dy - scroll delta this frame
	 */
	_watchdog(now, dy) {

		const prev = this._lastScrollFrameNow;

		if (Math.abs(dy) < 0.5) {
			this._lastScrollFrameNow = 0;
			return;
		}

		this._lastScrollFrameNow = now;

		if (!prev)
			return;

		const interval = now - prev;
		if (interval > 150)
			return;

		const samples = this._scrollIntervals;
		samples.push(interval);
		if (samples.length > 180)
			samples.shift();

		if (samples.length < 120 || !this.onDowngrade)
			return;

		const sorted = [...samples].sort((a, b) => a - b);
		const median = sorted[Math.floor(sorted.length / 2)];
		this.watchdogMedianMs = median;

		// under ~30fps while scrolling in parallax, or ~22fps in flat
		const limit = this.opts.parallax ? 34 : 45;
		if (median > limit) {
			this._scrollIntervals = [];
			this.onDowngrade(this.opts.parallax ? 'flat' : '2d', median);
		}
	}

}
