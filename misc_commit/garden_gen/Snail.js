import * as THREE from 'three';

export class Snail extends THREE.Object3D {
    constructor(model, debug = false) {
        super();
        this.snailModel = model.clone();
        
        // Auto-normalize scale to fit in ~1 unit box (Meshes only)
        const box = new THREE.Box3();
        this.snailModel.traverse((child) => {
            if (child.isMesh) {
                box.expandByObject(child);
            }
        });

        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) {
            const scaleFactor = 1.0 / maxDim;
            this.snailModel.scale.set(scaleFactor, scaleFactor, scaleFactor);
            // Re-center
            const center = new THREE.Vector3();
            box.getCenter(center);
            
            this.snailModel.position.sub(center.multiplyScalar(scaleFactor));
            this.snailModel.position.y += (size.y * scaleFactor) / 2;
        }

        this.add(this.snailModel);

        if (debug) {
            // Debug Box
            const debugBox = new THREE.Mesh(
                new THREE.BoxGeometry(1, 1, 1),
                new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
            );
            debugBox.position.y = 0.5;
            this.add(debugBox);
        }

        // Store all meshes that have morph targets
        this.meshesWithMorphs = [];
        
        this.snailModel.traverse((child) => {
            if (child.isMesh) {
                child.renderOrder = 3;
                if (child.morphTargetDictionary && child.morphTargetInfluences) {
                    console.log("Snail: Found morph targets on mesh:", child.name, Object.keys(child.morphTargetDictionary));
                    this.meshesWithMorphs.push(child);
                }
            }
        });

        this.phases = {
            tail_up: Math.random() * Math.PI * 2,
            tail_wag: Math.random() * Math.PI * 2,
            side_up_a: Math.random() * Math.PI * 2,
            side_up_b: Math.random() * Math.PI * 2,
            shell_a: Math.random() * Math.PI * 2,
            shell_b: Math.random() * Math.PI * 2,
            head: Math.random() * Math.PI * 2,
            antennas_a: Math.random() * Math.PI * 2,
            antennas_b: Math.random() * Math.PI * 2,
            whiskers: Math.random() * Math.PI * 2
        };

        this.speeds = {
            tail_up: 0.5 + Math.random() * 0.5,
            tail_wag: 0.8 + Math.random() * 0.4,
            side_up_a: 1.0 + Math.random() * 0.5, // Faster
            side_up_b: 1.2 + Math.random() * 0.5, // Faster
            shell_a: 0.8 + Math.random() * 0.4,   // Much faster
            shell_b: 0.9 + Math.random() * 0.4,   // Much faster
            head: 0.6 + Math.random() * 0.4,
            antennas_a: 0.4 + Math.random() * 0.3, 
            antennas_b: 0.3 + Math.random() * 0.3, 
            whiskers: 1.5 + Math.random() * 1.0
        };
    }

    update(time, speedMultiplier = 1.0) {
        if (this.meshesWithMorphs.length === 0) return;

        const keys = [
            'tail_up', 'tail_wag', 'side_up_a', 'side_up_b', 
            'shell_a', 'shell_b', 'head', 'antennas_a', 
            'antennas_b', 'whiskers'
        ];

        keys.forEach(key => {
            const speed = (this.speeds[key] || 1.0) * speedMultiplier;
            const phase = this.phases[key] || 0;
            let val = (Math.sin(time * speed + phase) + 1) / 2;
            
            // Add some interference for smoother/varied movement
            if (key === 'antennas_a' || key === 'antennas_b' || key === 'head' || key.includes('side') || key.includes('shell')) {
                val = (val + (Math.sin(time * speed * 1.7 + phase * 0.8) + 1) / 2) / 2;
            }

            // Apply to all meshes that have this target
            this.meshesWithMorphs.forEach(mesh => {
                const index = mesh.morphTargetDictionary[key];
                if (index !== undefined) {
                    mesh.morphTargetInfluences[index] = val;
                }
            });
        });
    }

    cleanup() {
        // Any specific cleanup if needed
    }
}