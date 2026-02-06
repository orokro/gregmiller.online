import * as THREE from 'three';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class Butterfly extends THREE.Object3D {
    constructor(model, groundPlane, camera, prisms, settings, side) {
        super();
        this.camera = camera;
        this.prisms = prisms;
        this.settings = settings || {};
        this.side = side; 

        const gltf = model;
        try {
            this.mesh = SkeletonUtils.clone(gltf.scene); 
        } catch (e) {
            this.mesh = gltf.scene.clone();
        }
        
        this.mixer = new THREE.AnimationMixer(this.mesh);
        if (gltf.animations && gltf.animations.length > 0) {
            const action = this.mixer.clipAction(gltf.animations[0]);
            action.play();
            action.timeScale = this.settings.animationSpeed || 1;
        }

        // Auto-normalize scale based on VALID MESHES ONLY
        const box = new THREE.Box3();
        let foundValidMesh = false;
        
        // Force update of internal matrices before measurement
        this.mesh.updateMatrixWorld(true);

        this.mesh.traverse((child) => {
            if (child.isMesh) {
                if (child.geometry) {
                    child.geometry.computeBoundingBox();
                    const geomBox = child.geometry.boundingBox.clone();
                    
                    const rootInv = this.mesh.matrixWorld.clone().invert();
                    const localMatrix = child.matrixWorld.clone().premultiply(rootInv);
                    geomBox.applyMatrix4(localMatrix);

                    const width = geomBox.max.x - geomBox.min.x;
                    const height = geomBox.max.y - geomBox.min.y;
                    const depth = geomBox.max.z - geomBox.min.z;
                    const maxSide = Math.max(width, height, depth);
                    
                    const center = new THREE.Vector3();
                    geomBox.getCenter(center);
                    const distFromOrigin = center.length();

                    // Heuristics:
                    // 1. Not massive (> 500 units)
                    // 2. Not far from origin (> 500 units) - catches the exploded parts at -1720
                    if (maxSide < 500 && maxSide > 0.001 && distFromOrigin < 500) {
                        box.union(geomBox);
                        foundValidMesh = true;
                        child.visible = true;
                    } else {
                        child.visible = false;
                    }
                }
                child.frustumCulled = false;
                
                if (child.material) {
                    child.material.side = THREE.DoubleSide;
                }
            }
        });

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        const center = new THREE.Vector3();
        box.getCenter(center);
        
        this.meshContainer = new THREE.Group();
        this.add(this.meshContainer);
        this.meshContainer.add(this.mesh);

        if (maxDim > 0) {
            // Scale to be size 1
            const scaleFactor = 1.0 / maxDim;
            this.mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
            this.mesh.position.sub(center.clone().multiplyScalar(scaleFactor));
        }

        const baseRot = this.settings.baseRotation || [0, 0, 0];
        this.meshContainer.rotation.set(
            THREE.MathUtils.degToRad(baseRot[0]),
            THREE.MathUtils.degToRad(baseRot[1]),
            THREE.MathUtils.degToRad(baseRot[2])
        );

        if (this.settings.showDebugTarget) {
            this.debugSphere = new THREE.Mesh(
                new THREE.SphereGeometry(0.5, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true })
            );
            const selfDebug = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: 0xffff00, wireframe: true })
            );
            this.meshContainer.add(selfDebug);
        }

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

        const userScale = this.settings.scale || 1;
        this.scale.set(userScale, userScale, userScale);

        this.initPosition();
    }

    initPosition() {
        const bounds = this.getLaneBoundsWorld();
        const x = (bounds.minX + bounds.maxX) / 2;
        const y = (bounds.minY + bounds.maxY) / 2;
        const z = this.settings.yOffset || 3;
        this.state.worldPos.set(x, y, z);
        this.position.copy(this.state.worldPos);
        this.pickTarget();
    }

    getScreenBoundsWorld() {
        if (!this.camera) return { w: 40, h: 30 };
        const dist = Math.abs(this.camera.position.z); 
        const vFOV = THREE.MathUtils.degToRad(this.camera.fov);
        const visibleHeight = 2 * Math.tan(vFOV / 2) * dist;
        const visibleWidth = visibleHeight * this.camera.aspect;
        return { w: visibleWidth, h: visibleHeight };
    }

    getLaneBoundsWorld() {
        const bounds = this.getScreenBoundsWorld();
        const halfW = bounds.w / 2;
        const halfH = bounds.h / 2;

        let minPX = 0, maxPX = 0;
        if (this.prisms && this.prisms.length > 0) {
            this.prisms.forEach(p => {
                const w = p.scale.x;
                minPX = Math.min(minPX, p.position.x - w/2);
                maxPX = Math.max(maxPX, p.position.x + w/2);
            });
        } else {
            minPX = -2; maxPX = 2; 
        }

        const margin = 2.5; 
        const screenMargin = 3.0; 

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

    pickTarget() {
        const bounds = this.getLaneBoundsWorld();
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

        const p0 = this.state.worldPos.clone();
        const heading = new THREE.Vector3(Math.cos(this.state.angle), Math.sin(this.state.angle), 0);
        const toT = new THREE.Vector3().subVectors(this.state.target, p0);
        const dist = toT.length();

        const c1Len = THREE.MathUtils.clamp(dist * 0.35, 2, 10);
        const c2Len = THREE.MathUtils.clamp(dist * 0.25, 1, 8);

        const p1 = p0.clone().add(heading.multiplyScalar(c1Len));
        const p3 = this.state.target.clone();

        const toDir = toT.clone().normalize();
        const sideVec = new THREE.Vector3(-toDir.y, toDir.x, 0);
        const sweepSign = (Math.random() < 0.5) ? -1 : 1;
        const sweepAmt = THREE.MathUtils.clamp(dist * 0.16, 1, 5) * sweepSign;
        const mix = THREE.MathUtils.clamp(0.35 + 0.25 * (1 - Math.abs(heading.dot(toDir))), 0.25, 0.75);
        const approach = new THREE.Vector3()
            .addVectors(toDir.clone().multiplyScalar(1 - mix), heading.clone().multiplyScalar(mix))
            .normalize();

        const p2 = p3.clone().sub(approach.multiplyScalar(c2Len)).add(sideVec.multiplyScalar(sweepAmt));

        this.state.curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
        this.state.curveT = 0;
        this.state.lastPickAt = performance.now();
    }

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
                this.state.worldPos.copy(p);

                const newTan = this.state.curve.getTangent(this.state.curveT);
                const targetAngle = Math.atan2(newTan.y, newTan.x);
                
                let angleDiff = targetAngle - this.state.angle;
                while (angleDiff <= -Math.PI) angleDiff += Math.PI * 2;
                while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
                
                const turnSmooth = 1 - Math.pow(0.001, safeDt);
                this.state.angle += angleDiff * turnSmooth;
            }
        }

        this.position.copy(this.state.worldPos);
        this.rotation.z = this.state.angle - Math.PI / 2; 
    }

    getBezierDerivative(curve, t) {
        const u = 1 - t;
        const p0 = curve.v0, p1 = curve.v1, p2 = curve.v2, p3 = curve.v3;
        const a = p1.clone().sub(p0).multiplyScalar(3 * u * u);
        const b = p2.clone().sub(p1).multiplyScalar(6 * u * t);
        const c = p3.clone().sub(p2).multiplyScalar(3 * t * t);
        return a.add(b).add(c);
    }

    cleanup() {
        if (this.debugSphere && this.debugSphere.parent) {
            this.debugSphere.parent.remove(this.debugSphere);
            this.debugSphere.geometry.dispose();
            this.debugSphere.material.dispose();
        }
    }
}