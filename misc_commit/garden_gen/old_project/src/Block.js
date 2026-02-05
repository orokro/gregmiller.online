import * as THREE from 'three';
import Building from './Building.js';
import PRNG from './utils/PRNG.js';

export default class Block extends THREE.Object3D {
    constructor(seed, cityModel, tallBlock, blockSize, buildingSettings = {}) {
        super();
        this.seed = seed.toString();
        this.cityModel = cityModel;
        this.tallBlock = tallBlock;
        this.blockSize = blockSize;
        this.buildingSettings = buildingSettings;
        
        this.buildings = [];
        this.generate();
    }

    generate() {
        // Clear existing buildings
        this.clearBuildings();
        this.updateLayout();
    }

    clearBuildings() {
        this.buildings.forEach(b => b.removeFromParent());
        this.buildings = [];
    }

    setBlockSize(newSize) {
        this.blockSize = Math.max(0.5, newSize);
        this.updateLayout();
    }

    updateLayout() {
        // 1. Calculate how many buildings to spawn
        const baseWidth = 2.0;
        const rawCount = this.blockSize / baseWidth;
        const floorCount = Math.floor(rawCount);
        const remainder = this.blockSize % baseWidth;
        
        let buildingCount;
        let totalScaleAdjustment; // How much width we need to add or remove in units

        if (remainder > 1.0) {
            // Case: extra space is more than half a building, add one and shrink
            buildingCount = floorCount + 1;
            // We need to SHRINK the buildings to fit
            // currentWidth = buildingCount * 2.0;
            // targetWidth = this.blockSize;
            // adjustment = targetWidth - currentWidth; (will be negative)
            totalScaleAdjustment = this.blockSize - (buildingCount * baseWidth);
        } else {
            // Case: extra space is small, keep current and expand
            buildingCount = Math.max(1, floorCount);
            // adjustment = targetWidth - currentWidth; (will be positive)
            totalScaleAdjustment = this.blockSize - (buildingCount * baseWidth);
        }

        // 2. Synchronize building instances
        // If we have too many, remove them
        while (this.buildings.length > buildingCount) {
            const b = this.buildings.pop();
            b.removeFromParent();
        }

        // If we have too few, add them
        while (this.buildings.length < buildingCount) {
            const index = this.buildings.length;
            const bSeed = this.seed + "_b" + index;
            
            // Mix settings
            const settings = { ...this.buildingSettings };
            if (this.tallBlock !== undefined) {
                settings.tall_items = this.tallBlock;
            }

            const building = new Building(this.cityModel, settings, bSeed);
            this.add(building);
            this.buildings.push(building);
        }

        // 3. Determine which buildings to scale and by how much
        // Reset block-level PRNG for layout stability
        const layoutPrng = new PRNG(this.seed + "_layout_" + buildingCount);
        
        // Default scale for everyone is 1.0 (2 units)
        const scales = new Array(buildingCount).fill(1.0);

        if (buildingCount === 1) {
            // Just scale the one building
            scales[0] = this.blockSize / baseWidth;
        } else if (buildingCount === 2) {
            // Scale both
            const r1 = layoutPrng.random();
            const r2 = layoutPrng.random();
            const sum = r1 + r2;
            const share1 = r1 / sum;
            const share2 = r2 / sum;
            
            // totalAdjustment in units. 1 unit of adjustment = 0.5 of scale factor for one building
            scales[0] += (totalScaleAdjustment * share1) / baseWidth;
            scales[1] += (totalScaleAdjustment * share2) / baseWidth;
        } else {
            // 3 or more buildings. Pick 2 or 3 to scale.
            const numToScale = layoutPrng.pick([2, 3]);
            const indices = [];
            while (indices.length < numToScale) {
                const idx = Math.floor(layoutPrng.range(0, buildingCount));
                if (!indices.includes(idx)) indices.push(idx);
            }

            // Distribute the adjustment among picked indices
            const shares = indices.map(() => layoutPrng.random());
            const shareSum = shares.reduce((a, b) => a + b, 0);
            
            indices.forEach((idx, i) => {
                const share = shares[i] / shareSum;
                scales[idx] += (totalScaleAdjustment * share) / baseWidth;
            });
        }

        // 4. Apply transforms and layout
        let currentX = 0;
        for (let i = 0; i < buildingCount; i++) {
            const b = this.buildings[i];
            const scaleX = scales[i];
            const width = baseWidth * scaleX;
            
            b.scale.x = scaleX;
            // Center of building is at currentX + half width
            b.position.x = currentX + (width / 2);
            currentX += width;
        }

        // Center the whole block around its local origin if desired, 
        // or just keep it starting from 0. The prompt suggests "everything should be centered in the orbit camera".
        // Let's offset the children so the block is centered at 0.
        const offset = this.blockSize / 2;
        for (let i = 0; i < buildingCount; i++) {
            this.buildings[i].position.x -= offset;
        }
    }
}
