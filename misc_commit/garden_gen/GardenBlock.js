import * as THREE from 'three';

export class GardenBlock extends THREE.Object3D {
    constructor(modelScene, prism, settings) {
        super();

        this.prism = prism;
        this.settings = settings || {};
        this.scaleSize = this.settings.blockScaleSize || 1.0;
        this.reprojectUVs = this.settings.reprojectUVs !== undefined ? this.settings.reprojectUVs : true;

        this.pieces = {};
        this.baseDimensions = {}; // Store unscaled, unrotated dimensions
        this.lastPrismScale = new THREE.Vector3();

        // Parse and clone the model parts
        this.parseModel(modelScene);

        // Initial layout
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

                // Rotate to face +Z
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

        const currentScale = this.prism.scale;
        
        if (!force && currentScale.equals(this.lastPrismScale)) {
            return;
        }

        this.layout();
        this.lastPrismScale.copy(currentScale);
    }

    layout() {
        // Since we are a child of the scaled prism, our parent's scale is applied to us.
        const pW = this.prism.scale.x;
        const pH = this.prism.scale.y;
        const pD = this.prism.scale.z;
        
        const s = this.scaleSize;

        // Base unscaled dimensions of TL
        const dimTL = this.baseDimensions['TL'] || new THREE.Vector3(1, 1, 1);
        
        // Desired WORLD sizes for margins (Corners)
        const worldCornerW = dimTL.x * s;
        const worldCornerH = dimTL.z * s; // Local Z is world Height
        
        // Inner world dimensions
        const worldInnerW = Math.max(0, pW - (2 * worldCornerW));
        const worldInnerH = Math.max(0, pH - (2 * worldCornerH));

        // LOCAL scales (relative to parent prism's scale)
        // For depth: Local Y * Parent Z * Base Y = Target Z
        // We want Target Z = Parent Z (pD)
        // So Local Y = 1 / Base Y
        const getLocalDepthScale = (name) => {
            const baseDepth = this.baseDimensions[name] ? this.baseDimensions[name].y : 1;
            return baseDepth > 0 ? (1.0 / baseDepth) : 1;
        };

        // --- CORNERS ---
        ['TL', 'TR', 'BL', 'BR'].forEach(n => {
            const p = this.pieces[n];
            if (p) {
                // Local X scale = worldCornerW / (pW * baseW) = (baseW * s) / (pW * baseW) = s / pW
                p.scale.set(s / pW, getLocalDepthScale(n), s / pH);
            }
        });

        // --- EDGES ---
        if (this.pieces['T'] && this.baseDimensions['T']) {
            const baseW = this.baseDimensions['T'].x;
            this.pieces['T'].scale.set(worldInnerW / (pW * baseW), getLocalDepthScale('T'), s / pH);
        }
        if (this.pieces['B'] && this.baseDimensions['B']) {
            const baseW = this.baseDimensions['B'].x;
            this.pieces['B'].scale.set(worldInnerW / (pW * baseW), getLocalDepthScale('B'), s / pH);
        }
        if (this.pieces['L'] && this.baseDimensions['L']) {
            const baseH = this.baseDimensions['L'].z;
            this.pieces['L'].scale.set(s / pW, getLocalDepthScale('L'), worldInnerH / (pH * baseH));
        }
        if (this.pieces['R'] && this.baseDimensions['R']) {
            const baseH = this.baseDimensions['R'].z;
            this.pieces['R'].scale.set(s / pW, getLocalDepthScale('R'), worldInnerH / (pH * baseH));
        }
        if (this.pieces['C'] && this.baseDimensions['C']) {
            const baseW = this.baseDimensions['C'].x;
            const baseH = this.baseDimensions['C'].z;
            this.pieces['C'].scale.set(worldInnerW / (pW * baseW), getLocalDepthScale('C'), worldInnerH / (pH * baseH));
        }

        // --- PLACEMENT ---
        // Local coordinates in prism space (-0.5 to 0.5)
        const left = -0.5;
        const right = 0.5;
        const top = 0.5;
        const bottom = -0.5;
        const back = -0.5; // Back of the prism

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
            this.reproject();
        }
    }

    place(name, x, y, z) {
        const p = this.pieces[name];
        if (p) {
            p.position.set(x, y, z);
        }
    }

    reproject() {
        // Placeholder
    }

    cleanup() {
        Object.values(this.pieces).forEach(p => {
            if (p.geometry) p.geometry.dispose();
        });
    }
}