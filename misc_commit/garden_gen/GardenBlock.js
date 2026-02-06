import * as THREE from 'three';
import PRNG from './utils/PRNG.js';
import { Snail } from './Snail.js';

export class GardenBlock extends THREE.Object3D {
    constructor(modelScene, prism, settings, seed = 'default_block_seed', snailModel = null, snailGroup = null) {
        super();

        this.prism = prism;
        this.settings = settings || {};
        this.seed = seed;
        this.prng = new PRNG(this.seed);
        this.snailModel = snailModel;
        this.snailGroup = snailGroup;

        this.scaleSize = this.settings.blockScaleSize || 1.0;
        this.overScaleDepth = this.settings.overScaleDepth || 1.0;
        this.centerScaler = this.settings.centerScaler !== undefined ? this.settings.centerScaler : 1.666666667;
        this.uvScale = this.settings.uvScale || 1.0;
        this.reprojectUVs = this.settings.reprojectUVs !== undefined ? this.settings.reprojectUVs : true;

        this.pieces = {};
        this.baseDimensions = {}; 
        this.lastPrismScale = new THREE.Vector3();

        this.snails = [];
        this.snailData = []; // Store local pos and orientation for updating world pos

        console.log(`GardenBlock: Initialized with seed ${this.seed}, has snailModel: ${!!this.snailModel}`);
        this.parseModel(modelScene);
        this.update(true);
    }

    parseModel(modelScene) {
        const names = ['TL', 'TR', 'BL', 'BR', 'T', 'B', 'L', 'R', 'C'];
        
        names.forEach(name => {
            const original = modelScene.getObjectByName(name);
            if (original) {
                const clone = original.clone();
                clone.geometry = original.geometry.clone();
                
                const bbox = new THREE.Box3().setFromBufferAttribute(clone.geometry.attributes.position);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                this.baseDimensions[name] = size;

                clone.rotation.x = Math.PI / 2;

                this.pieces[name] = clone;
                this.add(clone);
            } else {
                console.warn(`GardenBlock: Could not find piece named ${name}`);
            }
        });
    }

    update(force = false) {
        if (!this.prism) return;

        this.scaleSize = this.settings.blockScaleSize || 1.0;
        this.overScaleDepth = this.settings.overScaleDepth || 1.0;
        this.centerScaler = this.settings.centerScaler !== undefined ? this.settings.centerScaler : 1.666666667;
        this.uvScale = this.settings.uvScale || 1.0;
        this.reprojectUVs = this.settings.reprojectUVs !== undefined ? this.settings.reprojectUVs : true;

        const currentScale = this.prism.scale;
        
        if (!force && currentScale.equals(this.lastPrismScale)) {
            // Even if scale hasn't changed, position might have
            this.updateSnails();
            return;
        }

        this.layout();
        this.lastPrismScale.copy(currentScale);

        this.spawnSnails();
    }

    layout() {
        const pW = this.prism.scale.x;
        const pH = this.prism.scale.y;
        const pD = this.prism.scale.z;
        
        const s = this.scaleSize;
        const osd = this.overScaleDepth;
        const cs = this.centerScaler;

        const dimTL = this.baseDimensions['TL'] || new THREE.Vector3(1, 1, 1);
        const worldCornerW = dimTL.x * s;
        const worldCornerH = dimTL.z * s; // Z is height due to rotation
        
        const isShort = pH < (2 * worldCornerH);
        
        const worldInnerW = Math.max(0, pW - (2 * worldCornerW));
        const worldInnerH = Math.max(0, pH - (2 * worldCornerH));

        const getLocalWidthScale = (name, targetWorldW) => {
            const baseW = this.baseDimensions[name] ? this.baseDimensions[name].x : 1;
            return baseW > 0.001 ? targetWorldW / (pW * baseW) : s / pW;
        };
        const getLocalDepthScale = (name) => {
            const baseD = this.baseDimensions[name] ? this.baseDimensions[name].y : 1;
            let scale = baseD > 0.001 ? (osd / baseD) : osd;
            if (name === 'C') scale *= cs;
            return scale;
        };
        const getLocalHeightScale = (name, targetWorldH) => {
            const baseH = this.baseDimensions[name] ? this.baseDimensions[name].z : 1;
            return baseH > 0.001 ? targetWorldH / (pH * baseH) : s / pH;
        };

        // Visibility
        ['L', 'C', 'R'].forEach(name => {
            if (this.pieces[name]) this.pieces[name].visible = !isShort;
        });
        ['TL', 'T', 'TR', 'BL', 'B', 'BR'].forEach(name => {
            if (this.pieces[name]) this.pieces[name].visible = true;
        });

        if (isShort) {
            // Short Case: 50% height split
            const halfHeightScale = (baseH) => (baseH > 0.001 ? 0.5 / baseH : 1);

            // Row 1 (Top)
            ['TL', 'TR'].forEach(n => {
                const baseH = this.baseDimensions[n].z;
                if (this.pieces[n]) this.pieces[n].scale.set(s / pW, getLocalDepthScale(n), halfHeightScale(baseH));
            });
            if (this.pieces['T']) {
                const baseH = this.baseDimensions['T'].z;
                this.pieces['T'].scale.set(getLocalWidthScale('T', worldInnerW), getLocalDepthScale('T'), halfHeightScale(baseH));
            }

            // Row 3 (Bottom)
            ['BL', 'BR'].forEach(n => {
                const baseH = this.baseDimensions[n].z;
                if (this.pieces[n]) this.pieces[n].scale.set(s / pW, getLocalDepthScale(n), halfHeightScale(baseH));
            });
            if (this.pieces['B']) {
                const baseH = this.baseDimensions['B'].z;
                this.pieces['B'].scale.set(getLocalWidthScale('B', worldInnerW), getLocalDepthScale('B'), halfHeightScale(baseH));
            }

            // Placement
            const topY = 0.5;
            const botY = -0.5;
            const left = -0.5;
            const right = 0.5;
            const back = -0.5;

            this.place('TL', left, topY, back);
            this.place('TR', right, topY, back);
            this.place('T', 0, topY, back);

            this.place('BL', left, botY, back);
            this.place('BR', right, botY, back);
            this.place('B', 0, botY, back);

        } else {
            // Normal Case
            ['TL', 'TR', 'BL', 'BR'].forEach(n => {
                if (this.pieces[n]) this.pieces[n].scale.set(s / pW, getLocalDepthScale(n), s / pH);
            });

            const sideHeightScale = getLocalHeightScale('L', worldInnerH);
            const topWidthScale = getLocalWidthScale('T', worldInnerW);

            if (this.pieces['T']) this.pieces['T'].scale.set(topWidthScale, getLocalDepthScale('T'), s / pH);
            if (this.pieces['B']) this.pieces['B'].scale.set(topWidthScale, getLocalDepthScale('B'), s / pH);
            if (this.pieces['L']) this.pieces['L'].scale.set(s / pW, getLocalDepthScale('L'), sideHeightScale);
            if (this.pieces['R']) this.pieces['R'].scale.set(s / pW, getLocalDepthScale('R'), sideHeightScale);
            
            if (this.pieces['C']) {
                this.pieces['C'].scale.set(
                    getLocalWidthScale('C', worldInnerW), 
                    getLocalDepthScale('C'), 
                    getLocalHeightScale('C', worldInnerH)
                );
            }

            const left = -0.5;
            const right = 0.5;
            const top = 0.5;
            const bottom = -0.5;
            const back = -0.5; 

            this.place('TL', left, top, back);
            this.place('TR', right, top, back);
            this.place('BL', left, bottom, back);
            this.place('BR', right, bottom, back);
            this.place('T', 0, top, back);
            this.place('B', 0, bottom, back);
            this.place('L', left, 0, back);
            this.place('R', right, 0, back);
            this.place('C', 0, 0, back);
        }

        if (this.reprojectUVs) {
            this.reproject(pW, pH, isShort);
        }
    }

    place(name, x, y, z) {
        const p = this.pieces[name];
        if (p) {
            p.position.set(x, y, z);
        }
    }

    spawnSnails() {
        // Clear existing snails
        this.snails.forEach(s => {
            if (s.parent) s.parent.remove(s);
            s.cleanup();
        });
        this.snails = [];
        this.snailData = [];

        if (!this.snailModel) {
            console.warn("GardenBlock: No snail model provided");
            return;
        }

        const odds = this.settings.blockHasSnailsOdds !== undefined ? this.settings.blockHasSnailsOdds : 0.7;
        const maxSnails = this.settings.maxSnails !== undefined ? this.settings.maxSnails : 2;
        const rotationMultiplier = this.settings.snailRotationMultiplier || [0, 1, 0];
        const minSnailScale = this.settings.minSnailScale !== undefined ? this.settings.minSnailScale : 3.0;
        const maxSnailScale = this.settings.maxSnailScale !== undefined ? this.settings.maxSnailScale : 5.0;
        const snailXOffset = this.settings.snailXOffset !== undefined ? this.settings.snailXOffset : 0.0;
        const snailYOffset = this.settings.snailYOffset !== undefined ? this.settings.snailYOffset : -0.04;
        const snailZOffset = this.settings.snailZOffset !== undefined ? this.settings.snailZOffset : 0.0;
        const debugSnails = this.settings.debugSnails !== undefined ? this.settings.debugSnails : true;
        const rotXOffset = this.settings.snailRotationXOffset !== undefined ? this.settings.snailRotationXOffset : 0;
        const rotYOffset = this.settings.snailRotationYOffset !== undefined ? this.settings.snailRotationYOffset : 0;
        const rotZOffset = this.settings.snailRotationZOffset !== undefined ? this.settings.snailRotationZOffset : 0;

        // Force matrix update to ensure worldPos is correct
        this.prism.updateMatrixWorld(true);

        // Reset PRNG to ensure deterministic placement based on seed
        this.prng = new PRNG(this.seed);

        if (this.prng.bool(odds)) {
            const count = Math.floor(this.prng.range(1, maxSnails + 1));
            console.log(`GardenBlock: Spawning ${count} snails for seed ${this.seed}`);
            
            for (let i = 0; i < count; i++) {
                const snail = new Snail(this.snailModel, debugSnails);
                
                let attempts = 0;
                let validPlacement = false;
                let localPos = new THREE.Vector3();
                let worldPos = new THREE.Vector3();

                while (!validPlacement && attempts < 10) {
                    const edgeX = this.prng.range(-0.45, 0.45); 
                    localPos.set(edgeX + snailXOffset, 0.5 + snailYOffset, 0.5 + snailZOffset);

                    validPlacement = true;
                    worldPos.copy(localPos).applyMatrix4(this.prism.matrixWorld);

                    for (const other of this.snails) {
                        if (worldPos.distanceTo(other.position) < 1.5) { 
                            validPlacement = false;
                            break;
                        }
                    }
                    attempts++;
                }

                if (validPlacement) {
                    snail.position.copy(worldPos);
                    const baseRot = new THREE.Euler(rotXOffset, rotYOffset, rotZOffset); 
                    snail.quaternion.setFromEuler(baseRot);

                    // Add random rotation on Y axis based on multiplier
                    const randY = (this.prng.random() * Math.PI * 2) * rotationMultiplier[1];
                    snail.rotateY(randY);

                    const scale = this.prng.range(minSnailScale, maxSnailScale);
                    snail.scale.set(scale, scale, scale);

                    if (this.snailGroup) {
                        this.snailGroup.add(snail);
                    } else {
                        this.add(snail); 
                    }
                    this.snails.push(snail);
                    this.snailData.push({ localPos: localPos.clone(), baseRot: baseRot.clone() });
                }
            }
        }
    }

    updateSnails() {
        this.prism.updateMatrixWorld(true);
        this.snails.forEach((snail, i) => {
            const data = this.snailData[i];
            if (data) {
                snail.position.copy(data.localPos).applyMatrix4(this.prism.matrixWorld);
                // Orientation might also need updating if prism rotates, 
                // but for now we assume mostly upright.
                // If prism rotates, we'd need to combine rotations.
            }
        });
    }

    updateAnimation(time) {
        const speed = this.settings.snailAnimationSpeed !== undefined ? this.settings.snailAnimationSpeed : 1.0;
        this.snails.forEach(s => s.update(time, speed));
    }

    reproject(pW, pH, isShort) {
        const uvScale = this.uvScale;
        Object.keys(this.pieces).forEach(name => {
            const mesh = this.pieces[name];
            if (!mesh.visible || !mesh.geometry || !mesh.geometry.attributes.uv) return;

            const uvAttr = mesh.geometry.attributes.uv;
            const originalUV = mesh.userData.originalUV || uvAttr.array.slice();
            if (!mesh.userData.originalUV) mesh.userData.originalUV = originalUV;

            let worldW, worldH;
            const s = this.scaleSize;
            const dim = this.baseDimensions[name];
            const dimTL = this.baseDimensions['TL'];
            
            if (isShort) {
                // Short case UVs
                if (['TL', 'TR', 'BL', 'BR'].includes(name)) {
                    worldW = dim.x * s;
                    worldH = pH / 2;
                } else if (name === 'T' || name === 'B') {
                    worldW = pW - (2 * dimTL.x * s);
                    worldH = pH / 2;
                } else {
                    worldW = 0; worldH = 0; // Should be hidden
                }
            } else {
                // Normal case UVs
                if (['TL', 'TR', 'BL', 'BR'].includes(name)) {
                    worldW = dim.x * s;
                    worldH = dim.z * s;
                } else if (name === 'T' || name === 'B') {
                    worldW = pW - (2 * dimTL.x * s);
                    worldH = dim.z * s;
                } else if (name === 'L' || name === 'R') {
                    worldW = dim.x * s;
                    worldH = pH - (2 * dimTL.z * s);
                } else if (name === 'C') {
                    worldW = pW - (2 * dimTL.x * s);
                    worldH = pH - (2 * dimTL.z * s);
                }
            }

            const scaleX = (worldW / dim.x) * uvScale;
            const scaleY = (worldH / dim.z) * uvScale; 

            for (let i = 0; i < uvAttr.count; i++) {
                uvAttr.setXY(i, 
                    originalUV[i * 2] * scaleX, 
                    originalUV[i * 2 + 1] * scaleY
                );
            }
            uvAttr.needsUpdate = true;
        });
    }

    cleanup() {
        Object.values(this.pieces).forEach(p => {
            if (p.geometry) p.geometry.dispose();
            if (p.material) {
                if (Array.isArray(p.material)) p.material.forEach(m => m.dispose());
                else p.material.dispose();
            }
        });
        this.snails.forEach(s => {
            if (s.parent) s.parent.remove(s);
            s.cleanup();
        });
        this.snails = [];
        this.snailData = [];
    }
}
