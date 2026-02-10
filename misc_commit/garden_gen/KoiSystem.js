/*
	KoiSystem.js
	------------

	Instantiates & manages the Koi in the Koi Pond theme.
*/

// import dependencies
import * as THREE from 'three';
import { Koi } from "./Koi";

// main money
export class KoiSystem {

	/**
	 * Constructor
	 *
	 * @param {ThreeManager} manager - the ThreeManager instance to which this KoiSystem belongs
	 */
	constructor(manager) {

		// Store reference to manager and any state
		this.manager = manager;

		// store our list of spawned Koi
		this.koi = [];

		// get the background plane from the scene so we can position the koi on it
		const data = manager.getRegisteredElementByName('app-cover-bg');
		this.backgroundCenter = data.empties.center;

		// get the view ports corner/center empties for positioning
		this.viewportRefs = manager.getRegisteredElementByName('main_frame_ref').empties;

		// for computing delta time in the update loop
		this.lastTime = 0;

		// scratch
		this._vTL = new THREE.Vector3();
		this._vBR = new THREE.Vector3();
		this._tmp = new THREE.Vector3();

		// Initialize the system
		this.init();

		window.ks = this; // for debugging
	}


	/**
	 * Clean up the KoiSystem by removing all Koi from the scene and disposing of any resources.
	 */
	destroy(){

		// remove koi / target from scene
		this.koi.forEach(koi => this.backgroundCenter.remove(koi));
		this.koi.forEach(koi => koi.destroy());
		this.koi = [];
	}


	/**
	 * Initializes the Koi system by creating a Koi instance and adding it to the scene.
	 */
	init() {

		// add some koi to the pond
		const count = 3;
		for(let i = 0; i < count; i++) {

			this.addKoi(
				Math.random() * 1500 - 750,
				Math.random() * 1500 - 750
			);

		}// next i
	}


	/**
	 * Adds a koi to the pond
	 *
	 * @param {number} x - X coordinate for the new Koi
	 * @param {number} y - Y coordinate for the new Koi
	 */
	addKoi(x, y) {

		// Create a new Koi instance and add it to the scene
		const newKoi = new Koi(this, this.manager);
		this.koi.push(newKoi);
		this.backgroundCenter.add(newKoi);

		// Position the new Koi at the specified coordinates
		newKoi.position.set(x, y, -150);
	}


	/**
	 * Returns viewport bounds, converted into backgroundCenter-local space.
	 */
	getViewportBoundsInBackground(margin = 80) {

		if (!this.viewportRefs || !this.viewportRefs.tl || !this.viewportRefs.br)
			return { minX: -500, maxX: 500, minY: -500, maxY: 500 };

		// make sure matrices are current
		this.manager.scene.updateMatrixWorld(true);

		this.viewportRefs.tl.getWorldPosition(this._vTL);
		this.viewportRefs.br.getWorldPosition(this._vBR);

		// convert world -> background local
		this.backgroundCenter.worldToLocal(this._vTL);
		this.backgroundCenter.worldToLocal(this._vBR);

		const minX = Math.min(this._vTL.x, this._vBR.x) + margin;
		const maxX = Math.max(this._vTL.x, this._vBR.x) - margin;
		const minY = Math.min(this._vTL.y, this._vBR.y) + margin;
		const maxY = Math.max(this._vTL.y, this._vBR.y) - margin;

		return { minX, maxX, minY, maxY };
	}


	/**
	 * Gets a random point within the viewport bounds, converted into backgroundCenter-local space.
	 *
	 * @param {Number} margin - how much space to leave from the edges of the viewport bounds when generating a random point
	 */
	getRandomViewportPointInBackground(margin = 80) {

		const b = this.getViewportBoundsInBackground(margin);
		return new THREE.Vector3(
			THREE.MathUtils.lerp(b.minX, b.maxX, Math.random()),
			THREE.MathUtils.lerp(b.minY, b.maxY, Math.random()),
			-150
		);
	}


	/**
	 * Update our koi
	 * @param {Number} time - The current time, passed from the ThreeManager's animation loop
	 */
	update(time){

		// ms -> seconds
		let dt = this.lastTime === 0 ? 0 : (time - this.lastTime) / 1000;
		this.lastTime = time;

		// clamp to avoid huge jumps (tab switch, hitch, etc)
		dt = Math.min(dt, 0.05);

		this.koi.forEach(koi => koi.update(dt));
	}

}
