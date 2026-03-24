/*
	DebugTheme.js
	-------------

	A simple theme that renders Red wireframes for <Container3D> elements.
	Acts as the default theme and a reference implementation.
*/

import * as THREE from 'three';

export class DebugTheme {

	// whether to show side items (decorations on the left/right of the content)
	static showSideItems = false;

	// define this themes colors (will be applied to CSS when loaded)
	static themeColors = {
		primaryColor: '#000000',
		secondaryColor: '#707070ff',
		accentColor: '#b0ec6bff',
		bgAccent1: '#eeeeeeff',
		bgAccent2: '#f8f8f8ff',
		textColor: '#333333',
		hoverColor: '#ffffff',
		scrollColor:  '#FFFFFF',
	};

	// other CSS vars not specifically colors
	static themeStyles = {
		contentFrameShadow: 'inset 0px 0px 20px 5px rgba(0, 0, 0, 0.3)',
		contentHeaderBGColor: 'rgba(255, 255, 255, 0.8)',
		contentBoxBGColor: 'rgba(255, 255, 255, 0.8)',
	};


	/**
	 * Constructor
	 */
	constructor() {

		// Store theme-specific state here
		this.boxMaterial = null;
		this.cornerGeometry = null;
		this.customLineMaterial = null;
		this.customEdgesGeometry = null;
		this.customDepth = 40;

		// build our materials once on load
		this.buildMaterials();
	}


	/**
	 * Builds materials used by the theme, such as the glass material. This is called once during initialization.
	 */
	buildMaterials() {

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


		// make box to highlight corners
		this.cornerGeometry = new THREE.BoxGeometry(10, 10, 10); // 10px cubes

		// CustomContainer3D (different styling so we can visually confirm the pipeline)
		this.customEdgesGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
	}


	/**
	 * Builds the lighting setup for the theme, including environment maps and scene lights. Called during initialization.
	 *
	 * @param {ThreeManager} manager - ThreeManager instance
	 */
	buildThemeLighting(manager) {

		// 1. Load HDR Environment (High exposure for brightness)
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 1.0);

	}


	/**
	 * Cleans up theme before another one is loaded
	 *
	 * @param {ThreeManager} manager - ThreeManager instance reference
	 */
	destroy(manager) {

		// Clean up reusable assets
		if (this.boxMaterial)
			this.boxMaterial.dispose();

		if (this.cornerGeometry)
			this.cornerGeometry.dispose();

		if (this.customLineMaterial)
			this.customLineMaterial.dispose();

		if (this.customEdgesGeometry)
			this.customEdgesGeometry.dispose();
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

		// Add markers to corners
		const mkTL = new THREE.Mesh(this.cornerGeometry, new THREE.MeshBasicMaterial({ color: 0x00ff00 }));
		const mkBR = new THREE.Mesh(this.cornerGeometry, new THREE.MeshBasicMaterial({ color: 0x0000ff }));

		data.empties.tl.add(mkTL);
		data.empties.br.add(mkBR);
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
	 *
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
	 * Called per frame (only if manager.frameMode === 'active').
	 *
	 * @param {ThreeManager} manager - The ThreeManager instance.
	 * @param {number} time - The current performance.now() timestamp.
	 */
	onTick(manager, time) {

		// Nothing to animate in debug mode
	}
}
