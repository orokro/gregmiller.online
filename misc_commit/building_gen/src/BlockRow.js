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

        // Prism Z is Block Length (X-axis in BlockUnit local space)
        // Prism X is Block Width (Z-axis in BlockUnit local space)
        const prismX = size.x;
        const prismZ = size.z;

        // 1. Calculate Base Length and Scene Scale
        // buildingCount = prismZ / unitsPerBuilding
        // baseLength = buildingCount * 2.0 (since each building is 2 units wide at scale 1)
        const buildingCount = Math.max(1, Math.round(prismZ / this.unitsPerBuilding));
        const baseLength = buildingCount * 2.0;
        this.sceneScale = prismZ / baseLength;

        // 2. Calculate Base Width for BlockUnit
        // We want (baseWidth * sceneScale) to ideally fit prismX.
        // So baseWidth = prismX / sceneScale.
        this.unitLength = baseLength;
        this.unitWidth = prismX / this.sceneScale;

        // 3. Spawn Center BlockUnit
        this.centerUnit = new BlockUnit(
            this.seed + "_center",
            this.cityModel,
            this.buildingSettings.tall_items,
            this.unitLength,
            this.unitWidth,
            this.buildingSettings
        );

        // Rotate: BlockUnit X (Length) -> Prism Z. BlockUnit Z (Width) -> Prism X.
        this.centerUnit.rotation.y = Math.PI / 2;
        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
        this.add(this.centerUnit);

        // Position: Bottom of prism
        this.centerUnit.position.y = box.min.y;

        // 4. Roads
        this.createRoads();

        this.updateLayout();
    }

    createRoads() {
        // Create 2 planes for roads
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

        // Re-measure Prism
        const box = new THREE.Box3().setFromObject(this.targetFitObject);
        const prismSize = new THREE.Vector3();
        box.getSize(prismSize);

        // Re-measure Floor
        const floorBox = new THREE.Box3().setFromObject(this.targetFloorObject);
        const floorSize = new THREE.Vector3();
        floorBox.getSize(floorSize);
        
        // Expansion is along X axis
        const floorTotalWidth = floorSize.x;
        const prismX = prismSize.x;
        const prismZ = prismSize.z;

        // Update Center Unit to fit Prism
        const buildingCount = Math.max(1, Math.round(prismZ / this.unitsPerBuilding));
        const baseLength = buildingCount * 2.0;
        this.sceneScale = prismZ / baseLength;
        this.unitLength = baseLength;
        this.unitWidth = prismX / this.sceneScale;

        this.centerUnit.scale.set(this.sceneScale, this.sceneScale, this.sceneScale);
        this.centerUnit.setLength(this.unitLength);
        this.centerUnit.setWidth(this.unitWidth);
        this.centerUnit.position.y = box.min.y;

        // Layout Roads and Edges
        const roadBaseWidth = prismX; // Match block unit width
        const availableSide = (floorTotalWidth - prismX) / 2;

        const layoutSide = (side) => {
            const roadObj = this.roads.find(r => r.side === side);
            
            // Min space needed for road + one block
            const blockBaseWidth = (3.28 * this.sceneScale);
            const unitBaseWidth = (6.56 * this.sceneScale);
            const minRoadWidth = roadBaseWidth * this.settings.roadMinWidth;

            if (availableSide > minRoadWidth + blockBaseWidth) {
                roadObj.mesh.visible = true;
                
                let roadWidth = minRoadWidth;
                let remainingForBuilding = availableSide - roadWidth;
                
                // Determine if we use Unit or Block
                let useUnit = false;
                let buildingBaseWidth = blockBaseWidth;

                // Rule: "maxEdgeScale determines the maximum stretching allowed for the edge Blocks before they turn into BlockUnits"
                if (remainingForBuilding / blockBaseWidth > this.settings.maxEdgeScale) {
                    useUnit = true;
                    buildingBaseWidth = unitBaseWidth;
                }

                // If building is too big even for Unit, it might stretch.
                // If there's extra space, road can grow up to roadMaxWidth
                const maxRoad = roadBaseWidth * this.settings.roadMaxWidth;
                if (remainingForBuilding > buildingBaseWidth * this.settings.maxEdgeScale) {
                    const extra = remainingForBuilding - (buildingBaseWidth * this.settings.maxEdgeScale);
                    const grow = Math.min(extra, maxRoad - minRoadWidth);
                    roadWidth += grow;
                    remainingForBuilding -= grow;
                }

                // Final building width clamped to maxEdgeScale of its base
                let finalBuildingWidth = Math.min(remainingForBuilding, buildingBaseWidth * this.settings.maxEdgeScale);

                // Update Road Mesh
                roadObj.mesh.scale.set(roadWidth, prismZ, 1);
                roadObj.mesh.position.set(side * (prismX / 2 + roadWidth / 2), box.min.y, 0);
                
                // UVs: Repeat square. Road length is prismZ. Road width is roadWidth.
                // If texture is square, we want repeat.y = prismZ / roadWidth? 
                // Wait, mesh scale is (width, length, 1). UV U is across width, V is along length.
                // So repeat V = prismZ / roadWidth.
                if (roadObj.mesh.material.map) {
                    roadObj.mesh.material.map.repeat.set(1, prismZ / roadWidth);
                }

                // Update Edge Object
                this.updateEdgeObject(side, useUnit, finalBuildingWidth, prismZ, box.min.y);
            } else {
                roadObj.mesh.visible = false;
                const edge = this.edgeItems.find(e => e.side === side);
                if (edge) edge.object.visible = false;
            }
        };

        layoutSide(-1);
        layoutSide(1);
    }

    updateEdgeObject(side, isUnit, width, length, y) {
        let entry = this.edgeItems.find(e => e.side === side);
        
        if (!entry || entry.isUnit !== isUnit) {
            if (entry) this.remove(entry.object);
            
            let obj;
            if (isUnit) {
                obj = new BlockUnit(
                    this.seed + "_edge_" + side,
                    this.cityModel,
                    this.buildingSettings.tall_items,
                    this.unitLength,
                    this.unitWidth,
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
            }
            
            // Initial Orientation
            obj.rotation.y = Math.PI / 2; // North-South
            if (!isUnit) {
                // Single block needs to face the road
                if (side === -1) obj.rotation.y = Math.PI / 2; // Face East?
                else obj.rotation.y = -Math.PI / 2; // Face West?
                // Wait, Block local origin is back-center. 
                // Rotation 90 deg (PI/2) makes local X along World Z.
                // Front (+Z local) faces +X world if rotation is PI/2.
                // If side is -1 (West), road is at -X relative to building? No, road is at +X relative to building.
                // Building is at -X. Road is at center. So Front should face +X.
                // If side is 1 (East), building is at +X. Road is at center. So Front should face -X.
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
        const targetLocalWidth = width / this.sceneScale;
        if (isUnit) {
            entry.object.setLength(this.unitLength);
            entry.object.setWidth(targetLocalWidth);
        } else {
            // Block doesn't have setWidth. Buildings are 2x3.28 at scale 1.
            // Width of block is building depth.
            // We need to scale the block's Z (local) to match targetLocalWidth.
            entry.object.scale.set(this.sceneScale, this.sceneScale, (targetLocalWidth / 3.28) * this.sceneScale);
        }

        // Position
        const roadObj = this.roads.find(r => r.side === side);
        const roadWidth = roadObj.mesh.scale.y; // Wait, road mesh scale is (width, length, 1)
        const prismX = new THREE.Box3().setFromObject(this.targetFitObject).getSize(new THREE.Vector3()).x;
        
        entry.object.position.set(side * (prismX / 2 + roadWidth + width / 2), y, 0);
    }
}