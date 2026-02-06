import * as THREE from 'three';

export class GardenBlock extends THREE.Object3D {
    constructor(modelScene, prism, settings) {
        super();

        this.prism = prism;
        this.settings = settings || {};
        this.scaleSize = this.settings.blockScaleSize || 1.0;
        this.overScaleDepth = this.settings.overScaleDepth || 1.0;
        this.centerScaler = this.settings.centerScaler || 1.0;
        this.reprojectUVs = this.settings.reprojectUVs !== undefined ? this.settings.reprojectUVs : true;

        this.pieces = {};
        this.baseDimensions = {}; 
        this.lastPrismScale = new THREE.Vector3();

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
                
                // Measure base dimensions in local space
                const bbox = new THREE.Box3().setFromBufferAttribute(clone.geometry.attributes.position);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                this.baseDimensions[name] = size;

                // Rotate 90X to face Z+ (World)
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
        this.centerScaler = this.settings.centerScaler || 1.0;
        this.reprojectUVs = this.settings.reprojectUVs !== undefined ? this.settings.reprojectUVs : true;

        const currentScale = this.prism.scale;
        
        if (!force && currentScale.equals(this.lastPrismScale)) {
            return;
        }

        this.layout();
        this.lastPrismScale.copy(currentScale);
    }

    layout() {
        const pW = this.prism.scale.x;
        const pH = this.prism.scale.y;
        const pD = this.prism.scale.z;
        
        const s = this.scaleSize;
        const osd = this.overScaleDepth;
        const cs = this.centerScaler;

        // 1. Measure reference margins
        const dimTL = this.baseDimensions['TL'] || new THREE.Vector3(1, 1, 1);
        const worldCornerW = dimTL.x * s;
        const worldCornerH = dimTL.z * s; // Use Z for vertical height after 90X rotation
        
        const worldInnerW = Math.max(0, pW - (2 * worldCornerW));
        const worldInnerH = Math.max(0, pH - (2 * worldCornerH));

        // 2. Scale Helper Functions
        const getLocalWidthScale = (name, targetWorldW) => {
            const baseW = this.baseDimensions[name] ? this.baseDimensions[name].x : 1;
            return baseW > 0.001 ? targetWorldW / (pW * baseW) : s / pW;
        };
        const getLocalDepthScale = (name) => {
            const baseD = this.baseDimensions[name] ? this.baseDimensions[name].y : 1; // GLTF Y is world Depth after 90X
            let scale = baseD > 0.001 ? (osd / baseD) : osd;
            if (name === 'C') scale *= cs; // Apply center scaler
            return scale;
        };
        const getLocalHeightScale = (name, targetWorldH) => {
            const baseH = this.baseDimensions[name] ? this.baseDimensions[name].z : 1; // GLTF Z is world Height after 90X
            return baseH > 0.001 ? targetWorldH / (pH * baseH) : s / pH;
        };

        // --- SCALE ---
        ['TL', 'TR', 'BL', 'BR'].forEach(n => {
            const p = this.pieces[n];
            if (p) {
                p.scale.set(s / pW, getLocalDepthScale(n), s / pH);
            }
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

        // --- PLACEMENT ---
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

        if (this.reprojectUVs) {
            this.reproject(pW, pH);
        }
    }

    place(name, x, y, z) {
        const p = this.pieces[name];
        if (p) {
            p.position.set(x, y, z);
        }
    }

    reproject(pW, pH) {
        Object.keys(this.pieces).forEach(name => {
            const mesh = this.pieces[name];
            if (!mesh.geometry || !mesh.geometry.attributes.uv) return;

            const uvAttr = mesh.geometry.attributes.uv;
            const originalUV = mesh.userData.originalUV || uvAttr.array.slice();
            if (!mesh.userData.originalUV) mesh.userData.originalUV = originalUV;

            let worldW, worldH;
            const s = this.scaleSize;
            const dim = this.baseDimensions[name];
            const dimTL = this.baseDimensions['TL'];
            
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

            const scaleX = worldW / dim.x;
            const scaleY = worldH / dim.z; 

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
        });
    }
}
