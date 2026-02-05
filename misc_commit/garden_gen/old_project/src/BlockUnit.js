import * as THREE from 'three';
import Block from './Block.js';

export default class BlockUnit extends THREE.Object3D {
    constructor(seed, cityModel, tallBlock, length, width, buildingSettings = {}) {
        super();
        this.seed = seed.toString();
        this.cityModel = cityModel;
        this.tallBlock = tallBlock;
        this.length = length;
        this.width = width;
        this.buildingSettings = buildingSettings;

        this.blockLeft = null;
        this.blockRight = null;

        this.generate();
    }

    generate() {
        if (this.blockLeft) this.remove(this.blockLeft);
        if (this.blockRight) this.remove(this.blockRight);

        // Create two blocks
        // Left block
        this.blockLeft = new Block(
            this.seed + "_left",
            this.cityModel,
            this.tallBlock,
            this.length,
            this.buildingSettings
        );
        
        // Right block
        this.blockRight = new Block(
            this.seed + "_right",
            this.cityModel,
            this.tallBlock,
            this.length,
            this.buildingSettings
        );

        // Rotate right block 180 degrees to be back-to-back
        this.blockRight.rotation.y = Math.PI;

        this.add(this.blockLeft);
        this.add(this.blockRight);

        this.updateDimensions();
    }

    setLength(newLength) {
        this.length = Math.max(0.5, newLength);
        this.blockLeft.setBlockSize(this.length);
        this.blockRight.setBlockSize(this.length);
    }

    setWidth(newWidth) {
        this.width = Math.max(0.5, newWidth);
        this.updateDimensions();
    }

    updateDimensions() {
        // Default depth of a building is approx 3.28 units according to prompt
        const defaultDepth = 3.28;
        // Each block takes half the total width
        const targetDepth = this.width / 2;
        const depthScale = targetDepth / defaultDepth;

        // Scale on Z (assuming Z is depth axis)
        this.blockLeft.scale.z = depthScale;
        this.blockRight.scale.z = depthScale;
        
        // They are already back-to-back at z=0 if the origin is at the back-center
    }
}
