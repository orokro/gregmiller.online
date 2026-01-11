/*
	DebugTheme.js
	-------------

	A simple theme that renders Red wireframes for <Container3D> elements.
	Acts as the default theme and a reference implementation.
*/

import * as THREE from 'three';

export class DebugTheme {

	/**
	 * Constructor
	 */
	constructor() {

		// Store theme-specific state here
		this.boxMaterial = null;
		this.cornerGeometry = null;
	}


	/**
	 * Called when theme is loaded.
	 * * @param {ThreeManager} manager - The ThreeManager instance.
	 */
	init(manager) {

		// Set global background color
		manager.scene.background = new THREE.Color(0xf0f0f0);

		// Load assets if needed (graph paper)
		// For now we just use colors
		if (manager.bgPlane) {
			manager.bgPlane.material.color.set(0xe0e0e0);
			manager.bgPlane.material.map = null;
			manager.bgPlane.material.needsUpdate = true;
		}

		// Prepare reusable materials/geometries
		this.boxMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});

		this.cornerGeometry = new THREE.BoxGeometry(10, 10, 10); // 10px cubes
	}


	/**
	 * Called when theme is unloaded.
	 * * @param {ThreeManager} manager - The ThreeManager instance.
	 */
	destroy(manager) {

		// Clean up reusable assets
		if (this.boxMaterial)
			this.boxMaterial.dispose();

		if (this.cornerGeometry)
			this.cornerGeometry.dispose();
	}


	/**
	 * Called per frame (only if manager.frameMode === 'active').
	 * * @param {ThreeManager} manager - The ThreeManager instance.
	 * @param {number} time - The current performance.now() timestamp.
	 */
	onTick(manager, time) {

		// Nothing to animate in debug mode
	}


	/**
	 * Called when a <Container3D> is registered or theme is switched.
	 * * @param {ThreeManager} manager - The ThreeManager instance.
	 * @param {object} data - The element data object { id, empties, group, ... }.
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
	 * Called on Resize/Scroll/Reflow to update content dimensions.
	 * * @param {ThreeManager} manager - The ThreeManager instance.
	 * @param {object} data - The element data object.
	 * @param {DOMRect} rect - The bounding client rect of the DOM element.
	 */
	updateBox(manager, data, rect) {

		// Resize the center cube to match the div size
		const cube = data.empties.center.getObjectByName("debug_cube");
		if (cube) {
			cube.scale.set(rect.width, rect.height, 100); // 100px deep
		}
	}
}
