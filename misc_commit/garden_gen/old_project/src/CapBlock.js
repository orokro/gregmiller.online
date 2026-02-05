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
        this.isUnit = false; // Track current type
        
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
        const layout = computeBlockRowLayout(
            this.neighborPrism,
            this.floorPlane,
            this.unitsPerBuilding,
            this.capConfig
        );

        // Calculate Total Width
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
        
        // Measure Available Depth (Z)
        const floorBox = new THREE.Box3().setFromObject(this.floorPlane);
        const prismBox = new THREE.Box3().setFromObject(this.neighborPrism);
        
        let startZ;
        let availableDepth;
        let isTop = this.side === "top";

        if (isTop) {
            const sideRoadEdge = prismBox.min.z - this.spacing;
            startZ = sideRoadEdge;
            const floorEdge = floorBox.min.z;
            availableDepth = startZ - floorEdge;
        } else {
            const sideRoadEdge = prismBox.max.z + this.spacing;
            startZ = sideRoadEdge;
            const floorEdge = floorBox.max.z;
            availableDepth = floorEdge - startZ;
        }

        // Determine Block Type & Scale
        const sceneScale = layout.sceneScale;
        const blockBaseDepth = 3.28 * sceneScale;
        const unitBaseDepth = 6.56 * sceneScale;

        let useUnit = false;
        let depth = blockBaseDepth;

        if (availableDepth > unitBaseDepth) {
            useUnit = true;
            let maxDepth = unitBaseDepth * this.capConfig.maxCapScale;
            depth = Math.min(availableDepth, maxDepth);
        } else {
             let maxDepth = blockBaseDepth * this.capConfig.maxCapScale;
             depth = Math.max(blockBaseDepth, Math.min(availableDepth, maxDepth));
        }

        // Recreate if needed (First run, or type swap)
        if (!this.block || this.isUnit !== useUnit) {
            if (this.block) this.remove(this.block);
            
            const name = `Cap_${this.side}_${this.seed}`;
            
            if (useUnit) {
                this.block = new BlockUnit(
                    name,
                    this.buildingModel,
                    true,
                    totalWidth / sceneScale, // Length
                    depth / sceneScale, // Width
                    this.buildingConfig
                );
            } else {
                this.block = new Block(
                    name,
                    this.buildingModel,
                    true,
                    totalWidth / sceneScale, // Block Size
                    this.buildingConfig
                );
            }
            this.block.scale.x = sceneScale;
            this.block.scale.y = sceneScale;
            this.add(this.block);
            this.isUnit = useUnit;
        }

        // Update Dimensions & Scale (Every frame)
        if (useUnit) {
             // BlockUnit scaling
             this.block.scale.z = sceneScale; // Reset base Z scale
             this.block.setLength(totalWidth / sceneScale);
             this.block.setWidth(depth / sceneScale);
        } else {
            // Block scaling
            this.block.setBlockSize(totalWidth / sceneScale);
            // Block depth is fixed at ~3.28 local. Scale Z to match target depth.
            const zScale = (depth / sceneScale) / 3.28;
            this.block.scale.z = zScale;
        }
        
        // Update Position & Rotation
        if (isTop) {
            const zPos = startZ - (depth / 2);
            this.block.position.set(0, layout.floorY, zPos);
            this.block.rotation.y = 0;
        } else {
            const zPos = startZ + (depth / 2);
             this.block.position.set(0, layout.floorY, zPos);
             this.block.rotation.y = Math.PI; 
        }
    }
}