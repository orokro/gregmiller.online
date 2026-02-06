import * as THREE from 'three';

export class GardenScatter extends THREE.Object3D {
    constructor(model, bgPlane, prisms, settings) {
        super();
        this.model = model;
        this.bgPlane = bgPlane;
        this.prisms = prisms;
        this.settings = settings || {};
        
        this.items = [];
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
            randomRotation = true 
        } = this.settings;
        
        // Simple deterministic PRNG
        let seedNum = this.hashString(seed);
        const random = () => {
            seedNum = (seedNum * 16807) % 2147483647;
            return (seedNum - 1) / 2147483646;
        };

        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

        let spawned = 0;
        let attempts = 0;
        const maxAttempts = density * 10;

        while (spawned < density && attempts < maxAttempts) {
            attempts++;
            
            // Random position on the plane
            const x = (random() - 0.5) * gW;
            const y = (random() - 0.5) * gH;

            // Collision check: Avoid prisms
            let inside = false;
            for (const prism of this.prisms) {
                const pW = prism.scale.x;
                const pH = prism.scale.y;
                const pPos = prism.position;
                
                const margin = 0.5; // Slight margin to avoid clipping stones
                const minX = pPos.x - pW/2 - margin;
                const maxX = pPos.x + pW/2 + margin;
                const minY = pPos.y - pH/2 - margin;
                const maxY = pPos.y + pH/2 + margin;

                if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                    inside = true;
                    break;
                }
            }

            if (!inside) {
                const item = this.model.clone();
                // Position: X/Y on plane, yOffset for Z (Vertical depth)
                item.position.set(x, y, yOffset);
                
                // Orientation: Blender Z-up models need to face out from the wall
                item.rotation.x = Math.PI / 2; 
                if (randomRotation) {
                    // Random spin around the normal
                    item.rotation.z = random() * Math.PI * 2;
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
