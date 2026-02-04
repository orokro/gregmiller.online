import * as THREE from 'three';
import { computeBlockRowLayout } from './utils/LayoutUtils.js';

export default class CityTraffic extends THREE.Object3D {
    constructor(floorPlane, prisms, unitsPerBuilding, rowConfig, carAsset, options = {}) {
        super();
        this.floorPlane = floorPlane;
        this.prisms = prisms || [];
        this.unitsPerBuilding = unitsPerBuilding;
        this.rowConfig = rowConfig || {};
        this.carAsset = carAsset;
        
        this.options = {
            maxCars: 20,
            carSize: 2.0,
            speed: 5.0,
            spacing: 5.0, // Side road spacing default
            ...options
        };

        this.cars = []; // { mesh, edgeIndex, u, speed }
        this.nodes = []; // { id, pos: Vector3, out: [] }
        this.edges = []; // { id, from, to, len, vectors: [v1, v2] }
        
        this.clock = new THREE.Clock();
        
        // Group for car meshes
        this.trafficGroup = new THREE.Group();
        this.add(this.trafficGroup);

        // Initial Build
        this.rebuildGraph();
        this.spawnInitialCars();
    }

    setPrisms(prisms) {
        this.prisms = prisms;
        this.rebuildGraph();
    }

    setPrismSpacing(val) {
        this.options.spacing = val;
        this.rebuildGraph();
    }

    rebuildGraph() {
        // Clear old graph data, but keep car logical states if possible?
        // "cars should stay locked to the street their on".
        // We need to map old edges to new edges?
        // Simplest: Rebuild graph, then try to remap cars to nearest new edge/u?
        // Or if graph structure is deterministic (Edge indices match), we just update Node positions.
        
        // We will assume deterministic structure based on prism count.
        // If prism count changes, indices shift. Cars might despawn or jump. 
        // For simple drag updates (count same), structure is stable.

        if (!this.prisms || this.prisms.length === 0) return;

        // 1. Calculate Layouts
        // We assume all blocks share similar layout logic based on the FIRST prism for vertical alignment?
        // Or we calculate per prism?
        // BlockRow layout calculates road centers based on Prism Width.
        // If Prisms have different widths, vertical roads wiggle?
        // Usually vertical roads are straight. "Prisms should all share a similar width".
        // Let's use the first prism to define the Vertical Road Lines.
        
        const refPrism = this.prisms[0];
        const layout = computeBlockRowLayout(refPrism, this.floorPlane, this.unitsPerBuilding, this.rowConfig);
        
        const leftRoadX = -layout.left.roadCenter;
        const rightRoadX = layout.right.roadCenter;
        const roadWidth = layout.left.roadWidth; // Assuming symmetric width setting
        
        // Vertical Lane Offsets (from road center)
        // South (+Z) on Right side (Negative X relative to center? No)
        // Standard Right Hand Traffic:
        // Road going North (-Z): Right side is +X relative to center.
        // Road going South (+Z): Right side is -X relative to center.
        
        // Let's say Lane Offset = roadWidth * 0.25 (Center of right lane).
        const laneOffset = roadWidth * 0.25;

        // 2. Define Z-planes for Side Roads
        // "N+1" side roads.
        // 0: Before P0.
        // i: After P(i-1).
        const zPlanes = [];
        
        // Logic from CityGrid.updateSideRoadPositions
        if (this.prisms.length > 0) {
            const p0 = this.prisms[0];
            // Top (Back) Z
            zPlanes.push(p0.position.z - (p0.scale.z / 2) - (this.options.spacing / 2));
            
            for (let i = 0; i < this.prisms.length; i++) {
                const p = this.prisms[i];
                // Bottom (Front) Z of this prism gap
                zPlanes.push(p.position.z + (p.scale.z / 2) + (this.options.spacing / 2));
            }
        }

        // 3. Build Nodes & Edges
        // We'll reuse existing arrays if lengths match to preserve refs?
        // Or just clear and rebuild, and fix cars later.
        // Let's rebuild and remap cars.
        
        const newNodes = [];
        const newEdges = [];

        // Helper to get/create node
        const createNode = (x, z, type) => {
            newNodes.push({ pos: new THREE.Vector3(x, layout.floorY, z), type, out: [] });
            return newNodes.length - 1;
        };

        // Grid of Intersections: [Z_index][Left/Right]
        const gridNodes = [];

        for (let i = 0; i < zPlanes.length; i++) {
            const z = zPlanes[i];
            const leftIdx = createNode(leftRoadX, z, 'intersection');
            const rightIdx = createNode(rightRoadX, z, 'intersection');
            gridNodes.push([leftIdx, rightIdx]);
            
            // External Entry/Exit Nodes for Side Roads
            // Extended out by some amount
            const extDist = 20; 
            const leftExtIdx = createNode(leftRoadX - extDist, z, 'endpoint');
            const rightExtIdx = createNode(rightRoadX + extDist, z, 'endpoint');
            
            // Side Road Edges (Alternating)
            const isLeftToRight = (i % 2 === 0);
            
            if (isLeftToRight) {
                // Left Ext -> Left Int -> Right Int -> Right Ext
                newEdges.push({ from: leftExtIdx, to: leftIdx, lanes: [0] }); // Entry
                newEdges.push({ from: leftIdx, to: rightIdx, lanes: [0] }); // Cross
                newEdges.push({ from: rightIdx, to: rightExtIdx, lanes: [0] }); // Exit
            } else {
                // Right Ext -> Right Int -> Left Int -> Left Ext
                newEdges.push({ from: rightExtIdx, to: rightIdx, lanes: [0] }); // Entry
                newEdges.push({ from: rightIdx, to: leftIdx, lanes: [0] }); // Cross
                newEdges.push({ from: leftIdx, to: leftExtIdx, lanes: [0] }); // Exit
            }
        }

        // Vertical Edges (Between Z planes)
        // Left Road (North & South)
        // Right Road (North & South)
        
        for (let i = 0; i < zPlanes.length - 1; i++) {
            const rowTopZ = i;
            const rowBtmZ = i + 1;
            
            const lTop = gridNodes[rowTopZ][0];
            const lBtm = gridNodes[rowBtmZ][0];
            const rTop = gridNodes[rowTopZ][1];
            const rBtm = gridNodes[rowBtmZ][1];

            // Left Road
            // South Lane (+Z): Top -> Btm. X = LeftX - Offset (Right side of road going South)
            // North Lane (-Z): Btm -> Top. X = LeftX + Offset (Right side of road going North)
            newEdges.push({ from: lTop, to: lBtm, offset: -laneOffset }); // South
            newEdges.push({ from: lBtm, to: lTop, offset: laneOffset }); // North

            // Right Road
            // South Lane (+Z): Top -> Btm. X = RightX - Offset
            // North Lane (-Z): Btm -> Top. X = RightX + Offset
            newEdges.push({ from: rTop, to: rBtm, offset: -laneOffset }); // South
            newEdges.push({ from: rBtm, to: rTop, offset: laneOffset }); // North
        }

        // Update stored graph
        this.nodes = newNodes;
        this.edges = newEdges;

        // Precompute Edge Vectors
        this.edges.forEach((edge, i) => {
            edge.index = i;
            const n1 = this.nodes[edge.from];
            const n2 = this.nodes[edge.to];
            
            // Apply offsets if vertical
            const p1 = n1.pos.clone();
            const p2 = n2.pos.clone();
            
            if (edge.offset !== undefined) {
                p1.x += edge.offset;
                p2.x += edge.offset;
            }
            
            edge.vector = p2.clone().sub(p1);
            edge.length = edge.vector.length();
            edge.start = p1;
            edge.end = p2;
            
            // Link to nodes
            n1.out.push(edge);
        });
        
        this.updateCarsVisuals();
    }

    spawnInitialCars() {
        if (!this.carAsset) return;
        
        for (let i = 0; i < this.options.maxCars; i++) {
            this.spawnCar(true);
        }
    }

    spawnCar(randomPos = false) {
        if (!this.carAsset || this.edges.length === 0) return;

        // Pick an edge
        let edge;
        let u = 0;

        if (randomPos) {
            // Pick any edge
            edge = this.edges[Math.floor(Math.random() * this.edges.length)];
            u = Math.random();
        } else {
            // Pick an "Entry" edge
            // Entry edges start at 'endpoint' nodes.
            const entryEdges = this.edges.filter(e => this.nodes[e.from].type === 'endpoint');
            if (entryEdges.length === 0) return;
            edge = entryEdges[Math.floor(Math.random() * entryEdges.length)];
            u = 0;
        }

        const mesh = this.carAsset.scene.clone();
        const scale = this.options.carSize;
        mesh.scale.set(scale, scale, scale);
        
        // Color variation?
        mesh.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                // Random color tint? c.material.color.setHex(...)
            }
        });

        // Wrap in container for rotation fix
        const container = new THREE.Object3D();
        container.up.set(0, 0, 1); // Set Up vector to Z for correct lookAt in Z-up world
        container.add(mesh);
        
        // Fix rotation: Rotate 180 degrees if model faces backwards
        mesh.rotation.y = Math.PI;

        this.trafficGroup.add(container);
        
        this.cars.push({
            container,
            mesh,
            edge,
            edgeIndex: edge.index,
            u,
            speed: this.options.speed * (0.8 + Math.random() * 0.4) // Var speed
        });
        
        this.updateCarPos(this.cars[this.cars.length-1]);
    }

    updateTraffic(dt) {
        // const delta = this.clock.getDelta(); // Or use passed dt
        const delta = dt || 0.016; // Use passed dt or fixed step
        
        // Move Cars
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            
            // Move along edge
            // Speed is units/sec. u is 0..1.
            // du = (speed * dt) / length
            const du = (car.speed * delta) / car.edge.length;
            car.u += du;

            // Check End
            if (car.u >= 1.0) {
                // Reached Node
                const endNode = this.nodes[car.edge.to];
                
                if (endNode.out.length === 0 || endNode.type === 'endpoint') {
                    // Dead end or exit -> Despawn
                    this.despawnCar(i);
                    this.spawnCar(false); // Spawn new one at entry
                    continue;
                } else {
                    // Pick next edge
                    const nextEdge = endNode.out[Math.floor(Math.random() * endNode.out.length)];
                    car.edge = nextEdge;
                    car.edgeIndex = nextEdge.index;
                    car.u = 0;
                }
            }
            
            this.updateCarPos(car);
        }
    }

    updateCarPos(car) {
        const p = new THREE.Vector3().lerpVectors(car.edge.start, car.edge.end, car.u);
        car.container.position.copy(p);
        
        // Convert local target to world for lookAt fix in rotated coordinate systems
        const targetWorld = car.edge.end.clone();
        car.container.parent.localToWorld(targetWorld);
        car.container.lookAt(targetWorld);
    }
    
    updateCarsVisuals() {
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            // Try to map to new edge
            if (this.edges[car.edgeIndex]) {
                car.edge = this.edges[car.edgeIndex];
                this.updateCarPos(car);
            } else {
                // Out of bounds
                this.despawnCar(i);
                // Replenish?
                this.spawnCar(false);
            }
        }
    }

    despawnCar(index) {
        const car = this.cars[index];
        this.trafficGroup.remove(car.container);
        this.cars.splice(index, 1);
    }
}
