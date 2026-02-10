/*
	Butterfly.js
	------------

	Handles the logic for one of the butterflies in the garden.
*/

// imports
import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

// main export
export class Butterfly extends THREE.Object3D {

	/**
	 * Constructs a new Butterfly instance.
	 *
	 * @param {Object} model - The GLTF model of the butterfly.
	 * @param {THREE.Plane} groundPlane - The ground plane for positioning.
	 * @param {THREE.Camera} camera - The camera for view calculations.
	 * @param {Array} prisms - The prisms in the scene.
	 * @param {Object} settings - The settings for the butterfly.
	 * @param {string} side - The side of the garden the butterfly is on.
	 */
    constructor(model, groundPlane, camera, prisms, settings, side) {

		// call parent constructor
        super();

		// save references & settings
        this.camera = camera;
        this.prisms = prisms;
        this.settings = settings || {};
        this.side = side;

		// get the GLTF scene
        const gltf = model;
        try {
            this.mesh = SkeletonUtils.clone(gltf.scene);
        } catch (e) {
            this.mesh = gltf.scene.clone();
        }

        // Setup Animation
        this.mixer = new THREE.AnimationMixer(this.mesh);

        // Find the wing meshes and their morph target indices
        this.wingMeshes = [];
        this.mesh.traverse(child => {
            if (child.isMesh && child.morphTargetDictionary) {
                const dict = child.morphTargetDictionary;
                const meshInfo = { mesh: child, targets: [] };

                // We want to drive the flapping targets
                // Based on inspection: Wings1_Bot/Top and Wings2_Bot
                if (dict['Wings1_Bot'] !== undefined) meshInfo.targets.push({ index: dict['Wings1_Bot'], type: 'bot' });
                if (dict['Wings1_Top'] !== undefined) meshInfo.targets.push({ index: dict['Wings1_Top'], type: 'top' });
                if (dict['Wings2_Bot'] !== undefined) meshInfo.targets.push({ index: dict['Wings2_Bot'], type: 'bot' });
                if (dict['Wings2_Bot_copy1'] !== undefined) meshInfo.targets.push({ index: dict['Wings2_Bot_copy1'], type: 'bot' });

                if (meshInfo.targets.length > 0) {
                    this.wingMeshes.push(meshInfo);
                }
            }
        });

        // Clean Auto-normalization for the new model
        this.mesh.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(this.mesh);

		// measure the bounding box
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const center = new THREE.Vector3();
        box.getCenter(center);

		// Create a container for the mesh
        this.meshContainer = new THREE.Group();
        this.add(this.meshContainer);
        this.meshContainer.add(this.mesh);

        // FIX: Rotate mesh to face camera (parallel to XY plane)
        this.mesh.rotation.x = Math.PI / 2;

		// scale, and position the mesh
        if (maxDim > 0) {
            const targetSize = 5.0;
            const scaleFactor = targetSize / maxDim;
            this.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);

            // Re-center visually
            this.mesh.position.sub(center.clone().multiplyScalar(scaleFactor));

            // Apply user offsets
            this.mesh.position.x += (this.settings.butterflyXOffset || 0);
            this.mesh.position.y += (this.settings.butterflyYOffset || 0);
            this.mesh.position.z += (this.settings.butterflyZOffset || 0);
        }

		// apply a base rotation
        const baseRot = this.settings.baseRotation || [0, 0, 0];
        this.meshContainer.rotation.set(
            THREE.MathUtils.degToRad(baseRot[0]),
            THREE.MathUtils.degToRad(baseRot[1]),
            THREE.MathUtils.degToRad(baseRot[2])
        );

		// show debug target for debugging the movement
        if (this.settings.showDebugTarget) {
            this.debugSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
        }

		// save butter fly state
        this.state = {
            pos: new THREE.Vector3(),
            worldPos: new THREE.Vector3(),
            angle: Math.random() * Math.PI * 2,
            speed: (this.settings.speed || 1) * 5,
            targetSpeed: (this.settings.speed || 1) * 5,
            target: new THREE.Vector3(),
            curve: null,
            curveT: 0,
            lastPickAt: 0,
            lastUpdate: performance.now()
        };

		// apply user scale
        const userScale = this.settings.scale || 1;
        this.scale.set(userScale, userScale, userScale);

        this.initPosition();
    }


	/**
    * Initializes the butterfly's position.
    */
	/**
    * Initializes the butterfly's position.
    */
    initPosition() {

        const bounds = this.getLaneBounds();
        const x = (bounds.minX + bounds.maxX) / 2;
        const y = (bounds.minY + bounds.maxY) / 2;
        const z = this.settings.yOffset || 3;
        
        this.state.worldPos.set(x, y, z);
        this.position.set(x, y, z);
        this.pickTarget();
    }


	/**
     * Returns the lane bounds in local coordinates (relative to plane center).
	 *
	 * Lanes are to the left or right of the prisms.
    */
    getLaneBounds() {

        if (!this.groundPlane) return { minX: -10, maxX: 10, minY: -10, maxY: 10 };

        const halfW = this.groundPlane.scale.x / 2;
        const halfH = this.groundPlane.scale.y / 2;

        let minPX = 0, maxPX = 0;
        if (this.prisms && this.prisms.length > 0) {
            this.prisms.forEach(p => {
                const w = p.scale.x;
                // We need the prism position relative to the background plane center
                // Since prisms and bgData.empties.center share a common world root
                // we can approximate this by comparing their world positions
                // or just using the prism's local position if it's already in the same space.
                // For now, let's assume world position comparison for safety.
                const pWorld = new THREE.Vector3();
                p.getWorldPosition(pWorld);
                
                const planeWorld = new THREE.Vector3();
                this.groundPlane.getWorldPosition(planeWorld);
                
                const localX = pWorld.x - planeWorld.x;

                minPX = Math.min(minPX, localX - w/2);
                maxPX = Math.max(maxPX, localX + w/2);
            });
        } else {
            minPX = -2; maxPX = 2;
        }

        const margin = 100; // Increased for pixel-scale units
        const screenMargin = 200;

        if (this.side === 'left') {
            return {
                minX: -halfW + screenMargin,
                maxX: minPX - margin,
                minY: -halfH + screenMargin,
                maxY: halfH - screenMargin
            };
        } else {
            return {
                minX: maxPX + margin,
                maxX: halfW - screenMargin,
                minY: -halfH + screenMargin,
                maxY: halfH - screenMargin
            };
        }
    }


	/**
     * Picks a new target for the butterfly to move towards.
     */
    pickTarget() {

        const bounds = this.getLaneBounds();
        const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        const z = this.settings.yOffset || 3;

        this.state.target.set(x, y, z);

        if (this.debugSphere) {
            this.debugSphere.position.copy(this.state.target);
            if (!this.debugSphere.parent && this.parent && this.parent.parent) {
                this.parent.parent.add(this.debugSphere);
            }
        }

        const p0 = this.position.clone();
        const heading = new THREE.Vector3(Math.cos(this.state.angle), Math.sin(this.state.angle), 0);
        const toT = new THREE.Vector3().subVectors(this.state.target, p0);
        const dist = toT.length();

        const c1Len = THREE.MathUtils.clamp(dist * 0.35, 100, 500);
        const c2Len = THREE.MathUtils.clamp(dist * 0.25, 50, 400);

        const p1 = p0.clone().add(heading.multiplyScalar(c1Len));
        const p3 = this.state.target.clone();

        const toDir = toT.clone().normalize();
        const sideVec = new THREE.Vector3(-toDir.y, toDir.x, 0);
        const sweepSign = (Math.random() < 0.5) ? -1 : 1;
        const sweepAmt = THREE.MathUtils.clamp(dist * 0.16, 50, 250) * sweepSign;
        const mix = THREE.MathUtils.clamp(0.35 + 0.25 * (1 - Math.abs(heading.dot(toDir))), 0.25, 0.75);
        const approach = new THREE.Vector3()
            .addVectors(toDir.clone().multiplyScalar(1 - mix), heading.clone().multiplyScalar(mix))
            .normalize();

        const p2 = p3.clone().sub(approach.multiplyScalar(c2Len)).add(sideVec.multiplyScalar(sweepAmt));

        this.state.curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        this.state.curveT = 0;
        this.state.lastPickAt = performance.now();
    }


	/**
     * Updates the butterfly's position and animation.
	 *
	 * @param {number} time - The current time in seconds.
	 * @param {number} dt - The delta time since the last update in seconds.
     */
    update(time, dt) {
        const now = performance.now();
        let safeDt = dt;
        if (safeDt <= 0) {
            safeDt = (now - this.state.lastUpdate) / 1000;
            if (safeDt <= 0) safeDt = 1/60;
        }
        this.state.lastUpdate = now;
        safeDt = Math.min(safeDt, 0.1);

        if (this.mixer) this.mixer.update(safeDt);

        // Manually drive synced wing flapping
        const flapSpeed = (this.settings.animationSpeed || 1) * 15;
        const flapIntensity = (Math.sin(time * flapSpeed) + 1) / 2; // 0 to 1

        this.wingMeshes.forEach(info => {
            info.targets.forEach(t => {
                // If it's a 'top' target, maybe it's inverse or shifted?
                // Usually for these models, driving them together works best.
                info.mesh.morphTargetInfluences[t.index] = flapIntensity;
            });
        });

        const sincePick = (now - this.state.lastPickAt) / 1000;
        const nearingEnd = this.state.curve ? this.state.curveT > 0.86 : false;

        if (sincePick > (3.0 + Math.random() * 2) || nearingEnd) {
             this.pickTarget();
        }

        if (this.state.curve) {
            const subSteps = 4;
            const ds = (this.state.speed * safeDt) / subSteps;

            for (let i = 0; i < subSteps; i++) {
                const d = this.getBezierDerivative(this.state.curve, this.state.curveT);
                const dLen = d.length();
                let dtParam = ds / Math.max(0.001, dLen);
                dtParam = Math.min(dtParam, 0.05);

                this.state.curveT = Math.min(1, this.state.curveT + dtParam);

                const p = this.state.curve.getPoint(this.state.curveT);
                this.position.copy(p);

                const newTan = this.state.curve.getTangent(this.state.curveT);
                const targetAngle = Math.atan2(newTan.y, newTan.x);

                let angleDiff = targetAngle - this.state.angle;
                while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

                const turnSmooth = 1 - Math.pow(0.001, safeDt);
                this.state.angle += angleDiff * turnSmooth;
            }
        }

        this.rotation.z = this.state.angle - Math.PI / 2;
    }

	/**
     * Returns the derivative of a cubic Bezier curve at a given parameter t.
	 *
     * @param {THREE.CubicBezierCurve3} curve - The cubic Bezier curve.
     * @param {number} t - The parameter along the curve (0 to 1).
     * @returns {THREE.Vector3} The derivative vector at the given parameter.
     */
    getBezierDerivative(curve, t) {

        const u = 1 - t;
        const p0 = curve.v0, p1 = curve.v1, p2 = curve.v2, p3 = curve.v3;
        const a = p1.clone().sub(p0).multiplyScalar(3 * u * u);
        const b = p2.clone().sub(p1).multiplyScalar(6 * u * t);
        const c = p3.clone().sub(p2).multiplyScalar(3 * t * t);
        return a.add(b).add(c);
    }


	/**
     * Cleans up resources used by the butterfly.
     */
    cleanup() {

        if (this.debugSphere && this.debugSphere.parent) {
            this.debugSphere.parent.remove(this.debugSphere);
            this.debugSphere.geometry.dispose();
            this.debugSphere.material.dispose();
        }
    }

}
