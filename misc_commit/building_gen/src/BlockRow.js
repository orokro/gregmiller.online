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
        // Measure the prism
        const box = new THREE.Box3().setFromObject(this.targetFitObject);
        const size = new THREE.Vector3();
        box.getSize(size);

        // Prism X is Block Width (Z-axis in BlockUnit space)
        // Prism Z is Block Length (X-axis in BlockUnit space)
        // Note: prompt says "the x-axis of the prism corresponds to the width of the block (i.e. z), 
        // and the length of the prism corresponds to the length of the block (i.e x)"
        const prismX = size.x;
        const prismZ = size.z;

        // Determine BlockUnit length (X-axis)
        // "divide by the unitsPerBuilding on it's z axis [of prism], ... also needs to be divided by 2 ... because building width is default 2"
        // If unitsPerBuilding is e.g. 5 units of space per building?
        // Let's assume unitsPerBuilding is the width in world units for ONE building.
        // buildingCount = prismZ / unitsPerBuilding
        // In Block.js, building width is 2.0 * scaleX.
        // So raw length = buildingCount * 2.0 = (prismZ / unitsPerBuilding) * 2.0.
        this.unitLength = (prismZ / this.unitsPerBuilding) * 2.0;

        // Ratios for width? Prompt says "use ratios to figure out what the BlockUnit width should be"
        // Let's assume we want to match the prism ratio or some default.
        // "Once we have the converted BlockUnit length, we use ratios to figure out what the BlockUnit width should be."
        // Default building depth is 3.28. BlockUnit is 2 blocks back-to-back = 6.56 default width.
        // Let's just use the default 6.56 as the base unitWidth and then scale up.
        const baseUnitWidth = 6.56;
        this.unitWidth = baseUnitWidth;

        // Spawn Center BlockUnit
        this.centerUnit = new BlockUnit(
            this.seed + "_center",
            this.cityModel,
            this.buildingSettings.tall_items,
            this.unitLength,
            this.unitWidth,
            this.buildingSettings
        );

        // Rotate to fit Prism: BlockUnit X (length) along Prism Z. BlockUnit Z (width) along Prism X.
        // Three.js rotation: Y is up.
        this.centerUnit.rotation.y = Math.PI / 2;
        this.add(this.centerUnit);

        // Scale to fit Prism
        // Current Length is this.unitLength. Needs to be prismZ. -> scale = prismZ / unitLength
        // BUT wait, prompt says "Scale the entire block up, so it fits the prism perfectly on x/z. Call this scalar 'sceneScale'"
        // If we want it to fit perfectly on BOTH, and we used ratios to determine width, then one scale should cover both if ratios match.
        this.sceneScale = prismZ / this.unitLength; 
        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);

        // Position: Bottom of prism
        this.centerUnit.position.y = box.min.y;

        // Roads
        this.createRoads();

        // Edges
        this.createEdges();

        this.updateLayout();
    }

    createRoads() {
        // Create 2 planes for roads
        for (let i = 0; i < 2; i++) {
            const geom = new THREE.PlaneGeometry(1, 1);
            const mesh = new THREE.Mesh(geom, this.roadMaterial.clone());
            mesh.rotation.x = -Math.PI / 2; // Flat on ground
            this.add(mesh);
            this.roads.push({ mesh, side: i === 0 ? -1 : 1 });
        }
    }

    createEdges() {
        // We'll spawn these lazily in updateLayout or pre-spawn and hide.
        // Let's pre-spawn 2 BlockUnits and 2 Blocks per side?
        // Actually, let's just create them when needed in updateLayout to keep it simple,
        // since the prompt says "Avoid ever rebuilding geo unless initial generation ... everything should adjust layout dynamically"
        // "Geo" usually refers to BufferGeometry. Re-using class instances is fine.
    }

    updateLayout() {
        const box = new THREE.Box3().setFromObject(this.targetFitObject);
        const prismSize = new THREE.Vector3();
        box.getSize(prismSize);

        const floorBox = new THREE.Box3().setFromObject(this.targetFloorObject);
        const floorSize = new THREE.Vector3();
        floorBox.getSize(floorSize);
        // Floor Width on Z? Prompt: "measure the width of the floor plane on z (its x should be the same as the block/prism x)"
        // Wait, if Prism X is width, and Floor is bigger on Z?
        // "the blocks should run north/south now (along z, not x)"
        // "measure the width of the floor plane on z"
        // This implies the Row expands along Z.
        const floorTotalWidth = floorSize.z; 

        // Current Center Unit Width (on Z of the Row, which is Prism X)
        const unitWidth = prismSize.x;
        const roadBaseWidth = unitWidth; // "Default width of street should match the block units width after being scaled"
        
        // Available space on each side from center
        let availableSide = (floorTotalWidth - unitWidth) / 2;

        const layoutSide = (side) => {
            let cursor = unitWidth / 2;

            // 1. Road
            const roadObj = this.roads.find(r => r.side === side);
            let roadWidth = roadBaseWidth;
            // "if roadMaxWidth is 1.5, the responsive code should let the streets scale up to 1.5x"
            // We only scale if there's enough room? Or always?
            // Usually "responsive" means fill space.
            // Let's see how much space we have.
            const maxRoad = roadBaseWidth * this.settings.roadMaxWidth;
            
            // 2. Edge item (Block or Unit)
            // Need to decide what fits.
            // Edge min width is a single block (width ~3.28 * sceneScale)
            const blockBaseWidth = (3.28 * this.sceneScale);
            const unitBaseWidth = (6.56 * this.sceneScale);

            // If we have room for road + at least one block
            if (availableSide > roadBaseWidth + blockBaseWidth) {
                roadObj.mesh.visible = true;
                
                // Calculate remaining space for edge building after min road
                let remainingForBuilding = availableSide - roadBaseWidth;
                
                let edgeObj = this.getEdgeObject(side);
                let useUnit = false;

                // Check if it should be a Unit
                if (remainingForBuilding > unitBaseWidth) {
                    const scaleNeeded = remainingForBuilding / unitBaseWidth;
                    if (scaleNeeded > 1.0) {
                        // It's at least a unit. Check if we should stretch it or if it's too big.
                        useUnit = true;
                        // But wait, the rule: "if there isn't enough space to fit a whole BlockUnit... spawn regular Blocks"
                        // "maxEdgeScale determines the maximum stretching allowed for the edge Blocks before they turn into BlockUnits"
                        const blockScale = remainingForBuilding / blockBaseWidth;
                        if (blockScale > this.settings.maxEdgeScale) {
                            useUnit = true;
                        } else {
                            useUnit = false;
                        }
                    } else {
                        // Fits a block easily, maybe a unit?
                        useUnit = false;
                    }
                }

                // Finalize road and building widths
                // If we have tons of space, road can grow
                if (remainingForBuilding > (useUnit ? unitBaseWidth : blockBaseWidth) * this.settings.maxEdgeScale) {
                    roadWidth = Math.min(maxRoad, availableSide - (useUnit ? unitBaseWidth : blockBaseWidth) * this.settings.maxEdgeScale);
                }
                
                // Recalculate building width based on finalized road
                let finalBuildingWidth = availableSide - roadWidth;
                // Clamp building width to maxEdgeScale
                const base = useUnit ? unitBaseWidth : blockBaseWidth;
                if (finalBuildingWidth > base * this.settings.maxEdgeScale) {
                    finalBuildingWidth = base * this.settings.maxEdgeScale;
                }

                // Apply to Road
                roadObj.mesh.scale.set(finalBuildingWidth + roadWidth, prismSize.z, 1); // Not quite, road width is along Z-axis of Row
                // Wait, Row expands on Z. Road width is on Row Z. Road length is Row X.
                roadObj.mesh.scale.set(prismSize.z, roadWidth, 1);
                roadObj.mesh.position.set(0, box.min.y, side * (unitWidth / 2 + roadWidth / 2));
                
                // UVs
                const uvScale = prismSize.z / roadWidth;
                roadObj.mesh.material.map.repeat.set(1, uvScale);

                // Apply to Building
                this.updateEdgeObject(side, useUnit, finalBuildingWidth, prismSize.z);
                edgeObj = this.getEdgeObject(side);
                edgeObj.object.visible = true;
                edgeObj.object.position.set(0, box.min.y, side * (unitWidth / 2 + roadWidth + finalBuildingWidth / 2));
            } else {
                roadObj.mesh.visible = false;
                const edge = this.edgeItems.find(e => e.side === side);
                if (edge) edge.object.visible = false;
            }
        };

        layoutSide(-1);
        layoutSide(1);
    }

    getEdgeObject(side) {
        return this.edgeItems.find(e => e.side === side);
    }

    updateEdgeObject(side, isUnit, width, length) {
        let entry = this.edgeItems.find(e => e.side === side);
        
        // If type changed or doesn't exist, recreate
        if (!entry || entry.isUnit !== isUnit) {
            if (entry) {
                this.remove(entry.object);
            }
            let obj;
            if (isUnit) {
                obj = new BlockUnit(
                    this.seed + "_edge_" + side,
                    this.cityModel,
                    this.buildingSettings.tall_items,
                    this.unitLength,
                    6.56, // base width
                    this.buildingSettings
                );
            } else {
                obj = new Block(
                    this.seed + "_edge_" + side,
                    this.cityModel,
                    this.buildingSettings.tall_items,
                    this.unitLength,
                    this.buildingSettings
                );
                // For a single block, the front faces one way. 
                // We want it facing the road.
                // Block origin is back-center. 
                // Left side (side -1) road is at -Z. Building at more -Z. Front should face +Z.
                // Right side (side 1) road is at +Z. Building at more +Z. Front should face -Z.
                if (side === -1) obj.rotation.y = 0;
                else obj.rotation.y = Math.PI;
            }
            obj.rotation.y += Math.PI / 2;
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

        // Adjust width
        const baseWidth = isUnit ? 6.56 : 3.28;
        const targetLocalWidth = width / this.sceneScale;
        
        if (isUnit) {
            entry.object.setWidth(targetLocalWidth);
        } else {
            // Block scale depth (Z in block space, which is Row Z)
            // Default Block doesn't have setWidth, it just has the scale we give it.
            // But Block doesn't account for its internal building depth scale?
            // Actually, Block is just a collection of buildings. 
            // Let's assume the depth scale is applied to the Block object.
            entry.object.scale.z = (targetLocalWidth / baseWidth) * this.sceneScale;
        }
    }
}
