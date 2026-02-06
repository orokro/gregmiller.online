import * as THREE from 'three';

export class GardenScatter extends THREE.Object3D {
    constructor(model, bgPlane, prisms, settings) {
        super();
        this.model = model;
        this.bgPlane = bgPlane;
        this.prisms = prisms;
        this.settings = settings || {};
        
        this.items = [];
        
        // Analyze library if needed
        this.library = [];
        this.model.traverse((child) => {
            if (child.isMesh && child.name.includes('leaf')) {
                this.library.push(child);
            }
        });

        this.generate();
    }

    generate() {
        // Clear existing items
        this.items.forEach(item => this.remove(item));
        this.items = [];

        const { 
            density = 0, 
            minScale = 1, 
            maxScale = 1, 
            seed = 'default', 
            yOffset = 0, 
            randomRotation = true, // Legacy boolean or string?
            rotationAxis = 'z'     // Default for backward compat
        } = this.settings;
        
        // Simple deterministic PRNG
        let seedNum = this.hashString(seed);
        const random = () => {
            seedNum = (seedNum * 16807) % 2147483647;
            return (seedNum - 1) / 2147483646;
        };

        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

        // Calculate Block Column Bounds
        let minBX = Infinity, maxBX = -Infinity;
        let minBY = Infinity, maxBY = -Infinity;
        
        if (this.prisms.length > 0) {
            this.prisms.forEach(p => {
                const w = p.scale.x;
                const h = p.scale.y;
                minBX = Math.min(minBX, p.position.x - w/2);
                maxBX = Math.max(maxBX, p.position.x + w/2);
                minBY = Math.min(minBY, p.position.y - h/2);
                maxBY = Math.max(maxBY, p.position.y + h/2);
            });
        } else {
            // No blocks, no exclusion
            minBX = maxBX = 0;
            minBY = maxBY = 0;
        }

        const margin = 0.5;
        minBX -= margin;
        maxBX += margin;
        // Extend Y to cover the full column logic "space between blocks"
        // Actually the loop above covers the extent from bottom block to top block.
        // It effectively covers the "space between" because we take min/max of the whole set.

        let spawned = 0;
        let attempts = 0;
        const maxAttempts = density * 20;

        while (spawned < density && attempts < maxAttempts) {
            attempts++;
            
            // Random position on the plane
            const x = (random() - 0.5) * gW;
            const y = (random() - 0.5) * gH;

            // Collision check: Avoid the block column
            let inside = false;
            if (this.prisms.length > 0) {
                if (x >= minBX && x <= maxBX && y >= minBY && y <= maxBY) {
                    inside = true;
                }
            }

            if (!inside) {
                let item;
                if (this.library.length > 0) {
                    // Pick random from library
                    const template = this.library[Math.floor(random() * this.library.length)];
                    item = template.clone();
                } else {
                    item = this.model.clone();
                }

                // Position: X/Y on plane, yOffset for Z (Vertical depth)
                item.position.set(x, y, yOffset);
                
                // Orientation
                // Standard upright for wall garden: Rotate -90 X to point Up
                item.rotation.x = Math.PI / 2; // Blender Z -> World Y?
                // Wait, PI/2 is +90. 
                // Z -> -Y. Y -> Z.
                // If we want Z-up model to point Y-up, we need -PI/2 (-90).
                // Let's stick to what was there if it worked visually, but user complained about sideways.
                // Previous code: item.rotation.x = Math.PI / 2;
                // I'll try that.
                
                if (randomRotation) {
                    const angle = random() * Math.PI * 2;
                    // User requested specific axis control
                    // If settings has rotationAxis, use it.
                    // For flowers: 'y'. For leaves: 'z' (default?).
                    
                    // Logic hack based on settings structure
                    // If randomRotation is boolean, use rotationAxis or default 'z'
                    
                    let axis = rotationAxis;
                    // Auto-detect based on "sideways" complaint?
                    // User said: "make the random rotation only on the Y axis"
                    
                    if (this.settings.rotationAxis === 'y') {
                        item.rotation.y = angle;
                        // Reset Z if it was set by something else?
                        item.rotation.z = 0; 
                    } else if (this.settings.rotationAxis === 'z') {
                        item.rotation.z = angle;
                    } else {
                         // Default behavior (likely Z for legacy)
                         item.rotation.z = angle;
                    }
                }

                // Random Scale
                const s = minScale + random() * (maxScale - minScale);
                item.scale.set(s, s, s);

                this.add(item);
                this.items.push(item);
                spawned++;
            }
        }
    }

    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    }

    update(prisms, settings) {
        this.prisms = prisms;
        this.settings = settings;
        this.generate();
    }

    cleanup() {
        this.items.forEach(item => this.remove(item));
        this.items = [];
    }
}