import * as THREE from 'three';
import Block from './Block.js';
import BlockUnit from './BlockUnit.js';

export default class BlockRow extends THREE.Object3D {
    constructor(targetFitObject, targetFloorObject, unitsPerBuilding, roadMaterial, seed, cityModel, settings = {}, buildingSettings = {}) {
        super();
        this.targetFitObject = targetFitObject;
        this.targetFloorObject = targetFloorObject;
        this.unitsPerBuilding = unitsPerBuilding;
        this.roadMaterial = roadMaterial;
        this.seed = seed.toString();
        this.cityModel = cityModel;
        this.settings = {
            roadMinWidth: 1.0,
            roadMaxWidth: 1.5,
            maxEdgeScale: 1.5,
            ...settings
        };
        this.buildingSettings = buildingSettings;

        // Container for components
        this.centerUnit = null;
        this.roads = []; // { mesh, side }
        this.edgeItems = []; // { object, side, isUnit }

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

        const box = new THREE.Box3().setFromObject(this.targetFitObject);
        const prismSize = new THREE.Vector3();
        box.getSize(prismSize);

        const floorBox = new THREE.Box3().setFromObject(this.targetFloorObject);
        const floorSize = new THREE.Vector3();
        floorBox.getSize(floorSize);
        
        const floorTotalWidth = floorSize.x;
        const prismX = prismSize.x;
        const prismZ = prismSize.z;

        // BCP (Bottom-Center of Prism) X in world space
        const BCP_X = (box.min.x + box.max.x) / 2;
        const floorMinX = floorBox.min.x;
        const floorMaxX = floorBox.max.x;

        const leftSpace = BCP_X - floorMinX;
        const rightSpace = floorMaxX - BCP_X;

        const availableLeft = leftSpace - (prismX / 2);
        const availableRight = rightSpace - (prismX / 2);

        // Update Center Unit
        const buildingCount = Math.max(1, Math.round(prismZ / this.unitsPerBuilding));
        const baseLength = buildingCount * 2.0;
        this.sceneScale = prismZ / baseLength;
        this.unitLength = baseLength;
        this.unitWidth = prismX / this.sceneScale;

        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
        this.centerUnit.setLength(this.unitLength);
        this.centerUnit.setWidth(this.unitWidth);
        this.centerUnit.position.y = box.min.y;

        // Base Widths for logic (World Units)
        const blockBaseWidth = (3.28 * this.sceneScale);
        const unitBaseWidth = (6.56 * this.sceneScale);
        const roadBaseWidth = prismX; // Default street width matches center block width

        const layoutSide = (side) => {
            const roadObj = this.roads.find(r => r.side === side);
            const availableSide = side === -1 ? availableLeft : availableRight;
            
            // Priority 1: Roads always appear (min width)
            roadObj.mesh.visible = true;
            let roadWidth = roadBaseWidth * this.settings.roadMinWidth;

            // Space remaining after min road
            let remaining = availableSide - roadWidth;
            let buildingWidth = 0;
            let useUnit = false;
            let spawnBuilding = false;

            // Priority 2: Grow Road to Max BEFORE buildings
            let maxRoadWidth = roadBaseWidth * this.settings.roadMaxWidth;
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
                let maxBlock = blockBaseWidth * this.settings.maxEdgeScale;
                
                // Priority 4: Grow Single Blocks to Max
                if (remaining < maxBlock) {
                    useUnit = false;
                    buildingWidth = Math.max(blockBaseWidth, remaining);
                } 
                else {
                    // Remaining is more than max block.
                    // Priority 5: Switch to Unit
                    let maxUnit = unitBaseWidth * this.settings.maxEdgeScale;

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

            // Update Road
            roadObj.mesh.scale.set(roadWidth, prismZ, 1);
            if (roadObj.mesh.material.map) {
                roadObj.mesh.material.map.repeat.set(1, prismZ / roadWidth);
            }

            let roadCenter = prismX / 2 + roadWidth / 2;
            roadObj.mesh.position.set(side * roadCenter, box.min.y, 0);

            // Update Building
            if (spawnBuilding) {
                let buildingCenter = prismX / 2 + roadWidth + buildingWidth / 2;
                this.updateEdgeObject(side, useUnit, buildingWidth, prismZ, box.min.y, buildingCenter);
            } else {
                const edge = this.edgeItems.find(e => e.side === side);
                if (edge) edge.object.visible = false;
            }
        };

        layoutSide(-1);
        layoutSide(1);
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