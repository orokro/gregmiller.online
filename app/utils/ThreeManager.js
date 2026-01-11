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
import { DebugTheme } from '../themes/DebugTheme'; // Default theme

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
			bgColor: 0xf0f0f0  // Default fog/bg color (themes can override)
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
		// Map<string, { id, element, group, type, empties: { center, tl, tr, bl, br } }>
		this.registeredElements = new Map();

		// Theming
		this.currentTheme = null;

		// Loop Control
		this.isOk = false;       // WebGL Capability
		this.isDirty = true;     // For lazy rendering
		this.frameMode = 'lazy'; // 'lazy' or 'active' (60fps)

		this.init();
	}


	/**
	 * Clean up resources and event listeners when destroying the manager.
	 */
    destroy() {

        if (this.resizeObserver)
			this.resizeObserver.disconnect();

        window.removeEventListener('scroll', this.onScroll.bind(this));

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
		this.renderer.setSize(this.width, this.height);

		// 5. Global Background Plane
		this.setupBackground();

		// 6. Bind Events
        // window.addEventListener('resize', this.onResize.bind(this)); // <-- REMOVE THIS
        window.addEventListener('scroll', this.onScroll.bind(this));

        // NEW: Use ResizeObserver for robust layout detection
        this.resizeObserver = new ResizeObserver(() => {
            this.onResize();
        });
        this.resizeObserver.observe(document.body);

        // 7. Load Default Theme
        this.setTheme(DebugTheme);

		// we gucci
		this.isOk = true;

        // 8. Start Loop
        this.tick();
	}


	/**
	 * Sets up the infinite background plane.
	 * Themes can interact with this via this.bgPlane.
	 */
	setupBackground() {

		// We parent the BG to the camera so it follows us forever.
		// We will animate the texture offset to simulate parallax.
		const geometry = new THREE.PlaneGeometry(1, 1);

		// Load Texture
		const loader = new THREE.TextureLoader();
		const texture = loader.load('/img/bg_graph_paper.jpg');

		// IMPORTANT: Enable wrapping so we can shift UVs infinitely
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;

		// Make our own material so we can control opacity and color tint
		const material = new THREE.MeshBasicMaterial({
			map: texture,
			color: 0xffffff,
			transparent: true,
			opacity: 1
		});

		this.bgPlane = new THREE.Mesh(geometry, material);

		// Put it deep in the scene
		// Since it's a child of CAMERA, this Z is relative to Camera.
		// Camera is at +1000. We want BG at -500 world space.
		// So relative Z = -1500.
		this.bgPlane.position.z = -1500;

		// Add to Camera, not Scene!
		this.camera.add(this.bgPlane);
		this.scene.add(this.camera);
	}


	/* ==========================================================================
	   THEME SYSTEM
	   ========================================================================== */

	/**
	 * Switches the active visual theme.
	 *
	 * @param {Class} ThemeClass - The class definition of the theme to load.
	 */
	setTheme(ThemeClass) {

		if (!ThemeClass)
			return;

		console.log(`ThreeManager: Switching theme to ${ThemeClass.name}`);

		// 1. Unload old theme
		if (this.currentTheme) {
			this.currentTheme.destroy(this);
		}

		// 2. Instantiate new theme
		this.currentTheme = new ThemeClass();
		this.currentTheme.init(this);

		// 3. Rebuild all Theme-Managed boxes
		this.registeredElements.forEach((data) => {
			if (data.type === 'box') {
				// Clear old children from the group
				this.cleanGroupChildren(data.empties.center);
				this.cleanGroupChildren(data.empties.tl);
				this.cleanGroupChildren(data.empties.tr);
				this.cleanGroupChildren(data.empties.bl);
				this.cleanGroupChildren(data.empties.br);

				// Ask theme to build
				this.currentTheme.buildBox(this, data);
			}
		});

		this.requestRender();
	}


	/**
	 * Helper to set frame rate mode.
	 * Themes call this (e.g. Koi theme calls setFrameMode('active')).
	 * * @param {string} mode - 'lazy' or 'active'.
	 */
	setFrameMode(mode) {

		this.frameMode = mode;

		if (mode === 'active')
			this.tick(); // kickstart if stopped
	}


	/* ==========================================================================
	   ASSET MANAGEMENT
	   ========================================================================== */

	/**
	 * Loads assets and returns Clones.
	 * * @param {string[]} urls - List of URLs to load.
	 * @returns {Promise<any[]>} - Array of cloned assets.
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
				}
			});

			this.loadingPromises.set(url, promise);
			return promise;
		};

		await Promise.all(urls.map(loadOne));

		return urls.map(url => {
			const asset = this.assets.get(url);
			// Clone geometry/material deep for meshes, shallow for textures
			return asset.isTexture ? asset.clone() : asset.clone(true);
		});
	}


	/* ==========================================================================
	   ELEMENT SYNC
	   ========================================================================== */

	/**
	 * Registers a DOM element. Generates a Group with 5 empties (Center + 4 Corners).
	 *
	 * @param {HTMLElement} element - The DOM element.
	 * @param {string} type - 'box' (Theme Managed) or 'custom' (Component Managed).
	 * @returns {object} - { id, empties }.
	 */
	register(element, type = 'box') {

		if (!this.isOk)
			return null;

		const id = crypto.randomUUID();

		// Create the main container group
		const group = new THREE.Group();
		this.scene.add(group);

		// Create the 5 anchors
		const empties = {
			center: new THREE.Group(),
			tl: new THREE.Group(),
			tr: new THREE.Group(),
			bl: new THREE.Group(),
			br: new THREE.Group(),
		};

		group.add(empties.center);
		group.add(empties.tl);
		group.add(empties.tr);
		group.add(empties.bl);
		group.add(empties.br);

		// Store data
		const data = { id, element, group, type, empties };
		this.registeredElements.set(id, data);

		// Initial position calculation
		this.updateElementPosition(id);

		// If it's a theme-controlled box, let the theme build it
		if (type === 'box' && this.currentTheme) {
			this.currentTheme.buildBox(this, data);
		}

		this.requestRender();

		return { id, empties };
	}


	/**
	 * Unregister a DOM element.
	 * * @param {string} id - The ID of the element to unregister.
	 */
	unregister(id) {

		if (!this.registeredElements.has(id))
			return;

		const { group } = this.registeredElements.get(id);
		this.scene.remove(group);
		this.cleanGroupChildren(group); // Helper to dispose memory

		this.registeredElements.delete(id);
		this.requestRender();
	}


	/**
	 * Helper to recursively dispose objects.
	 * * @param {THREE.Object3D} group - The group to clean.
	 */
	cleanGroupChildren(group) {

		while (group.children.length > 0) {
			const child = group.children[0];
			group.remove(child);
			if (child.geometry) child.geometry.dispose();
			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
				else child.material.dispose();
			}
			if (child.children.length) this.cleanGroupChildren(child);
		}
	}


	/* ==========================================================================
	   CORE LOOP & MATH
	   ========================================================================== */

	/**
	 * Recalculate Field of View (FOV) to maintain 1:1 pixel mapping.
	 */
	updateFOV() {

		const dist = this.camera.position.z - this.config.planeZ;
		const fov = 2 * Math.atan((this.height / 2) / dist) * (180 / Math.PI);
		this.camera.fov = fov;
		this.camera.aspect = this.width / this.height;
		this.camera.updateProjectionMatrix();
	}


	/**
	 * Handle window resize events.
	 */
	onResize() {

		// Safety check if destroyed
        if (!this.renderer)
			return;

		this.width = window.innerWidth;
		this.height = window.innerHeight;
		this.renderer.setSize(this.width, this.height);
		this.updateFOV();

		// Update BG Plane Scale to fill the camera view
		// Since it's parented to camera, we calculate size at its relative depth (-1500)
		const distBg = 1500; // Hardcoded matches the z-position set in setupBackground
		const vH = 2 * Math.tan((this.camera.fov * Math.PI / 180) / 2) * distBg;
		const vW = vH * this.camera.aspect;

		// Scale background plane & adjust texture repeat for consistent grid size
		if (this.bgPlane) {
			this.bgPlane.scale.set(vW, vH, 1);

			// Update Texture repeat to keep scale consistent regardless of screen size
			// Assuming texture is 512px
			if (this.bgPlane.material.map) {
				const tex = this.bgPlane.material.map;

				// This math makes the grid size constant on screen
				tex.repeat.set(vW / 1000, vH / 1000);
			}
		}

		// Update all elements
		this.registeredElements.forEach((_, id) => this.updateElementPosition(id));
		this.requestRender();
	}


	/**
	 * Handle scroll events.
	 */
	onScroll() {

		this.scrollY = window.scrollY;
		this.scrollX = window.scrollX;

		// 1. Move Camera
		this.camera.position.y = -this.scrollY;
		this.camera.position.x = this.scrollX; // Track Horizontal Scroll

		// 2. Parallax Background
		// We shift the texture offset, not the plane position (since plane is locked to camera)
		if (this.bgPlane && this.bgPlane.material.map) {
			const parallaxFactor = 0.0005; // Adjust speed
			this.bgPlane.material.map.offset.y = this.scrollY * parallaxFactor;
			this.bgPlane.material.map.offset.x = this.scrollX * parallaxFactor;
		}

		this.requestRender();
	}


	/**
	 * Requests a single frame render (Lazy rendering).
	 */
	requestRender() {

		this.isDirty = true;
	}


	/**
	 * Update the 3D position of a specific registered element to match its DOM position.
	 * * @param {string} id - The element ID.
	 */
	updateElementPosition(id) {

		const data = this.registeredElements.get(id);

		if (!data)
			return;

		const rect = data.element.getBoundingClientRect();
		const group = data.group;

		// 1. Position Main Group (Center of Element)
		const docTop = rect.top + this.scrollY;
		const docLeft = rect.left + this.scrollX;
		const halfW = rect.width / 2;
		const halfH = rect.height / 2;

		// X: -ScreenW/2 + Left + HalfWidth
		group.position.x = (-this.width / 2) + docLeft + halfW;

		// Y: ScreenH/2 - Top - HalfHeight
		group.position.y = (this.height / 2) - docTop - halfH;

		// 2. Position Anchors (Relative to Main Group)
		// No scaling on Group! We move children to match pixels.
		const { empties } = data;

		// Center is 0,0,0
		empties.center.position.set(0, 0, 0);

		// TL: x = -halfW, y = +halfH
		empties.tl.position.set(-halfW, halfH, 0);

		// TR: x = +halfW, y = +halfH
		empties.tr.position.set(halfW, halfH, 0);

		// BL: x = -halfW, y = -halfH
		empties.bl.position.set(-halfW, -halfH, 0);

		// BR: x = +halfW, y = -halfH
		empties.br.position.set(halfW, -halfH, 0);

		// 3. Notify Theme (for resizing content)
		if (data.type === 'box' && this.currentTheme) {
			this.currentTheme.updateBox(this, data, rect);
		}
	}


	/**
	 * The main render loop.
	 */
	tick() {

		if (!this.isOk)
			return;

		// 1. Theme Updates (e.g. water ripple)
		// We pass performance.now() for time-based animation
		if (this.currentTheme && this.frameMode === 'active') {
			this.currentTheme.onTick(this, performance.now());
			this.isDirty = true; // Force render
		}

		// 2. Render if dirty
		if (this.isDirty) {
			this.renderer.render(this.scene, this.camera);
			this.isDirty = false;
		}

		// 3. Loop
		if (this.frameMode === 'active') {
			requestAnimationFrame(this.tick.bind(this));
		} else {
			requestAnimationFrame(this.tick.bind(this));
		}
	}
}
