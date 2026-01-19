// app/themes/includes/Koi.js

import * as THREE from 'three';

// used for our koi states
const KOI_STATE = {
	IDLE: 'idle',
	SWIMMING: 'swimming',
	SURFACING: 'surfacing'
};

const TAU = Math.PI * 2;

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;

const easeInOut = (t) => {
	t = clamp(t, 0, 1);
	return t < 0.5
		? 4 * t * t * t
		: 1 - Math.pow(-2 * t + 2, 3) / 2;
};

// shortest signed angular difference (a -> b)
const deltaAngle = (a, b) => {
	let d = (b - a) % TAU;
	if (d > Math.PI) d -= TAU;
	if (d < -Math.PI) d += TAU;
	return d;
};

export class Koi extends THREE.Object3D {

	constructor(koiSystem, manager, options = {}) {
		super();

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
		this.yaw = 0;		// we store heading here (applied to rotation.y)
		this.yawVel = 0;

		this.target = new THREE.Vector3(0, 0, -150);

		// surfacing
		this.surfacePhase = 0; // 0 up+forward, 1 pause, 2 down+forward
		this.surfaceT = 0;
		this.surfaceUpTime = rand(1.4, 2.1);
		this.surfacePauseTime = rand(0.25, 0.55);
		this.surfaceDownTime = rand(1.0, 1.7);
		this.surfacePitchMax = THREE.MathUtils.degToRad(50);

		// timers
		this.state = KOI_STATE.IDLE;
		this.stateTimer = 0;
		this.stateDuration = rand(5, 10);

		this.idleTurnTarget = 0;
		this.idleTurnStart = 0;
		this.idleTurnT = 0;
		this.idleTurnDuration = rand(3.5, 7.0);

		// target debug
		this.axisHelper = new THREE.AxesHelper(100);
		this.koiTarget = new THREE.Group();
		this.koiTarget.add(this.axisHelper);
		this.koiSystem.backgroundCenter.add(this.koiTarget);

		// animation speeds (hook up to your mixer/actions if you add them)
		this.swimAnimationSpeed = 1;
		this.idleAnimationSpeed = 0.5;
		this.surfaceAnimationSpeed = 0.75;

		this._loadModel(manager);

		// start with a gentle random heading
		this.yaw = rand(0, TAU);
		this.rotation.y = this.yaw;
		this.rotation.x = 0;
	}

	destroy() {
		this.koiSystem.backgroundCenter.remove(this.koiTarget);

		this.axisHelper.geometry.dispose();
		this.axisHelper.material.dispose();
		this.koiTarget.remove(this.axisHelper);
		this.axisHelper = null;
		this.koiTarget = null;
	}

	async _loadModel(manager){
		const [gltfScene] = await manager.assetsReady(['/models/koi_fish.glb']);

		if (!gltfScene) {
			console.error("Koi: Failed to load model.");
			return;
		}

		this.koiFish = gltfScene.children[0];
		this.add(this.koiFish);

		const scale = 50;
		this.koiFish.scale.set(scale, scale, scale);

		// model is facing 12 o'clock with zRot=0 at parent
		this.koiFish.rotation.x = 0;
		this.koiFish.rotation.z = -Math.PI / 2;
	}

	_pickNextState() {
		const r = Math.random();
		if (r < 0.40) this._enterSwimming();
		else if (r < 0.75) this._enterIdle();
		else this._enterSurfacing();
	}

	_enterIdle() {
		this.state = KOI_STATE.IDLE;
		this.stateTimer = 0;
		this.stateDuration = rand(5, 10);

		this.idleTurnStart = this.yaw;
		this.idleTurnTarget = this.yaw + THREE.MathUtils.degToRad(rand(-30, 30));
		this.idleTurnT = 0;
		this.idleTurnDuration = rand(3.5, 7.0);
	}

	_enterSwimming() {
		this.state = KOI_STATE.SWIMMING;
		this.stateTimer = 0;

		const p = this.koiSystem.getRandomViewportPointInBackground(110);
		this.target.copy(p);
		this.koiTarget.position.copy(this.target);

		// reset “arrive” bookkeeping
		this._stuckTimer = 0;
		this._lastDist = Infinity;
	}

	_enterSurfacing() {
		this.state = KOI_STATE.SURFACING;
		this.stateTimer = 0;

		this.surfacePhase = 0;
		this.surfaceT = 0;
		this.surfaceUpTime = rand(1.4, 2.1);
		this.surfacePauseTime = rand(0.25, 0.55);
		this.surfaceDownTime = rand(1.0, 1.7);

		// pick a point "in front" of fish but clamped into viewport bounds (in background space)
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

	_forward2D() {
		// We treat yaw as “heading” and move in XY plane.
		// Forward is +Y at yaw = 0.
		const s = Math.sin(this.yaw);
		const c = Math.cos(this.yaw);
		return { x: s, y: c };
	}

	_updateSteering(dt, desiredYaw) {
		const d = deltaAngle(this.yaw, desiredYaw);

		// springy-ish turn acceleration + damping
		const accel = clamp(d * this.turnAccel, -this.turnAccel, this.turnAccel);
		this.yawVel += accel * dt;

		// clamp turn rate
		this.yawVel = clamp(this.yawVel, -this.maxTurnRate, this.maxTurnRate);

		// damping
		this.yawVel -= this.yawVel * this.turnDamping * dt;

		this.yaw += this.yawVel * dt;
		this.yaw = (this.yaw % TAU + TAU) % TAU;

		// apply to object (per your note: only x/y rotations)
		this.rotation.y = this.yaw;
	}

	_updateSpeed(dt, desiredSpeed) {
		if (this.speed < desiredSpeed) {
			this.speed = Math.min(desiredSpeed, this.speed + this.accel * dt);
		} else {
			this.speed = Math.max(desiredSpeed, this.speed - this.decel * dt);
		}
	}

	_updateArrive(dt, speedScale = 1) {

		const dx = this.target.x - this.position.x;
		const dy = this.target.y - this.position.y;
		const dist = Math.hypot(dx, dy);

		const desiredYaw = Math.atan2(dx, dy); // forward is +Y
		this._updateSteering(dt, desiredYaw);

		let arrive01 = 1;
		if (dist <= this.slowRadius) {
			arrive01 = clamp((dist - this.stopRadius) / Math.max(1, (this.slowRadius - this.stopRadius)), 0, 1);
			arrive01 = arrive01 * arrive01;
		}

		const desiredSpeedRaw = this.maxSpeed * speedScale * arrive01;

		// keep a creep speed inside slow radius until we truly "arrive"
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

		// stuck watchdog (prevents “almost there forever”)
		const improving = (dist < this._lastDist - 0.15);
		this._stuckTimer = improving ? 0 : (this._stuckTimer + dt);
		this._lastDist = dist;

		if (this._stuckTimer > 1.25)
			return true;

		if (dist <= this.stopRadius + 2) {
			this.position.x = this.target.x;
			this.position.y = this.target.y;
			this.speed = 0;
			return true;
		}

		return false;
	}

	_updateIdle(dt) {

		this.stateTimer += dt;

		// gentle drift turn
		this.idleTurnT += dt / this.idleTurnDuration;
		const t = easeInOut(this.idleTurnT);

		const desiredYaw = this.idleTurnStart + deltaAngle(this.idleTurnStart, this.idleTurnTarget) * t;
		this._updateSteering(dt, desiredYaw);

		// ease speed to 0
		this._updateSpeed(dt, 0);

		// level out pitch slowly in idle
		this.rotation.x = lerp(this.rotation.x, 0, 1 - Math.pow(0.001, dt));

		if (this.stateTimer >= this.stateDuration) {
			this._pickNextState();
		}
	}

	_updateSwimming(dt) {
		const arrived = this._updateArrive(dt, 1.0);

		// pitch back to flat while swimming
		this.rotation.x = lerp(this.rotation.x, 0, 1 - Math.pow(0.001, dt));

		if (arrived) {
			this._pickNextState();
		}
	}

	_updateSurfacing(dt) {

		// We use a 3-phase “cubic” profile:
		// 0: forward + tilt up
		// 1: pause at top
		// 2: forward + tilt down

		if (this.surfacePhase === 0) {

			this.surfaceT += dt / this.surfaceUpTime;
			const t = easeInOut(this.surfaceT);

			// move (but cap speed naturally via arrive)
			const arrived = this._updateArrive(dt, 1.0);

			// tilt up smoothly
			this.rotation.x = lerp(0, this.surfacePitchMax, t);

			// when we reach target (or finish time), pause
			if (arrived || this.surfaceT >= 1) {
				this.surfacePhase = 1;
				this.surfaceT = 0;
			}

		} else if (this.surfacePhase === 1) {

			// pause briefly at top, hold pitch, ease speed to 0
			this.surfaceT += dt / this.surfacePauseTime;
			this._updateSpeed(dt, 0);
			this.rotation.x = lerp(this.rotation.x, this.surfacePitchMax, 1 - Math.pow(0.001, dt));

			if (this.surfaceT >= 1) {
				// set a new target forward (still clamped in viewport) for the "dive" run
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

			// tilt down smoothly
			this.rotation.x = lerp(this.surfacePitchMax, 0, t);

			if (arrived || this.surfaceT >= 1) {
				this.rotation.x = 0;
				this._pickNextState();
			}
		}
	}

	update(dt) {

		// if model not loaded yet, still run logic (movement object exists)
		this.stateTimer += 0; // (kept for clarity)

		if (this.state === KOI_STATE.IDLE) {
			this._updateIdle(dt);

		} else if (this.state === KOI_STATE.SWIMMING) {
			this._updateSwimming(dt);

		} else if (this.state === KOI_STATE.SURFACING) {
			this._updateSurfacing(dt);
		}
	}
}
