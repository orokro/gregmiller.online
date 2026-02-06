import * as THREE from 'three';
import { GardenBlock } from './GardenBlock.js';
import { GardenScatter } from './GardenScatter.js';

export class GardenSystem extends THREE.Object3D {
    constructor(models, bgPlane, prisms, gardenSettings, blockSettings) {
        super();
        this.models = models;
        this.bgPlane = bgPlane;
        this.gardenSettings = gardenSettings || {};
        this.blockSettings = blockSettings || {};
        
        this.gardenBlocks = new Map(); // Map prism -> GardenBlock
        
        this.scatterers = {
            snails: null,
            flowers: null,
            leaves: null
        };

        this.update(prisms);
    }

    update(prisms) {
        // 1. Update Blocks
        const currentPrisms = new Set(prisms);

        // Remove old blocks
        for (const [prism, block] of this.gardenBlocks) {
            if (!currentPrisms.has(prism)) {
                block.cleanup();
                if (block.parent) block.parent.remove(block);
                this.gardenBlocks.delete(prism);
            }
        }

        // Add or Update blocks
        prisms.forEach(prism => {
            if (!this.gardenBlocks.has(prism)) {
                const block = new GardenBlock(this.models.block, prism, this.blockSettings);
                prism.add(block);
                this.gardenBlocks.set(prism, block);
            } else {
                const block = this.gardenBlocks.get(prism);
                block.settings = this.blockSettings; // Pass latest settings
                block.update();
            }
        });

        // 2. Update Scatterers
        this.updateScatter('snails', this.models.snail, this.gardenSettings.snails, prisms);
        this.updateScatter('flowers', this.models.sunflower, this.gardenSettings.flowers, prisms);
        this.updateScatter('leaves', this.models.leaves, this.gardenSettings.leaves, prisms);
    }

    updateScatter(key, model, settings, prisms) {
        if (!settings || !model || settings.density <= 0) {
            if (this.scatterers[key]) {
                this.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
            return;
        }

        if (!this.scatterers[key]) {
            this.scatterers[key] = new GardenScatter(model, this.bgPlane, prisms, settings);
            this.add(this.scatterers[key]);
        } else {
            // Check if settings or prisms changed significantly to warrant regen
            // For now, always update when called (since it's UI driven)
            this.scatterers[key].update(prisms, settings);
        }
    }

    cleanup() {
        for (const block of this.gardenBlocks.values()) {
            block.cleanup();
            if (block.parent) block.parent.remove(block);
        }
        this.gardenBlocks.clear();

        Object.keys(this.scatterers).forEach(key => {
            if (this.scatterers[key]) {
                this.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
        });
    }
}