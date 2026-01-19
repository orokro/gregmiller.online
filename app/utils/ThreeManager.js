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
import { KoiPondTheme } from '../themes/KoiPondTheme';

import { useTheming } from '../composables/useTheming';
import { nextTick } from 'vue';
const { setTheme } = useTheming();

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
			perspectiveX: -100,
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
		this.currentBgConfig = null; // Stores the current background configuration globally

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

		// NEW: Mouse Light Feature
		this.mouseLightEnabled = false;
		this.mouseLight = null;
		this.onMouseMove = this._handleMouseLightMove.bind(this);

		// NEW: Default Background Plane Feature (Optional)
		this.useDefaultBgPlane = false;
		this.bgPlane = null;

		this.init();

		// for debugging
		window.tm = this;
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

		// Cleanup Mouse Light
		this.enableMouseLight(false);

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

		// Capability Check
		if (!window.WebGLRenderingContext)
			return;

		// Scene Setup
		this.scene = new THREE.Scene();
		this.scene.background = new THREE.Color(this.config.bgColor);

		// Camera Setup
		this.camera = new THREE.PerspectiveCamera(50, this.width / this.height, 10, 10000);
		this.camera.position.z = this.config.cameraZ;

		// Renderer
		this.renderer = new THREE.WebGLRenderer({
			canvas: this.canvas,
			alpha: true,
			antialias: true,
			powerPreference: "high-performance"
		});
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFShadowMap;

		// Initial sizing - will be immediately overridden by onResize
		this.renderer.setSize(this.width, this.height);

		// Global Background Plane (Optional - call enableDefaultBGPlane(true) to enable)
		// this.setupBackground();

		// Bind Events
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
		// this.setTheme(GlassTheme);
		setTimeout(() => {
			setTheme("KoiPondTheme");
			// setTheme("GlassTheme");
		}, 1000);

		// 8. Force initial layout update
		this.onResize();

		// 9. Start Loop
		this.tick();
	}


	/**
	 * Toggles the default background plane.
	 * If enabling for the first time, it builds the plane.
	 * If disabling, it hides the plane.
	 *
	 * @param {boolean} enabled
	 */
	enableDefaultBGPlane(enabled = true) {

		if (enabled === this.useDefaultBgPlane)
			return;

		this.useDefaultBgPlane = enabled;

		if (enabled) {
			// If we haven't built it yet, build it now
			if (!this.bgPlane) {
				this.setupBackground();
			}
			// Ensure it's visible and in the scene
			if (this.bgPlane) {
				this.bgPlane.visible = true;
				// In case it was removed from scene manually (though usually we just hide it)
				if (!this.bgPlane.parent) {
					this.scene.add(this.bgPlane);
				}
			}
		} else {
			// Just hide it if it exists
			if (this.bgPlane) {
				this.bgPlane.visible = false;
			}
		}

		this.requestRender();
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
		const material = new THREE.MeshStandardMaterial({
			map: texture,
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			envMapIntensity: 0, // Disable IBL on bg so shadows are sharper
		});

		// add the background plane to the scene, positioned at the back
		this.bgPlane = new THREE.Mesh(geometry, material);

		// Camera is at (100, 0, 1000). Plane was at local z=-1101.
		// So World Z = -101.
		this.bgPlane.position.set(100, 0, -101);
		this.bgPlane.receiveShadow = true;
		this.bgPlane.frustumCulled = false;

		this.scene.add(this.bgPlane);
		this.scene.add(this.camera);

		// SHADOW TEST CUBE
		/*
		const testGeo = new THREE.BoxGeometry(100, 100, 100);
		const testMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
		const testMesh = new THREE.Mesh(testGeo, testMat);
		testMesh.position.set(-200, 0, 0);
		testMesh.castShadow = true;
		this.scene.add(testMesh);
		*/
	}


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

		// Initialize cache if needed
		if (!this.materialCache) {
			this.materialCache = new Map();
		}

		// Return cached material if available
		if (!noCache && this.materialCache.has(baseName)) {
			return this.materialCache.get(baseName);
		}

		const loader = new THREE.TextureLoader();
		const path = `/textures/${baseName}`;

		// Load Maps
		const maps = {};

		// ALBEDO (Always expected)
		maps.map = loader.load(`${path}_ALBEDO.png`);
		maps.map.colorSpace = THREE.SRGBColorSpace;
		maps.map.wrapS = THREE.RepeatWrapping;
		maps.map.wrapT = THREE.RepeatWrapping;

		if (normal) {
			maps.normalMap = loader.load(`${path}_NORMAL.png`);
			maps.normalMap.wrapS = THREE.RepeatWrapping;
			maps.normalMap.wrapT = THREE.RepeatWrapping;
		}

		if (smooth) {
			// Assuming _SMOOTH.png maps to roughnessMap
			maps.roughnessMap = loader.load(`${path}_SMOOTH.png`);
			maps.roughnessMap.wrapS = THREE.RepeatWrapping;
			maps.roughnessMap.wrapT = THREE.RepeatWrapping;
		}

		if (metal) {
			maps.metalnessMap = loader.load(`${path}_METAL.png`);
			maps.metalnessMap.wrapS = THREE.RepeatWrapping;
			maps.metalnessMap.wrapT = THREE.RepeatWrapping;
		}

		// Merge options
		const matConfig = Object.assign({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			...maps
		}, options);

		const material = new THREE.MeshStandardMaterial(matConfig);

		// Cache it
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
			// Dispose textures
			['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'alphaMap', 'aoMap', 'emissiveMap'].forEach(key => {
				if (mat[key] && mat[key].isTexture) {
					mat[key].dispose();
				}
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
		this.currentBgConfig = {
			material,
			depth,
			uvScale,
			catchShadows
		};

		// get the registered element data for the background cover component or GTFO if doesn't exist
		const data = this.getRegisteredElementByName('app-cover-bg');
		if (!data)
			return;

		// Set configuration on the data object so the component can read it
		data.bgConfig = this.currentBgConfig;

		// FORCE UPDATE: Ensure the component re-evaluates its state immediately
		this.updateElementPosition(data.id);
		this.requestRender();
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

		// Clean any potential remaining theme artifacts from the scene (but keep registered element groups and bg plane)
		// this.nukeThemeArtifacts();

		// Set new theme & init
		this.currentTheme = new ThemeClass();
		this.currentTheme.init(this);

		// make sure all registered elements are updated to use the new theme's styles
		this.registeredElements.forEach((data) => {
			if (data.type === 'box') {
				this.cleanGroupNonEmptyChildren(data.group, data.empties);
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


	/**
	 * Nuclear cleanup after a theme switch:
	 * - Preserves: camera (and its bgPlane child), all registered element root groups,
	 *   and backgroundImage3D groups.
	 * - Destroys: everything else in scene/camera (and disposes geometries/materials/textures).
	 */
	nukeThemeArtifacts() {

		// Build keep set
		const keep = new Set();

		// Keep camera (bgPlane is attached under it)
		if (this.camera)
			keep.add(this.camera);

		// Keep all registered element root groups (and background image groups)
		this.registeredElements.forEach((data) => {
			if (data && data.group)
				keep.add(data.group);
		});

		// Helper to dispose object tree
		const disposeTree = (obj) => {
			if (!obj)
				return;

			obj.traverse((child) => {

				// geometry
				if (child.geometry)
					child.geometry.dispose();

				// material(s) + textures
				if (child.material) {
					const mats = Array.isArray(child.material) ? child.material : [child.material];
					mats.forEach((m) => {
						if (!m) return;

						// dispose common texture slots if present
						Object.keys(m).forEach((k) => {
							const v = m[k];
							if (v && v.isTexture) {
								v.dispose();
							}
						});

						m.dispose();
					});
				}
			});
		};

		// 1) Clear all per-element theme artifacts under empties
		this.registeredElements.forEach((data) => {

			if (!data || !data.empties)
				return;

			// backgroundImage3D doesn't use empties; skip
			if (data.type === 'backgroundImage3D')
				return;

			this.cleanEmptiesChildren(data.empties);

			// Also clear any theme junk added directly under the element's group (but keep empties)
			this.cleanGroupNonEmptyChildren(data.group, data.empties);
		});

		// 2) Nuke stray stuff attached to the camera (except bgPlane if you want to keep it)
		if (this.camera) {
			const camChildren = [...this.camera.children];
			camChildren.forEach((child) => {

				// Keep background plane if it exists
				if (this.bgPlane && child === this.bgPlane)
					return;

				// Also keep any registered groups that someone attached under camera (rare, but possible)
				if (keep.has(child))
					return;

				this.camera.remove(child);
				disposeTree(child);
			});
		}

		// 3) Nuke stray stuff attached directly to the scene (except keep set)
		if (this.scene) {
			const sceneChildren = [...this.scene.children];
			sceneChildren.forEach((child) => {

				if (keep.has(child))
					return;

				this.scene.remove(child);
				disposeTree(child);
			});
		}

		this.requestRender();
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
	   BACKGROUND IMAGE MANAGEMENT
	   ========================================================================== */

	/**
	 * Clean up the 3D background image for an element, removing it from the scene and disposing of its resources.
	 * @param {Object} data - the registered element's data object
	 */
	_disposeBackgroundImage3D(data) {

		if (!data || !data._bgImage3D)
			return;

		const { mesh, material, geometry, texture } = data._bgImage3D;

		if (mesh && mesh.parent)
			mesh.parent.remove(mesh);

		if (geometry)
			geometry.dispose();

		if (material)
			material.dispose();

		if (texture) {

			// If this is an ImageBitmap texture, close it
			if (texture.image && typeof texture.image.close === 'function') {
				try { texture.image.close(); } catch (e) {}
			}

			// For HTMLImageElement, release reference
			if (texture.image && texture.image instanceof HTMLImageElement) {
				try { texture.image.src = ''; } catch (e) {}
			}

			texture.dispose();
		}

		data._bgImage3D = null;
	}


	/**
	 * Clean up and rebuild the background image for an element, used when the theme changes or the element's options change.
	 *
	 * @param {Object} data - the registered element's data object
	 */
	_buildBackgroundImage3D(data) {

		if (!data || !data.options || !data.options.src)
			return;

		const src = data.options.src;
		const mode = (data.options.mode || 'multiply').toLowerCase();
		const opacity = Number.isFinite(data.options.opacity) ? data.options.opacity : 1.0;

		// geometry is unit plane; we scale it in updateElementPosition
		const geometry = new THREE.PlaneGeometry(1, 1);

		// “decal-ish” shaded material that still receives shadowing
		const material = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			transparent: true,
			opacity,
			depthWrite: false,
			premultipliedAlpha: true,
		});

		// Blend mode (best-effort)
		if (mode === 'multiply') {
			material.blending = THREE.MultiplyBlending;

		} else if (mode === 'overlay') {
			// Three doesn’t have true “overlay”; use normal blending as safest fallback
			material.blending = THREE.NormalBlending;

		} else {
			material.blending = THREE.NormalBlending;
		}

		// Debug flags
		// Avoid z-fighting / depth rejection caused by bgPlane depth
		// material.depthTest = false;
		// material.depthWrite = false;

		// build the new image plane mesh
		const mesh = new THREE.Mesh(geometry, material);
		mesh.castShadow = false;
		mesh.receiveShadow = true;

		// Make it render after the bg plane
		// mesh.renderOrder = 10;
		// mesh.frustumCulled = false; // ensure it renders even if camera is inside the plane

		// make a new debug cube
		// const cube = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100), new THREE.MeshBasicMaterial({
		// 	color: 0xff0000,
		// 	wireframe: true
		// }));
		// data.group.add(cube);

		// Put it inside the group
		data.group.add(mesh);

		const targetZ = this.bgPlane.position.z + 0.025; // -1101 + 0.25 = -1100.75 (closer)
		data.group.position.z = targetZ;

		// Load the texture (and guard against unregister-before-load)
		const aliveId = data.id;
		const loader = new THREE.TextureLoader();

		loader.load(src, (tex) => {

			// If it got unregistered while loading, dispose immediately
			if (!this.registeredElements.has(aliveId)) {
				try {
					if (tex.image && typeof tex.image.close === 'function') tex.image.close();
				} catch (e) {}
				tex.dispose();
				return;
			}

			tex.colorSpace = THREE.SRGBColorSpace;
			// tex.flipY = false;

			material.map = tex;
			material.needsUpdate = true;

			// Save refs for cleanup
			if (data._bgImage3D)
				data._bgImage3D.texture = tex;

			// ensure the quad is scaled correctly now that everything exists
			this.updateElementPosition(aliveId);

			this.requestRender();
		});

		// store for cleanup + later sizing
		data._bgImage3D = {
			mesh,
			material,
			geometry,
			texture: null,
		};

		// make sure we render at least once
		this.requestRender();
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

		// Special: background image decals live in camera space near the bgPlane
		if (type === 'backgroundImage3D') {

			const group = new THREE.Group();

			// Attach to camera so it stays in “screen space” like the bgPlane :contentReference[oaicite:4]{index=4}
			this.camera.add(group);

			// no empties needed
			const empties = null;

			const data = { id, element, group, type, empties, options };
			this.registeredElements.set(id, data);

			if (this.resizeObserver) {
				this.resizeObserver.observe(element);
			}

			this.buildRegisteredElement(data);
			this.updateElementPosition(id);
			this.requestRender();

			return { id, empties };
		}

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

		// Apply global background config if this is the background element
		if (options.name === 'app-cover-bg' && this.currentBgConfig) {
			data.bgConfig = this.currentBgConfig;
		}

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

		// background image types
		if (data.type === 'backgroundImage3D') {

			this._disposeBackgroundImage3D(data);

			// remove from camera (or whatever parent it has)
			if (group && group.parent) {
				group.parent.remove(group);
			}

			this.registeredElements.delete(id);
			this.requestRender();
			return;
		}

		this.scene.remove(group);
		this.cleanGroupNonEmptyChildren(data.group, data.empties);
		this.registeredElements.delete(id);

		// make sure to re-render now that it's gone
		this.requestRender();
	}


	/**
	 * Remove everything under the empties (but keep the empties themselves).
	 * This is the missing piece that caused DebugTheme wireframes to persist.
	 */
	cleanEmptiesChildren(empties) {

		if (!empties)
			return;

		const emptyList = [
			empties.center,
			empties.tl,
			empties.tr,
			empties.bl,
			empties.br,
		].filter(Boolean);

		emptyList.forEach((empty) => {
			// disposes recursively (your code already expects this to exist)
			if (typeof this.cleanGroupChildren === 'function') {
				this.cleanGroupChildren(empty);
				return;
			}

			// fallback: remove only
			while (empty.children.length > 0) {
				empty.remove(empty.children[0]);
			}
		});
	}


	/**
	 * Clean all children of a group except the 5 empties groups.
	 * This prevents themes from leaking geometry added directly to data.group (like GlassTheme).
	 *
	 * @param {THREE.Group} group
	 * @param {Object} empties
	 */
	cleanGroupNonEmptyChildren(group, empties, skipEmpties = false) {

		if (!group)
			return;

		// if empties aren't ready, fall back to doing nothing (don't nuke the group)
		if (!empties || !empties.center || !empties.tl || !empties.tr || !empties.bl || !empties.br)
			return;

		// clean children of empties first to prevent orphaned geometry if themes add directly to empties instead of using their own sub-groups
		if (!skipEmpties) {
			this.cleanEmptiesChildren(empties);
		}

		// build a set of the empties so we can skip them when cleaning the sibling children of the main group
		const keep = new Set([
			empties.center,
			empties.tl,
			empties.tr,
			empties.bl,
			empties.br,
		]);

		// copy because we'll mutate group.children
		const children = [...group.children];

		children.forEach((child) => {

			if (keep.has(child))
				return;

			group.remove(child);

			// dispose mesh resources
			if (child.geometry)
				child.geometry.dispose();

			if (child.material) {
				if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
				else child.material.dispose();
			}

			// dispose nested children
			if (child.children && child.children.length)
				this.cleanGroupChildren(child);
		});
	}


	/**
	 * Helper to find a registered element by its name option, which is useful for themes that want to apply specific styling to certain elements (e.g., a "card" element).
	 *
	 * @param {String} name - name of element to find
	 * @returns {null|Object} - the registered element object
	 */
	getRegisteredElementByName(name) {
		for (const entry of this.registeredElements.values()) {
			if (entry.options?.name === name) {
				return entry;
			}
		}

		return null;
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


	/*
	 * Similar to _getCustomRoot but for regular boxes, which only have the empties as the theme-accessible root objects.
	 *
	 * @param {Object} data - data about registered object
	 */
	_getElementRoot(data) {
		return {
			group: data.group,
			empties: data.empties,
		};
	}


	/**
	 * Builds a registered element by calling the appropriate theme build function based on the element type.
	 *
	 * @param {Object} data - the data about registered object
	 * @param {boolean} rebuildCustom - whether to rebuild custom boxes (if false, skips straight to default theme build for custom boxes, which is useful for theme switches where we want to preserve custom builds but re-apply theming)
	 */
	buildRegisteredElement(data, rebuildCustom = true) {

		if (!data)
			return;

		// BackgroundImage3D (does not use theme or empties)
		if (data.type === 'backgroundImage3D') {

			// rebuild safely
			this._disposeBackgroundImage3D(data);
			this._buildBackgroundImage3D(data);

			return;
		}

		// If this is a CustomContainer3D and it supplied a cleanup hook,
		// let it dispose custom resources BEFORE we wipe the empties.
		// Only run this if we are actually rebuilding the custom part.
		if (rebuildCustom && data.type === 'customBox' && data.options && typeof data.options.cleanFn === 'function') {
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
		this.cleanGroupNonEmptyChildren(data.group, data.empties, !rebuildCustom);

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
				data.options.buildFn(defaultBuild, customRoot, this, rebuildCustom);
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

		// Only call setSize when size changed
		const sizeChanged = (vW !== this.width) || (vH !== this.height);
		this.width = vW;
		this.height = vH;

		if (sizeChanged) {
			this.renderer.setSize(vW, vH, false);
			this.canvas.style.width = `${vW}px`;
			this.canvas.style.height = `${vH}px`;
		}

		// Transform can change on scroll/pan
		this.canvas.style.transform = `translate3d(${offX}px, ${offY}px, 0)`;
	}

	updateCanvasLayout_old() {

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

		if (this.useDefaultBgPlane && this.bgPlane) {

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
		if (this.useDefaultBgPlane && this.bgPlane && this.bgPlane.material.map) {
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

		// BackgroundImage3D doesn't have corners or theme-based positioning, so we handle it separately here.
		if (data.type === 'backgroundImage3D') {

			if (!this.useDefaultBgPlane || !this.bgPlane)
				return;

			// 1) DOM anchor (center)
			const rect = data.element.getBoundingClientRect();
			const cx = rect.left + rect.width * 0.5;
			const cy = rect.top + rect.height * 0.5;

			if (!Number.isFinite(cx) || !Number.isFinite(cy))
				return;

			// 2) Screen -> NDC
			const ndcX = (cx / this.width) * 2 - 1;
			const ndcY = -((cy / this.height) * 2 - 1);

			// 3) Project to a plane at the desired depth (camera-local)
			const targetZ = this.bgPlane.position.z;// + 0.25; // slightly closer than bg
			const dist = Math.abs(targetZ);

			const fovRad = this.camera.fov * Math.PI / 180;
			const planeH = 2 * Math.tan(fovRad * 0.5) * dist;
			const planeW = planeH * this.camera.aspect;

			const foo = 0.571;
			let x = ndcX * (planeW * foo);
			let y = ndcY * (planeH * foo);

			// 4) Background "reference frame" correction
			// Your bg grid "moves" via texture offset. If we don't apply the same offset
			// in world space, decals will appear to slide over the grid.
			const map = this.bgPlane.material && this.bgPlane.material.map ? this.bgPlane.material.map : null;

			if (map && map.offset) {

				// In your bg setup you typically set repeat = vW/256, vH/256
				// which means: 1.0 UV offset == 256 world units on the bg plane.
				// Use that same constant here (keep in sync with your bg repeat logic).
				const UNITS_PER_UV = 256;

				// NOTE: Signs depend on how you perceive the offset direction.
				// This pairing is the one that usually makes decals "stick" to the texture.
				x += map.offset.x * UNITS_PER_UV;
				y += map.offset.y * UNITS_PER_UV;
			}

			data.group.position.set(x, -y*0.653, targetZ);

			// 5) Scale from DOM px -> world units at this depth
			if (data._bgImage3D && data._bgImage3D.mesh) {

				const pxW = Number.isFinite(+data.options.width)
					? +data.options.width
					: rect.width;

				const pxH = Number.isFinite(+data.options.height)
					? +data.options.height
					: rect.height;

				if (!Number.isFinite(pxW) || !Number.isFinite(pxH) || pxW <= 0 || pxH <= 0)
					return;

				const wWorld = (pxW / this.width) * planeW;
				const hWorld = (pxH / this.height) * planeH;

				data._bgImage3D.mesh.scale.set(wWorld, hWorld, 1);
			}

			return;
		}



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
	 * Calls the tick function for each registered element that has a tickFn defined in its options.
	 *
	 * @param {Number} time - the current time, passed from the main tick loop
	 */
	_tickElements(time) {

		this.registeredElements.forEach((data) => {

			if (!data || !data.options)
				return;

			if (typeof data.options.tickFn !== 'function')
				return;

			try {
				data.options.tickFn(this._getElementRoot(data), this, time);
			} catch (e) {
				console.warn('Element tickFn error:', e);
			}
		});
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

			const time = performance.now();

			// theme tick stays as-is (you already call it above)
			// but per-element tick should only run when we actually render a frame
			this._tickElements(time);

			this.renderer.render(this.scene, this.camera);

			// reset dirty after a render
			this.isDirty = false;

			// decrement burst counter only in lazy mode
			if (!isActive && this.renderFramesLeft > 0) {
				this.renderFramesLeft--;
			}

			// for debug
			// console.log('render');
			// console.log('Rendered frame. Active mode:', isActive, 'Frames left in burst:', this.renderFramesLeft);
		}

		// Decide whether to keep looping
		const shouldContinue = isActive || this.renderFramesLeft > 0;

		if (shouldContinue) {
			this._rafId = requestAnimationFrame(this.tick);
		}
	}



	/* ============================================================================
	   SHADOW HELPERS
	   ============================================================================ */


	/**
	 * Recursively sets castShadow on the object and its children.
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable casting.
	 */
	setShadowCasting(object, enabled) {
		object.traverse((child) => {
			// We usually only want Meshes to cast shadows, not helper objects or lights
			if (child.isMesh) {
				child.castShadow = enabled;
			}
		});
	}


	/**
	 * Recursively sets receiveShadow on the object and its children.
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable receiving.
	 */
	setShadowReceiving(object, enabled) {
		object.traverse((child) => {
			if (child.isMesh) {
				child.receiveShadow = enabled;
			}
		});
	}


	/**
	 * Recursively sets both casting and receiving.
	 * @param {THREE.Object3D} object - The root object to traverse.
	 * @param {boolean} enabled - Whether to enable or disable both.
	 */
	setShadows(object, enabled) {
		this.setShadowCasting(object, enabled);
		this.setShadowReceiving(object, enabled);
	}



	/* ============================================================================
	   MOUSE LIGHT
	   ============================================================================ */

	/**
	 * Toggles the "mouse light" feature.
	 * When enabled, a light follows the mouse cursor.
	 *
	 * @param {boolean} enabled - whether to turn the feature on or off
	 */
	enableMouseLight(enabled = true) {

		if (enabled === this.mouseLightEnabled)
			return;

		this.mouseLightEnabled = enabled;

		if (enabled) {

			// Create light if it doesn't exist
			if (!this.mouseLight) {
				this.mouseLight = new THREE.PointLight(0xffffff, 500000, 500);
				this.mouseLight.castShadow = true;
				this.mouseLight.shadow.bias = -0.0001;
			}

			this.scene.add(this.mouseLight);
			window.addEventListener('mousemove', this.onMouseMove);

		} else {

			if (this.mouseLight) {
				this.scene.remove(this.mouseLight);
			}
			window.removeEventListener('mousemove', this.onMouseMove);
		}

		this.requestRender();
	}


	/**
	 * Handles mouse move events to update the position of the mouse light.
	 *
	 * @param {MouseEvent} event - the mouse move event
	 */
	_handleMouseLightMove(event) {

		if (!this.mouseLightEnabled || !this.mouseLight)
			return;

		// Convert mouse screen coords to world coords on the Z=0 plane (or config.planeZ)
		// Similar logic to updateElementPosition but simpler since we just want the point

		const x = event.clientX;
		const y = event.clientY;

		// Center (0,0) is at the center of the screen
		// X increases to the right
		// Y increases upwards
		const worldX = (x - this.width / 2);
		const worldY = -(y - this.height / 2);

		// Position the light slightly above the plane so it casts nice shadows
		// this.config.planeZ is usually 0
		const z = this.config.planeZ + 150;

		this.mouseLight.position.set(worldX, worldY, z);
		this.requestRender();
	}

}
