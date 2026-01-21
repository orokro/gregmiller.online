/*
	PondElements.js
	---------------

	Spawns the other pond elements (rocks, flowers) along the pond columns.
	For the Koi Pond theme.
*/

// three
import * as THREE from 'three';
import { Mesh } from "three";

// main money
export class PondElements {

	/**
	 * Constructor
	 *
	 * @param {Object} empties - Object full of empty ThreeJS Groups to use as reference points:
	 *	{ tl:THREE.Group, tr:THREE.Group, bl:THREE.Group, br:THREE.Group, center:THREE.Group }
	 * @param {Mesh} rockModel - Mesh/group root for rock to clone
	 * @param {Mesh} flowerModel - Mesh/group root for flower to clone
	 * @param {String} seed - Seed to use for procedural generation
	 */
	constructor(empties, rockModel, flowerModel, seed = "rocks") {

		this.empties = empties;
		this.rockModel = rockModel;
		this.flowerModel = flowerModel;

		// Spawn region width (height is determined programmatically)
		this.columnsWidth = 300;

		// Depth offset from parent empty
		this.zOffset = -70;

		// Manual offsets so you can hand-tune spacing / avoid overlaps.
		// Positive numbers push outward (left goes negative, right goes positive).
		this.rock_offset_x = 100;
		this.flower_offset_x = -50;

		// --- ROCK SPAWN SETTINGS ---
		// Frequency as items per 1000 world units of height (pixels-ish).
		// Examples:
		// - 1 => ~1 rock per 1000px vertically (sparse)
		// - 10 => ~10 rocks per 1000px (dense)
		// - 30 => ~30 rocks per 1000px (very dense)
		this.rockFrequency = 8;

		// Randomized spacing jitter around the mean gap derived from rockFrequency.
		// 0.5 => +/- 50% around the mean gap.
		this.rockGapJitter = 0.55;

		// Clamp the computed gaps to these ranges (safety)
		this.rockMinGap = 40;
		this.rockMaxGap = 600;

		// Model scale sizing in "world-ish" units; will be converted to actual scale via divisor
		this.minRockSize = 200;
		this.maxRockSize = 300;
		this.rockScaleDivisor = 2;

		// Rotation axes toggles (1 = allow, 0 = lock)
		this.rotateRockAxes = { x: 1, y: 1, z: 1 };

		// Keep rocks from clustering too tightly in X
		this.rockXEdgePadding = 8;

		// --- FLOWER SPAWN SETTINGS ---
		// Much lower than rocks: items per 1000 world units of height
		this.flowerFrequency = 0.7;

		this.flowerGapJitter = 0.6;

		this.flowerMinGap = 250;
		this.flowerMaxGap = 2200;

		// If you need a different scale feel for flowers
		this.flowerMinSize = 120;
		this.flowerMaxSize = 180;
		this.flowerScaleDivisor = 1;

		this.flowerInitialRotation = { x: Math.PI / 2, y: 0, z: 0 };
		this.rotateFlowerAxes = { x: 0, y: 1, z: 0 };

		this.flowerXEdgePadding = 6;

		// Deterministic seed base
		this.seed = String(seed);

		// Lazy update bookkeeping
		this._lastHeight = null;
		this._lastPlanKey = null;

		// Spawned items lookup for fast add/remove
		// id -> { obj: THREE.Object3D, type: "rock"|"flower", side: "L"|"R" }
		this._spawned = new Map();

		// Track which parent each side attaches to
		this._sideParent = {
			L: this.empties.tl,
			R: this.empties.tr
		};

		// Build initial plan + layout
		this.update(true);
	}



	/**
	 * Cleans up clones created by this class (does not dispose shared materials/geometries).
	 * Safe to call multiple times.
	 *
	 * @returns {void}
	 */
	destroy() {

		for (const entry of this._spawned.values()) {
			if (entry && entry.obj) {
				if (entry.obj.parent) entry.obj.parent.remove(entry.obj);
			}
		}

		this._spawned.clear();

		// Drop refs (external models remain untouched)
		this.empties = null;
		this.rockModel = null;
		this.flowerModel = null;
		this._sideParent = null;
	}



	/**
	 * Updates the system. If the column height changed, a new plan is generated and applied.
	 *
	 * @param {boolean} [force=false] - Forces a rebuild even if height hasn't changed.
	 * @returns {boolean} True if a layout update happened, false otherwise.
	 */
	update(force = false) {

		if (!this.empties || !this.empties.tl || !this.empties.bl || !this.empties.tr || !this.empties.br)
			return false;

		const height = this._measureColumnHeight();

		if (!force && this._lastHeight !== null) {
			// Small tolerance so tiny float jitter doesn't thrash the layout
			const eps = 0.0001;
			if (Math.abs(height - this._lastHeight) < eps)
				return false;
		}

		const plan = this.generateLayoutPlan(height);
		if (!plan)
			return false;

		this.manageLayout(plan);

		this._lastHeight = height;
		return true;
	}



	/**
	 * Measures the height of the pond column region using TL/BL world positions.
	 *
	 * @returns {number} Height in world units.
	 */
	_measureColumnHeight() {

		const tlW = new THREE.Vector3();
		const blW = new THREE.Vector3();

		this.empties.tl.getWorldPosition(tlW);
		this.empties.bl.getWorldPosition(blW);

		const dy = blW.y - tlW.y;
		const height = Math.abs(dy);

		// If dy is ~0 (some setups), use full distance as fallback
		if (height < 0.0001)
			return tlW.distanceTo(blW);

		return height;
	}



	/**
	 * Generates a deterministic layout plan for the given height.
	 *
	 * Key stability rule:
	 * - Items up to any specific height (e.g. 1000) must be identical even if the current height grows (e.g. 1500).
	 * - Height must NOT be part of the RNG seed stream.
	 *
	 * @param {number} height - Current measured height in world units.
	 * @returns {{height:number,leftColumnItems:Object[],rightColumnItems:Object[]} | null}
	 * Returns null if the plan would be identical to the last plan (cheap early-exit).
	 */
	generateLayoutPlan(height) {

		// Quantize height slightly so tiny jitter doesn't cause churn.
		const quant = 1.0;
		const heightQ = Math.max(0, Math.round(height / quant) * quant);

		// Plan key IS allowed to depend on height (for early exit),
		// but RNG seeds MUST NOT.
		const planKey = `${this.seed}|h:${heightQ}`;

		if (this._lastPlanKey === planKey)
			return null;

		this._lastPlanKey = planKey;

		const plan = {
			height: heightQ,
			leftColumnItems: [],
			rightColumnItems: []
		};

		this._fillColumnPlan(plan.leftColumnItems, "L", heightQ);
		this._fillColumnPlan(plan.rightColumnItems, "R", heightQ);

		return plan;
	}



	/**
	 * Fills a plan array with deterministic items for a single column side.
	 *
	 * @param {Object[]} outItems - Array to push planned items into.
	 * @param {"L"|"R"} side - Left ("L") or Right ("R") column.
	 * @param {number} height - Column height.
	 * @returns {void}
	 */
	_fillColumnPlan(outItems, side, height) {

		const parentEmpty = (side === "L") ? this.empties.tl : this.empties.tr;

		// Determine signed "down" direction based on world-y comparison
		const topW = new THREE.Vector3();
		const botW = new THREE.Vector3();

		parentEmpty.getWorldPosition(topW);
		(side === "L" ? this.empties.bl : this.empties.br).getWorldPosition(botW);

		const downSign = (botW.y - topW.y) >= 0 ? 1 : -1;

		// Side-based manual offsets (push outward)
		const rockOffset = (side === "L") ? -this.rock_offset_x : this.rock_offset_x;
		const flowerOffset = (side === "L") ? -this.flower_offset_x : this.flower_offset_x;

		// --- ROCKS (outer half) ---
		{
			// IMPORTANT: height is NOT part of the RNG seed.
			const rng = this._makeRng(`${this.seed}|${side}|rocks`);

			const freq = Math.max(0, this.rockFrequency);
			const meanGap = (freq > 0) ? (1000 / freq) : Number.POSITIVE_INFINITY;

			const jitter = THREE.MathUtils.clamp(this.rockGapJitter, 0, 0.95);
			let minGap = meanGap * (1 - jitter);
			let maxGap = meanGap * (1 + jitter);

			// Safety clamps
			minGap = THREE.MathUtils.clamp(minGap, this.rockMinGap, this.rockMaxGap);
			maxGap = THREE.MathUtils.clamp(maxGap, this.rockMinGap, this.rockMaxGap);

			let y = 0;
			let i = 0;

			while (Math.abs(y) <= height) {

				// Step first (so we don't always spawn at y=0)
				const gap = this._randRange(rng, minGap, maxGap);
				y += downSign * gap;

				if (Math.abs(y) > height)
					break;

				const xRange = this._getXRanges(side, "rock");

				// Uniform X in the allowed region, then apply outward offset
				let x = this._randRange(rng, xRange.min + this.rockXEdgePadding, xRange.max - this.rockXEdgePadding);
				x += rockOffset;

				const size = this._randRange(rng, this.minRockSize, this.maxRockSize);
				const scl = size / Math.max(1e-6, this.rockScaleDivisor);

				// Independent rotation per axis
				const rx = this._randRange(rng, 0, Math.PI * 2) * (this.rotateRockAxes.x ? 1 : 0);
				const ry = this._randRange(rng, 0, Math.PI * 2) * (this.rotateRockAxes.y ? 1 : 0);
				const rz = this._randRange(rng, 0, Math.PI * 2) * (this.rotateRockAxes.z ? 1 : 0);

				const id = `rock_${side}_${this._pad4(i)}`;

				outItems.push({
					id,
					type: "rock",
					side,
					position: { x, y, z: this.zOffset },
					rotation: { x: rx, y: ry, z: rz },
					scale: { x: scl, y: scl, z: scl }
				});

				i++;
			}
		}

		// --- FLOWERS (inner half, rarer) ---
		{
			// IMPORTANT: height is NOT part of the RNG seed.
			const rng = this._makeRng(`${this.seed}|${side}|flowers`);

			const freq = Math.max(0, this.flowerFrequency);
			const meanGap = (freq > 0) ? (1000 / freq) : Number.POSITIVE_INFINITY;

			const jitter = THREE.MathUtils.clamp(this.flowerGapJitter, 0, 0.95);
			let minGap = meanGap * (1 - jitter);
			let maxGap = meanGap * (1 + jitter);

			minGap = THREE.MathUtils.clamp(minGap, this.flowerMinGap, this.flowerMaxGap);
			maxGap = THREE.MathUtils.clamp(maxGap, this.flowerMinGap, this.flowerMaxGap);

			let y = 0;
			let i = 0;

			while (Math.abs(y) <= height) {

				const gap = this._randRange(rng, minGap, maxGap);
				y += downSign * gap;

				if (Math.abs(y) > height)
					break;

				const xRange = this._getXRanges(side, "flower");

				// Bias flowers toward the "inside" edge of their region (toward xRange.max).
				// This helps them avoid overlapping with rocks near the boundary.
				const t = this._biasToMax(rng());
				let x = THREE.MathUtils.lerp(
					xRange.min + this.flowerXEdgePadding,
					xRange.max - this.flowerXEdgePadding,
					t
				);

				x += flowerOffset;

				const size = this._randRange(rng, this.flowerMinSize, this.flowerMaxSize);
				const scl = size / Math.max(1e-6, this.flowerScaleDivisor);

				// Flowers: one rotation scalar applied to chosen axis + initial rotation
				const r = this._randRange(rng, 0, Math.PI * 2);

				const rot = {
					x: this.flowerInitialRotation.x + (this.rotateFlowerAxes.x ? r : 0),
					y: this.flowerInitialRotation.y + (this.rotateFlowerAxes.y ? r : 0),
					z: this.flowerInitialRotation.z + (this.rotateFlowerAxes.z ? r : 0)
				};

				const id = `flower_${side}_${this._pad4(i)}`;

				outItems.push({
					id,
					type: "flower",
					side,
					position: { x, y, z: this.zOffset },
					rotation: rot,
					scale: { x: scl, y: scl, z: scl }
				});

				i++;
			}
		}
	}



	/**
	 * Gets X ranges for spawn regions (local space of TL/TR empties).
	 *
	 * @param {"L"|"R"} side - Column side.
	 * @param {"rock"|"flower"} type - Item type.
	 * @returns {{min:number,max:number}} X range.
	 */
	_getXRanges(side, type) {

		const w = this.columnsWidth;

		if (side === "L") {
			if (type === "rock") return { min: 0, max: w / 2 };
			return { min: w / 2, max: w };
		}

		if (type === "rock") return { min: -w / 2, max: 0 };
		return { min: -w, max: -w / 2 };
	}



	/**
	 * Applies a plan by lazily adding/removing only the necessary ThreeJS objects.
	 *
	 * @param {{leftColumnItems:Object[],rightColumnItems:Object[]}} plan - Layout plan from generateLayoutPlan().
	 * @returns {void}
	 */
	manageLayout(plan) {

		const desired = new Set();

		const applyItems = (items) => {
			for (const item of items) {
				desired.add(item.id);

				const existing = this._spawned.get(item.id);

				if (!existing) {
					const obj = this._spawnFromPlanItem(item);
					this._spawned.set(item.id, { obj, type: item.type, side: item.side });
				} else {
					this._applyTransform(existing.obj, item);
				}
			}
		};

		applyItems(plan.leftColumnItems);
		applyItems(plan.rightColumnItems);

		for (const [id, entry] of this._spawned.entries()) {
			if (!desired.has(id)) {
				if (entry && entry.obj && entry.obj.parent)
					entry.obj.parent.remove(entry.obj);

				this._spawned.delete(id);
			}
		}
	}



	/**
	 * Clones a model and parents it into the correct column empty.
	 *
	 * @param {Object} item - Plan item describing what to spawn.
	 * @returns {THREE.Object3D} The spawned object.
	 */
	_spawnFromPlanItem(item) {

		const model = (item.type === "rock") ? this.rockModel : this.flowerModel;
		const obj = this._cloneModel(model);

		this._applyTransform(obj, item);

		const parentEmpty = this._sideParent[item.side];
		parentEmpty.add(obj);

		return obj;
	}



	/**
	 * Applies transform values from a plan item to an object.
	 *
	 * @param {THREE.Object3D} obj - The object to transform.
	 * @param {Object} item - The plan item with position/rotation/scale.
	 * @returns {void}
	 */
	_applyTransform(obj, item) {

		obj.position.set(item.position.x, item.position.y, item.position.z);
		obj.rotation.set(item.rotation.x, item.rotation.y, item.rotation.z);
		obj.scale.set(item.scale.x, item.scale.y, item.scale.z);

		obj.updateMatrix();
		obj.updateMatrixWorld(true);
	}



	/**
	 * Deep clones a model hierarchy. Geometry/materials remain shared (intentionally).
	 *
	 * @param {THREE.Object3D} model - Source model root.
	 * @returns {THREE.Object3D} Clone.
	 */
	_cloneModel(model) {

		const clone = model.clone(true);
		clone.matrixAutoUpdate = true;

		// Optional: if the model is skinned, ensure skeleton is correctly bound
		this._fixSkinnedMeshClone(clone);

		return clone;
	}



	/**
	 * Fixes skinned mesh clones (common ThreeJS clone pitfall).
	 *
	 * @param {THREE.Object3D} root - Root of the cloned hierarchy.
	 * @returns {void}
	 */
	_fixSkinnedMeshClone(root) {

		const skinnedMeshes = {};

		root.traverse((node) => {
			if (node.isSkinnedMesh)
				skinnedMeshes[node.name] = node;
		});

		if (Object.keys(skinnedMeshes).length === 0)
			return;

		const bones = {};
		const skeletons = {};

		root.traverse((node) => {
			if (node.isBone)
				bones[node.name] = node;

			if (node.isSkinnedMesh)
				skeletons[node.name] = node.skeleton;
		});

		for (const name in skinnedMeshes) {

			const skinnedMesh = skinnedMeshes[name];
			const skeleton = skeletons[name];

			if (!skeleton)
				continue;

			const orderedBones = skeleton.bones.map((b) => bones[b.name]).filter(Boolean);
			skinnedMesh.bind(new THREE.Skeleton(orderedBones, skeleton.boneInverses), skinnedMesh.bindMatrix);
		}
	}



	/**
	 * Creates a seeded RNG function in [0,1).
	 *
	 * @param {string} seedStr - Seed string.
	 * @returns {() => number} RNG function.
	 */
	_makeRng(seedStr) {

		const seed = this._hashStringToUint32(seedStr);
		return this._mulberry32(seed);
	}



	/**
	 * Hashes a string into a uint32.
	 *
	 * @param {string} str - Input string.
	 * @returns {number} Unsigned 32-bit hash.
	 */
	_hashStringToUint32(str) {

		// FNV-1a 32-bit
		let h = 0x811c9dc5;

		for (let i = 0; i < str.length; i++) {
			h ^= str.charCodeAt(i);
			h = Math.imul(h, 0x01000193);
		}

		return h >>> 0;
	}



	/**
	 * Mulberry32 PRNG.
	 *
	 * @param {number} a - Seed.
	 * @returns {() => number} RNG function.
	 */
	_mulberry32(a) {

		return function () {
			let t = a += 0x6D2B79F5;
			t = Math.imul(t ^ (t >>> 15), t | 1);
			t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}



	/**
	 * Returns a random float in [min, max).
	 *
	 * @param {() => number} rng - RNG function.
	 * @param {number} min - Minimum.
	 * @param {number} max - Maximum.
	 * @returns {number} Random value.
	 */
	_randRange(rng, min, max) {

		return min + (max - min) * rng();
	}



	/**
	 * Biases a [0,1) value toward 1.0 (max).
	 *
	 * @param {number} t - Input in [0,1).
	 * @returns {number} Biased value in [0,1).
	 */
	_biasToMax(t) {

		// 1 - (1-t)^2 : pushes probability mass toward 1
		const u = 1 - t;
		return 1 - (u * u);
	}



	/**
	 * Left-pads an integer to 4 digits.
	 *
	 * @param {number} n - Input integer.
	 * @returns {string} Padded string.
	 */
	_pad4(n) {

		const s = String(n);

		if (s.length >= 4)
			return s;

		return ("0000" + s).slice(-4);
	}
}
