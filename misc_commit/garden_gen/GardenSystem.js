import * as THREE from 'three';
import { GardenBlock } from './GardenBlock.js';

export class GardenSystem extends THREE.Object3D {
    constructor(models, bgPlane, prisms, gardenSettings, blockSettings) {
        super();
        this.models = models;
        this.bgPlane = bgPlane;
        this.gardenSettings = gardenSettings || {};
        this.blockSettings = blockSettings || {};
        
        this.gardenBlocks = new Map(); // Map prism -> GardenBlock

        this.update(prisms);
    }

    update(prisms) {
        // diff prisms
        const currentPrisms = new Set(prisms);

        // Remove old
        for (const [prism, block] of this.gardenBlocks) {
            if (!currentPrisms.has(prism)) {
                block.cleanup();
                this.remove(block);
                this.gardenBlocks.delete(prism);
            }
        }

        // Add new / Update existing
        prisms.forEach(prism => {
            if (!this.gardenBlocks.has(prism)) {
                // Spawn new
                const block = new GardenBlock(this.models.block, prism, this.blockSettings);
                // Parent to the prism so it moves with it? 
                // "The pieces are placed inside their target prism"
                // If we parent to the prism, local coords are easy.
                // BUT the prism might be invisible/wireframe.
                // The prompt says "spawned for any new prisms".
                // And "pieces are placed inside their target prism".
                // If I add 'block' to 'this' (GardenSystem), I need to copy world transforms.
                // If I add 'block' to 'prism', it inherits transforms.
                // Let's add to prism for simplicity, as implied by "inside".
                prism.add(block);
                this.gardenBlocks.set(prism, block);
            } else {
                // Update existing
                const block = this.gardenBlocks.get(prism);
                block.update();
            }
        });
    }

    cleanup() {
        for (const block of this.gardenBlocks.values()) {
            block.cleanup();
            if (block.parent) block.parent.remove(block);
        }
        this.gardenBlocks.clear();
    }
}
