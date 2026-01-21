/*
	TemplateTheme.js
	----------------

	Not a theme intended to be implemented, but a copy-and-pastable base template
	for building other themes on tp of.
*/

import * as THREE from 'three';
import { ThreeManager } from '../utils/ThreeManager';
import { Object3D } from 'three';

export class TemplateTheme {

	// static theme colors for UI elements, etc. (not used by theme code directly)
	static themeColors = {
		primaryColor: '#4da83bff',
		secondaryColor: '#30a6aaff',
		accentColor: '#b0ec6b',
		bgAccent1: '#eaf8ffff',
		bgAccent2: '#d9e3f0ff',
		colorScroll: '#ffffff',
	};


	/**
	 * Constructs the theme, initializing properties and default materials.
	 */
	constructor() {

		// true when the theme is ready
		this.isReady = false;

		// store our lights
		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.fillLight = null;
		this.backLight = null;

		// build our materials once on load
		this.buildMaterials();

		// promise for loading the model, so we don't try to build boxes before it's ready
		this._loadPromise = null;
	}


	/**
	 * Builds materials used by the theme, such as the glass material. This is called once during initialization.
	 */
	buildMaterials() {

		// make ur glass material
		this.glassMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			emissive: 0x00AABAE,
			emissiveIntensity: 0.15,

			transmission: 1.0,
			transparent: true,
			opacity: 1.0,

			ior: 1.45,
			thickness: 0.6,

			roughness: 0.05,
			metalness: 0.1,

			clearcoat: 1.0,
			clearcoatRoughness: 0.02,

			envMapIntensity: 20.5,

			attenuationColor: new THREE.Color(0xfaffff),
			attenuationDistance: 0.08,

			side: THREE.DoubleSide
		});


		// Prepare reusable materials/geometries
		this.boxMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});

		// box line material
		this.customLineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffff
		});
	}


	/**
	 * Builds the lighting setup for the theme, including environment maps and scene lights. Called during initialization.
	 *
	 * @param {ThreeManager} manager - ThreeManager instance
	 */
	buildThemeLighting(manager) {

		// set our environment map for this theme
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 0.65);

		// enable or disable the mouse-light feature
		manager.enableMouseLight(false);

		// configure scene lighting
		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		// Add a directional light as main shadow caster
		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0);
		this.camLight.position.set(-300, 500, 500);
		this.camLight.castShadow = true;
		manager.scene.add(this.camLight);
		manager.scene.add(this.camLight.target);
		this.camLight.target.position.set(-500, 400, 0);

		// Add some rim lights to make the glass pop more
		this.rimLightL = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightL.position.set(-180, 10, 0);
		manager.scene.add(this.rimLightL);

		this.rimLightR = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightR.position.set(280, 50, 0);
		manager.scene.add(this.rimLightR);

		// --- SHADOW CONFIGURATION ---
		const d = 2500;
		this.camLight.shadow.camera.left = -d;
		this.camLight.shadow.camera.right = d;
		this.camLight.shadow.camera.top = d;
		this.camLight.shadow.camera.bottom = -d;

		this.camLight.shadow.camera.near = 1;
		this.camLight.shadow.camera.far = 5000;

		this.camLight.shadow.bias = 0; // Reset bias
		this.camLight.shadow.mapSize.width = 2048 * 2;
		this.camLight.shadow.mapSize.height = 2048 * 2;

		// Reduce shadow acne without needing a bias
		this.camLight.shadow.normalBias = 0.05;
		this.camLight.shadow.radius = 4;
		this.camLight.shadow.needsUpdate = true;

		// Ensure renderer settings are correct
		manager.renderer.shadowMap.enabled = true;
		manager.renderer.shadowMap.type = THREE.PCFShadowMap; // THREE.PCFSoftShadowMap;
	}


	/**
	 * Called by ThemeManager when the theme is initialized. Sets up environment, lighting, and starts loading the model.
	 *
	 * @param {ThreeManager} manager - The ThreeManager Instance
	 */
	init(manager) {

		// this theme doesn't need to be rendered every frame, so we can set the frame mode to 'lazy'
		// to only render when necessary (like on scroll/resize/reflow or when registered elements update)
		manager.setFrameMode('lazy');

		// set the background texture for our built-in bg plane
		const bgTexture = manager.loadPBR('bg_graph_paper', true, false, false, {});
		manager.setBackground(bgTexture, 100, 1, true);

		// set up our lighting
		this.buildThemeLighting(manager);

		// load our glass slice model used for boxes
		this._loadPromise = this._loadModel(manager);
	}


	/**
	 * Cleans up theme before another one is loaded
	 *
	 * @param {ThreeManager} manager - ThreeManager instance reference
	 */
	destroy(manager) {

		// clean lights
		if (this.camLight) {
			manager.scene.remove(this.camLight);
			manager.scene.remove(this.camLight.target);
			this.camLight = null;
		}

		if (this.rimLightL) {
			manager.scene.remove(this.rimLightL);
			this.rimLightL = null;
		}
		if (this.rimLightR) {
			manager.scene.remove(this.rimLightR);
			this.rimLightR = null;
		}
		if (this.fillLight) {
			manager.scene.remove(this.fillLight);
			this.fillLight = null;
		}
		if (this.backLight) {
			manager.scene.remove(this.backLight);
			this.backLight = null;
		}

		// clear and reset references
		this.isReady = false;
		this._didCopyMaps = false;
	}


	/**
	 * Loads the glass slice model used for boxes
	 *
	 * @param {ThreeManager} manager - ThreeManager instances
	 */
	async _loadModel(manager) {

		// load the GLB model using our ThreeManager's asset loading system, which will cache it for future use and ensure it's loaded before we try to build boxes with it
		// const [gltfScene] = await manager.assetsReady(['/models/glass_slice.glb']);

		// // if we got nothing, GTFO
		// if (!gltfScene) {
		// 	console.error("GlassTheme2: Failed to load model.");
		// 	return;
		// }

		// // Our slice model contains objects with these names
		// const names = [
		// 	'Top_Left', 'Top', 'Top_Right',
		// 	'Left', 'Center', 'Right',
		// 	'Bottom_Left', 'Bottom', 'Bottom_Right'
		// ];

		// // enable the shadow casting/receiving for the whole model, since we'll be cloning pieces of it to make our boxes, and we want them all to cast/receive shadows. We can be more selective if we want later, but this is easier.
		// manager.setShadows(gltfScene, true);



		// we have everything we need to start building boxes
		this.isReady = true;

		// calling this on all our registered elements will cause them to rebuild with our new glass slices
		// we just loaded & processed above
		// manager.registeredElements.forEach((data) => {
		// 	manager.buildRegisteredElement(data, false);
		// });

		// // trigger relayout & rerender just to prevent any misalignment or glitches
		// manager.onResize();
		// manager.requestRender();
	}



	/**
	 * Called by the ThreeManager when a box needs to be built
	 *
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the box we're building from the ThreeManagers registered element system
	 */
	buildBox(manager, data) {

		// Add a wireframe cube to the center
		// We'll scale it in updateBox
		const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.boxMaterial);
		cube.name = "debug_cube";
		data.empties.center.add(cube);
	}


	/**
	 * Updates a box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateBox(manager, data, rect) {

		// Resize the center cube to match the div size
		const cube = data.empties.center.getObjectByName("debug_cube");

		if (cube) {
			const depth = 100; // Arbitrary depth for the debug box

			// 1. Scale
			cube.scale.set(rect.width, rect.height, depth);

			// 2. Position Shift
			// By default, a box is centered at (0,0,0).
			// We want the front face to be at Z = 0.
			// Since the box is 'depth' thick, it extends from +depth/2 to -depth/2.
			// We need to move it back by depth/2 so it extends from 0 to -depth.
			cube.position.z = -depth / 2;
		}
	}


	/**
	 * Called by the ThreeManager when a custom box needs to be built
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the custom box we're building from the ThreeManagers registered element system
	 */
	buildCustomBox(manager, data) {

		// A simple cyan wireframe outline (no corner cubes)
		const lines = new THREE.LineSegments(this.customEdgesGeometry, this.customLineMaterial);
		lines.name = "debug_custom_outline";
		data.empties.center.add(lines);
	}


	/**
	 * Updates a custom box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the custom box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateCustomBox(manager, data, rect) {

		const lines = data.empties.center.getObjectByName("debug_custom_outline");

		if (lines) {

			// Keep it thinner than the normal debug box so it's visually distinct
			const depth = this.customDepth;

			lines.scale.set(rect.width, rect.height, depth);
			lines.position.z = -depth / 2;
		}
	}


	/**
	 * Called when the window is resized.
	 */
	onResize(){

	}


	/**
	 * Called when the page is scrolled.
	 *
	 * @param {number} scrollX - The current horizontal scroll position.
	 * @param {number} scrollY - The current vertical scroll position.
	 */
	onScroll(scrollX, scrollY){

	}


	/**
	 * Used for frame adjustments on themes that are "active" (rendered in a rAF loop).
	 * This is where you would put any per-frame animation code for your theme, such as animating the water in our koi pond.
	 * If your theme doesn't need per-frame updates, you can just leave this empty.
	 *
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Number} time - current performance.now() timestamp
	 */
	onTick(manager, time) {

	}

}
