/*
	ThreeManager.js
	---------------

	The core engine for the 3D website.
	Manages the Scene, Camera, Renderer, Asset Loading, and the "Theme" system.
	Syncs 3D coordinates 1:1 with DOM elements.
*/

// imports
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// Themes
import { GlassTheme } from '../themes/GlassTheme';
import { DebugTheme } from '../themes/DebugTheme';

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
	 * Constructor initializes the Three.js scene, camera, and renderer.
	 *
	 * @param {HTMLCanvasElement} canvas - The canvas element to render the Three.js scene on.
	 */
	constructor(canvas) {

		// save our references
		this.canvas = canvas;

		// Configuration
		this.config = {
			cameraZ: 1000,     // The camera distance
			planeZ: 0,         // The plane where 1 unit = 1 pixel
			bgZ: -500,         // The depth of the background plane
			bgColor: 0xf0f0f0,  // Default fog/bg color (themes can override)
			perspectiveX: 0,
			perspectiveY: 0
		};

		// State
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.scrollY = window.scrollY;
		this.scrollX = window.scrollX;

		// Asset Management
		this.assets = new Map();
		this.loadingPromises = new Map();

		// DOM elements synced to 3D
		this.registeredElements = new Map();

		// Theming
		this.currentTheme = null;
		this.envTexture = null;

		// Loop Control
		this.isOk = false;
		this.isDirty = true;

		// NEW: burst render state
		this.renderFramesLeft = 0;
		this._rafId = null;
		this.tick = this.tick.bind(this);

		// For lazy rendering
		this.frameMode = 'lazy'; // 'lazy' or 'active' (60fps)

		// Bindings for Visual Viewport (iOS Zoom Fix)
		this.onVisualScroll = this.onScroll.bind(this);
		this.onVisualResize = this.onResize.bind(this);

		this.init();
	}


	/**
	 * Clean up resources and event listeners when destroying the manager.
	 */
	destroy() {

		if (this.resizeObserver)
			this.resizeObserver.disconnect();

		window.removeEventListener('scroll', this.onScroll.bind(this));

		// Cleanup Visual Viewport listeners
		if (window.visualViewport) {
			window.visualViewport.removeEventListener('scroll', this.onVisualScroll);
			window.visualViewport.removeEventListener('resize', this.onVisualResize);
		}

		// Dispose renderer
		if (this.renderer) {
			this.renderer.dispose();
			this.renderer = null;
		}
	}


	/**
	 * Sets up the scene, camera, renderer, and events.
	 */
	init() {

		// 1. Capability Check
		if (!window.WebGLRenderingContext)
			return;

		// 2. Scene Setup
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(this.config.bgColor);

		// 3. Camera Setup
		this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 10, 10000);
		this.camera.position.z = this.config.cameraZ;

		// 4. Renderer
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

		// Initial sizing - will be immediately overridden by onResize
		this.renderer.setSize(this.width, this.height);

		// 5. Global Background Plane
		this.setupBackground();

		// 6. Bind Events
		window.addEventListener('scroll', this.onScroll.bind(this));

		// NEW: Bind Visual Viewport events for iOS Zoom/Pan support
		if (window.visualViewport) {
			window.visualViewport.addEventListener('scroll', this.onVisualScroll);
			window.visualViewport.addEventListener('resize', this.onVisualResize);
		}

		// Make sure onResize is called at least once to set initial sizes and FOV
		this.resizeObserver = new ResizeObserver((entries) => {
			let needsGlobalUpdate = false;
			for (const entry of entries) {
				needsGlobalUpdate = true;
			}
			if (needsGlobalUpdate) {
				this.onResize();
			}
		});
		this.resizeObserver.observe(document.body);

		// we're good to go!
		this.isOk = true;

		// 7. Load Default Theme
		this.setTheme(GlassTheme);

		// 8. Force initial layout update
		this.onResize();

		// 9. Start Loop
		this.tick();
	}


	/**
	 * Sets up the infinite background plane.
	 */
	setupBackground() {

		// build a plane for the background
		const geometry = new THREE.PlaneGeometry(1, 1);
		const loader = new THREE.TextureLoader();

		// our our default background texture (a subtle graph paper)
		const texture = loader.load(
			'/img/bg_graph_paper.jpg',
			() => {
				this.requestRender();
			}
		);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;

		// build a texture-mapped material for the background
		// no tone mapping, we want the colors to be exactly as they are in the texture
		const material = new THREE.MeshPhysicalMaterial({
			map: texture,
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
		});
		material.toneMapped = false;

		// add the background plane to the scene, positioned at the back
		this.bgPlane = new THREE.Mesh(geometry, material);
		this.bgPlane.position.z = -1101;
		this.camera.add(this.bgPlane);
		this.scene.add(this.camera);
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

		// gtfo if no theme
		if (!ThemeClass)
			return;
		console.log(`ThreeManager: Switching theme to ${ThemeClass.name}`);

		// Clean up old theme if exists
		if (this.currentTheme) {
			this.currentTheme.destroy(this);
		}

		// Set new theme & init
		this.currentTheme = new ThemeClass();
		this.currentTheme.init(this);

		// make sure all registered elements are updated to use the new theme's styles
		this.registeredElements.forEach((data) => {
			if (data.type === 'box') {
				this.cleanGroupChildren(data.empties.center);
				this.cleanGroupChildren(data.empties.tl);
				this.cleanGroupChildren(data.empties.tr);
				this.cleanGroupChildren(data.empties.bl);
				this.cleanGroupChildren(data.empties.br);

			}
		});

		this.registeredElements.forEach((data) => {
			this.buildRegisteredElement(data);
		});

		this.requestRender();
		this.onResize(); // make sure everything is positioned correctly for the new theme
	}


	/**
	 * Sets our render mode to either "active" (continuous) or "lazy" (on-demand).
	 *
	 * @param {String} mode - either "active" or "lazy", "active" is requestAnimationFrame loop on
	 */
	setFrameMode(mode) {
		this.frameMode = mode;

		// If switching to active, ensure loop is running
		if (this.frameMode === 'active') {
			this._ensureTicking();
			return;
		}

		// If switching to lazy, we only keep running if we have burst frames left
		// If none left, do nothing and the loop will naturally stop
		// If some left, ensure ticking continues for the burst
		if (this.renderFramesLeft > 0) {
			this._ensureTicking();
		}
	}


	/**
	 * Set the environment texture for image-based lighting in the scene.
	 *
	 * @param {string} url - location of new texture
	 * @param {Number} exposure - how bright the environment texture should be
	 */
	setEnvironmentTexture(url, exposure = 1.0) {

		// gtfo if  no url or renderer
		if (!url || !this.renderer)
			return;

		// clean up old texture if exists
		this.clearEnvironmentTexture();

		// pick loader based on file extension
		const ext = url.split('.').pop().toLowerCase();
		let loader;
		if (ext === 'hdr') {
			loader = new RGBELoader();
		} else {
			loader = new THREE.TextureLoader();
		}

		// load the new texture
		loader.load(url, (texture) => {
			texture.mapping = THREE.EquirectangularReflectionMapping;
			if (ext !== 'hdr') {
				texture.colorSpace = THREE.SRGBColorSpace;
			}
			this.scene.environment = texture;
			this.envTexture = texture;
			this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
			this.renderer.toneMappingExposure = exposure;
			this.requestRender();
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

		// gtfo if no urls
		if (!this.isOk)
			return [];

		// Helper to load a single asset with caching and promise management
		const loadOne = (url) => {

			// if we already have this asset, return it immediately
			if (this.assets.has(url))
				return Promise.resolve(this.assets.get(url));

			// if we're already loading this asset, return the existing promise
			if (this.loadingPromises.has(url))
				return this.loadingPromises.get(url);

			// otherwise, start loading the asset
			const promise = new Promise((resolve, reject) => {

				// pick loader based on file extension
				const ext = url.split('.').pop().toLowerCase();
				if (ext === 'glb' || ext === 'gltf') {

					new GLTFLoader().load(url, (gltf) => {
						this.assets.set(url, gltf.scene);
						this.loadingPromises.delete(url);
						resolve(gltf.scene);
					}, undefined, reject);

				} else if (['jpg', 'png', 'webp'].includes(ext)) {

					new THREE.TextureLoader().load(url, (tex) => {
						this.assets.set(url, tex);
						this.loadingPromises.delete(url);
						resolve(tex);
					}, undefined, reject);

				} else if (ext === 'hdr') {

					new RGBELoader().load(url, (tex) => {
						this.assets.set(url, tex);
						this.loadingPromises.delete(url);
						resolve(tex);
					}, undefined, reject);
				}
			});
			this.loadingPromises.set(url, promise);
			return promise;
		};

		// wait for all assets to load and return them in the same order as the input URLs
		await Promise.all(urls.map(loadOne));

		// return clones of the assets to prevent accidental mutations (especially important for textures)
		return urls.map(url => {
			const asset = this.assets.get(url);
			return asset.isTexture ? asset.clone() : asset.clone(true);
		});
	}


	/* ==========================================================================
	   ELEMENT SYNC
	   ========================================================================== */

	/**
	 * register a DOM element to be synced in 3D space, with a specific theme type for styling.
	 *
	 * @param {HTMLElement} element - the element to watch in 3d
	 * @param {String} type - the type of sync to use (e.g., 'box')
	 * @param {Object} options - additional options for registration, passed to the theme's build functions
	 * @returns {Object} - { id, empties } where id is the unique identifier for this element and empties are the empty groups for positioning
	 */
	register(element, type = 'box', options = {}) {

		// gtfo if no element or manager not ready
		if (!this.isOk)
			return null;

		// make a new id and group for this element, and save it in our registry
		const id = uuid();
		const group = new THREE.Group();
		this.scene.add(group);

		// create empties for the center and corners
		const empties = {
			center: new THREE.Group(),
			tl: new THREE.Group(),
			tr: new THREE.Group(),
			bl: new THREE.Group(),
			br: new THREE.Group(),
		};

		// add our empties used for themes to position stuff
		group.add(empties.center);
		group.add(empties.tl);
		group.add(empties.tr);
		group.add(empties.bl);
		group.add(empties.br);

		// pack up the data and save it
		const data = { id, element, group, type, empties, options };
		this.registeredElements.set(id, data);
		if (this.resizeObserver) {
			this.resizeObserver.observe(element);
		}

		// make sure the new element is positioned correctly in the first place
		this.updateElementPosition(id);
		this.buildRegisteredElement(data);

		// make sure to re-render now that we have a new element
		this.requestRender();
		return { id, empties };
	}


	/**
	 * Unregister a DOM element from syncing, removing its 3D group and cleaning up resources.
	 *
	 * @param {string} id - id of object to unregister
	 */
	unregister(id) {

		// gtfo if no id or manager not ready
		if (!this.registeredElements.has(id))
			return;

		// grab the group and element, unobserve it, remove it from the scene, clean up resources, and delete from registry
		const data = this.registeredElements.get(id);
		const { group, element } = data;
		if (this.resizeObserver && element) {
			this.resizeObserver.unobserve(element);
		}

		// CustomContainer3D cleanup hook (optional)
		if (data.type === 'customBox' && data.options && typeof data.options.cleanFn === 'function') {
			try {
				data.options.cleanFn(this._getCustomRoot(data), this);
			} catch (e) {
				console.warn('CustomContainer3D cleanFn error:', e);
			}
		}

		this.scene.remove(group);
		this.cleanGroupChildren(group);
		this.registeredElements.delete(id);

		// make sure to re-render now that it's gone
		this.requestRender();
	}


	/**
	 * Clean up all children of a group, disposing of geometries and materials to free GPU memory.
	 *
	 * @param {THREE.Object3D} group - group to clean
	 */
	cleanGroupChildren(group) {

		// loop through all children and dispose of geometries and materials,
		// then remove them from the group
		while (group.children.length > 0) {

			const child = group.children[0];
			group.remove(child);

			if (child.geometry)
				child.geometry.dispose();

			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
				else child.material.dispose();
			}

			if (child.children.length)
				this.cleanGroupChildren(child);
		}
	}


	/* ==========================================================================
	   CUSTOM CONTAINERS
	   ========================================================================== */

	/**
	 * Get a function that builds a custom box for this item
	 * @param {Object} data - data about registered object
	 * @returns
	 */
	_getDefaultCustomBuild(data) {

		return () => {
			if (this.currentTheme && typeof this.currentTheme.buildCustomBox === 'function') {
				this.currentTheme.buildCustomBox(this, data);
			}
		};
	}


	/**
	 * Gets the a wrapped update function for a custom box that calls the theme's updateCustomBox if it exists.
	 *
	 * @param {Object} data - data about registered object
	 * @param {Object} rect - the bounding rect of the element
	 * @return {Function} - the wrapped update function
	 */
	_getDefaultCustomUpdate(data, rect) {
		return () => {
			if (this.currentTheme && typeof this.currentTheme.updateCustomBox === 'function') {
				this.currentTheme.updateCustomBox(this, data, rect);
			}
		};
	}


	/**
	 * Gets root objects to be used in custom builds, which can be useful for themes that want to provide some default structure for custom boxes.
	 */
	_getCustomRoot(data) {
		return {
			group: data.group,
			empties: data.empties,
		};
	}

	/**
	 * Builds a registered element by calling the appropriate theme build function based on the element type.
	 *
	 * @param {Object} data - the data about registered object
	 */
	buildRegisteredElement(data) {

		if (!data)
			return;

		// If this is a CustomContainer3D and it supplied a cleanup hook,
		// let it dispose custom resources BEFORE we wipe the empties.
		if (data.type === 'customBox' && data.options && typeof data.options.cleanFn === 'function') {
			try {
				data.options.cleanFn({
					group: data.group,
					empties: data.empties,
				}, this);
			} catch (e) {
				console.warn('CustomContainer3D cleanFn error:', e);
			}
		}

		// Always clear any existing geometry so rebuilds don't stack
		this.cleanGroupChildren(data.empties.center);
		this.cleanGroupChildren(data.empties.tl);
		this.cleanGroupChildren(data.empties.tr);
		this.cleanGroupChildren(data.empties.bl);
		this.cleanGroupChildren(data.empties.br);

		// Regular Container3D always uses theme buildBox
		if (data.type === 'box') {
			if (this.currentTheme && typeof this.currentTheme.buildBox === 'function') {
				this.currentTheme.buildBox(this, data);
			}
			return;
		}

		// Custom ContainerCustom3D: theme default is optional, instance overrides possible
		if (data.type === 'customBox') {

			// theme default build (no-op if theme doesn't implement it)
			const defaultBuild = () => {
				if (this.currentTheme && typeof this.currentTheme.buildCustomBox === 'function') {
					this.currentTheme.buildCustomBox(this, data);
				}
			};

			// Provide full access to group + empties so custom components can pick corners, etc.
			const customRoot = {
				group: data.group,
				empties: data.empties,
			};

			// If a custom buildFn exists, it replaces default theming unless it calls defaultBuild()
			if (data.options && typeof data.options.buildFn === 'function') {
				data.options.buildFn(defaultBuild, customRoot, this);
			} else {
				defaultBuild();
			}
		}
	}


	/**
	 * Updates a registered element by calling the appropriate theme update function based on the element type.
	 *
	 * @param {string} id - the id of the registered object to update
	 * @param {Object} rect - the bounding rect of the element
	 */
	updateRegisteredElement(data, rect) {

		if (!data || !this.currentTheme)
			return;

		// Container3D: always theme updateBox
		if (data.type === 'box') {
			if (typeof this.currentTheme.updateBox === 'function') {
				this.currentTheme.updateBox(this, data, rect);
			}
			return;
		}

		// ContainerCustom3D:
		if (data.type === 'customBox') {

			const customRoot = this._getCustomRoot(data);
			const defaultUpdate = this._getDefaultCustomUpdate(data, rect);

			if (data.options && typeof data.options.updateFn === 'function') {
				data.options.updateFn(defaultUpdate, customRoot, this);
			} else {
				defaultUpdate();
			}
		}
	}


	/* ==========================================================================
	   CORE LOOP & MATH
	   ========================================================================== */

	/**
	 * Make sure our FOV is always set so that 1 unit in Three.js space equals 1 pixel on the screen at the planeZ distance, regardless of viewport size or camera distance.
	 */
	updateFOV() {

		const dist = this.camera.position.z - this.config.planeZ;
		const fov = 2 * Math.atan((this.height / 2) / dist) * (180 / Math.PI);
		this.camera.fov = fov;
		this.camera.aspect = this.width / this.height;

		this.camera.clearViewOffset();
		this.camera.setViewOffset(
			this.width,
			this.height,
			this.config.perspectiveX,
			-this.config.perspectiveY,
			this.width,
			this.height
		);

		this.onScroll();
		this.camera.updateProjectionMatrix();
	}


	/**
	 * Make sure the canvas always matches the viewport size and position, including accounting for Visual Viewport offsets on mobile.
	 */
	updateCanvasLayout() {

		// Get the viewport size and offsets. On desktop, offsets will be 0 and size will match the window. On mobile, this accounts for zoom/pan.
		let vW = document.documentElement.clientWidth || window.innerWidth;
		let vH = document.documentElement.clientHeight || window.innerHeight;
		let offX = 0;
		let offY = 0;

		// If Visual Viewport API is available, use it to get the actual viewport size and offsets (important for iOS zoom/pan)
		if (window.visualViewport) {
			vW = window.visualViewport.width;
			vH = window.visualViewport.height;
			offX = window.visualViewport.offsetLeft;
			offY = window.visualViewport.offsetTop;
		}

		this.width = vW;
		this.height = vH;

		// Update the renderer size to match the viewport
		this.renderer.setSize(vW, vH);

		// Position the canvas to match the viewport, including any visual viewport offsets
		this.canvas.style.width = `${vW}px`;
		this.canvas.style.height = `${vH}px`;
		this.canvas.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
	}


	/**
	 * Handle when the window is resized, including updating the camera FOV and background plane scale to maintain the correct aspect ratio and 1:1 pixel mapping.
	 */
	onResize() {

		// gtfo if no renderer
		if (!this.renderer)
			return;

		this.updateCanvasLayout();
		this.updateFOV();

		// Update BG Plane Scale
		const distBg = 1101;
		const vH = 4 * Math.tan((this.camera.fov * Math.PI / 180) / 2) * distBg;
		const vW = vH * this.camera.aspect;

		if (this.bgPlane) {

			this.bgPlane.scale.set(vW, vH, 1);
			if (this.bgPlane.material.map) {
				const tex = this.bgPlane.material.map;
				tex.repeat.set(vW / 1000, vH / 1000);
			}
		}

		this.registeredElements.forEach((_, id) => this.updateElementPosition(id));
		this.requestRender();
	}


	/**
	 * Handle scroll events.
	 */
	onScroll() {

		this.updateCanvasLayout();

		this.scrollY = window.scrollY;
		this.scrollX = window.scrollX;

		let visualOffsetX = 0;
		let visualOffsetY = 0;

		if (window.visualViewport) {
			visualOffsetX = window.visualViewport.offsetLeft;
			visualOffsetY = window.visualViewport.offsetTop;
		}

		// FIX: CAMERA IS NOW STATIC
		// Since the canvas moves to match the Visual Viewport, the camera
		// stays centered on the "screen". We don't move it.
		this.camera.position.x = -this.config.perspectiveX;
		this.camera.position.y = -this.config.perspectiveY;

		// 2. Parallax Background
		// We still want the background to scroll, even if the camera is static relative to the screen.
		// Total Scroll = Document Scroll + Visual Offset (Pan)
		if (this.bgPlane && this.bgPlane.material.map) {
			const totalScrollY = this.scrollY + visualOffsetY;
			const totalScrollX = this.scrollX + visualOffsetX;

			const worldUnitScale = 1000;
			this.bgPlane.material.map.offset.y = -totalScrollY / worldUnitScale;
			this.bgPlane.material.map.offset.x = totalScrollX / worldUnitScale;
		}

		this.registeredElements.forEach((_, id) => this.updateElementPosition(id));
		this.requestRender();
	}


	/**
	 * Request a render on the next animation frame.
	 *
	 * In "lazy" mode, this is how you trigger a new render when something changes.
	 * In "active" mode, this is ignored since we're rendering every frame anyway.
	 */
	requestRender() {
		this.isDirty = true;
		this.renderFramesLeft = 60;
		this._ensureTicking();
	}


	/**
	 * Update the 3D position of a specific registered element to match its DOM position.
	 */
	updateElementPosition(id) {

		// get the data for the element of this id & gtfo if no data
		const data = this.registeredElements.get(id);
		if (!data)
			return;

		// get the corners to measure
		const el = data.element;
		const cTL = el.querySelector('.top-left');
		const cBR = el.querySelector('.bottom-right');

		// get the corner positions relative to the viewport
		if (!cTL || !cBR) return;
		const rectTL = cTL.getBoundingClientRect();
		const rectBR = cBR.getBoundingClientRect();

		// FIX: Direct Screen Mapping
		// We ignore scroll offsets and visual offsets.
		// We just ask: "Where is this element on the screen right now?"
		// Since the Canvas is strictly locked to the Screen, these coordinates map 1:1.

		const top = rectTL.top;
		const left = rectTL.left;
		const width = rectBR.left - rectTL.left;
		const height = rectBR.top - rectTL.top;

        const halfW = width / 2;
        const halfH = height / 2;

		const group = data.group;

		// Map Screen Coordinates (Top-Left 0,0) to Three.js Plane (Center 0,0)
		group.position.x = (-this.width / 2) + left + halfW;
		group.position.y = (this.height / 2) - top - halfH;

		const { empties } = data;
		empties.center.position.set(0, 0, 0);
		empties.tl.position.set(-halfW, halfH, 0);
		empties.tr.position.set(halfW, halfH, 0);
		empties.bl.position.set(-halfW, -halfH, 0);
		empties.br.position.set(halfW, -halfH, 0);

		const rect = { width, height, top, left };
		this.updateRegisteredElement(data, rect);
	}


	/**
	 * Render loop management: ensures that the tick function is being called on the next animation frame.
	 * In "lazy" mode, this is called whenever we need to render a new frame due to changes.
	 * In "active" mode, this is called once to kick off the continuous rendering loop.
	 */
	_ensureTicking() {
		if (this._rafId != null)
			return;
		this._rafId = requestAnimationFrame(this.tick);
	}


	/**
	 * The main render loop.
	 * - Active mode: always renders and keeps looping.
	 * - Lazy mode: renders for N frames after requestRender(), then stops.
	 */
	tick() {

		// clear the scheduled id (we're in the callback now)
		this._rafId = null;

		// gtfo if we're not ready
		if (!this.isOk)
			return;

		const isActive = (this.frameMode === 'active');

		// Theme tick: only run while we are actively ticking
		// (Active mode always ticks; Lazy mode ticks during a burst window)
		if (this.currentTheme && typeof this.currentTheme.onTick === 'function') {
			this.currentTheme.onTick(this, performance.now());

			// IMPORTANT:
			// Do NOT force dirty here. If the theme actually animates,
			// it should call manager.requestRender() itself.
		}

		// Decide whether to render this frame
		const shouldRender = isActive || this.isDirty || this.renderFramesLeft > 0;

		if (shouldRender) {

			this.renderer.render(this.scene, this.camera);

			// reset dirty after a render
			this.isDirty = false;

			// decrement burst counter only in lazy mode
			if (!isActive && this.renderFramesLeft > 0) {
				this.renderFramesLeft--;
			}
			console.log('render');
			// console.log('Rendered frame. Active mode:', isActive, 'Frames left in burst:', this.renderFramesLeft);
		}

		// Decide whether to keep looping
		const shouldContinue = isActive || this.renderFramesLeft > 0;

		if (shouldContinue) {
			this._rafId = requestAnimationFrame(this.tick);
		}
	}

}
