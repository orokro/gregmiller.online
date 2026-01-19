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

		// Initialize the system
		this.init();

		window.ks = this; // for debugging
	}


	/**
	 * Clean up the KoiSystem by removing all Koi from the scene and disposing of any resources.
	 */
	destroy(){

		// remove koi / target from scene
		this.koi.forEach(koi => this.backgroundCenter.scene.remove(koi));

		// Clean up koi
		this.koi.forEach(koi => koi.destroy());
		this.koi = [];
	}


	/**
	 * Initializes the Koi system by creating a Koi instance and adding it to the scene.
	 */
	init() {

		// add some koi to the pond
		for(let i = 0; i < 3; i++) {

			this.addKoi(
				Math.random() * 200 - 100, // x between -100 and 100
				Math.random() * 200 - 100  // y between -100 and 100
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
	 * Update our koi
	 * @param {Number} time - The current time, passed from the ThreeManager's animation loop
	 */
	update(time){

		// Compute delta time
		let deltaTime = this.lastTime==0 ? 0 : time - this.lastTime;
		this.lastTime = time;

		// update all our koi
		this.koi.forEach(koi => koi.update(deltaTime));
	}

}
