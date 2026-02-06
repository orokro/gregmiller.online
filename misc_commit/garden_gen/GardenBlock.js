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
                
                // Measure base dimensions before any transformation
                const bbox = new THREE.Box3().setFromBufferAttribute(clone.geometry.attributes.position);
                const size = new THREE.Vector3();
                bbox.getSize(size);
                this.baseDimensions[name] = size;

                // Apply rotation to face +Z (out of wall)
                // Blender (Z-up) -> Three (Y-up) usually means we look down -Y or +Z.
                // Rotating 90 deg on X aligns Blender Z to Three -Y.
                // Let's try to orient so 'Up' in Blender (Z) points to 'Up' in World (Y).
                // Blender Z is Up. Three Y is Up.
                // So we need to rotate X by -90 (-PI/2) to map Z to Y?
                // Or +90?
                // If we rotate X by +90: Y -> Z, Z -> -Y.
                // If we rotate X by -90: Y -> -Z, Z -> Y.
                // The user prompt said: "Top left corner piece should be placed... on -x +y"
                // And "origin of the TL corner mesh is on it's top left corner".
                // Let's stick to the prompt's implied rotation or the previous behavior which "faced the correct direction".
                // Previous code used `Math.PI / 2` (90 deg). 
                // Result: "middle row was way taller... applying it's scale on the wrong axes (probably z instead of y)".
                // This confirms rotation was mostly right (facing out), but scaling was wrong.
                
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
        const pW = this.prism.scale.x;
        const pH = this.prism.scale.y;
        const pD = this.prism.scale.z;
        const s = this.scaleSize;

        // Reset scales to base * s
        // For corners, we just want uniform scale 's'.
        ['TL', 'TR', 'BL', 'BR'].forEach(n => {
            if (this.pieces[n]) this.pieces[n].scale.set(s, s, s);
        });

        // Dimensions of the corner pieces (scaled)
        // We use the base dimensions * s.
        // Important: Which dimension maps to which?
        // With rotation X 90:
        // Local X -> World X (Width)
        // Local Y -> World Z (Depth)
        // Local Z -> World -Y (Height)
        
        // So for 'TL', the world width is baseSize.x * s
        // The world height is baseSize.z * s (because local Z is vertical in world now)
        
        const dimTL = this.baseDimensions['TL'];
        // Fallback if missing
        const cornerW = (dimTL ? dimTL.x : 1) * s;
        const cornerH = (dimTL ? dimTL.z : 1) * s; 
        
        // Inner dimensions to fill
        const innerW = Math.max(0.01, pW - (2 * cornerW));
        const innerH = Math.max(0.01, pH - (2 * cornerH));

        // Prism Bounds
        const left = -pW / 2;
        const right = pW / 2;
        const top = pH / 2;
        const bottom = -pH / 2;
        const zPos = -pD / 2;

        // --- PLACEMENT ---
        // TL: Top Left. Origin is Top Left.
        // Place at left, top.
        this.place('TL', left, top, zPos);

        // TR: Top Right. Origin is Top Right.
        // Place at right, top.
        this.place('TR', right, top, zPos);

        // BL: Bottom Left. Origin is Bottom Left.
        // Place at left, bottom.
        this.place('BL', left, bottom, zPos);

        // BR: Bottom Right. Origin is Bottom Right.
        // Place at right, bottom.
        this.place('BR', right, bottom, zPos);


        // --- EDGES ---
        
        // T: Top Edge. 
        // Should fill horizontally.
        // Scale Local X to match innerW.
        // Current Local X size = baseDimensions['T'].x * s
        // Factor = innerW / (baseDimensions['T'].x * s) * s = innerW / baseT.x
        if (this.pieces['T'] && this.baseDimensions['T']) {
            this.place('T', 0, top, zPos); // Centered on top edge?
            // "origin matches it's edge side - so the left piece has it's origin centered on it's left edge"
            // "top piece origin matches it's edge side". Top edge?
            // If origin is centered on Top Edge, then position at (0, top).
            // Scale X:
            const baseW = this.baseDimensions['T'].x;
            const factor = innerW / baseW;
            // Apply scale: X stretches, Y (Depth) stays 's', Z (Height) stays 's'
            this.pieces['T'].scale.set(factor, s, s);
        }

        // B: Bottom Edge.
        if (this.pieces['B'] && this.baseDimensions['B']) {
            this.place('B', 0, bottom, zPos);
            const baseW = this.baseDimensions['B'].x;
            const factor = innerW / baseW;
            this.pieces['B'].scale.set(factor, s, s);
        }

        // L: Left Edge.
        // Should fill vertically.
        // Scale Local Z to match innerH (since rotated).
        if (this.pieces['L'] && this.baseDimensions['L']) {
            this.place('L', left, 0, zPos);
            const baseH = this.baseDimensions['L'].z; // Local Z is Height
            const factor = innerH / baseH;
            // X stays s, Y (depth) stays s, Z stretches
            this.pieces['L'].scale.set(s, s, factor); 
        }

        // R: Right Edge.
        if (this.pieces['R'] && this.baseDimensions['R']) {
            this.place('R', right, 0, zPos);
            const baseH = this.baseDimensions['R'].z;
            const factor = innerH / baseH;
            this.pieces['R'].scale.set(s, s, factor);
        }

        // C: Center.
        // Fill both.
        if (this.pieces['C'] && this.baseDimensions['C']) {
            this.place('C', 0, 0, zPos);
            const baseW = this.baseDimensions['C'].x;
            const baseH = this.baseDimensions['C'].z; // Local Z is Height
            const factorX = innerW / baseW;
            const factorY = innerH / baseH;
            this.pieces['C'].scale.set(factorX, s, factorY);
        }

        // UV Reprojection
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
        // Placeholder for UV logic
    }

    cleanup() {
        Object.values(this.pieces).forEach(p => {
            if (p.geometry) p.geometry.dispose();
        });
    }
}