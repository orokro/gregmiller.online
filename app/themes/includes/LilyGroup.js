/*
	LilyGroup.js
	------------

	Defines the Lily Group element for the Koi Pond theme.
*/

// three
import * as THREE from 'three';


// helper class for seeded random numbers
class Random {

	/**
	 * Constructor
	 *
	 * @param {String} seedStr - seed string to initialize the RNG with
	 */
	constructor(seedStr) {

		let h = 2166136261 >>> 0;
		for (let i = 0; i < seedStr.length; i++)
			h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);

		this.seed = h;
	}


	/**
	 * Generates the next pseudo-random number in the sequence.
	 *
	 * @returns {Number} - pseudo-random number between 0 and 1
	 */
	next() {
		let t = this.seed += 0x6D2B79F5;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	}

	/**
	 * Generates a pseudo-random number within the specified range.
	 *
	 * @param {Number} min - minimum value of the range
	 * @param {Number} max - maximum value of the range
	 * @returns {Number} - pseudo-random number between min and max
	 */
	range(min, max) {

		return min + (this.next() * (max - min));
	}
}


// main money
export class LilyGroup extends THREE.Object3D {

	/**
	 * Constructor
	 *
	 * @param {ThemeManager} manager - The ThemeManager instance managing this theme.
	 * @param {Object} models - the loaded models for the theme
	 */
	constructor(manager, models) {

		// call Three.Object3D constructor
		super();

		// save reference to manager & models
		this.manager = manager;
		this.models = models;

		// save our last known width/height
		this.lastWidth = 0;
		this.lastHeight = 0;

		// the lilly pads we've spawned
		this.lilies = [];
	}


	/**
	 * Cleans up any resources used by this element.
	 */
	destroy() {

		// clear lilies
		this.clearLilies();
	}


	/**
	 * Clears all lilies from the group
	 */
	clearLilies() {

		for (let lily of this.lilies) {
			this.remove(lily);
			lily.geometry.dispose();
			lily.material.dispose();
		}
		this.lilies = [];
	}


	/**
	 * Generates lily definitions within the specified bounding box.
	 *
	 * @param {Number} x1 - bounding box for lily generation
	 * @param {Number} y1 - bounding box for lily generation
	 * @param {Number} x2 - bounding box for lily generation
	 * @param {Number} y2 - bounding box for lily generation
	 * @param {Number} minRad - minimum radius of lilies
	 * @param {Number} maxRad - maximum radius of lilies
	 * @param {Number} normalizedRadiusInPixels - how many pixels per unit radius
	 * @param {Number} jitterStrength - amount of jitter to apply to lily positions
	 * @param {Number} maxPlanes - maximum number of overlapping planes before lily is culled
	 * @param {Number} margin - margin around bounding box for lily generation
	 * @param {Boolean} fillGaps - whether to fill gaps between lilies
	 * @param {Number} gapThreshold - threshold for gap filling
	 * @param {String} seed - random seed for generation
	 * @returns {Array<Object>} - array of lily definitions
	 */
	generateLilies(x1, y1, x2, y2, minRad, maxRad, normalizedRadiusInPixels, jitterStrength, maxPlanes, margin, fillGaps, gapThreshold, seed) {

		const rng = new Random(seed);
		let lilies = [];

		// 1. Grid Setup
		const avgRad = (minRad + maxRad) / 2;
		const hexRadius = avgRad * normalizedRadiusInPixels;
		const hexWidth = Math.sqrt(3) * hexRadius;
		const hexHeight = 2 * hexRadius;
		const colStep = hexWidth;
		const rowStep = hexHeight * 0.75;

		const startX = x1 - hexWidth - margin;
		const startY = y1 - hexHeight - margin;
		const endX = x2 + hexWidth + margin;
		const endY = y2 + hexHeight + margin;

		// 2. Main Generation Loop (Hex Jitter)
		let rowIndex = 0;
		for (let cy = startY; cy < endY; cy += rowStep) {
			const isOddRow = rowIndex % 2 === 1;
			const rowOffset = isOddRow ? (hexWidth / 2) : 0;

			for (let cx = startX + rowOffset; cx < endX; cx += colStep) {
				const maxOffset = hexRadius * jitterStrength;
				const offsetX = rng.range(-maxOffset, maxOffset);
				const offsetY = rng.range(-maxOffset, maxOffset);

				const finalX = cx + offsetX;
				const finalY = cy + offsetY;
				const finalR = rng.range(minRad, maxRad);
				const pixelR = finalR * normalizedRadiusInPixels;

				if (finalX < x1 - margin || finalX > x2 + margin ||
					finalY < y1 - margin || finalY > y2 + margin) {
					continue;
				}

				lilies.push({
					x: finalX,
					y: finalY,
					radius: finalR,
					rotation: rng.range(0, 360),
					depth: 0,
					pixelRadius: pixelR
				});
			}
			rowIndex++;
		}

		// 3. Gap Filling Pass (Aggressive Update)
		if (fillGaps) {
			// Increased from 150 to 4000 to guarantee finding the "deep center" of voids
			const attempts = 4000;
			const minPixelR = minRad * normalizedRadiusInPixels;

			for(let i=0; i<attempts; i++) {
				const px = rng.range(x1, x2);
				const py = rng.range(y1, y2);

				// Find distance to closest existing lily edge
				let closestDist = 99999;
				for(const l of lilies) {
					const dx = px - l.x;
					const dy = py - l.y;
					const dist = Math.sqrt(dx*dx + dy*dy);
					const distToEdge = dist - l.pixelRadius;
					if (distToEdge < closestDist) {
						closestDist = distToEdge;
					}
				}

				// Gap Check
				// If the available space is larger than (MinLily * Threshold)
				if (closestDist > (minPixelR * gapThreshold)) {

					// Cap filler size to Max Radius
					const gapFillRadius = Math.min(closestDist, maxRad * normalizedRadiusInPixels);
					const normGapR = gapFillRadius / normalizedRadiusInPixels;

					// Acceptance Logic:
					// We allow "Runts" (lilies smaller than minRad) if they are filling a gap.
					// We accept anything down to 50% of minRad, OR whatever the gapThreshold implies is acceptable.
					// This ensures we don't detect a gap and then refuse to fill it.
					if (normGapR >= (minRad * 0.5)) {
						lilies.push({
							x: px,
							y: py,
							radius: normGapR,
							rotation: rng.range(0, 360),
							depth: 0,
							pixelRadius: gapFillRadius
						});
					}
				}
			}
		}

		// 4. Z-Sorting / Collision Resolution
		let changesMade = true;
		let safetyBreak = 0;

		while(changesMade && safetyBreak < 500) {
			changesMade = false;
			safetyBreak++;

			const indices = lilies.map((_, i) => i);
			// Shuffle check order
			for (let i = indices.length - 1; i > 0; i--) {
				const j = Math.floor(rng.next() * (i + 1));
				[indices[i], indices[j]] = [indices[j], indices[i]];
			}

			for (let i = 0; i < indices.length; i++) {
				const idxA = indices[i];
				const lilyA = lilies[idxA];
				if (!lilyA) continue;

				for (let j = i + 1; j < indices.length; j++) {
					const idxB = indices[j];
					const lilyB = lilies[idxB];
					if (!lilyB) continue;

					if (lilyA.depth !== lilyB.depth) continue;

					const dx = lilyA.x - lilyB.x;
					const dy = lilyA.y - lilyB.y;
					const dist = Math.sqrt(dx*dx + dy*dy);
					const touchDist = lilyA.pixelRadius + lilyB.pixelRadius;

					if (dist < touchDist) {
						const target = rng.next() > 0.5 ? lilyA : lilyB;
						target.depth += 1;
						changesMade = true;

						if (target.depth >= maxPlanes) {
							target.markForDelete = true;
						}
					}
				}
			}
		}

		lilies = lilies.filter(l => !l.markForDelete);
		lilies.sort((a, b) => a.depth - b.depth);

		return lilies;
	}


	/**
	 * builds a lily group element
	 *
	 * @param {Object} data - data about the registered element from the ThreeManager that we're building for
	 */
	buildLilyGroup(data) {

		// prepare parameters
		// get the top left & bottom right corners of the bounding box
		const x1 = data.empties.tl.position.x;
		const y1 = data.empties.tl.position.y;
		const x2 = data.empties.br.position.x;
		const y2 = data.empties.br.position.y;

		// compute width & height
		const width = parseInt(Math.abs(x2 - x1), 10);
		const height = parseInt(Math.abs(y2 - y1), 10);

		// gtfo if they didn't change
		if (width === this.lastWidth && height === this.lastHeight)
			return;

		// save last known size
		this.lastWidth = width;
		this.lastHeight = height;

		// clear any existing lilies
		this.clearLilies();

		// lily generation parameters
		const minRad = 0.7;
		const maxRad = 1.0;
		const normalizedRadiusInPixels = 130.0;
		const jitterStrength = 0.4;
		const maxPlanes = 5;
		const margin = -10;
		const fillGaps = true;
		const gapThreshold = 0.2;
		const seed = "lilygroup_" + data.id;

		// generate lily definitions
		const lilyDefs = this.generateLilies(
			x1, y1, x2, y2,
			minRad, maxRad,
			normalizedRadiusInPixels,
			jitterStrength,
			maxPlanes,
			margin,
			fillGaps,
			gapThreshold,
			seed
		);

		// console.log(lilyDefs);
		// build lilies from definitions
		for (const def of lilyDefs) {

			// clone a lilly
			const lily = this.models.lily_pad.clone();
			this.add(lily);
			lily.position.set(def.x, def.y, -65 + def.depth * 20); // slight Z offset per depth to avoid z-fighting
			const radius = def.pixelRadius * 2;
			lily.scale.set(radius, radius, radius);
			lily.rotation.x = Math.PI / 2;
			lily.rotation.y = THREE.MathUtils.degToRad(def.rotation);
			// lily.rotation.set(-Math.PI / 2, 0, THREE.MathUtils.degToRad(def.rotation));
			this.add(lily);
			this.lilies.push(lily);

		}// next def
	}


	/**
	 * Updates a lily group element
	 *
	 * @param {Object} data - data about the registered element from the ThreeManager that we're updating for
	 * @param {Object} rect - the bounding rectangle of the element
	 */
	updateLilyGroup(data, rect) {

		// just rebuild if the size changed, or otherwise do nothing
		this.buildLilyGroup(data);
	}

}

