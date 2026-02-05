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
            loggingEnabled: false,
            showColliders: false, // Debug: show red collision sensors
            collisionDistance: 1.5, // How far ahead to sense (multiplier of carSize)
            stopDuration: 0.5, // Seconds to wait after obstruction clears
            ...options
        };

        this.cars = []; // { container, edgeIndex, u, speed, id }
        this.nextCarId = 0;
        this.nodes = []; // { id, pos: Vector3, out: [] }
        this.edges = []; // { id, from, to, len, vectors: [v1, v2] }
        
        this.clock = new THREE.Clock();
        
        // Group for car meshes
        this.trafficGroup = new THREE.Group();
        this.add(this.trafficGroup);

        // Initial Build
        this.rebuildGraph();
    }

    dumpGraph() {
        console.log("--- CITY TRAFFIC GRAPH DUMP ---");
        console.log("Nodes:");
        this.nodes.forEach((n, i) => {
            console.log(`Node ${i}: type=${n.type}, pos=(${n.pos.x.toFixed(2)}, ${n.pos.y.toFixed(2)}, ${n.pos.z.toFixed(2)})`);
        });
        console.log("Edges:");
        this.edges.forEach((e, i) => {
            const from = e.from;
            const to = e.to;
            const type = e.type;
            const len = e.length.toFixed(2);
            let info = `Edge ${i}: from=${from}, to=${to}, type=${type}, len=${len}`;
            if (type === 'bezier') {
                info += `, ctrl=(${e.controlPos.x.toFixed(2)}, ${e.controlPos.y.toFixed(2)}, ${e.controlPos.z.toFixed(2)})`;
            }
            console.log(info);
        });
        console.log("--- END GRAPH DUMP ---");
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

        // 2. Dynamic Turn Radius Clamping
        // We must ensure that a port from one intersection does not "cross over" 
        // the port of the next intersection. This happens if 2 * turnRadius > gap.
        let baseTurnRadius = this.options.turnRadius || 2.5;
        let minGap = Infinity;
        for (let i = 0; i < zPlanes.length - 1; i++) {
            const gap = Math.abs(zPlanes[i+1] - zPlanes[i]);
            if (gap < minGap) minGap = gap;
        }
        
        // Clamp turnRadius to slightly less than half the smallest gap 
        // to ensure we always have a positive-length connector segment.
        let turnRadius = Math.min(baseTurnRadius, minGap * 0.45);

        // 3. Dynamic Lane Offset (The Fix for the "Backward Turn")
        // If the turnRadius is forced to be smaller than the laneOffset (due to small gaps),
        // the geometric turn becomes "inverted" (target is behind the start).
        // To fix this, we must effectively narrow the lanes at the intersection so they fit within the radius.
        // We ensure effectiveLaneOffset is always slightly smaller than turnRadius.
        let effectiveLaneOffset = laneOffset;
        if (effectiveLaneOffset >= turnRadius) {
            effectiveLaneOffset = Math.max(0.1, turnRadius - 0.1); 
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
                // Precise length calculation via 10-point integration
                let len = 0;
                let lastP = edge.start.clone();
                const tempP = new THREE.Vector3();
                for (let i = 1; i <= 10; i++) {
                    this.getBezier(edge.start, controlPos, edge.end, i / 10, tempP);
                    len += tempP.distanceTo(lastP);
                    lastP.copy(tempP);
                }
                edge.length = len;
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
                ports.North_In = addNode(new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z - turnRadius), 'port'); // Southbound In
                ports.North_Out = addNode(new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z - turnRadius), 'port'); // Northbound Out

                // South Port (Bottom of intersection)
                ports.South_In = addNode(new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z + turnRadius), 'port'); // Northbound In
                ports.South_Out = addNode(new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z + turnRadius), 'port'); // Southbound Out

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
                    addEdge(ports.North_In, ports.East_Out, 'bezier', new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z));
                } else {
                    // Moving Right->Left. Can turn Right (West).
                    addEdge(ports.North_In, ports.West_Out, 'bezier', new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z));
                }

                // 2. Northbound Arrival (from South_In)
                // - Can go Straight (to North_Out) IF NOT First Row (Top)
                if (!isFirstRow) {
                    addEdge(ports.South_In, ports.North_Out, 'linear');
                }
                // - Can turn?
                if (isEastbound) {
                    // Moving Left->Right. Can turn Right (East).
                    addEdge(ports.South_In, ports.East_Out, 'bezier', new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z));
                } else {
                    // Moving Right->Left. Can turn Left (West).
                    addEdge(ports.South_In, ports.West_Out, 'bezier', new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z));
                }

                // 3. Side Road Arrival
                if (isEastbound) {
                    // Arriving at West_In.
                    // Can turn Left (North) -> North_Out (Cross turn)
                    // Only if not Top Row (would lead to dead end)
                    if (!isFirstRow) {
                        addEdge(ports.West_In, ports.North_Out, 'bezier', new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z));
                    }
                    
                    // Can turn Right (South) -> South_Out (Short turn)
                    // Only if not Bottom Row
                    if (!isLastRow) {
                        addEdge(ports.West_In, ports.South_Out, 'bezier', new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z));
                    }
                    
                    // Can go Straight? Only if internal road exists.
                    addEdge(ports.West_In, ports.East_Out, 'linear');
                } else {
                    // Arriving at East_In.
                    // Can turn Right (North) -> North_Out
                    if (!isFirstRow) {
                        addEdge(ports.East_In, ports.North_Out, 'bezier', new THREE.Vector3(x + effectiveLaneOffset, layout.floorY, z));
                    }
                    
                    // Can turn Left (South) -> South_Out
                    if (!isLastRow) {
                        addEdge(ports.East_In, ports.South_Out, 'bezier', new THREE.Vector3(x - effectiveLaneOffset, layout.floorY, z));
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
            }
        });

        // Wrap in container for rotation fix
        const container = new THREE.Object3D();
        // Use Z-up with a tiny epsilon to avoid Gimbal Lock on North/South (+/- Z) travel
        container.up.set(0.0001, 0, 1); 
        container.add(mesh);
        
        // Fix rotation: Rotate 180 degrees if model faces backwards
        mesh.rotation.y = Math.PI;

        // Collision Sensor (Sphere)
        // Positioned forward relative to car size. +Z is forward in local space.
        const sensorDist = this.options.carSize * this.options.collisionDistance;
        const sensorGeo = new THREE.SphereGeometry(this.options.carSize * 0.3, 8, 8);
        const sensorMat = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            wireframe: true,
            visible: this.options.showColliders 
        });
        const sensor = new THREE.Mesh(sensorGeo, sensorMat);
        sensor.position.set(0, 0, sensorDist); 
        container.add(sensor);

        this.trafficGroup.add(container);
        
        const car = {
            id: this.nextCarId++,
            sensor,
            blocked: false,
            stopTime: 0,
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
        
        if (this.options.loggingEnabled) {
            console.log(`[Car ${car.id}] Spawned on Edge ${car.edge.index} (u=${car.u.toFixed(2)}). From Node ${car.edge.from} to Node ${car.edge.to}`);
        }

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
        
        // --- Collision Check (Every 15 frames) ---
        this.frameCount = (this.frameCount || 0) + 1;
        if (this.frameCount % 15 === 0) {
            const collisionThreshold = this.options.carSize * 1.2; // Radius of sensitivity around sensor
            const sensorWorldPos = new THREE.Vector3();
            
            for (const car of this.cars) {
                car.blocked = false;
                car.sensor.getWorldPosition(sensorWorldPos);

                for (const other of this.cars) {
                    if (car === other) continue;
                    
                    // Check if Sensor is inside Other Car's safety bubble
                    // We check distance to Other Car's CENTER
                    const dist = sensorWorldPos.distanceTo(other.container.position);
                    
                    if (dist < collisionThreshold) {
                        car.blocked = true;
                        // If blocked, ensure we wait a bit before retrying fully
                        car.stopTime = this.options.stopDuration;
                        break; 
                    }
                }
            }
        }

        for (let i = this.cars.length - 1; i >= 0; i--) {
            const car = this.cars[i];
            
            // Handle Stop Logic
            if (car.blocked) {
                car.stopTime = this.options.stopDuration; // Refresh wait while blocked
            }
            if (car.stopTime > 0) {
                car.stopTime -= delta;
                if (car.stopTime <= 0) {
                    car.stopTime = 0;
                    car.blocked = false; // Release block
                } else {
                    // Skip movement
                    continue; 
                }
            }

            let du;
            if (car.edge.type === 'bezier' && car.edge.controlPos) {
                // To maintain constant physical speed on a Bezier curve, 
                // we must scale 'du' by the magnitude of the velocity vector at current 'u'.
                const vel = new THREE.Vector3();
                this.getBezierVelocity(car.edge.start, car.edge.controlPos, car.edge.end, car.u, vel);
                const speedAtT = vel.length();
                du = (car.speed * delta) / Math.max(0.1, speedAtT);
            } else {
                du = (car.speed * delta) / car.edge.length;
            }
            
            car.u += du;

            if (car.u >= 1.0) {
                // Carry over overflow distance
                const oldLen = car.edge.length;
                const overflowDist = (car.u - 1.0) * oldLen;

                if (car.nextEdge) {
                    car.prevEdge = car.edge;
                    car.edge = car.nextEdge;
                    car.edgeIndex = car.edge.index;
                    car.u = overflowDist / car.edge.length;
                    
                    if (this.options.loggingEnabled) {
                        console.log(`[Car ${car.id}] Switched to Edge ${car.edge.index} (from ${car.prevEdge.index}). Node: ${car.prevEdge.to}. Type: ${car.edge.type}`);
                    }
                    
                    this.pickNextEdge(car);
                } else {
                    if (this.options.loggingEnabled) {
                        console.log(`[Car ${car.id}] Reached end of graph at Node ${car.edge.to}. Despawning.`);
                    }
                    this.despawnCar(i);
                    this.spawnCar(false); 
                    continue;
                }
            }
            
            this.updateCarPos(car);
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
            this.getBezierVelocity(p0, p1, p2, car.u, lookTarget);
            lookTarget.add(pos);
        } else {
            pos.lerpVectors(car.edge.start, car.edge.end, car.u);
            if (car.edge.vector) {
                lookTarget.copy(pos).add(car.edge.vector);
            } else {
                lookTarget.copy(car.edge.end);
            }
        }

        const oldRotation = car.container.quaternion.clone();

        car.container.position.copy(pos);
        
        // Convert to world space for lookAt
        const worldLookTarget = lookTarget.clone();
        this.localToWorld(worldLookTarget); 
        car.container.lookAt(worldLookTarget);

        // Hiccup detector
        const newRotation = car.container.quaternion;
        const angle = oldRotation.angleTo(newRotation);
        if (angle > (100 * Math.PI / 180)) {
            if (this.options.loggingEnabled) {
                console.log(`[Car ${car.id}] !!! ERROR TRIGGER NOTICED !!!`);
                console.log(`Large rotation detected: ${(angle * 180 / Math.PI).toFixed(2)} degrees`);
                console.log(`Car is on Edge ${car.edgeIndex} (u=${car.u.toFixed(3)}). Type: ${car.edge.type}`);
                console.log(`From Node ${car.edge.from} to Node ${car.edge.to}`);
            }
        }
    }

    getBezier(p0, p1, p2, t, target) {
        const mt = 1 - t;
        target.x = mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x;
        target.y = mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y;
        target.z = mt * mt * p0.z + 2 * mt * t * p1.z + t * t * p2.z;
    }

    getBezierVelocity(p0, p1, p2, t, target) {
        // Unnormalized derivative for physics/speed calculation
        const mt = 1 - t;
        const term1 = p1.clone().sub(p0).multiplyScalar(2 * mt);
        const term2 = p2.clone().sub(p1).multiplyScalar(2 * t);
        target.copy(term1).add(term2);
    }

    getBezierTangent(p0, p1, p2, t, target) {
        this.getBezierVelocity(p0, p1, p2, t, target);
        target.normalize();
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