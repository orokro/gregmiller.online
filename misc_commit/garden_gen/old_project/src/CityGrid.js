import * as THREE from 'three';
import BlockRow from './BlockRow.js';
import SideRoad from './SideRoad.js';
import CapBlock from './CapBlock.js';

export default class CityGrid extends THREE.Object3D {
    constructor(seed, buildingModel, signalAsset, streetLightAsset, mtlRoad, mtlRoadIntersection, mtlRoadSide, floorPlane, prisms, unitsPerBuilding, rowConfig, buildingConfig) {
        super();
        this.seed = seed.toString();
        this.buildingModel = buildingModel;
        this.signalAsset = signalAsset;
        this.streetLightAsset = streetLightAsset;
        this.mtlRoad = mtlRoad;
        this.mtlRoadIntersection = mtlRoadIntersection;
        this.mtlRoadSide = mtlRoadSide;
        this.floorPlane = floorPlane;
        this.prisms = prisms;
        this.unitsPerBuilding = unitsPerBuilding;
        this.rowConfig = rowConfig;
        this.buildingConfig = buildingConfig;

        this.blockRows = [];
        this.sideRoads = [];
        this.capBlocks = [];
        this.blockRowMap = new Map(); // prism -> BlockRow
        this.spacing = 5.0; 
        
        // Initial build
        this.setPrisms(prisms);
    }

    init() {
        // Legacy init removed, logic moved to setPrisms
    }

    setPrisms(newPrisms) {
        this.prisms = newPrisms;
        
        const newBlockRows = [];
        const keptPrisms = new Set(newPrisms);

        // 1. Sync BlockRows
        newPrisms.forEach((prism, index) => {
            let blockRow = this.blockRowMap.get(prism);
            
            if (!blockRow) {
                // Create New
                const rowSeed = this.seed + "_row_" + index + "_" + Math.random(); // Unique seed for new entries? 
                // Or deterministic based on something? 
                // If we want deterministic "nth prism" but they move, it's tricky. 
                // Let's use index if we assume append? 
                // If we insert in middle, index changes.
                // ideally seed is derived from prism if prism has ID. 
                // For now, use index or random.
                
                blockRow = new BlockRow(
                    prism,
                    this.floorPlane,
                    this.unitsPerBuilding,
                    this.mtlRoad,
                    this.streetLightAsset,
                    this.seed + "_row_" + index, // Use index-based seed for stability of "slot"
                    this.buildingModel,
                    this.rowConfig,
                    this.buildingConfig
                );
                this.add(blockRow);
                this.blockRowMap.set(prism, blockRow);
            } else {
                // Update Index/Seed? No, keep existing state.
                // Just ensure it's in the scene
                if (blockRow.parent !== this) this.add(blockRow);
            }
            newBlockRows.push(blockRow);
            
            // Sync Position
            blockRow.position.z = prism.position.z;
        });

        // 2. Remove Unused
        this.blockRowMap.forEach((row, prism) => {
            if (!keptPrisms.has(prism)) {
                this.remove(row);
                this.blockRowMap.delete(prism);
            }
        });

        this.blockRows = newBlockRows;

        // 3. Recreate Side Roads (Cheap, gap dependent)
        this.sideRoads.forEach(sr => this.remove(sr));
        this.sideRoads = [];

        for (let i = 0; i <= this.prisms.length; i++) {
            const refPrism = (i < this.prisms.length) ? this.prisms[i] : this.prisms[this.prisms.length - 1];
            if (!refPrism) continue; // No prisms case

            const sideRoad = new SideRoad(
                this.floorPlane,
                refPrism,
                this.mtlRoadIntersection,
                this.mtlRoadSide,
                this.unitsPerBuilding,
                this.signalAsset,
                this.streetLightAsset,
                this.rowConfig
            );
            this.add(sideRoad);
            this.sideRoads.push(sideRoad);
        }

        // 4. Recreate Cap Blocks
        this.capBlocks.forEach(cb => this.remove(cb));
        this.capBlocks = [];

        if (this.prisms.length > 0) {
            const topCap = new CapBlock(
                this.floorPlane,
                this.prisms[0],
                "top",
                this.unitsPerBuilding,
                this.buildingModel,
                this.seed + "_cap_top",
                this.buildingConfig,
                this.rowConfig
            );
            this.add(topCap);
            this.capBlocks.push(topCap);

            const bottomCap = new CapBlock(
                this.floorPlane,
                this.prisms[this.prisms.length - 1],
                "bottom",
                this.unitsPerBuilding,
                this.buildingModel,
                this.seed + "_cap_btm",
                this.buildingConfig,
                this.rowConfig
            );
            this.add(bottomCap);
            this.capBlocks.push(bottomCap);
        }

        this.updateSideRoadPositions();
        this.updateCapBlockPositions();
        
        // Force update on new layout
        this.update();
    }

    setUnitsPerBuilding(val) {
        this.unitsPerBuilding = val;
        this.blockRows.forEach(row => {
            row.unitsPerBuilding = val;
        });
        this.sideRoads.forEach(road => {
            road.unitsPerBuilding = val;
            road.update();
        });
        this.capBlocks.forEach(cap => {
            cap.setUnitsPerBuilding(val);
        });
        this.update();
    }

    setPrismSpacing(val) {
        this.spacing = val;
        this.sideRoads.forEach(road => road.setSpacing(val));
        this.capBlocks.forEach(cap => cap.setSpacing(val));
        this.update();
    }

    update() {
        this.blockRows.forEach((row, i) => {
            // Sync Position in case prisms moved
            if (this.prisms[i]) {
                row.position.z = this.prisms[i].position.z;
            }
            row.updateLayout();
        });
        this.updateSideRoadPositions();
        this.sideRoads.forEach(road => road.update());
        
        this.updateCapBlockPositions();
        this.capBlocks.forEach(cap => cap.update());
    }

    updateSideRoadPositions() {
        // Position SideRoads in the gaps
        // SideRoad i is before Prism i. SideRoad i+1 is after Prism i.
        
        for (let i = 0; i < this.sideRoads.length; i++) {
            const road = this.sideRoads[i];
            let zPos = 0;
            
            if (i === 0) {
                // Before first prism
                // Pos = Prism0 Z - Prism0 HalfHeight - Spacing/2
                if (this.prisms.length > 0) {
                    const p = this.prisms[0];
                    zPos = p.position.z - (p.scale.z / 2) - (this.spacing / 2);
                }
            } else {
                // After Prism i-1
                // Pos = Prism(i-1) Z + Prism(i-1) HalfHeight + Spacing/2
                if (this.prisms[i-1]) {
                    const p = this.prisms[i-1];
                    zPos = p.position.z + (p.scale.z / 2) + (this.spacing / 2);
                }
            }
            
            road.position.z = zPos;
            road.setSpacing(this.spacing);
        }
    }

    updateCapBlockPositions() {
        // Cap Blocks handle their own positioning relative to neighbor prism + spacing,
        // but they need to know the spacing to calculate "startZ".
        // In CapBlock.js: "startZ = sideRoadEdge".
        // Top: PrismMin - Spacing. 
        // Bottom: PrismMax + Spacing.
        
        // So we just need to ensure they have the latest spacing via setSpacing (called above).
        // Their internal update() measures the prisms and floor directly.
    }
}
