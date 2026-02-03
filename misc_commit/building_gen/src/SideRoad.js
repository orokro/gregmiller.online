import * as THREE from 'three';
import { computeBlockRowLayout } from './utils/LayoutUtils.js';

export default class SideRoad extends THREE.Object3D {
    constructor(floorPlane, neighborPrism, mtlRoadIntersection, mtlRoadSide, unitsPerBuilding, rowConfig = {}) {
        super();
        this.floorPlane = floorPlane;
        this.neighborPrism = neighborPrism;
        this.mtlRoadIntersection = mtlRoadIntersection;
        this.mtlRoadSide = mtlRoadSide;
        this.unitsPerBuilding = unitsPerBuilding;
        this.rowConfig = {
            roadMinWidth: 1.0,
            roadMaxWidth: 1.5,
            maxEdgeScale: 1.5,
            ...rowConfig
        };

        this.spacing = 0; // Will be set via setSpacing
        
        // Parts
        this.leftRoad = null;
        this.leftIntersection = null;
        this.centerRoad = null;
        this.rightIntersection = null;
        this.rightRoad = null;

        this.init();
    }

    init() {
        const createPlane = (mat) => {
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat.clone());
            mesh.rotation.x = -Math.PI / 2;
            this.add(mesh);
            return mesh;
        };

        this.leftRoad = createPlane(this.mtlRoadSide);
        this.leftIntersection = createPlane(this.mtlRoadIntersection);
        this.centerRoad = createPlane(this.mtlRoadSide);
        this.rightIntersection = createPlane(this.mtlRoadIntersection);
        this.rightRoad = createPlane(this.mtlRoadSide);
    }

    setSpacing(spacing) {
        this.spacing = spacing;
        this.update();
    }

    update() {
        if (!this.spacing || this.spacing <= 0) {
            this.visible = false;
            return;
        }
        this.visible = true;

        // Use the utility to "dry run" the layout of the neighbor block row
        // We only care about the dimensions it calculates for roads/buildings
        const layout = computeBlockRowLayout(
            this.neighborPrism,
            this.floorPlane,
            this.unitsPerBuilding,
            this.rowConfig
        );

        const y = layout.floorY;
        const zScale = this.spacing;

        // Center Road (Between the two Block Rows main units)
        // Matches the Prism Width (layout.prismX)
        // Actually, the prompt says "middle side road... shared width with central prism BlockUnit"
        // The central unit width is layout.prismX / layout.sceneScale (Local) -> layout.prismX (World)
        
        // Wait, "BlockUnit ... scales on Z axis to fit requested depth". 
        // The Center BlockUnit in BlockRow has width = prismX / sceneScale.
        // It's scaled by sceneScale. So world width is prismX.
        // Yes, so center road width is prismX.

        this.centerRoad.scale.set(layout.prismX, zScale, 1);
        this.centerRoad.position.set(0, y, 0);
        if (this.centerRoad.material.map) {
            this.centerRoad.material.map.repeat.set(layout.prismX / 5, 1); // Repeat on X
        }

        // Left Side
        // "Left-most side-road... share same width as left-side Block/BlockUnit"
        // "Left intersection... same width as left-street" (which is the main vertical street)
        
        // From BlockRow layout logic:
        // The vertical road is at layout.left.roadCenter with width layout.left.roadWidth
        // The vertical building is at layout.left.buildingCenter with width layout.left.buildingWidth
        
        // Prompt interpretation:
        // "Left Side Road": Runs horizontally in the gap. 
        // "Share same width as left-side Block and/or BlockUnit".
        // This implies the horizontal road segment covers the width of the vertical building row.
        
        // "Intersection plane spawned above the left street".
        // The left street is the vertical road. So intersection is where horizontal gap meets vertical road.
        
        // So:
        // 1. Intersection at (left.roadCenter, z=0 (local)) size (left.roadWidth, spacing)
        // 2. Side Road at (left.buildingCenter, z=0) size (left.buildingWidth, spacing)
        
        // Apply Left Intersection
        this.leftIntersection.visible = true;
        this.leftIntersection.scale.set(layout.left.roadWidth, zScale, 1);
        this.leftIntersection.position.set(-layout.left.roadCenter, y, 0); // Side -1
        // No repeating uvs for intersection

        // Apply Left Road (Side Segment)
        if (layout.left.spawnBuilding) {
            this.leftRoad.visible = true;
            this.leftRoad.scale.set(layout.left.buildingWidth, zScale, 1);
            this.leftRoad.position.set(-layout.left.buildingCenter, y, 0); // Side -1
             if (this.leftRoad.material.map) {
                this.leftRoad.material.map.repeat.set(layout.left.buildingWidth / 5, 1);
            }
        } else {
            this.leftRoad.visible = false;
        }

        // Right Side
        // Same logic mirrored
        this.rightIntersection.visible = true;
        this.rightIntersection.scale.set(layout.right.roadWidth, zScale, 1);
        this.rightIntersection.position.set(layout.right.roadCenter, y, 0); // Side 1

        if (layout.right.spawnBuilding) {
            this.rightRoad.visible = true;
            this.rightRoad.scale.set(layout.right.buildingWidth, zScale, 1);
            this.rightRoad.position.set(layout.right.buildingCenter, y, 0); // Side 1
            if (this.rightRoad.material.map) {
                this.rightRoad.material.map.repeat.set(layout.right.buildingWidth / 5, 1);
            }
        } else {
            this.rightRoad.visible = false;
        }
    }
}
