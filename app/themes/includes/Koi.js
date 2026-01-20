/*
	Koi.js
	------

	Defines the Koi class used in the Koi Pond theme.
*/

// Three
import * as THREE from 'three';
import { KoiSystem } from './KoiSystem';

// used for our koi states
const KOI_STATE = {
	IDLE: 'idle',
	SWIMMING: 'swimming',
	SURFACING: 'surfacing',
	DIVING: 'diving'
};

const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

// animation easing (cubic ease-in-out) helper
const easeInOut = (t) => {
	t = clamp(t, 0, 1);
	return t < 0.5
		? 4 * t * t * t
		: 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// 2D demo’s wrap: keep angles in [-PI, +PI]
const angleWrap = (a) => {
	a = (a + Math.PI) % TAU;
	if (a <= 0) a += TAU;
	return a - Math.PI;
};

// 2D demo’s convention: yaw=0 faces "up" (-Y)
const angleTo = (x1, y1, x2, y2) => {
	const dx = x2 - x1;
	const dy = y2 - y1;
	return Math.atan2(dx, -dy);
};

// main money
export class Koi extends THREE.Object3D {

	/**
	 * Constructor
	 *
	 * @param {KoiSystem} koiSystem - instance of our KoiSystem
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} options - options for the koi
	 */
	constructor(koiSystem, manager, options = {}) {

		// Three.Object3D constructor
		super();

		// save our refs
		this.koiSystem = koiSystem;
		this.manager = manager;
		this.options = options;

		// movement tuning (pixels == world units)
		this.maxSpeed = options.maxSpeed ?? rand(70, 115); // px/s
		this.accel = options.accel ?? rand(140, 220); // px/s^2
		this.decel = options.decel ?? rand(170, 260); // px/s^2

		this.turnAccel = options.turnAccel ?? rand(4.5, 7.0); // rad/s^2
		this.turnDamping = options.turnDamping ?? 7.0; // rad/s
		this.maxTurnRate = options.maxTurnRate ?? rand(1.2, 2.2); // rad/s

		this.slowRadius = options.slowRadius ?? 220;
		this.stopRadius = options.stopRadius ?? 12;
		this.minCreepSpeed = options.minCreepSpeed ?? rand(10, 16);

		this.speed = 0;
		this.yaw = 0;
		this.yawVel = 0;

		// where the fish wants to head too
		this.target = new THREE.Vector3(0, 0, -150);

		// surfacing animation logic
		this.surfacePhase = 0; // 0 up+forward, 1 pause, 2 down+forward
		this.surfaceT = 0;
		this.surfaceUpTime = rand(1.4, 2.1);
		this.surfacePauseTime = rand(0.25, 0.55);
		this.surfaceDownTime = rand(1.0, 1.7);
		this.surfacePitchMax = THREE.MathUtils.degToRad(-50);

		// diving uses the same logic as surfacing except pitch
		this.divingPitchMax = THREE.MathUtils.degToRad(40);

		// timers
		this.state = KOI_STATE.IDLE;
		this.stateTimer = 0;
		this.stateDuration = rand(5, 10);

		this.idleTurnTarget = 0;
		this.idleTurnStart = 0;
		this.idleTurnT = 0;
		this.idleTurnDuration = rand(3.5, 7.0);

		// Adjustment for fish facing direction vs movement direction
		this.headingOffset = 0;

		// scratch forward vector (avoid allocs)
		this._fwd = new THREE.Vector2();

		// arrival bookkeeping (when the fish gets really close floating point jitter can prevent it from "arriving")
		this._stuckTimer = 0;
		this._lastDist = Infinity;

		// target debug
		this.axisHelper = new THREE.AxesHelper(100);
		this.koiTarget = new THREE.Group();
		// this.koiTarget.add(this.axisHelper);
		this.koiSystem.backgroundCenter.add(this.koiTarget);

		// animation speeds (hook up to your mixer/actions if you add them)
		this.swimAnimationSpeed = 1;
		this.idleAnimationSpeed = 0.5;
		this.surfaceAnimationSpeed = 0.75;

		// animation state
		this.mixer = null;
		this.swimAction = null;
		this._lastAnimState = null;

		// load our koi model
		this._loadModel(manager);

		// start with a gentle random heading in [-PI, PI]
		this.yaw = angleWrap(rand(-Math.PI, Math.PI));

		this.rotation.z = this.yaw;
		this.rotation.x = 0;

		// yaw then pitch (pitch local to yaw)
		this.rotation.order = 'ZXY';
	}


	/**
	 * Clean up the Koi by removing it from the scene and disposing of any resources.
	 */
	destroy() {

		// remove koi / target from scene
		this.koiSystem.backgroundCenter.remove(this.koiTarget);

		// dispose of axis helper and koi target
		this.axisHelper.geometry.dispose();
		this.axisHelper.material.dispose();
		// this.koiTarget.remove(this.axisHelper);
		this.axisHelper = null;
		this.koiTarget = null;

		// dispose of koi fish and animations
		if (this.mixer) {
			this.mixer.stopAllAction();
			this.mixer = null;
			this.swimAction = null;
		}
	}


	/**
	 * Loads our Koi model and sets up animations.
	 *
	 * @param {ThreeManager} manager - the ThreeManager instance
	 */
	async _loadModel(manager){

		// use our ThreeManagers asset system to load the model
		const [gltfScene] = await manager.assetsReady(['/models/koi_fish.glb']);

		// GTFO if we failed
		if (!gltfScene) {
			console.error("Koi: Failed to load model.");
			return;
		}

		// we'll break the mesh out of the gltfScene for our own use
		this.koiFish = gltfScene.children[0];
		this.add(this.koiFish);

		// scale it up to a reasonable size
		const scale = 50;
		this.koiFish.scale.set(scale, scale, scale);

		// keep your existing “face up” orientation
		this.koiFish.rotation.x = 0;
		this.koiFish.rotation.z = -Math.PI / 2;

		// ----- animations -----
		const clips = gltfScene.animations || [];
		if (!clips.length) {
			console.warn("Koi: No animations found on gltfScene.animations (check ThreeManager fix).");
			return;
		}

		// mixer on the fish root (the animated hierarchy is under this.koiFish)
		this.mixer = new THREE.AnimationMixer(this.koiFish);

		// pick a clip:
		// if your GLB only has one, this is perfect. If it has multiple, we’ll still start with the first.
		const clip = clips[0];

		// set up the swim action
		this.swimAction = this.mixer.clipAction(clip);
		this.swimAction.setLoop(THREE.LoopRepeat, Infinity);
		this.swimAction.play();

		// start at correct speed for whatever state we’re currently in
		this._applyAnimationSpeed();
	}


	/**
	 * Our fish uses a state machine, so here we pick another random state to enter.
	 */
	_pickNextState() {

		const r = Math.random();
		if (r < 0.40)
			this._enterSwimming();
		else if (r < 0.75)
			this._enterIdle();
		else if (r < 0.875)
			this._enterDiving();
		else
			this._enterSurfacing();
	}


	/**
	 * Enter the idle state
	 */
	_enterIdle() {

		// set up idle state
		this.state = KOI_STATE.IDLE;
		this.stateTimer = 0;
		this.stateDuration = rand(5, 10);

		this.idleTurnStart = this.yaw;
		this.idleTurnTarget = angleWrap(this.yaw + THREE.MathUtils.degToRad(rand(-30, 30)));
		this.idleTurnT = 0;
		this.idleTurnDuration = rand(3.5, 7.0);
	}


	/**
	 * Enter the swimming state
	 */
	_enterSwimming() {

		// set up swimming state
		this.state = KOI_STATE.SWIMMING;
		this.stateTimer = 0;

		const p = this.koiSystem.getRandomViewportPointInBackground(110);
		this.target.copy(p);
		this.koiTarget.position.copy(this.target);

		this._stuckTimer = 0;
		this._lastDist = Infinity;
	}


	/**
	 * Enter the surfacing state
	 */
	_enterSurfacing() {

		// set up surfacing state
		this.state = KOI_STATE.SURFACING;
		this.stateTimer = 0;

		this.surfacePhase = 0;
		this.surfaceT = 0;
		this.surfaceUpTime = rand(1.4, 2.1);
		this.surfacePauseTime = rand(0.25, 0.55);
		this.surfaceDownTime = rand(1.0, 1.7);

		const bounds = this.koiSystem.getViewportBoundsInBackground(120);

		const f = this._forward2D();
		const dist = rand(240, 420);

		const tx = clamp(this.position.x + f.x * dist, bounds.minX, bounds.maxX);
		const ty = clamp(this.position.y + f.y * dist, bounds.minY, bounds.maxY);

		this.target.set(tx, ty, this.position.z);
		this.koiTarget.position.copy(this.target);

		this._stuckTimer = 0;
		this._lastDist = Infinity;
	}


	/**
	 * Enter the diving state
	 */
	_enterDiving() {

		// set up diving state
		this.state = KOI_STATE.DIVING;
		this.stateTimer = 0;

		this.surfacePhase = 0;
		this.surfaceT = 0;
		this.surfaceUpTime = rand(1.4, 2.1);
		this.surfacePauseTime = rand(0.25, 0.55);
		this.surfaceDownTime = rand(1.0, 1.7);

		const bounds = this.koiSystem.getViewportBoundsInBackground(120);

		const f = this._forward2D();
		const dist = rand(240, 420);

		const tx = clamp(this.position.x + f.x * dist, bounds.minX, bounds.maxX);
		const ty = clamp(this.position.y + f.y * dist, bounds.minY, bounds.maxY);

		this.target.set(tx, ty, this.position.z);
		this.koiTarget.position.copy(this.target);

		this._stuckTimer = 0;
		this._lastDist = Infinity;
	}


	/**
	 * Gets the forward vector in 2D space based on current yaw.
	 *
	 * @returns {THREE.Vector2} - forward vector in 2D space
	 */
	_forward2D() {

		// yaw=0 faces "up" (-Y)
		const a = this.yaw + this.headingOffset;
		this._fwd.set(Math.sin(a), -Math.cos(a));
		return this._fwd;
	}


	/**
	 * Updates the steering to head toward the target.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	_updateSteering(dt) {

		// desired heading uses atan2(dx, -dy)
		const desiredYaw = angleTo(
			this.position.x,
			this.position.y,
			this.target.x,
			this.target.y
		) - this.headingOffset;

		const delta = angleWrap(desiredYaw - this.yaw);

		// Convert heading error into a desired turn rate (same shape as 2D)
		const gain = 2.2;
		const desiredRate = clamp(delta * gain, -this.maxTurnRate, this.maxTurnRate);

		// Accelerate angular velocity toward desiredRate (inertia)
		const maxDV = this.turnAccel * dt;
		const dv = clamp(desiredRate - this.yawVel, -maxDV, maxDV);
		this.yawVel += dv;

		// Apply angular velocity
		this.yaw = angleWrap(this.yaw + this.yawVel * dt);

		this.rotation.z = this.yaw;
	}


	/**
	 * Updates the speed to approach the desired speed.
	 *
	 * @param {Number} dt - delta time in seconds
	 * @param {Number} desiredSpeed - desired speed to approach
	 */
	_updateSpeed(dt, desiredSpeed) {
		if (this.speed < desiredSpeed) {
			this.speed = Math.min(desiredSpeed, this.speed + this.accel * dt);
		} else {
			this.speed = Math.max(desiredSpeed, this.speed - this.decel * dt);
		}
	}


	/**
	 * Updates the arrival behavior toward the target.
	 *
	 * @param {Number} dt - delta time in seconds
	 * @param {Number} speedScale - scales the max speed for this arrive call
	 * @returns {Boolean} - true if arrived at target
	 */
	_updateArrive(dt, speedScale = 1) {

		const dx = this.target.x - this.position.x;
		const dy = this.target.y - this.position.y;
		const dist = Math.hypot(dx, dy);

		// steering first (same as 2D)
		this._updateSteering(dt);

		let arrive01 = 1;
		if (dist <= this.slowRadius) {
			arrive01 = clamp((dist - this.stopRadius) / Math.max(1, (this.slowRadius - this.stopRadius)), 0, 1);
			arrive01 = arrive01 * arrive01;
		}

		const desiredSpeedRaw = this.maxSpeed * speedScale * arrive01;

		let desiredSpeed = desiredSpeedRaw;
		if (dist > this.stopRadius && dist < this.slowRadius) {
			desiredSpeed = Math.max(desiredSpeed, this.minCreepSpeed);
		}
		if (dist <= this.stopRadius) {
			desiredSpeed = 0;
		}

		this._updateSpeed(dt, desiredSpeed);

		const f = this._forward2D();
		this.position.x += f.x * this.speed * dt;
		this.position.y += f.y * this.speed * dt;

		// ---- stuck watchdog ----
		// IMPORTANT: only consider “stuck” when we're close enough that we should converge.
		if (dist < this.slowRadius) {
			const improving = (dist < this._lastDist - 0.15);
			this._stuckTimer = improving ? 0 : (this._stuckTimer + dt);

			if (this._stuckTimer > 2.5)
				return true;
		} else {
			this._stuckTimer = 0;
		}
		this._lastDist = dist;

		if (dist <= this.stopRadius + 2) {
			this.position.x = this.target.x;
			this.position.y = this.target.y;
			this.speed = 0;
			return true;
		}

		return false;
	}


	/**
	 * Update the koi when in the idle state.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	_updateIdle(dt) {

		this.stateTimer += dt;

		this.idleTurnT += dt / this.idleTurnDuration;
		const t = easeInOut(this.idleTurnT);

		const desiredYaw = angleWrap(this.idleTurnStart + angleWrap(this.idleTurnTarget - this.idleTurnStart) * t);
		const delta = angleWrap(desiredYaw - this.yaw);

		const desiredRate = clamp(delta * 0.8, -0.25, 0.25);
		const maxDV = (this.turnAccel * 0.6) * dt;
		const dv = clamp(desiredRate - this.yawVel, -maxDV, maxDV);
		this.yawVel += dv;

		this.yaw = angleWrap(this.yaw + this.yawVel * dt);
		this.rotation.z = this.yaw;

		this._updateSpeed(dt, 0);
		this.rotation.x = lerp(this.rotation.x, 0, 1 - Math.pow(0.001, dt));

		if (this.stateTimer >= this.stateDuration) {
			this._pickNextState();
		}
	}


	/**
	 * Update the koi when in the swimming state.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	_updateSwimming(dt) {

		const arrived = this._updateArrive(dt, 1.0);

		this.rotation.x = lerp(this.rotation.x, 0, 1 - Math.pow(0.001, dt));

		if (arrived) {
			this._pickNextState();
		}
	}


	/**
	 * Update the koi when in the surfacing state.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	_updateSurfacing(dt) {

		if (this.surfacePhase === 0) {

			this.surfaceT += dt / this.surfaceUpTime;
			const t = easeInOut(this.surfaceT);

			const arrived = this._updateArrive(dt, 1.0);

			this.rotation.x = lerp(0, this.surfacePitchMax, t);

			if (arrived || this.surfaceT >= 1) {
				this.surfacePhase = 1;
				this.surfaceT = 0;
			}

		} else if (this.surfacePhase === 1) {

			this.surfaceT += dt / this.surfacePauseTime;
			this._updateSpeed(dt, 0);
			this.rotation.x = lerp(this.rotation.x, this.surfacePitchMax, 1 - Math.pow(0.001, dt));

			if (this.surfaceT >= 1) {

				const bounds = this.koiSystem.getViewportBoundsInBackground(120);

				const f = this._forward2D();
				const dist = rand(220, 380);

				const tx = clamp(this.position.x + f.x * dist, bounds.minX, bounds.maxX);
				const ty = clamp(this.position.y + f.y * dist, bounds.minY, bounds.maxY);

				this.target.set(tx, ty, this.position.z);
				this.koiTarget.position.copy(this.target);

				this.surfacePhase = 2;
				this.surfaceT = 0;

				this._stuckTimer = 0;
				this._lastDist = Infinity;
			}

		} else {

			this.surfaceT += dt / this.surfaceDownTime;
			const t = easeInOut(this.surfaceT);

			const arrived = this._updateArrive(dt, 1.0);

			this.rotation.x = lerp(this.surfacePitchMax, 0, t);

			if (arrived || this.surfaceT >= 1) {
				this.rotation.x = 0;
				this._pickNextState();
			}
		}
	}


	/**
	 * Update the koi when in the diving state.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	_updateDiving(dt) {

		if (this.surfacePhase === 0) {

			this.surfaceT += dt / this.surfaceUpTime;
			const t = easeInOut(this.surfaceT);

			const arrived = this._updateArrive(dt, 1.0);

			this.rotation.x = lerp(0, this.divingPitchMax, t);

			if (arrived || this.surfaceT >= 1) {
				this.surfacePhase = 1;
				this.surfaceT = 0;
			}

		} else if (this.surfacePhase === 1) {

			this.surfaceT += dt / this.surfacePauseTime;
			this._updateSpeed(dt, 0);
			this.rotation.x = lerp(this.rotation.x, this.divingPitchMax, 1 - Math.pow(0.001, dt));

			if (this.surfaceT >= 1) {

				const bounds = this.koiSystem.getViewportBoundsInBackground(120);

				const f = this._forward2D();
				const dist = rand(220, 380);

				const tx = clamp(this.position.x + f.x * dist, bounds.minX, bounds.maxX);
				const ty = clamp(this.position.y + f.y * dist, bounds.minY, bounds.maxY);

				this.target.set(tx, ty, this.position.z);
				this.koiTarget.position.copy(this.target);

				this.surfacePhase = 2;
				this.surfaceT = 0;

				this._stuckTimer = 0;
				this._lastDist = Infinity;
			}

		} else {

			this.surfaceT += dt / this.surfaceDownTime;
			const t = easeInOut(this.surfaceT);

			const arrived = this._updateArrive(dt, 1.0);

			this.rotation.x = lerp(this.divingPitchMax, 0, t);

			if (arrived || this.surfaceT >= 1) {
				this.rotation.x = 0;
				this._pickNextState();
			}
		}
	}


	/**
	 * Applies the correct animation speed based on the current state.
	 */
	_applyAnimationSpeed(){

		if (!this.swimAction)
			return;

		if (this.state === KOI_STATE.SWIMMING)
			this.swimAction.timeScale = this.swimAnimationSpeed;

		else if (this.state === KOI_STATE.IDLE)
			this.swimAction.timeScale = this.idleAnimationSpeed;

		else if (this.state === KOI_STATE.SURFACING)
			this.swimAction.timeScale = this.surfaceAnimationSpeed;

		else if (this.state === KOI_STATE.DIVING)
			this.swimAction.timeScale = this.surfaceAnimationSpeed;

	}


	/**
	 * Update the koi, based on its current state.
	 *
	 * @param {Number} dt - delta time in seconds
	 */
	update(dt) {

		if (this.state === KOI_STATE.IDLE)
			this._updateIdle(dt);
		else if (this.state === KOI_STATE.SWIMMING)
			this._updateSwimming(dt);
		else if (this.state === KOI_STATE.SURFACING)
			this._updateSurfacing(dt);
		else if (this.state === KOI_STATE.DIVING)
			this._updateDiving(dt);

		// animation tick
		if (this.mixer) {

			// only adjust timeScale when state changes (cheap + avoids jitter)
			if (this._lastAnimState !== this.state) {
				this._lastAnimState = this.state;
				this._applyAnimationSpeed();
			}

			this.mixer.update(dt);
		}
	}
}
