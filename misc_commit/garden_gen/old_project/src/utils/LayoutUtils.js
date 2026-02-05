import * as THREE from 'three';

export function computeBlockRowLayout(
    targetFitObject, 
    targetFloorObject, 
    unitsPerBuilding, 
    settings
) {
    // Measure target (Prism) in Local Space assuming unit box geometry
    const prismX = targetFitObject.scale.x;
    const prismY = targetFitObject.scale.y;
    const prismZ = targetFitObject.scale.z;

    // Measure Floor in Local Space
    // Assuming floor is plane (x, y scale = dimensions) or box
    const floorW = targetFloorObject.scale.x;
    const floorH = targetFloorObject.scale.y; // Plane geometry is X/Y, rotated -90 X means Y is Z.
    // Wait, BlockRow assumes floor is passed in.
    // If it's a plane geometry (1x1), scale.x is width, scale.y is height.
    // But BlockRow usually gets a floor where Z is length?
    // Let's rely on Box3 for floor if it's world aligned, but for Prism inside rotated City, we must use scale.
    // Actually, LayoutUtils takes objects. If they are in the same space, relative measures are fine.
    // But 'box.min.x' is world.
    
    // We need 'leftSpace' and 'rightSpace'.
    // Distance from Prism Center X to Floor Min X and Floor Max X.
    
    // Use local positions relative to parent (City)?
    // Assuming targetFitObject and targetFloorObject are siblings (children of City).
    const prismPos = targetFitObject.position;
    const floorPos = targetFloorObject.position;

    const floorMinX = floorPos.x - floorW / 2;
    const floorMaxX = floorPos.x + floorW / 2;
    const BCP_X = prismPos.x;

    const leftSpace = BCP_X - floorMinX;
    const rightSpace = floorMaxX - BCP_X;

    const availableLeft = leftSpace - (prismX / 2);
    const availableRight = rightSpace - (prismX / 2);

    // Floor Y (Level)
    // Prism is sitting on floor?
    // Prism Y position is center. Floor Y is surface?
    // In BlockRow, "centerUnit.position.y = box.min.y".
    // box.min.y is world.
    // Local min y = prismPos.y - prismY / 2.
    const floorY = prismPos.y - prismY / 2;

    // 1. Calculate Scene Scale & Base Dimensions
    const buildingCount = Math.max(1, Math.round(prismZ / unitsPerBuilding));
    const baseLength = buildingCount * 2.0;
    const sceneScale = prismZ / baseLength;
    const unitLength = baseLength;
    const unitWidth = prismX / sceneScale;

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
        floorY: floorY,
        left: calculateSide(-1),
        right: calculateSide(1)
    };
}
