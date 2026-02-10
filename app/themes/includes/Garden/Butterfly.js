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
	 * @param {Object} manager - The ThreeManager instance.
	 * @param {Object} model - The GLTF model of the butterfly.
	 * @param {THREE.Plane} groundPlane - The ground plane for positioning.
	 * @param {THREE.Camera} camera - The camera for view calculations.
	 * @param {Array} prisms - The prisms in the scene.
	 * @param {Object} settings - The settings for the butterfly.
	 * @param {string} side - The side of the garden the butterfly is on.
	 */
    constructor(manager, model, groundPlane, camera, prisms, settings, side) {

		// call parent constructor
        super();

		// save references & settings
        this.manager = manager;
        this.camera = camera;
        this.prisms = prisms;
        this.settings = settings || {};
        this.side = side;
        this.groundPlane = groundPlane;

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
        const speedVar = 0.7 + Math.random() * 0.6;
        this.state = {
            pos: new THREE.Vector3(),
            angle: Math.random() * Math.PI * 2,
            speed: (this.settings.speed || 1) * 5 * speedVar,
            targetSpeed: (this.settings.speed || 1) * 5 * speedVar,
            target: new THREE.Vector3(),
            curve: null,
            curveT: 0,
            lastPickAt: 0,
            lastUpdate: performance.now(),
            syncOffset: Math.random() * 100
        };

		// apply user scale
        const userScale = this.settings.scale || 1;
        this.scale.set(userScale, userScale, userScale);

        this.initPosition();
    }


	/**
    * Initializes the butterfly's position.
    */
    initPosition() {

        const bounds = this.getLaneBounds();
        const x = (bounds.minX + bounds.maxX) / 2;
        const y = (bounds.minY + bounds.maxY) / 2;
        const z = this.settings.yOffset || 3;
        
        this.position.set(x, y, z);
        this.pickTarget();
    }


	/**
     * Returns the lane bounds in local coordinates (relative to plane center).
	 *
	 * Lands are to the left or right of the prisms.
    */
    getLaneBounds() {

        // Fallback defaults
        let minX = -1000, maxX = 1000, minY = -1000, maxY = 1000;
        
        // 1. Get Screen Bounds from main_frame_ref (World Space)
        const frame = this.manager ? this.manager.getRegisteredElementByName('main_frame_ref') : null;
        let screenLeft, screenRight, screenTop, screenBottom;

        if (frame && frame.empties) {
            const tl = new THREE.Vector3();
            const br = new THREE.Vector3();
            frame.empties.tl.getWorldPosition(tl);
            frame.empties.br.getWorldPosition(br);
            
            screenLeft = tl.x;
            screenRight = br.x;
            screenTop = tl.y;
            screenBottom = br.y;
        } else if (this.groundPlane) {
            // Fallback: use ground plane size
            const halfW = this.groundPlane.scale.x / 2;
            const halfH = this.groundPlane.scale.y / 2;
            screenLeft = -halfW;
            screenRight = halfW;
            screenTop = halfH;
            screenBottom = -halfH;
        }

        // 2. Calculate Prism Bounds (World Space)
        let prismMinX = 0, prismMaxX = 0;
        let hasPrisms = false;

        if (this.prisms && this.prisms.length > 0) {
            hasPrisms = true;
            let first = true;
            const pPos = new THREE.Vector3();
            
            this.prisms.forEach(p => {
                p.getWorldPosition(pPos);
                const w = p.scale.x; 
                
                const pLeft = pPos.x - w / 2;
                const pRight = pPos.x + w / 2;
                
                if (first) {
                    prismMinX = pLeft;
                    prismMaxX = pRight;
                    first = false;
                } else {
                    prismMinX = Math.min(prismMinX, pLeft);
                    prismMaxX = Math.max(prismMaxX, pRight);
                }
            });
        }

        // 3. Define Lanes (World Space)
        const laneMargin = 80; 
        let targetMinX, targetMaxX;

        if (this.side === 'left') {
            targetMinX = screenLeft + 50; 
            targetMaxX = hasPrisms ? prismMinX - laneMargin : -100;
            if (targetMaxX < targetMinX) targetMaxX = targetMinX + 150;
        } else {
            targetMinX = hasPrisms ? prismMaxX + laneMargin : 100;
            targetMaxX = screenRight - 50; 
            if (targetMinX > targetMaxX) targetMinX = targetMaxX - 150;
        }

        // 4. Convert to Local Space
        if (this.parent) {
            // We need parent's world matrix updated to get accurate conversion
            this.parent.updateMatrixWorld();
            
            const worldTL = new THREE.Vector3(targetMinX, screenTop, 0);
            const worldBR = new THREE.Vector3(targetMaxX, screenBottom, 0);
            
            this.parent.worldToLocal(worldTL);
            this.parent.worldToLocal(worldBR);
            
            minX = Math.min(worldTL.x, worldBR.x);
            maxX = Math.max(worldTL.x, worldBR.x);
            minY = Math.min(worldTL.y, worldBR.y);
            maxY = Math.max(worldTL.y, worldBR.y);
        } else {
            minX = targetMinX;
            maxX = targetMaxX;
            minY = screenBottom;
            maxY = screenTop;
        }

        return { minX, maxX, minY, maxY };
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

        // Varied control point distances
        const c1Len = THREE.MathUtils.clamp(dist * (0.2 + Math.random() * 0.3), 100, 600);
        const c2Len = THREE.MathUtils.clamp(dist * (0.1 + Math.random() * 0.3), 50, 500);

        const p1 = p0.clone().add(heading.multiplyScalar(c1Len));
        const p3 = this.state.target.clone();

        const toDir = toT.clone().normalize();
        const sideVec = new THREE.Vector3(-toDir.y, toDir.x, 0);
        const sweepSign = (Math.random() < 0.5) ? -1 : 1;
        const sweepAmt = THREE.MathUtils.clamp(dist * (0.1 + Math.random() * 0.2), 50, 300) * sweepSign;
        const mix = THREE.MathUtils.clamp(0.2 + 0.6 * Math.random(), 0.2, 0.8);
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
        const flapIntensity = (Math.sin((time + this.state.syncOffset) * flapSpeed) + 1) / 2; // 0 to 1

        this.wingMeshes.forEach(info => {
            info.targets.forEach(t => {
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

        // FIX: Adjusted offset to fix backward flight
        this.rotation.z = this.state.angle + Math.PI / 2;
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