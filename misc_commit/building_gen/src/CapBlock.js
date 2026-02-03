import * as THREE from 'three';
import Block from './Block.js';
import BlockUnit from './BlockUnit.js';
import { computeBlockRowLayout } from './utils/LayoutUtils.js';

export default class CapBlock extends THREE.Object3D {
    constructor(floorPlane, neighborPrism, side, unitsPerBuilding, buildingModel, seed, buildingConfig = {}, capConfig = {}) {
        super();
        this.floorPlane = floorPlane;
        this.neighborPrism = neighborPrism;
        this.side = side; // "top" or "bottom"
        this.unitsPerBuilding = unitsPerBuilding;
        this.buildingModel = buildingModel;
        this.seed = seed;
        this.buildingConfig = buildingConfig;
        this.capConfig = {
            maxCapScale: 1.5,
            ...capConfig
        };

        this.spacing = 5.0; // Default spacing from side road
        this.block = null;
        
        this.init();
    }

    init() {
        this.update();
    }

    setSpacing(val) {
        this.spacing = val;
        this.update();
    }
    
    setUnitsPerBuilding(val) {
        this.unitsPerBuilding = val;
        this.update();
    }

    update() {
        if (this.block) {
            this.remove(this.block);
            this.block = null;
        }

        // 1. Get Layout Stats from Neighbor
        // We use the same row settings as the grid for width consistency
        // But we might not have access to the exact row settings object here unless passed.
        // For now, let's assume default or passed in settings.
        // Actually, we need to know the Total Grid Width.
        // computeBlockRowLayout returns 'left' and 'right' data.
        
        // We need the Row Settings to accurately measure width.
        // Let's assume passed in capConfig includes row-like settings or we pass rowConfig separately.
        // For simplicity, I'll assume capConfig has what we need or defaults.
        
        const layout = computeBlockRowLayout(
            this.neighborPrism,
            this.floorPlane,
            this.unitsPerBuilding,
            this.capConfig // potentially missing road settings here if not careful
        );

        // Calculate Total Width
        // Left Building Center + Width/2 + Right Building Center + Width/2
        // Center is 0. 
        // Left Edge = - (left.buildingCenter + left.buildingWidth/2)
        // Right Edge = (right.buildingCenter + right.buildingWidth/2)
        
        // But wait, if spawnBuilding is false, the edge is the road edge.
        const getEdge = (sideData) => {
            if (sideData.spawnBuilding) {
                return sideData.buildingCenter + sideData.buildingWidth / 2;
            } else {
                return sideData.roadCenter + sideData.roadWidth / 2;
            }
        };

        const leftEdge = getEdge(layout.left);
        const rightEdge = getEdge(layout.right);
        const totalWidth = leftEdge + rightEdge;
        
        // 2. Measure Available Depth (Z)
        const floorBox = new THREE.Box3().setFromObject(this.floorPlane);
        const prismBox = new THREE.Box3().setFromObject(this.neighborPrism);
        
        // Base Z position is the edge of the side road.
        // Top Side Road is at: PrismTop - Spacing/2 - SpacingWidth(aka Spacing)/2 ?
        // No, SideRoad logic:
        // Top Road Z = Prism0 Z - Prism0 HalfHeight - Spacing/2.
        // Its height (Z-scale) is Spacing.
        // So Top Edge of Side Road = RoadZ - Spacing/2 = Prism0 Z - Prism0 HalfHeight - Spacing.
        
        // Bottom Road Z = PrismLast Z + HalfHeight + Spacing/2
        // Bottom Edge of Side Road = RoadZ + Spacing/2 = PrismLast Z + HalfHeight + Spacing.
        
        let startZ;
        let availableDepth;
        let isTop = this.side === "top";

        if (isTop) {
            const prismTopEdge = prismBox.min.z; // -Z is top in visual terms usually? 
            // Wait, coordinate system. 
            // Usually Camera is at +Z looking at -Z? No, standard is Camera +Z looking 0.
            // "Top" usually implies -Z in 2D map terms, or +Z?
            // "buildings facing downward along the top (above the topmost side road)"
            // "buildings facing up (below the bottom most side row"
            
            // "Above" usually means -Z in 3D top-down view.
            // "Below" usually means +Z.
            
            const sideRoadEdge = prismBox.min.z - this.spacing;
            startZ = sideRoadEdge;
            const floorEdge = floorBox.min.z;
            availableDepth = startZ - floorEdge; // Positive distance
        } else {
            const sideRoadEdge = prismBox.max.z + this.spacing;
            startZ = sideRoadEdge;
            const floorEdge = floorBox.max.z;
            availableDepth = floorEdge - startZ;
        }

        // 3. Determine Block Type & Scale
        // Base logic:
        // Always present (Block).
        // If enough space, Swap to Unit.
        
        const sceneScale = layout.sceneScale;
        const blockBaseDepth = 3.28 * sceneScale; // Approx depth of single building
        const unitBaseDepth = 6.56 * sceneScale; // Approx depth of back-to-back unit

        // Default: Single Block
        let useUnit = false;
        let depth = blockBaseDepth;

        // "Swap it out for a BlockUnit if there's enough space"
        // And "semi responsive... scaling".
        // Let's say if available > unitBaseDepth, we switch.
        
        if (availableDepth > unitBaseDepth) {
            useUnit = true;
            // Max grow?
            let maxDepth = unitBaseDepth * this.capConfig.maxCapScale;
            depth = Math.min(availableDepth, maxDepth);
        } else {
             // Grow Block?
             let maxDepth = blockBaseDepth * this.capConfig.maxCapScale;
             // Ensure it's at least base depth? Prompt: "Always be present... but semi responsive"
             // If available space is tiny, we might clip or shrink.
             // "Always be present regardless of the floor plane size" -> implies min size is enforced even if overlapping floor?
             // Or maybe it just sticks out.
             
             // Let's clamp min to base.
             depth = Math.max(blockBaseDepth, Math.min(availableDepth, maxDepth));
             
             // Actually, if availableDepth is huge but less than unitBase, we grow block?
             // Yes.
        }

        // 4. Create Object
        const name = `Cap_${this.side}_${this.seed}`;
        
        if (useUnit) {
            this.block = new BlockUnit(
                name,
                this.buildingModel,
                true, // Tall ON? "swap it out for a BlockUnit... scaling used elsewhere"
                totalWidth / sceneScale, // Length (World -> Local)
                depth / sceneScale, // Width (World -> Local)
                this.buildingConfig
            );
        } else {
            this.block = new Block(
                name,
                this.buildingModel,
                true, // Tall ON
                totalWidth / sceneScale, // Block Size (Length)
                this.buildingConfig
            );
            // Block depth is usually fixed to 3.28 in local (1.0 scale).
            // We need to scale Z to match calculated 'depth'.
            // Default depth at scale 1 is ~3.28.
            // Target world depth is 'depth'.
            // Local depth target = depth / sceneScale.
            // Scale factor = (depth / sceneScale) / 3.28.
            const zScale = (depth / sceneScale) / 3.28;
            this.block.scale.z = zScale;
        }

        this.block.scale.x = sceneScale;
        this.block.scale.y = sceneScale;
        if (useUnit) this.block.scale.z = sceneScale; // BlockUnit handles its own Z sizing via constructor params, just apply scene scale

        // 5. Rotation & Position
        // Top (Above): Facing Down (+Z). 
        // Bottom (Below): Facing Up (-Z).
        
        // Standard Block faces +Z?
        // Block: "buildings facing downward" -> Front faces +Z.
        // BlockUnit: Double sided.
        
        if (isTop) {
            // Top: Should sit just above the side road.
            // Position is Center of the Block.
            // Edge is startZ.
            // Center = startZ - depth/2.
            const zPos = startZ - (depth / 2);
            
            this.block.position.set(0, layout.floorY, zPos);
            
            // Rotation:
            // "facing downward" -> +Z.
            // Default Block might face +Z?
            // Let's assume default rotation 0 faces +Z.
            this.block.rotation.y = 0;
            
        } else {
            // Bottom: Sit just below side road.
            // Center = startZ + depth/2.
            const zPos = startZ + (depth / 2);
             this.block.position.set(0, layout.floorY, zPos);
             
             // Rotation:
             // "facing up" -> -Z.
             this.block.rotation.y = Math.PI; 
        }

        this.add(this.block);
    }
}
