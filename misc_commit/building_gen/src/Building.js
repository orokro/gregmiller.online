import * as THREE from 'three';
import PRNG from './utils/PRNG.js';

export default class Building extends THREE.Object3D {
    constructor(glb, settings, seed) {
        super();
        this.settings = settings;
        this.prng = new PRNG(seed.toString());
        
        // Clone the GLB scene so we don't modify the original cached asset
        // Note: SkeletonUtils.clone() is safer for skinned meshes but standard clone 
        // is usually fine for static geometry. However, standard clone shares materials.
        // We will need to clone materials explicitly when we modify them.
        this.model = glb.scene.clone(); 
        this.add(this.model);

        this.processBuilding();
    }

    processBuilding() {
        // We will implement the steps from prompt.txt here
        
        // Find Scene Root
        const sceneRoot = this.model.getObjectByName("Scene");
        if (!sceneRoot) {
            console.error("Could not find 'Scene' in GLB");
            return;
        }

        const buildingBase = sceneRoot.getObjectByName("Building_Base");
        if (!buildingBase) {
            console.error("Could not find 'Building_Base'");
            return;
        }

        // 1. Facade
        this.setupFacade(buildingBase);

        // 3. Cornice
        this.setupCornice(buildingBase);

        // 5. Window Decor
        this.setupWindowDecor(buildingBase);

        // 6. Sides and Roof
        this.setupSidesAndRoof(buildingBase);

        // 6b. Windows
        this.setupWindows(buildingBase);
        
        // 7. Store Windows
        this.setupStoreWindows(buildingBase);

        // 8. Awnings
        this.setupAwnings(buildingBase);

        // 10. Fire Escapes
        this.setupFireEscapes(buildingBase);

        // 12. AC Units
        this.setupACUnits(buildingBase);

        // 13. Roof Items
        this.setupRoofItems(buildingBase);

        // 14. Vertical Scale
        this.applyVerticalScale(buildingBase);
    }

    // Helper to hex string to Color
    getColor(hexStr) {
        return new THREE.Color(hexStr.substring(0, 7)); // Ignore alpha if present for now
    }

    // Helper to pick random color from array in settings treated as gradient
    pickColorFromPalette(palette) {
        if (!palette || palette.length === 0) return new THREE.Color(0xffffff);
        if (palette.length === 1) return this.getColor(palette[0]);

        // Treat as gradient
        const t = this.prng.random(); // 0 to 1
        // Map t to indices
        const scaledT = t * (palette.length - 1);
        const index1 = Math.floor(scaledT);
        const index2 = Math.min(index1 + 1, palette.length - 1);
        const alpha = scaledT - index1;

        const c1 = this.getColor(palette[index1]);
        const c2 = this.getColor(palette[index2]);

        return c1.clone().lerp(c2, alpha);
    }

    setupFacade(root) {
        const facade = root.getObjectByName("Facade");
        const faceMtls = root.getObjectByName("Face_Mtls");
        
        if (facade && faceMtls) {
            // Pick random child from Face_Mtls
            const options = faceMtls.children;
            const picked = this.prng.pick(options);
            
            if (picked) {
                // Apply material
                facade.material = picked.material.clone();
                
                // Recolor
                const color = this.pickColorFromPalette(this.settings.facade_colors);
                facade.material.color = color;
            }
        }
        
        // Cleanup reference objects if desired, or hide them. 
        // The prompt says "delete some objects", implying we should remove the 'meta' objects from the scene graph.
        if (faceMtls) faceMtls.removeFromParent();
    }

    setupCornice(root) {
        const cornices = root.getObjectByName("Cornices");
        if (cornices) {
            const options = ["Cornice_01", "Cornice_02", "Cornice_03"];
            const keptName = this.prng.pick(options);
            
            let keptObj = null;

            // Iterate backwards to safely remove
            for (let i = cornices.children.length - 1; i >= 0; i--) {
                const child = cornices.children[i];
                if (child.name === keptName) {
                    keptObj = child;
                } else {
                    child.removeFromParent();
                }
            }

            if (keptObj) {
                keptObj.material = keptObj.material.clone();
                keptObj.material.color = this.pickColorFromPalette(this.settings.cornice_colors);
            }
        }
    }

    setupWindowDecor(root) {
        const winDecor = root.getObjectByName("Window_Decor");
        if (winDecor) {
             winDecor.material = winDecor.material.clone();
             winDecor.material.color = this.pickColorFromPalette(this.settings.cornice_colors);
        }
    }

    setupSidesAndRoof(root) {
        const building = root.getObjectByName("Building");
        if (building) {
            const cube = building.getObjectByName("Cube");
            const cube1 = building.getObjectByName("Cube_1");
            const cube2 = building.getObjectByName("Cube_2"); // Ignore

            if (cube) {
                cube.material = cube.material.clone();
                cube.material.color = this.pickColorFromPalette(this.settings.side_colors);
            }
            if (cube1) {
                cube1.material = cube1.material.clone();
                cube1.material.color = this.pickColorFromPalette(this.settings.roof_colors);
            }
        }
    }

    setupWindows(root) {
         const windows = root.getObjectByName("Windows");
         const mtlRefs = root.getObjectByName("MTL_Refs");
         
         if (windows && mtlRefs) {
             const winMtls = mtlRefs.getObjectByName("Windows_Mtls");
             if (winMtls) {
                 const picked = this.prng.pick(winMtls.children);
                 if (picked) {
                     windows.material = picked.material.clone();
                 }
                 winMtls.removeFromParent();
             }
         }
    }

    setupStoreWindows(root) {
        const storeWindows = root.getObjectByName("Store_Windows");
        const mtlRefs = root.getObjectByName("MTL_Refs");

        if (storeWindows && mtlRefs) {
            const storeMtls = mtlRefs.getObjectByName("Store_Window_Mtls");
            if (storeMtls) {
                 const picked = this.prng.pick(storeMtls.children);
                 if (picked) {
                     storeWindows.material = picked.material.clone();
                 }
                 storeMtls.removeFromParent();
            }
        }
    }

    setupAwnings(root) {
        const awningsGroup = root.getObjectByName("Awnings");
        if (!awningsGroup) return;

        const options = ["Box_Awning_01", "Box_Awning_02", "Box_Awning_03", "Box_Awning_04"];
        const pickedName = this.prng.pick(options);

        let pickedObj = null;

        for (let i = awningsGroup.children.length - 1; i >= 0; i--) {
            const child = awningsGroup.children[i];
            if (child.name === pickedName) {
                pickedObj = child;
            } else {
                child.removeFromParent();
            }
        }

        if (pickedObj) {
            // Recolor
            const sat = this.settings.awning_sat[pickedName] || 1;
            
            // Rejection sampling for Hue to strictly avoid Pink/Magenta
            // Range to avoid: 0.80 to 0.98
            let hue;
            let attempts = 0;
            do {
                hue = this.prng.random();
                attempts++;
            } while (hue > 0.80 && hue < 0.98 && attempts < 10);
            
            // Fallback if loop fails (unlikely) -> Red (0.99)
            if (hue > 0.80 && hue < 0.98) hue = 0.99;

            const color = new THREE.Color().setHSL(hue, sat, 0.5); // Value middle (0.5)

            // Awnings might be groups (Box_Awning_03) or meshes
            pickedObj.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color = color;
                }
            });
        }
    }

    setupFireEscapes(root) {
        const fireEscapes = root.getObjectByName("Fire_Escapes");
        if (!fireEscapes) return;

        // Odds check
        if (this.prng.random() > this.settings.fireescape_odds) {
            fireEscapes.removeFromParent();
            return;
        }

        const options = ["FE_A", "FE_B"];
        const pickedName = this.prng.pick(options);

        let pickedObj = null;
        for (let i = fireEscapes.children.length - 1; i >= 0; i--) {
             const child = fireEscapes.children[i];
             if (child.name === pickedName) {
                 pickedObj = child;
             } else {
                 child.removeFromParent();
             }
        }

        if (pickedObj) {
            // Color from palette (no gradient)
            const colorHex = this.prng.pick(this.settings.fireescape_colors);
            const color = this.getColor(colorHex);

             pickedObj.traverse((child) => {
                if (child.isMesh) {
                    child.material = child.material.clone();
                    child.material.color = color;
                }
            });
        }
    }

    setupACUnits(root) {
        const acUnits = root.getObjectByName("AC_Units");
        if (!acUnits) return;

        const windowsCount = 6;
        
        for (let i = 1; i <= windowsCount; i++) {
            const suffix = i.toString().padStart(2, '0'); // "01", "02"...
            const nameA = `AC_A_${suffix}`;
            const nameB = `AC_B_${suffix}`;

            const objA = acUnits.getObjectByName(nameA);
            const objB = acUnits.getObjectByName(nameB);

            // Check odds
            if (this.prng.random() > this.settings.window_ac_odds) {
                // Remove both
                if (objA) objA.removeFromParent();
                if (objB) objB.removeFromParent();
            } else {
                // Pick one
                const keepA = this.prng.bool();
                if (keepA) {
                    if (objB) objB.removeFromParent();
                } else {
                    if (objA) objA.removeFromParent();
                }
            }
        }
    }

    setupRoofItems(root) {
        const roofItems = root.getObjectByName("RoofItems");
        if (!roofItems) return;

        // 1. Clean up "Tall Items" if disabled
        if (!this.settings.tall_items) {
            const tallItems = ["RoofExit", "WaterTank"];
            tallItems.forEach(name => {
                const obj = roofItems.getObjectByName(name);
                if (obj) obj.removeFromParent();
            });
        }
        
        // Always delete Duct
        const duct = roofItems.getObjectByName("Duct");
        if (duct) duct.removeFromParent();

        // 2. Extract Prefabs (Templates)
        const prefabs = {};
        const potentialItems = [
            "Big_Vent", "Chimney", "Roof_AC", "RoofExit", "Skylight", 
            "Vent_01", "Vent_02", "Vent_03", "WaterTank"
        ];

        potentialItems.forEach(name => {
            const obj = roofItems.getObjectByName(name);
            if (obj) {
                prefabs[name] = obj.clone();
                prefabs[name].position.set(0, 0, 0);
                prefabs[name].rotation.set(0, 0, 0);
                // Do NOT reset scale. Some items like RoofExit depend on it.
                obj.removeFromParent();
            }
        });

        // 3. Establish Roof Coordinate System
        const roofCorners = root.getObjectByName("Roof_Corners");
        if (!roofCorners) return;

        const A = roofCorners.getObjectByName("A");
        const B = roofCorners.getObjectByName("B");
        const D = roofCorners.getObjectByName("D");

        if (!A || !B || !D) return;

        const posA = A.position.clone().applyMatrix4(roofCorners.matrix);
        const posB = B.position.clone().applyMatrix4(roofCorners.matrix);
        const posD = D.position.clone().applyMatrix4(roofCorners.matrix);

        const uVec = new THREE.Vector3().subVectors(posB, posA);
        const uLen = uVec.length();
        uVec.normalize();

        const vVec = new THREE.Vector3().subVectors(posD, posA);
        const vLen = vVec.length();
        vVec.normalize();

        const roofSystem = {
            origin: posA,
            uDir: uVec,
            vDir: vVec,
            width: uLen,
            depth: vLen
        };

        // 4. Generate Spawn Manifest
        const spawnQueue = [];

        // Chimney (Max 1)
        if (prefabs["Chimney"] && this.prng.bool(0.3)) {
            spawnQueue.push({ name: "Chimney", group: "Chimney", count: 1 });
        }

        // RoofExit (Max 1, Tall)
        if (this.settings.tall_items && prefabs["RoofExit"] && this.prng.bool(0.5)) {
            spawnQueue.push({ name: "RoofExit", group: "Single", count: 1 });
        }

        // WaterTank (Max 2, Tall)
        if (this.settings.tall_items && prefabs["WaterTank"] && this.prng.bool(0.5)) {
             // Explicitly pick 1 or 2
             const count = this.prng.pick([1, 2]);
             spawnQueue.push({ name: "WaterTank", group: "Single", count: count });
        }

        // Roof_AC (Max 3)
        if (prefabs["Roof_AC"] && this.prng.bool(0.6)) {
             const pattern = this.prng.pick(["Line", "L-Shape"]);
             const count = Math.floor(this.prng.range(1, 4)); // 1 to 3
             spawnQueue.push({ name: "Roof_AC", group: pattern, count: count });
        }

        // Skylight (Single, Pair, Grid)
        if (prefabs["Skylight"] && this.prng.bool(0.4)) {
            const pattern = this.prng.pick(["Single", "Pair", "Grid2x2"]);
            let count = 1;
            if (pattern === "Pair") count = 2;
            if (pattern === "Grid2x2") count = 4;
            spawnQueue.push({ name: "Skylight", group: pattern, count: count });
        }

        // Vents Cluster
        if (this.prng.bool(0.7)) {
            const count = Math.floor(this.prng.range(1, 5));
            const pattern = count === 3 ? "Triangle" : (count > 1 ? "Line" : "Single");
            const ventTypes = [];
            if (prefabs["Vent_01"]) ventTypes.push("Vent_01");
            if (prefabs["Vent_02"]) ventTypes.push("Vent_02");
            
            if (ventTypes.length > 0) {
                 spawnQueue.push({ 
                     name: "VentCluster", 
                     types: ventTypes, 
                     group: pattern, 
                     count: count 
                 });
            }
        }

        // Vent 03
        if (prefabs["Vent_03"] && this.prng.bool(0.5)) {
             const count = Math.floor(this.prng.range(1, 3));
             spawnQueue.push({ name: "Vent_03", group: "Single", count: count }); 
        }
        
         // Big_Vent
        if (prefabs["Big_Vent"] && this.prng.bool(0.4)) {
             const count = Math.floor(this.prng.range(1, 3));
             const pattern = count === 3 ? "Triangle" : "Line";
             spawnQueue.push({ name: "Big_Vent", group: pattern, count: count });
        }


        // 5. Placement Logic
        const placedRects = []; 
        
        const checkCollision = (rect) => {
            if (rect.u < 0 || rect.u + rect.w > roofSystem.width) return true;
            if (rect.v < 0 || rect.v + rect.d > roofSystem.depth) return true;
            for (const other of placedRects) {
                if (rect.u < other.u + other.w &&
                    rect.u + rect.w > other.u &&
                    rect.v < other.v + other.d &&
                    rect.v + rect.d > other.v) {
                    return true;
                }
            }
            return false;
        };

        const placeObject = (obj, u, v, w, d, scale, rotIdx) => {
             // Create Instance
            const instance = obj.clone();
            instance.scale.multiplyScalar(scale);
            // Rotate around Up
            instance.rotateY(rotIdx * (Math.PI / 2));

            // Position (u, v is Top-Left of rect)
            // But object pivot is bottom-center of bounding box?
            // "All the items have their 3d-origin ... at their bottom-center".
            // So if we have a rect (u, v, w, d), the Center X is u + w/2, Center Z is v + d/2.
            // We place the object at (CenterX, CenterZ).
            
            const centerU = u + w/2;
            const centerV = v + d/2;

            const pos = roofSystem.origin.clone()
                .add(roofSystem.uDir.clone().multiplyScalar(centerU))
                .add(roofSystem.vDir.clone().multiplyScalar(centerV));
            
            instance.position.copy(pos);
            root.add(instance);
        };

        const tryPlaceGroup = (task) => {
            // Determine Prefab & Dimensions
            const sampleName = task.name === "VentCluster" ? task.types[0] : task.name;
            const samplePrefab = prefabs[sampleName];
            if (!samplePrefab) return;

            const scale = this.prng.range(this.settings.roof_item_scales.min, this.settings.roof_item_scales.max);
            const rotIdx = Math.floor(this.prng.range(0, 4));

            // Measure single item footprint
            const box = new THREE.Box3().setFromObject(samplePrefab);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Apply Transform to dimensions
            const sx = size.x * scale;
            const sz = size.z * scale;
            
            // Footprint on Roof (swapping if rotated 90/270)
            let itemW = sx;
            let itemD = sz;
            if (rotIdx === 1 || rotIdx === 3) {
                itemW = sz;
                itemD = sx;
            }

            // Calculate Group Footprint
            let groupW = itemW;
            let groupD = itemD;
            const gap = 0.2; // small gap between items

            // Define Offsets for children relative to Group Top-Left
            const offsets = []; // {u, v}

            if (task.group === "Single" || task.count === 1) {
                offsets.push({u: 0, v: 0});
            } else if (task.group === "Pair") {
                // Side by side
                groupW = itemW * 2 + gap;
                offsets.push({u: 0, v: 0});
                offsets.push({u: itemW + gap, v: 0});
            } else if (task.group === "Grid2x2") {
                groupW = itemW * 2 + gap;
                groupD = itemD * 2 + gap;
                offsets.push({u: 0, v: 0});
                offsets.push({u: itemW + gap, v: 0});
                offsets.push({u: 0, v: itemD + gap});
                offsets.push({u: itemW + gap, v: itemD + gap});
            } else if (task.group === "Line") {
                // Horizontal Line
                groupW = (itemW + gap) * task.count - gap;
                for(let k=0; k<task.count; k++) {
                    offsets.push({u: k * (itemW + gap), v: 0});
                }
            } else if (task.group === "L-Shape") {
                // 3 items in L
                // XX
                // X
                groupW = itemW * 2 + gap;
                groupD = itemD * 2 + gap;
                offsets.push({u: 0, v: 0});
                offsets.push({u: itemW + gap, v: 0});
                offsets.push({u: 0, v: itemD + gap});
                // If count < 3, handled by slice later? task.count should match pattern ideally.
            } else if (task.group === "Triangle") {
                //   X
                // X   X
                groupW = itemW * 2 + gap;
                groupD = itemD * 2 + gap; // Roughly
                offsets.push({u: itemW/2 + gap/2, v: 0}); // Top Middle
                offsets.push({u: 0, v: itemD + gap}); // Bottom Left
                offsets.push({u: itemW + gap, v: itemD + gap}); // Bottom Right
            }

            // Safety: Ensure we don't spawn more than offsets available
            const spawnCount = Math.min(task.count, offsets.length);

            // Try Placement of Group Rect
            const maxAttempts = 20;
            for (let i = 0; i < maxAttempts; i++) {
                let u = this.prng.range(0, roofSystem.width - groupW);
                let v = this.prng.range(0, roofSystem.depth - groupD);

                // Chimney Rule override
                if (task.name === "Chimney") {
                    const edge = Math.floor(this.prng.range(0, 4));
                    if (edge === 0) u = 0;
                    else if (edge === 1) u = roofSystem.width - groupW;
                    else if (edge === 2) v = 0;
                    else if (edge === 3) v = roofSystem.depth - groupD;
                }
                
                // Skylight Rule: Margin
                if (task.name === "Skylight") {
                    const mU = roofSystem.width * 0.1;
                    const mV = roofSystem.depth * 0.1;
                    // Clamp selection to margin
                    u = this.prng.range(mU, roofSystem.width - groupW - mU);
                    v = this.prng.range(mV, roofSystem.depth - groupD - mV);
                    // If rect is too big for margin, this range might be invalid (min > max).
                    if (u > roofSystem.width - groupW - mU) continue; // Skip
                }

                const groupRect = { u, v, w: groupW, d: groupD };

                if (!checkCollision(groupRect)) {
                    // Success! Place Group
                    placedRects.push(groupRect);

                    // Place Children
                    for (let k = 0; k < spawnCount; k++) {
                        // Pick prefab
                        const pName = task.name === "VentCluster" ? this.prng.pick(task.types) : task.name;
                        const pObj = prefabs[pName];
                        if (pObj) {
                            const offset = offsets[k];
                            // Item Rect relative to Group U,V
                            // We don't need to register item rects if we registered the whole group rect.
                            placeObject(pObj, u + offset.u, v + offset.v, itemW, itemD, scale, rotIdx);
                        }
                    }
                    return;
                }
            }
        };

        // Execute Queue
        spawnQueue.forEach(task => tryPlaceGroup(task));
    }

    applyVerticalScale(root) {
        const scale = this.prng.range(this.settings.height_scale.min, this.settings.height_scale.max);
        
        // Scale along the Normal to ABCD.
        // Assuming global Z up (Blender) or Y up (Three).
        // The prompt says "entire building can be scaled vertically".
        // Since we are in Three.js, vertical is Y. 
        // However, we should respect the object's local space if it was imported with rotation.
        // GLTFLoader usually handles the coordinate conversion (Y up).
        
        // Let's assume standard Y-up for now.
        root.scale.y = scale;
    }
}
