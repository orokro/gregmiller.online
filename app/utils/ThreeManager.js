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
		this.isOk = false;       // WebGL Capability
		this.isDirty = true;
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

		// NEW: Robust ResizeObserver
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
		const geometry = new THREE.PlaneGeometry(1, 1);
		const loader = new THREE.TextureLoader();
		const texture = loader.load(
			'/img/bg_graph_paper.jpg',
			() => {
				this.requestRender();
			}
		);
		texture.colorSpace = THREE.SRGBColorSpace;
		texture.wrapS = THREE.RepeatWrapping;
		texture.wrapT = THREE.RepeatWrapping;
		const material = new THREE.MeshPhysicalMaterial({
			map: texture,
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
		});
		material.toneMapped = false;

		this.bgPlane = new THREE.Mesh(geometry, material);

		this.bgPlane.position.z = -1101;
		this.camera.add(this.bgPlane);
		this.scene.add(this.camera);
	}


	/* ==========================================================================
	   THEME SYSTEM
	   ========================================================================== */

	setTheme(ThemeClass) {
		if (!ThemeClass) return;
		console.log(`ThreeManager: Switching theme to ${ThemeClass.name}`);

		if (this.currentTheme) {
			this.currentTheme.destroy(this);
		}

		this.currentTheme = new ThemeClass();
		this.currentTheme.init(this);

		this.registeredElements.forEach((data) => {
			if (data.type === 'box') {
				this.cleanGroupChildren(data.empties.center);
				this.cleanGroupChildren(data.empties.tl);
				this.cleanGroupChildren(data.empties.tr);
				this.cleanGroupChildren(data.empties.bl);
				this.cleanGroupChildren(data.empties.br);
				this.currentTheme.buildBox(this, data);
			}
		});
		this.requestRender();
	}

	setFrameMode(mode) {
		this.frameMode = mode;
		if (mode === 'active')
			this.tick();
	}

	setEnvironmentTexture(url, exposure = 1.0) {
		if (!this.renderer) return;
		this.clearEnvironmentTexture();

		const ext = url.split('.').pop().toLowerCase();
		let loader;
		if (ext === 'hdr') {
			loader = new RGBELoader();
		} else {
			loader = new THREE.TextureLoader();
		}

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
	async assetsReady(urls) {
		if (!this.isOk) return [];
		const loadOne = (url) => {
			if (this.assets.has(url)) return Promise.resolve(this.assets.get(url));
			if (this.loadingPromises.has(url)) return this.loadingPromises.get(url);
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
		await Promise.all(urls.map(loadOne));
		return urls.map(url => {
			const asset = this.assets.get(url);
			return asset.isTexture ? asset.clone() : asset.clone(true);
		});
	}


	/* ==========================================================================
	   ELEMENT SYNC
	   ========================================================================== */
	register(element, type = 'box') {
		if (!this.isOk) return null;
		const id = uuid();
		const group = new THREE.Group();
		this.scene.add(group);
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
		const data = { id, element, group, type, empties };
		this.registeredElements.set(id, data);
		if (this.resizeObserver) {
			this.resizeObserver.observe(element);
		}
		this.updateElementPosition(id);
		if (type === 'box' && this.currentTheme) {
			this.currentTheme.buildBox(this, data);
		}
		this.requestRender();
		return { id, empties };
	}

	unregister(id) {
		if (!this.registeredElements.has(id)) return;
		const { group, element } = this.registeredElements.get(id);
		if (this.resizeObserver && element) {
			this.resizeObserver.unobserve(element);
		}
		this.scene.remove(group);
		this.cleanGroupChildren(group);
		this.registeredElements.delete(id);
		this.requestRender();
	}

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

	updateCanvasLayout() {
		let vW = document.documentElement.clientWidth || window.innerWidth;
		let vH = document.documentElement.clientHeight || window.innerHeight;
		let offX = 0;
		let offY = 0;

		if (window.visualViewport) {
			vW = window.visualViewport.width;
			vH = window.visualViewport.height;
			offX = window.visualViewport.offsetLeft;
			offY = window.visualViewport.offsetTop;
		}

		this.width = vW;
		this.height = vH;

		this.renderer.setSize(vW, vH);

		this.canvas.style.width = `${vW}px`;
		this.canvas.style.height = `${vH}px`;
		this.canvas.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
	}

	onResize() {
		if (!this.renderer) return;

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


	requestRender() {
		this.isDirty = true;
	}


	/**
	 * Update the 3D position of a specific registered element to match its DOM position.
	 */
	updateElementPosition(id) {
		const data = this.registeredElements.get(id);
		if (!data) return;

		const el = data.element;
		const cTL = el.querySelector('.top-left');
		const cBR = el.querySelector('.bottom-right');

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

		const syntheticRect = { width, height, top: rectTL.top, left: rectTL.left };
		if (data.type === 'box' && this.currentTheme) {
			this.currentTheme.updateBox(this, data, syntheticRect);
		}
	}


	/**
	 * The main render loop.
	 */
	tick() {
		if (!this.isOk) return;
		if (this.currentTheme && this.frameMode === 'active') {
			this.currentTheme.onTick(this, performance.now());
			this.isDirty = true;
		}
		if (this.isDirty) {
			this.renderer.render(this.scene, this.camera);
			this.isDirty = false;
		}
		if (this.frameMode === 'active') {
			requestAnimationFrame(this.tick.bind(this));
		} else {
			requestAnimationFrame(this.tick.bind(this));
		}
	}
}
