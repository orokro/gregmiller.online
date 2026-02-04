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
            turnRadius: 2.0,
            ...options
        };

        this.cars = []; // { container, edgeIndex, u, speed }
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
        if (!this.prisms || this.prisms.length === 0) return;

        const refPrism = this.prisms[0];
        const layout = computeBlockRowLayout(refPrism, this.floorPlane, this.unitsPerBuilding, this.rowConfig);
        
        const leftRoadX = -layout.left.roadCenter;
        const rightRoadX = layout.right.roadCenter;
        const roadWidth = layout.left.roadWidth; 
        
        const laneOffset = roadWidth * 0.25;

        const zPlanes = [];
        if (this.prisms.length > 0) {
            const p0 = this.prisms[0];
            zPlanes.push(p0.position.z - (p0.scale.z / 2) - (this.options.spacing / 2));
            
            for (let i = 0; i < this.prisms.length; i++) {
                const p = this.prisms[i];
                zPlanes.push(p.position.z + (p.scale.z / 2) + (this.options.spacing / 2));
            }
        }

        const newNodes = [];
        const newEdges = [];

        const createNode = (x, z, type) => {
            newNodes.push({ pos: new THREE.Vector3(x, layout.floorY, z), type, out: [] });
            return newNodes.length - 1;
        };

        const gridNodes = [];

        for (let i = 0; i < zPlanes.length; i++) {
            const z = zPlanes[i];
            const leftIdx = createNode(leftRoadX, z, 'intersection');
            const rightIdx = createNode(rightRoadX, z, 'intersection');
            gridNodes.push([leftIdx, rightIdx]);
            
            const extDist = 20; 
            const leftExtIdx = createNode(leftRoadX - extDist, z, 'endpoint');
            const rightExtIdx = createNode(rightRoadX + extDist, z, 'endpoint');
            
            const isLeftToRight = (i % 2 === 0);
            
            if (isLeftToRight) {
                newEdges.push({ from: leftExtIdx, to: leftIdx, lanes: [0] });
                newEdges.push({ from: leftIdx, to: rightIdx, lanes: [0] });
                newEdges.push({ from: rightIdx, to: rightExtIdx, lanes: [0] });
            } else {
                newEdges.push({ from: rightExtIdx, to: rightIdx, lanes: [0] });
                newEdges.push({ from: rightIdx, to: leftIdx, lanes: [0] });
                newEdges.push({ from: leftIdx, to: leftExtIdx, lanes: [0] });
            }
        }

        for (let i = 0; i < zPlanes.length - 1; i++) {
            const rowTopZ = i;
            const rowBtmZ = i + 1;
            
            const lTop = gridNodes[rowTopZ][0];
            const lBtm = gridNodes[rowBtmZ][0];
            const rTop = gridNodes[rowTopZ][1];
            const rBtm = gridNodes[rowBtmZ][1];

            newEdges.push({ from: lTop, to: lBtm, offset: -laneOffset }); // South
            newEdges.push({ from: lBtm, to: lTop, offset: laneOffset }); // North

            newEdges.push({ from: rTop, to: rBtm, offset: -laneOffset }); // South
            newEdges.push({ from: rBtm, to: rTop, offset: laneOffset }); // North
        }

        this.nodes = newNodes;
        this.edges = newEdges;

        this.edges.forEach((edge, i) => {
            edge.index = i;
            const n1 = this.nodes[edge.from];
            const n2 = this.nodes[edge.to];
            
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

        let edge;
        let u = 0;

        if (randomPos) {
            edge = this.edges[Math.floor(Math.random() * this.edges.length)];
            u = Math.random();
        } else {
            const entryEdges = this.edges.filter(e => this.nodes[e.from].type === 'endpoint');
            if (entryEdges.length === 0) return;
            edge = entryEdges[Math.floor(Math.random() * entryEdges.length)];
            u = 0;
        }

        // Pick Random Car from Library
        const availableCars = this.carAsset.scene.children;
        if (!availableCars || availableCars.length === 0) return;
        
        const randomCar = availableCars[Math.floor(Math.random() * availableCars.length)];
        const mesh = randomCar.clone();

        const scale = this.options.carSize;
        mesh.scale.set(scale, scale, scale);
        
        // Color variation? (Optional, kept for variety)
        mesh.traverse(c => {
            if (c.isMesh) {
                c.material = c.material.clone();
                // c.material.color.setHex(...) 
            }
        });

        // Wrap in container for rotation fix
        const container = new THREE.Object3D();
        container.up.set(0, 0, 1); // Z-up fix
        container.add(mesh);
        
        // Fix rotation: Rotate 180 degrees if model faces backwards
        mesh.rotation.y = Math.PI;

        this.trafficGroup.add(container);
        
        const car = {
            container,
            mesh,
            edge,
            edgeIndex: edge.index,
            prevEdge: null,
            nextEdge: null,
            u,
            speed: this.options.speed * (0.8 + Math.random() * 0.4) // Var speed
        };

        // Pre-calculate next edge
        this.pickNextEdge(car);
        
        this.cars.push(car);
        this.updateCarPos(car);
    }

    pickNextEdge(car) {
        const endNode = this.nodes[car.edge.to];
        
        // 1. Disable U-Turns: Filter out edges that go back to where we just came from
        let validEdges = endNode.out.filter(e => e.to !== car.edge.from);
        
        // 2. Fallback: If no other choice (dead end), allow anything to keep cars moving
        if (validEdges.length === 0) validEdges = endNode.out;

        if (validEdges.length > 0 && endNode.type !== 'endpoint') {
            car.nextEdge = validEdges[Math.floor(Math.random() * validEdges.length)];
        } else {
            car.nextEdge = null;
        }
    }

    updateTraffic(dt) {
        const delta = dt || 0.016; 
        
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            
            const du = (car.speed * delta) / car.edge.length;
            car.u += du;

            if (car.u >= 1.0) {
                // Carry over overflow distance to the next edge to prevent teleportation/hiccups
                const oldLen = car.edge.length;
                const overflowDist = (car.u - 1.0) * oldLen;

                if (car.nextEdge) {
                    car.prevEdge = car.edge;
                    car.edge = car.nextEdge;
                    car.edgeIndex = car.edge.index;
                    
                    // Convert overflow distance to new 'u' coordinate
                    car.u = overflowDist / car.edge.length;
                    
                    // Pick the NEXT NEXT edge
                    this.pickNextEdge(car);
                } else {
                    // Reached end of line
                    this.despawnCar(i);
                    this.spawnCar(false); 
                    continue;
                }
            }
            
            this.updateCarPos(car);
        }
    }

    updateCarPos(car) {
        // Curve Settings
        const turnRadius = this.options.turnRadius;
        
        const currentLen = car.edge.length;
        const distOnEdge = car.u * currentLen;
        const distRemain = currentLen - distOnEdge;

        let pos = new THREE.Vector3();
        let lookTarget = new THREE.Vector3();
        let turning = false;

        // 1. Turning OUT (Leaving Start Node)
        // We need a previous edge to curve from
        if (car.prevEdge && distOnEdge < turnRadius) {
            const prevLen = car.prevEdge.length;
            const limit = Math.min(turnRadius, currentLen / 2, prevLen / 2);

            if (distOnEdge < limit) {
                turning = true;
                const P1 = car.edge.start; // Corner
                
                // P0: Back on previous edge
                const P0 = P1.clone().sub(car.prevEdge.vector.clone().normalize().multiplyScalar(limit));
                
                // P2: Forward on current edge
                const P2 = P1.clone().add(car.edge.vector.clone().normalize().multiplyScalar(limit));

                // Normalize t to 0.5 -> 1.0 (Second half of curve)
                const localT = distOnEdge / limit; // 0 to 1
                const t = 0.5 + (localT * 0.5);

                this.getBezier(P0, P1, P2, t, pos);
                this.getBezierTangent(P0, P1, P2, t, lookTarget);
                lookTarget.add(pos); // Convert direction to target point
            }
        }

        // 2. Turning IN (Approaching End Node)
        // We need a next edge to curve into
        if (!turning && car.nextEdge && distRemain < turnRadius) {
            const nextLen = car.nextEdge.length;
            const limit = Math.min(turnRadius, currentLen / 2, nextLen / 2);

            if (distRemain < limit) {
                turning = true;
                const P1 = car.edge.end; // Corner

                // P0: Back on current edge
                const P0 = P1.clone().sub(car.edge.vector.clone().normalize().multiplyScalar(limit));

                // P2: Forward on next edge
                const P2 = P1.clone().add(car.nextEdge.vector.clone().normalize().multiplyScalar(limit));

                // Normalize t to 0.0 -> 0.5 (First half of curve)
                const localT = (limit - distRemain) / limit; // 0 (at limit) to 1 (at corner)
                const t = localT * 0.5;

                this.getBezier(P0, P1, P2, t, pos);
                this.getBezierTangent(P0, P1, P2, t, lookTarget);
                lookTarget.add(pos);
            }
        }

        // 3. Linear (Straight)
        if (!turning) {
            pos.lerpVectors(car.edge.start, car.edge.end, car.u);
            
            // Look ahead
            lookTarget.copy(pos).add(car.edge.vector);
        }

        car.container.position.copy(pos);
        
        // Convert lookTarget to World for lookAt, because container is in trafficGroup (child of City)
        this.localToWorld(lookTarget); 
        car.container.lookAt(lookTarget);
    }

    getBezier(p0, p1, p2, t, target) {
        // Quadratic Bezier: (1-t)^2 * P0 + 2(1-t)t * P1 + t^2 * P2
        const mt = 1 - t;
        target.x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
        target.y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
        target.z = mt * mt * p0.z + 2 * mt * t * p1.z + t * t * p2.z;
    }

    getBezierTangent(p0, p1, p2, t, target) {
        // Derivative: 2(1-t)(P1-P0) + 2t(P2-P1)
        const mt = 1 - t;
        const term1 = p1.clone().sub(p0).multiplyScalar(2 * mt);
        const term2 = p2.clone().sub(p1).multiplyScalar(2 * t);
        target.copy(term1).add(term2).normalize();
    }
    
    updateCarsVisuals() {
        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            if (this.edges[car.edgeIndex]) {
                car.edge = this.edges[car.edgeIndex];
                this.updateCarPos(car);
            } else {
                this.despawnCar(i);
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