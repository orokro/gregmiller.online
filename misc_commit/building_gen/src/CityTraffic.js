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
        
        // Ensure turnRadius is large enough to prevent degenerate/inverted Bezier curves on inner turns
        // If turnRadius <= laneOffset, P1 and P2 cross, causing a 180 flip.
        let turnRadius = this.options.turnRadius || 2.5;
        if (turnRadius <= laneOffset) {
            turnRadius = laneOffset + 1.0;
        }

        // 1. Calculate Z Planes (Intersection Centers)
        const zPlanes = [];
        if (this.prisms.length > 0) {
            const p0 = this.prisms[0];
            zPlanes.push(p0.position.z - (p0.scale.z / 2) - (this.options.spacing / 2));
            for (let i = 0; i < this.prisms.length; i++) {
                const p = this.prisms[i];
                zPlanes.push(p.position.z + (p.scale.z / 2) + (this.options.spacing / 2));
            }
        }

        this.nodes = [];
        this.edges = [];

        // Helper to add node
        const addNode = (pos, type) => {
            this.nodes.push({ pos: pos.clone(), type, out: [] });
            return this.nodes.length - 1;
        };

        // Helper to add edge
        const addEdge = (from, to, type = 'linear', controlPos = null) => {
            const edge = {
                index: this.edges.length,
                from,
                to,
                type,
                controlPos,
                start: this.nodes[from].pos,
                end: this.nodes[to].pos
            };
            
            // Calc Length & Vector
            if (type === 'bezier' && controlPos) {
                const l1 = edge.start.distanceTo(controlPos);
                const l2 = controlPos.distanceTo(edge.end);
                edge.length = (l1 + l2) * 0.8; // Rough approx
            } else {
                edge.vector = edge.end.clone().sub(edge.start);
                edge.length = edge.vector.length();
            }

            this.nodes[from].out.push(edge);
            this.edges.push(edge);
            return edge;
        };

        // Storage for intersection "Ports"
        // gridPorts[rowIndex][colIndex] = { N_In, N_Out, S_In, S_Out, E_In, E_Out, W_In, W_Out }
        const gridPorts = []; 

        // 2. Build Intersections & Ports
        // Columns: 0 = Left Road, 1 = Right Road
        const roadXs = [leftRoadX, rightRoadX];

        for (let r = 0; r < zPlanes.length; r++) {
            const z = zPlanes[r];
            const rowPorts = [];
            
            // Side Road Direction: Even = Left->Right (Eastbound), Odd = Right->Left (Westbound)
            const isEastbound = (r % 2 === 0);
            const isFirstRow = (r === 0);
            const isLastRow = (r === zPlanes.length - 1);

            for (let c = 0; c < 2; c++) {
                const x = roadXs[c];
                const ports = {};

                // Main Road (North/South) - Always Bi-directional
                // North Port (Top of intersection)
                ports.North_In = addNode(new THREE.Vector3(x - laneOffset, layout.floorY, z - turnRadius), 'port'); // Southbound In
                ports.North_Out = addNode(new THREE.Vector3(x + laneOffset, layout.floorY, z - turnRadius), 'port'); // Northbound Out

                // South Port (Bottom of intersection)
                ports.South_In = addNode(new THREE.Vector3(x + laneOffset, layout.floorY, z + turnRadius), 'port'); // Northbound In
                ports.South_Out = addNode(new THREE.Vector3(x - laneOffset, layout.floorY, z + turnRadius), 'port'); // Southbound Out

                // Side Road (East/West) - Alternating
                if (isEastbound) {
                    // Traffic moves West -> East
                    ports.West_In = addNode(new THREE.Vector3(x - turnRadius, layout.floorY, z), 'port');
                    ports.East_Out = addNode(new THREE.Vector3(x + turnRadius, layout.floorY, z), 'port');
                } else {
                    // Traffic moves East -> West
                    ports.East_In = addNode(new THREE.Vector3(x + turnRadius, layout.floorY, z), 'port');
                    ports.West_Out = addNode(new THREE.Vector3(x - turnRadius, layout.floorY, z), 'port');
                }
                
                // --- INTERNAL TURNS ---
                // Connect In-Ports to Out-Ports
                
                // 1. Southbound Arrival (from North_In)
                // - Can go Straight (to South_Out) IF NOT Last Row (Bottom)
                if (!isLastRow) {
                    addEdge(ports.North_In, ports.South_Out, 'linear');
                }
                // - Can turn?
                if (isEastbound) {
                    // Moving Left->Right. Can turn Left (East). 
                    addEdge(ports.North_In, ports.East_Out, 'bezier', new THREE.Vector3(x - laneOffset, layout.floorY, z));
                } else {
                    // Moving Right->Left. Can turn Right (West).
                    addEdge(ports.North_In, ports.West_Out, 'bezier', new THREE.Vector3(x - laneOffset, layout.floorY, z));
                }

                // 2. Northbound Arrival (from South_In)
                // - Can go Straight (to North_Out) IF NOT First Row (Top)
                if (!isFirstRow) {
                    addEdge(ports.South_In, ports.North_Out, 'linear');
                }
                // - Can turn?
                if (isEastbound) {
                    // Moving Left->Right. Can turn Right (East).
                    addEdge(ports.South_In, ports.East_Out, 'bezier', new THREE.Vector3(x + laneOffset, layout.floorY, z));
                } else {
                    // Moving Right->Left. Can turn Left (West).
                    addEdge(ports.South_In, ports.West_Out, 'bezier', new THREE.Vector3(x + laneOffset, layout.floorY, z));
                }

                // 3. Side Road Arrival
                if (isEastbound) {
                    // Arriving at West_In.
                    // Can turn Left (North) -> North_Out (Cross turn)
                    // Only if not Top Row (would lead to dead end)
                    if (!isFirstRow) {
                        addEdge(ports.West_In, ports.North_Out, 'bezier', new THREE.Vector3(x, layout.floorY, z));
                    }
                    
                    // Can turn Right (South) -> South_Out (Short turn)
                    // Only if not Bottom Row
                    if (!isLastRow) {
                        addEdge(ports.West_In, ports.South_Out, 'bezier', new THREE.Vector3(x - laneOffset, layout.floorY, z));
                    }
                    
                    // Can go Straight? Only if internal road exists.
                    addEdge(ports.West_In, ports.East_Out, 'linear');
                } else {
                    // Arriving at East_In.
                    // Can turn Right (North) -> North_Out
                    if (!isFirstRow) {
                        addEdge(ports.East_In, ports.North_Out, 'bezier', new THREE.Vector3(x + laneOffset, layout.floorY, z));
                    }
                    
                    // Can turn Left (South) -> South_Out
                    if (!isLastRow) {
                        addEdge(ports.East_In, ports.South_Out, 'bezier', new THREE.Vector3(x, layout.floorY, z));
                    }
                    
                    // Straight
                    addEdge(ports.East_In, ports.West_Out, 'linear');
                }

                rowPorts.push(ports);
            }
            gridPorts.push(rowPorts);
        }

        // 3. Build Road Segments (Connecting Intersections)
        
        // Vertical Roads (North/South)
        // Connect Row R South_Out to Row R+1 North_In (Southbound)
        // Connect Row R+1 North_Out to Row R South_In (Northbound)
        for (let c = 0; c < 2; c++) {
            for (let r = 0; r < gridPorts.length - 1; r++) {
                const top = gridPorts[r][c];
                const btm = gridPorts[r+1][c];
                
                // Southbound
                addEdge(top.South_Out, btm.North_In, 'linear');
                // Northbound
                addEdge(btm.North_Out, top.South_In, 'linear');
            }
            
            // Extensions (Top/Bottom infinity) removed for closed loop effect
            // Only internal side roads act as spawn points now? 
            // The prompt says "The only in/out points should be on the end of SideRoads".
            // So we do NOT add the Top/Bottom extensions.
        }

        // Horizontal Roads (East/West)
        for (let r = 0; r < gridPorts.length; r++) {
            const left = gridPorts[r][0]; // Left Intersection
            const right = gridPorts[r][1]; // Right Intersection
            const isEastbound = (r % 2 === 0);

            if (isEastbound) {
                // Left -> Right
                // Connect Left East_Out to Right West_In
                addEdge(left.East_Out, right.West_In, 'linear');
                
                // Extensions
                if (left.West_In !== undefined) {
                    const lStartPos = this.nodes[left.West_In].pos.clone().add(new THREE.Vector3(-30,0,0));
                    const lStart = addNode(lStartPos, 'endpoint');
                    addEdge(lStart, left.West_In, 'linear');
                }
                if (right.East_Out !== undefined) {
                    const rEndPos = this.nodes[right.East_Out].pos.clone().add(new THREE.Vector3(30,0,0));
                    const rEnd = addNode(rEndPos, 'endpoint');
                    addEdge(right.East_Out, rEnd, 'linear');
                }
            } else {
                // Right -> Left
                // Connect Right West_Out to Left East_In
                addEdge(right.West_Out, left.East_In, 'linear');
                
                // Extensions
                if (right.East_In !== undefined) {
                    const rStartPos = this.nodes[right.East_In].pos.clone().add(new THREE.Vector3(30,0,0));
                    const rStart = addNode(rStartPos, 'endpoint');
                    addEdge(rStart, right.East_In, 'linear');
                }
                if (left.West_Out !== undefined) {
                    const lEndPos = this.nodes[left.West_Out].pos.clone().add(new THREE.Vector3(-30,0,0));
                    const lEnd = addNode(lEndPos, 'endpoint');
                    addEdge(left.West_Out, lEnd, 'linear');
                }
            }
        }
        
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
            // Prefer linear road segments for random spawns, avoid intersections
            const roadEdges = this.edges.filter(e => e.type === 'linear');
            edge = roadEdges[Math.floor(Math.random() * roadEdges.length)];
            u = Math.random();
        } else {
            // Find edges starting from 'endpoint' nodes
            const entryEdges = this.edges.filter(e => this.nodes[e.from].type === 'endpoint');
            if (entryEdges.length === 0) return;
            edge = entryEdges[Math.floor(Math.random() * entryEdges.length)];
            u = 0;
        }

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
            speed: this.options.speed * (0.8 + Math.random() * 0.4), // Var speed
            framesAlive: 0
        };

        // Pre-calculate next edge
        this.pickNextEdge(car);
        
        this.cars.push(car);
        this.updateCarPos(car);
    }

    pickNextEdge(car) {
        const endNode = this.nodes[car.edge.to];
        if (endNode.out.length > 0) {
            car.nextEdge = endNode.out[Math.floor(Math.random() * endNode.out.length)];
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
            car.framesAlive++;
        }
    }

    updateCarPos(car) {
        let pos = new THREE.Vector3();
        let lookTarget = new THREE.Vector3();

        if (car.edge.type === 'bezier' && car.edge.controlPos) {
            const p0 = car.edge.start;
            const p1 = car.edge.controlPos;
            const p2 = car.edge.end;
            
            this.getBezier(p0, p1, p2, car.u, pos);
            this.getBezierTangent(p0, p1, p2, car.u, lookTarget);
            lookTarget.add(pos);
        } else {
            pos.lerpVectors(car.edge.start, car.edge.end, car.u);
            
            if (car.edge.vector) {
                lookTarget.copy(pos).add(car.edge.vector);
            } else {
                // Fallback if vector missing
                lookTarget.copy(car.edge.end);
            }
        }

        // Store old rotation
        const oldQ = car.container.quaternion.clone();

        car.container.position.copy(pos);
        
        // Convert lookTarget to World for lookAt, because container is in trafficGroup (child of City)
        this.localToWorld(lookTarget); 
        car.container.lookAt(lookTarget);

        // Rotation Smoothing / Glitch Rejection
        // If angle change is > 45 degrees in one frame (impossible for car), reject it.
        // This handles the "flip back and forth" issues near turn boundaries.
        if (car.framesAlive > 5) {
            const angle = oldQ.angleTo(car.container.quaternion);
            if (angle > 0.8) { // ~45 degrees
                car.container.quaternion.copy(oldQ);
            }
        }
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