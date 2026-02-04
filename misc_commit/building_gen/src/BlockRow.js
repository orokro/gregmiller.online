import * as THREE from 'three';
import Block from './Block.js';
import BlockUnit from './BlockUnit.js';
import { computeBlockRowLayout } from './utils/LayoutUtils.js';

export default class BlockRow extends THREE.Object3D {
    constructor(targetFitObject, targetFloorObject, unitsPerBuilding, roadMaterial, streetLightAsset, seed, cityModel, settings = {}, buildingSettings = {}) {
        super();
        this.targetFitObject = targetFitObject;
        this.targetFloorObject = targetFloorObject;
        this.unitsPerBuilding = unitsPerBuilding;
        this.roadMaterial = roadMaterial;
        this.streetLightAsset = streetLightAsset;
        this.seed = seed.toString();
        this.cityModel = cityModel;
        this.settings = {
            roadMinWidth: 1.0,
            roadMaxWidth: 1.5,
            maxEdgeScale: 1.5,
            street_light_spacing: 5.0,
            ...settings
        };
        this.buildingSettings = buildingSettings;

        // Container for components
        this.centerUnit = null;
        this.roads = []; // { mesh, side }
        this.edgeItems = []; // { object, side, isUnit }
        this.streetLights = new THREE.Group();
        this.add(this.streetLights);

        this.sceneScale = 1.0;
        this.unitLength = 0;
        this.unitWidth = 0;

        this.init();
    }

    init() {
        const box = new THREE.Box3().setFromObject(this.targetFitObject);
        const size = new THREE.Vector3();
        box.getSize(size);
        const prismX = size.x;
        const prismZ = size.z;

        // 1. Calculate Scene Scale
        const buildingCount = Math.max(1, Math.round(prismZ / this.unitsPerBuilding));
        const baseLength = buildingCount * 2.0;
        this.sceneScale = prismZ / baseLength;

        // 2. Base Dimensions
        this.unitLength = baseLength;
        this.unitWidth = prismX / this.sceneScale;

        // 3. Center Unit (Tall OFF)
        this.centerUnit = new BlockUnit(
            this.seed + "_center",
            this.cityModel,
            false, // Tall OFF
            this.unitLength,
            this.unitWidth,
            this.buildingSettings
        );

        this.centerUnit.rotation.y = Math.PI / 2;
        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
        this.add(this.centerUnit);
        this.centerUnit.position.y = box.min.y;

        // 4. Roads
        this.createRoads();

        this.updateLayout();
    }

    createRoads() {
        for (let i = 0; i < 2; i++) {
            const geom = new THREE.PlaneGeometry(1, 1);
            const mesh = new THREE.Mesh(geom, this.roadMaterial.clone());
            mesh.rotation.x = -Math.PI / 2; 
            this.add(mesh);
            this.roads.push({ mesh, side: i === 0 ? -1 : 1 });
        }
    }

    updateLayout() {
        if (!this.centerUnit) return;

        const layout = computeBlockRowLayout(
            this.targetFitObject,
            this.targetFloorObject,
            this.unitsPerBuilding,
            this.settings
        );

        this.sceneScale = layout.sceneScale;
        this.unitLength = layout.unitLength;
        this.unitWidth = layout.unitWidth;

        // Update Center Unit
        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
        this.centerUnit.setLength(this.unitLength);
        this.centerUnit.setWidth(this.unitWidth);
        this.centerUnit.position.y = layout.floorY;

        // Helper for updates
        const updateSide = (side, data) => {
            const roadObj = this.roads.find(r => r.side === side);
            
            // Update Road
            roadObj.mesh.visible = true;
            roadObj.mesh.scale.set(data.roadWidth, layout.prismZ, 1);
            if (roadObj.mesh.material.map) {
                roadObj.mesh.material.map.repeat.set(1, layout.prismZ / data.roadWidth);
            }
            roadObj.mesh.position.set(side * data.roadCenter, layout.floorY, 0);

            // Update Building
            if (data.spawnBuilding) {
                this.updateEdgeObject(side, data.useUnit, data.buildingWidth, layout.prismZ, layout.floorY, data.buildingCenter);
            } else {
                const edge = this.edgeItems.find(e => e.side === side);
                if (edge) edge.object.visible = false;
            }
        };

        updateSide(-1, layout.left);
        updateSide(1, layout.right);

        this.updateStreetLights(layout);
    }

    updateStreetLights(layout) {
        // Clean up
        while(this.streetLights.children.length > 0) {
            this.streetLights.remove(this.streetLights.children[0]);
        }

        if (!this.streetLightAsset) return;

        const spacing = this.settings.street_light_spacing;
        const halfPrismZ = layout.prismZ / 2;

        const spawnLightsForRoad = (side, data) => {
            const roadWidth = data.roadWidth;
            const roadCenter = side * data.roadCenter;
            
            // We want to space along Z from -halfPrismZ to +halfPrismZ
            const count = Math.floor(layout.prismZ / spacing);
            const startZ = -halfPrismZ + (layout.prismZ % spacing) / 2;

            for (let i = 0; i <= count; i++) {
                const z = startZ + i * spacing;
                const light = this.streetLightAsset.scene.clone();
                
                // Alternate sides of the street
                const onRightOfStreet = (i % 2 === 0);
                const xOffset = (roadWidth / 2) * (onRightOfStreet ? 1 : -1);
                
                light.position.set(roadCenter + xOffset, layout.floorY, z);
                
                // Left side of street: 0, Right side of street: 180
                // Note: "Left side" relative to street direction. 
                // If we're at roadCenter, xOffset negative is left, positive is right.
                if (onRightOfStreet) {
                    light.rotation.y = Math.PI;
                } else {
                    light.rotation.y = 0;
                }

                light.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
                this.streetLights.add(light);
            }
        };

        spawnLightsForRoad(-1, layout.left);
        spawnLightsForRoad(1, layout.right);
    }

    updateEdgeObject(side, isUnit, width, length, y, centerX) {
        let entry = this.edgeItems.find(e => e.side === side);
        
        if (!entry || entry.isUnit !== isUnit) {
            if (entry) this.remove(entry.object);
            
            let obj;
            if (isUnit) {
                obj = new BlockUnit(
                    this.seed + "_edge_" + side,
                    this.cityModel,
                    true, // Tall ON
                    this.unitLength,
                    this.unitWidth,
                    this.buildingSettings
                );
            } else {
                obj = new Block(
                    this.seed + "_edge_" + side,
                    this.cityModel,
                    true, // Tall ON
                    this.unitLength,
                    this.buildingSettings
                );
            }
            
            // Orientation
            if (isUnit) {
                obj.rotation.y = Math.PI / 2; 
            } else {
                // Single block facing INWARD
                if (side === -1) obj.rotation.y = Math.PI / 2;
                else obj.rotation.y = -Math.PI / 2;
            }

            this.add(obj);
            
            if (!entry) {
                entry = { side, object: obj, isUnit: isUnit };
                this.edgeItems.push(entry);
            } else {
                entry.object = obj;
                entry.isUnit = isUnit;
            }
        }

        entry.object.visible = true;
        
        const targetLocalWidth = width / this.sceneScale;
        
        if (isUnit) {
            entry.object.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
            entry.object.setLength(this.unitLength);
            entry.object.setWidth(targetLocalWidth);
            // Unit is centered, so centerX works fine
            entry.object.position.set(side * centerX, y, 0);
        } else {
            // Block (Single)
            // Fix: ensure the length is updated!
            entry.object.setBlockSize(this.unitLength);
            
            // Scale Z is custom Width
            const scaleZ = targetLocalWidth / 3.28;
            entry.object.scale.set(this.sceneScale, this.sceneScale, scaleZ * this.sceneScale);
            
            // Positioning Fix for Back-Pivot
            const pivotOffset = side * (width / 2);
            entry.object.position.set(side * centerX + pivotOffset, y, 0);
        }
    }
}