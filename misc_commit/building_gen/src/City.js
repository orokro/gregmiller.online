import * as THREE from 'three';
import CityGrid from './CityGrid.js';

export default class City extends THREE.Object3D {
    constructor(seed, buildingModel, signalAsset, streetLightAsset, mtlRoad, mtlRoadIntersection, mtlRoadSide, floorPlane, prisms, unitsPerBuilding, rowConfig, buildingConfig) {
        super();
        
        // 1. Rotate City to align internal Y-up with external Z-up
        // Rx(90): (x, y, z) -> (x, -z, y)
        // Local X = Global X
        // Local Y = Global Z (Up -> Up)
        // Local Z = Global -Y (Depth -> -Depth)
        this.rotation.x = Math.PI / 2;

        this.inputFloor = floorPlane;
        this.inputPrisms = prisms || [];
        
        // 2. Create Shadow Objects
        this.shadowFloor = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
        this.shadowPrisms = [];
        this.shadowPrismMap = new Map(); // inputPrism -> shadowPrism

        // 3. Create CityGrid
        this.cityGrid = new CityGrid(
            seed,
            buildingModel,
            signalAsset,
            streetLightAsset,
            mtlRoad,
            mtlRoadIntersection,
            mtlRoadSide,
            this.shadowFloor,
            this.shadowPrisms,
            unitsPerBuilding,
            rowConfig,
            buildingConfig
        );
        this.add(this.cityGrid);

        this.update(this.inputPrisms);
    }

    update(prisms) {
        this.inputPrisms = prisms || this.inputPrisms;

        // 1. Sync Floor
        this.syncShadowObject(this.inputFloor, this.shadowFloor);

        // 2. Sync Prisms
        const newShadowPrisms = [];
        const keptInputPrisms = new Set(this.inputPrisms);

        this.inputPrisms.forEach(realPrism => {
            let shadow = this.shadowPrismMap.get(realPrism);
            if (!shadow) {
                shadow = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ visible: false }));
                this.shadowPrismMap.set(realPrism, shadow);
            }
            this.syncShadowObject(realPrism, shadow);
            newShadowPrisms.push(shadow);
        });

        // Reverse to match CityGrid's Low-Z -> High-Z expectation
        // (Input is Low-Y -> High-Y, which maps to High-Z -> Low-Z)
        newShadowPrisms.reverse();

        // Cleanup
        this.shadowPrismMap.forEach((shadow, real) => {
            if (!keptInputPrisms.has(real)) {
                this.shadowPrismMap.delete(real);
            }
        });

        this.shadowPrisms = newShadowPrisms;

        // 3. Update Grid
        let listChanged = false;
        if (this.cityGrid.prisms.length !== this.shadowPrisms.length) {
            listChanged = true;
        } else {
            for (let i = 0; i < this.shadowPrisms.length; i++) {
                if (this.cityGrid.prisms[i] !== this.shadowPrisms[i]) {
                    listChanged = true;
                    break;
                }
            }
        }

        if (listChanged) {
            this.cityGrid.setPrisms(this.shadowPrisms);
        } else {
            this.cityGrid.update();
        }
    }

    syncShadowObject(real, shadow) {
        // Map Z-up Left-Handed (Prod) to Y-up Right-Handed (Gen) inside rotated container.
        // City rotation: Rx(90).
        // Global coords (x, y, z) map to Local (x, z, -y).
        
        // Position Mapping:
        // Local X = Global X
        // Local Y = Global Z (Up)
        // Local Z = -Global Y (Depth)
        
        shadow.position.set(
            real.position.x,
            real.position.z, 
            -real.position.y
        );
        
        // Scale Mapping:
        // Local X = Global X
        // Local Y = Global Z (Height)
        // Local Z = Global Y (Depth/Length)
        
        shadow.scale.set(
            real.scale.x,
            real.scale.z,
            real.scale.y
        );
        
        // Rotation Mapping?
        // If Prism is rotated around Z (Up), it corresponds to Local Y.
        // If Prism is rotated around Y (Depth), it corresponds to Local Z.
        // shadow.rotation.set(real.rotation.x, real.rotation.z, -real.rotation.y);
        // For simple prisms (boxes), scale handles dimensions, rotation usually 0.
        // Leaving rotation copy out unless requested, as simple AABB logic is safer for grid.
    }
}