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
        this.spacing = 5.0; // Default, should be set externally if different
        this.init();
    }

    init() {
        // We need (prisms.length + 1) side roads
        // Road 0 (Top), Prism 0, Road 1, Prism 1, ... Road N (Bottom)

        // Create Side Roads
        for (let i = 0; i <= this.prisms.length; i++) {
            // Use the nearest prism as reference. 
            // For i < length, use prism[i]. For last one, use prism[length-1].
            const refPrism = (i < this.prisms.length) ? this.prisms[i] : this.prisms[this.prisms.length - 1];
            
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

        this.prisms.forEach((prism, index) => {
            const rowSeed = this.seed + "_row_" + index;
            const blockRow = new BlockRow(
                prism,
                this.floorPlane,
                this.unitsPerBuilding,
                this.mtlRoad,
                this.streetLightAsset,
                rowSeed,
                this.buildingModel,
                this.rowConfig,
                this.buildingConfig
            );
            this.add(blockRow);
            this.blockRows.push(blockRow);
            
            // Sync Position
            blockRow.position.z = prism.position.z;
        });
        
        // Create Cap Blocks
        if (this.prisms.length > 0) {
            // Top Cap (Use first prism as neighbor)
            const topCap = new CapBlock(
                this.floorPlane,
                this.prisms[0],
                "top",
                this.unitsPerBuilding,
                this.buildingModel,
                this.seed + "_cap_top",
                this.buildingConfig,
                this.rowConfig // Passing rowConfig as capConfig for now to share maxEdgeScale etc
            );
            this.add(topCap);
            this.capBlocks.push(topCap);

            // Bottom Cap (Use last prism as neighbor)
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
