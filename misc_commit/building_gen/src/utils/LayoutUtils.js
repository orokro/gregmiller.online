import * as THREE from 'three';

export function computeBlockRowLayout(
    targetFitObject, 
    targetFloorObject, 
    unitsPerBuilding, 
    settings
) {
    const box = new THREE.Box3().setFromObject(targetFitObject);
    const prismSize = new THREE.Vector3();
    box.getSize(prismSize);

    const floorBox = new THREE.Box3().setFromObject(targetFloorObject);
    const floorSize = new THREE.Vector3();
    floorBox.getSize(floorSize);

    const prismX = prismSize.x;
    const prismZ = prismSize.z;

    // 1. Calculate Scene Scale & Base Dimensions
    const buildingCount = Math.max(1, Math.round(prismZ / unitsPerBuilding));
    const baseLength = buildingCount * 2.0;
    const sceneScale = prismZ / baseLength;
    const unitLength = baseLength;
    const unitWidth = prismX / sceneScale;

    // 2. Measure Spaces
    const BCP_X = (box.min.x + box.max.x) / 2;
    const floorMinX = floorBox.min.x;
    const floorMaxX = floorBox.max.x;

    const leftSpace = BCP_X - floorMinX;
    const rightSpace = floorMaxX - BCP_X;

    const availableLeft = leftSpace - (prismX / 2);
    const availableRight = rightSpace - (prismX / 2);

    // 3. Base Widths (World Units)
    const blockBaseWidth = (3.28 * sceneScale);
    const unitBaseWidth = (6.56 * sceneScale);
    const roadBaseWidth = prismX; 

    // 4. Calculate Layout for a Side
    const calculateSide = (side) => {
        const availableSide = side === -1 ? availableLeft : availableRight;
        
        // Priority 1: Roads always appear (min width)
        let roadWidth = roadBaseWidth * settings.roadMinWidth;

        // Space remaining after min road
        let remaining = availableSide - roadWidth;
        let buildingWidth = 0;
        let useUnit = false;
        let spawnBuilding = false;

        // Priority 2: Grow Road to Max BEFORE buildings
        let maxRoadWidth = roadBaseWidth * settings.roadMaxWidth;
        if (remaining > 0) {
            let canGrow = maxRoadWidth - roadWidth;
            let grow = Math.min(remaining, canGrow);
            roadWidth += grow;
            remaining -= grow;
        }

        // Priority 3: Single Blocks
        if (remaining > 0.001) { 
            spawnBuilding = true;
            
            // Max Block Width
            let maxBlock = blockBaseWidth * settings.maxEdgeScale;
            
            // Priority 4: Grow Single Blocks to Max
            if (remaining < maxBlock) {
                useUnit = false;
                buildingWidth = Math.max(blockBaseWidth, remaining);
            } 
            else {
                // Remaining is more than max block.
                // Priority 5: Switch to Unit
                let maxUnit = unitBaseWidth * settings.maxEdgeScale;

                if (remaining >= unitBaseWidth) {
                    useUnit = true;
                    // Priority 6: Grow Unit to Max
                    buildingWidth = Math.min(remaining, maxUnit);
                } else {
                    // Can't fit base unit yet, stay as max block
                    useUnit = false;
                    buildingWidth = maxBlock;
                }
            }
        } else {
            spawnBuilding = false;
        }

        const roadCenter = prismX / 2 + roadWidth / 2;
        const buildingCenter = prismX / 2 + roadWidth + buildingWidth / 2;

        return {
            roadWidth,
            roadCenter,
            spawnBuilding,
            buildingWidth,
            useUnit,
            buildingCenter
        };
    };

    return {
        sceneScale,
        unitLength,
        unitWidth,
        prismX,
        prismZ,
        floorY: box.min.y,
        left: calculateSide(-1),
        right: calculateSide(1)
    };
}
