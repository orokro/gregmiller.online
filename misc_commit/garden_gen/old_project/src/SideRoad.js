import * as THREE from 'three';
import { computeBlockRowLayout } from './utils/LayoutUtils.js';

export default class SideRoad extends THREE.Object3D {
    constructor(floorPlane, neighborPrism, mtlRoadIntersection, mtlRoadSide, unitsPerBuilding, signalAsset, streetLightAsset, rowConfig = {}) {
        super();
        this.floorPlane = floorPlane;
        this.neighborPrism = neighborPrism;
        this.mtlRoadIntersection = mtlRoadIntersection;
        this.mtlRoadSide = mtlRoadSide;
        this.unitsPerBuilding = unitsPerBuilding;
        this.signalAsset = signalAsset;
        this.streetLightAsset = streetLightAsset;
        this.rowConfig = {
            roadMinWidth: 1.0,
            roadMaxWidth: 1.5,
            maxEdgeScale: 1.5,
            street_light_spacing: 5.0,
            ...rowConfig
        };

        this.spacing = 0; // Will be set via setSpacing
        
        // Parts
        this.leftRoad = null;
        this.leftIntersection = null;
        this.centerRoad = null;
        this.rightIntersection = null;
        this.rightRoad = null;

        this.props = new THREE.Group();
        this.add(this.props);

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
        // Clean up props
        while(this.props.children.length > 0) {
            this.props.remove(this.props.children[0]);
        }

        if (!this.spacing || this.spacing <= 0) {
            this.visible = false;
            return;
        }
        this.visible = true;

        // Use the utility to "dry run" the layout of the neighbor block row
        const layout = computeBlockRowLayout(
            this.neighborPrism,
            this.floorPlane,
            this.unitsPerBuilding,
            this.rowConfig
        );

        const y = layout.floorY;
        const zScale = this.spacing;
        const halfSpacing = zScale / 2;

        // Center Road
        this.centerRoad.scale.set(layout.prismX, zScale, 1);
        this.centerRoad.position.set(0, y, 0);
        if (this.centerRoad.material.map) {
            this.centerRoad.material.map.repeat.set(layout.prismX / 5, 1); 
        }

        // Left Side
        this.leftIntersection.visible = true;
        this.leftIntersection.scale.set(layout.left.roadWidth, zScale, 1);
        this.leftIntersection.position.set(-layout.left.roadCenter, y, 0); 

        if (layout.left.spawnBuilding) {
            this.leftRoad.visible = true;
            this.leftRoad.scale.set(layout.left.buildingWidth, zScale, 1);
            this.leftRoad.position.set(-layout.left.buildingCenter, y, 0); 
             if (this.leftRoad.material.map) {
                this.leftRoad.material.map.repeat.set(layout.left.buildingWidth / 5, 1);
            }
        } else {
            this.leftRoad.visible = false;
        }

        // Right Side
        this.rightIntersection.visible = true;
        this.rightIntersection.scale.set(layout.right.roadWidth, zScale, 1);
        this.rightIntersection.position.set(layout.right.roadCenter, y, 0); 

        if (layout.right.spawnBuilding) {
            this.rightRoad.visible = true;
            this.rightRoad.scale.set(layout.right.buildingWidth, zScale, 1);
            this.rightRoad.position.set(layout.right.buildingCenter, y, 0); 
            if (this.rightRoad.material.map) {
                this.rightRoad.material.map.repeat.set(layout.right.buildingWidth / 5, 1);
            }
        } else {
            this.rightRoad.visible = false;
        }

        this.updateProps(layout, zScale);
    }

    updateProps(layout, spacing) {
        if (this.signalAsset) {
            this.spawnSignals(-layout.left.roadCenter, layout.left.roadWidth, spacing, layout.floorY);
            this.spawnSignals(layout.right.roadCenter, layout.right.roadWidth, spacing, layout.floorY);
        }

        if (this.streetLightAsset) {
            // Left segment
            if (layout.left.spawnBuilding) {
                this.spawnStreetLights(-layout.left.buildingCenter, layout.left.buildingWidth, spacing, layout.floorY, layout.sceneScale);
            }
            // Center segment
            this.spawnStreetLights(0, layout.prismX, spacing, layout.floorY, layout.sceneScale);
            // Right segment
            if (layout.right.spawnBuilding) {
                this.spawnStreetLights(layout.right.buildingCenter, layout.right.buildingWidth, spacing, layout.floorY, layout.sceneScale);
            }
        }
    }

    spawnSignals(xCenter, width, spacing, y) {
        const halfW = width / 2;
        const halfS = spacing / 2;

        // Top-Left
        const s1 = this.signalAsset.scene.clone();
        s1.position.set(xCenter - halfW, y, -halfS);
        this.props.add(s1);

        // Bottom-Right
        const s2 = this.signalAsset.scene.clone();
        s2.position.set(xCenter + halfW, y, halfS);
        s2.rotation.y = Math.PI;
        this.props.add(s2);
    }

    spawnStreetLights(xCenter, width, spacing, y, sceneScale) {
        const lightSpacing = this.rowConfig.street_light_spacing;
        const count = Math.floor(width / lightSpacing);
        const startX = -width / 2 + (width % lightSpacing) / 2;
        const halfS = spacing / 2;

        for (let i = 0; i <= count; i++) {
            const lx = startX + i * lightSpacing;
            const light = this.streetLightAsset.scene.clone();
            
            // Alternate top/bottom
            const isTop = (i % 2 === 0);
            const zOffset = halfS * (isTop ? -1 : 1);
            
            light.position.set(xCenter + lx, y, zOffset);
            
            // Top: 270 (3PI/2), Bottom: 90 (PI/2)
            if (isTop) {
                light.rotation.y = Math.PI * 1.5;
            } else {
                light.rotation.y = Math.PI / 2;
            }

            light.scale.set(sceneScale, sceneScale, sceneScale);
            this.props.add(light);
        }
    }
}
