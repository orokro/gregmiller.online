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
        
        const availableSide = (floorTotalWidth - prismX) / 2;

        const layoutSide = (side) => {
            const roadObj = this.roads.find(r => r.side === side);
            
            // Priority 1: Roads always appear (min width)
            // Even if floor is small, they exist.
            roadObj.mesh.visible = true;
            let roadWidth = roadBaseWidth * this.settings.roadMinWidth;

            // Space remaining after min road
            let remaining = availableSide - roadWidth;
            let buildingWidth = 0;
            let useUnit = false;
            let spawnBuilding = false;

            if (remaining > 0) {
                spawnBuilding = true;
                
                // Priority 2: Single Blocks
                // Start with single block base
                let targetWidth = blockBaseWidth;
                
                // Priority 3: Grow Single Blocks to Max
                let maxBlock = blockBaseWidth * this.settings.maxEdgeScale;
                
                // Priority 4: Switch to Unit
                let targetUnitWidth = unitBaseWidth;

                // Priority 5: Grow Unit
                let maxUnit = unitBaseWidth * this.settings.maxEdgeScale;

                // Logic Flow
                if (remaining < maxBlock) {
                    // Fits within scalable block range (or is smaller than base block, we clamp min later)
                    useUnit = false;
                    buildingWidth = Math.max(blockBaseWidth, remaining); 
                    // Wait, if remaining < blockBaseWidth, do we spawn? 
                    // Prompt: "if there's still space left over... then the single blocks should spawn".
                    // Implies we need at least enough for a block? 
                    // Let's assume if we have > 0, we try to fit a block, clamped to min size.
                    // But if available < min road + min block, maybe we don't spawn building?
                    if (remaining < blockBaseWidth * 0.5) spawnBuilding = false; // Threshold
                    else buildingWidth = Math.max(blockBaseWidth, remaining);
                } 
                else if (remaining < maxUnit) {
                    // Bigger than max block, smaller than max unit.
                    // Could be big block or small unit?
                    // "replace them with blockunits" implies switch.
                    useUnit = true;
                    // Ideally we switch when block hits max scale.
                    // blockMax ~ 1.5 * 3.28 ~ 4.92.
                    // unitBase ~ 6.56.
                    // There is a gap where we are > maxBlock but < unitBase.
                    // In that gap, we probably stick to maxBlock or jump to unit?
                    // Let's jump to unit if we can fit base unit.
                    if (remaining >= unitBaseWidth) {
                        useUnit = true;
                        buildingWidth = Math.max(unitBaseWidth, remaining);
                    } else {
                        // Can't fit unit yet, stick to max block
                        useUnit = false;
                        buildingWidth = maxBlock;
                    }
                } 
                else {
                    // Bigger than max unit
                    useUnit = true;
                    buildingWidth = maxUnit; // Cap at max unit for now
                    
                    // Priority 6: Grow Unit Max (Already capped above)
                    // Priority 7: Grow Road (if space remains after max unit)
                    let extra = remaining - maxUnit;
                    if (extra > 0) {
                        let maxRoadGrow = (roadBaseWidth * this.settings.roadMaxWidth) - roadWidth;
                        let roadGrow = Math.min(extra, maxRoadGrow);
                        roadWidth += roadGrow;
                        // extra -= roadGrow;
                        // If still extra, nothing else changes
                    }
                }
            } else {
                spawnBuilding = false;
            }

            // Update Road
            // Scale X is Width (Road Width along Row X). Scale Y is Length (Road Length along Row Z).
            // PlaneGeometry(1,1) rotated X -90.
            // Local X is World X. Local Y is World Z.
            roadObj.mesh.scale.set(roadWidth, prismZ, 1);
            
            // UVs
            if (roadObj.mesh.material.map) {
                roadObj.mesh.material.map.repeat.set(1, prismZ / roadWidth);
            }

            // Position Road
            // Center Prism is width prismX.
            // Road starts at prismX/2. Center is prismX/2 + roadWidth/2.
            let roadCenter = prismX / 2 + roadWidth / 2;
            roadObj.mesh.position.set(side * roadCenter, box.min.y, 0);

            // Update Building
            if (spawnBuilding) {
                // Building starts at road edge: prismX/2 + roadWidth.
                // Center is prismX/2 + roadWidth + buildingWidth/2.
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
            obj.rotation.y = Math.PI / 2; 
            if (!isUnit) {
                // Face the road.
                // Side -1 (Left/West): Road is to Right (+X). Front (+Z local) needs to face +X.
                // Rot 90 (PI/2) -> +Z local is +X world. Correct.
                // Side 1 (Right/East): Road is to Left (-X). Front (+Z local) needs to face -X.
                // Rot -90 (-PI/2) -> +Z local is -X world. Correct.
                if (side === -1) obj.rotation.y = Math.PI / 2;
                else obj.rotation.y = -Math.PI / 2;
            }

            obj.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
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
        
        // Adjust Dimensions
        // We pass the RAW dimension (unscaled) to the object methods, because they apply scale internally?
        // No, setWidth/setLength usually expect world units or logical units.
        // In BlockUnit: setWidth(w) sets this.width = w. Then updates scale.z = (w/2)/3.28.
        // It does NOT assume sceneScale.
        // BUT our object instance has .scale applied (sceneScale).
        // So we need to set the LOCAL width (unscaled).
        const targetLocalWidth = width / this.sceneScale;
        
        if (isUnit) {
            entry.object.setLength(this.unitLength); // unitLength is already unscaled (base)
            entry.object.setWidth(targetLocalWidth);
        } else {
            // Block width control (Depth)
            // Block has no setWidth. It relies on scale.
            // Width of block is scale.z * 3.28.
            // We want (scale.z * 3.28) * sceneScale = width
            // scale.z = (width / sceneScale) / 3.28
            entry.object.scale.z = targetLocalWidth / 3.28;
            
            // Scale X/Y is sceneScale. Scale Z is custom.
            entry.object.scale.set(this.sceneScale, this.sceneScale, entry.object.scale.z * this.sceneScale);
        }

        entry.object.position.set(side * centerX, y, 0);
    }
}
