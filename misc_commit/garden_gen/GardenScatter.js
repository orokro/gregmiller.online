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
            randomRotation = true,
            rotationAxis = 'z',
            xRot = null,
            yRot = null,
            zRot = null
        } = this.settings;
        
        // Simple deterministic PRNG
        let seedNum = this.hashString(seed);
        const random = () => {
            seedNum = (seedNum * 16807) % 2147483647;
            return (seedNum - 1) / 2147483646;
        };

        const degToRad = THREE.MathUtils.degToRad;

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
            minBX = maxBX = 0;
            minBY = maxBY = 0;
        }

        const margin = 0.5;
        minBX -= margin;
        maxBX += margin;

        let spawned = 0;
        let attempts = 0;
        const maxAttempts = density * 20;

        while (spawned < density && attempts < maxAttempts) {
            attempts++;
            
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
                    const template = this.library[Math.floor(random() * this.library.length)];
                    item = template.clone();
                } else {
                    item = this.model.clone();
                }

                item.position.set(x, y, yOffset);
                
                // Base Orientation (Pointing Up/Out)
                item.rotation.x = Math.PI / 2; 
                
                if (randomRotation) {
                    // Check if we have specific range settings (Leaves)
                    if (xRot || yRot || zRot) {
                        const rx = xRot ? degToRad(xRot[0] + random() * (xRot[1] - xRot[0])) : 0;
                        const ry = yRot ? degToRad(yRot[0] + random() * (yRot[1] - yRot[0])) : 0;
                        const rz = zRot ? degToRad(zRot[0] + random() * (zRot[1] - zRot[0])) : 0;
                        
                        // Apply as local additions or absolute if base is zero?
                        // If base is PI/2 X, we should probably use a dummy or rotate in order
                        item.rotateX(rx);
                        item.rotateY(ry);
                        item.rotateZ(rz);
                    } else {
                        // Simple axis logic (Flowers)
                        const angle = random() * Math.PI * 2;
                        if (rotationAxis === 'y') {
                            item.rotation.y = angle;
                        } else {
                            item.rotation.z = angle;
                        }
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
