/*
	Koi.js
	------

	This is a Object3D wrapper that provides character controlling for a Koi in the Koi Pond theme.
*/

// Three
import * as THREE from 'three';
import { AxesHelper } from 'three';

// used for our koi states
const KOI_STATE = {
	IDLE: 'idle',
	SWIMMING: 'swimming',
	SURFACING: 'surfacing'
};

// main money
export class Koi extends THREE.Object3D {

	/**
	 * Constructor
	 *
	 * @param {KoiSystem} koiSystem - the KoiSystem instance to which this Koi belongs
	 * @param {ThreeManager} manager - the ThreeManager instance to which this Koi belongs
	 * @param {Object} options - Configuration options for the Koi
	 */
	constructor(koiSystem, manager, options = {}) {

		super();

		// save reference to our koi system and manager
		this.koiSystem = koiSystem;
		this.manager = manager;

		// Store options and state
		this.options = options;
		this.speed = 0.1; // Default speed, can be overridden by options

		// the current target the koi will swim towards
		this.axisHelper = new THREE.AxesHelper(100);
		this.koiTarget = new THREE.Group();
		this.koiTarget.add(this.axisHelper);
		this.koiSystem.backgroundCenter.add(this.koiTarget);

		// use these knobs to tweak the animations for the koi states
		this.swimAnimationSpeed = 1;
		this.idleAnimationSpeed = 0.5;
		this.surfaceAnimationSpeed = 0.75;

		// our initial state is idle
		this.state = KOI_STATE.IDLE;

		// load our koi model and add it to this object
		this._loadModel(manager);

		// for debug
		// this.rotation.x = 45 * (Math.PI / 180); // rotate 45 degrees on X so it's oriented correctly in the pond
	}


	/**
	 * Clean up if necessary
	 */
	destroy() {

		// Clean up any resources, event listeners, etc. here
		this.koiSystem.backgroundCenter.remove(this.koiTarget);

		// Clean up target
		this.axisHelper.geometry.dispose();
		this.axisHelper.material.dispose();
		this.koiTarget.remove(this.axisHelper);
		this.axisHelper = null;
		this.koiTarget = null;
	}


	/**
	 * Loads the Koi model
	 *
	 * @param {ThreeManager} manager - the ThreeManager instance to which this Koi belongs
	 */
	async _loadModel(manager){

		// load the GLB model using our ThreeManager's asset loading system, which will cache it for future use and ensure it's loaded before we try to build boxes with it
		const [gltfScene] = await manager.assetsReady(['/models/koi_fish.glb']);

		// if we got nothing, GTFO
		if (!gltfScene) {
			console.error("GlassTheme2: Failed to load model.");
			return;
		}

		// get the mesh from the loaded GLTF scene and add it to this object
		this.koiFish = gltfScene.children[0];

		// add to this object
		this.add(this.koiFish);

		// scale/rotate/position correctly
		const scale = 50;
		this.koiFish.scale.set(scale, scale, scale);
		this.koiFish.rotation.x = 0;
		this.koiFish.rotation.z = -Math.PI / 2;
	}


	/**
	 * Update method to be called on each frame - moves fish & handles any animation
	 *
	 * @param {number} deltaTime - Time elapsed since the last update
	 */
	update(deltaTime) {


	}

}
