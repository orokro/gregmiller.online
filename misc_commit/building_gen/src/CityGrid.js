import * as THREE from 'three';
import BlockRow from './BlockRow.js';

export default class CityGrid extends THREE.Object3D {
    constructor(seed, buildingModel, mtlRoad, mtlRoadIntersection, floorPlane, prisms, unitsPerBuilding, rowConfig, buildingConfig) {
        super();
        this.seed = seed.toString();
        this.buildingModel = buildingModel;
        this.mtlRoad = mtlRoad;
        this.mtlRoadIntersection = mtlRoadIntersection;
        this.floorPlane = floorPlane;
        this.prisms = prisms;
        this.unitsPerBuilding = unitsPerBuilding;
        this.rowConfig = rowConfig;
        this.buildingConfig = buildingConfig;

        this.blockRows = [];
        this.init();
    }

    init() {
        this.prisms.forEach((prism, index) => {
            const rowSeed = this.seed + "_row_" + index;
            const blockRow = new BlockRow(
                prism,
                this.floorPlane,
                this.unitsPerBuilding,
                this.mtlRoad,
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
    }

    setUnitsPerBuilding(val) {
        this.unitsPerBuilding = val;
        this.blockRows.forEach(row => {
            row.unitsPerBuilding = val;
        });
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
    }
}
