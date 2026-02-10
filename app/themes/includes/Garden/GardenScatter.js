import * as THREE from 'three';
import PRNG from '../../../utils/PRNG.js';

export class GardenScatter extends THREE.Object3D {
    constructor(model, bgPlane, prisms, settings) {
        super();
        this.model = model;
        this.bgPlane = bgPlane;
        this.prisms = prisms;
        this.settings = settings || {};

        this.cells = new Map(); // key -> { items: [] }
        this.cellSize = 300; // Adjusted for pixel-scale units (was 10)
        this.shadowEnabled = false;

        // Cache for change detection
        this.lastPrismState = '';
        this.lastBgState = '';

        this.library = [];
        if (this.model) {
            this.model.traverse((child) => {
                if (child.isMesh && child.name.toLowerCase().includes('leaf')) {
                    this.library.push(child);
                }
            });
        }

        this.update(prisms, this.settings);
    }

    /**
     * Generates a signature string for the current prism state.
     * Used to detect if prisms have moved or resized.
     */
    getPrismState(prisms) {
        let sig = "";
        const v = new THREE.Vector3();
        for (let i = 0; i < prisms.length; i++) {
            const p = prisms[i];
            // We need world position for the signature since that's what we cull against
            v.setFromMatrixPosition(p.matrixWorld);
            sig += `${p.id}:${v.x.toFixed(0)},${v.y.toFixed(0)},${p.scale.x.toFixed(0)},${p.scale.y.toFixed(0)}|`;
        }
        return sig;
    }

    update(prisms, settings) {
        const oldSettings = this.settings;
        this.prisms = prisms;
        this.settings = settings;

        // Check if we need to completely regenerate cell contents
        const needsRegen = !oldSettings ||
            settings.seed !== oldSettings.seed ||
            settings.density !== oldSettings.density ||
            settings.rotationAxis !== oldSettings.rotationAxis ||
            JSON.stringify(settings.xRot) !== JSON.stringify(oldSettings.xRot) ||
            JSON.stringify(settings.yRot) !== JSON.stringify(oldSettings.yRot) ||
            JSON.stringify(settings.zRot) !== JSON.stringify(oldSettings.zRot) ||
            settings.randomRotation !== oldSettings.randomRotation;

        // Check geometry changes (bg plane size)
        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;
        const bgState = `${gW.toFixed(0)}_${gH.toFixed(0)}`;

        // Check prism changes
        const prismState = this.getPrismState(prisms);

        const layoutChanged = bgState !== this.lastBgState;
        const prismsChanged = prismState !== this.lastPrismState;

        this.lastBgState = bgState;
        this.lastPrismState = prismState;

        if (needsRegen) {
            this.clearAll();
            this.refresh(gW, gH, true);
        } else if (layoutChanged) {
            this.refresh(gW, gH, true);
        } else if (prismsChanged) {
            // If only prisms moved, just re-cull, don't regen grid
            this.updateItems(gW, gH);
        }
    }

    refresh(gW, gH, fullUpdate = false) {
        const { density = 0 } = this.settings;
        const refArea = 270; // Reference area for density
        const densityPerUnit = density / refArea;

        const colEnd = Math.ceil(gW / this.cellSize);
        const rowEnd = Math.ceil(gH / this.cellSize);

        const activeKeys = new Set();
        for (let i = 0; i <= colEnd; i++) {
            for (let j = 0; j <= rowEnd; j++) {
                const key = `${i}_${j}`;
                activeKeys.add(key);
                if (!this.cells.has(key)) {
                    this.generateCell(i, j, densityPerUnit);
                }
            }
        }

        // Apply positions and culling
        if (fullUpdate) {
            this.updateItems(gW, gH);
        }

        // Cleanup out-of-bounds cells
        for (const key of this.cells.keys()) {
            if (!activeKeys.has(key)) {
                const cell = this.cells.get(key);
                cell.items.forEach(item => {
                    if (item.parent) this.remove(item);
                    // Optional: Dispose if we want to be aggressive with memory
                });
                this.cells.delete(key);
            }
        }
    }

    generateCell(col, row, densityPerUnit) {
        const cellX = col * this.cellSize;
        const cellY = row * this.cellSize;
        const cellSeed = `${this.settings.seed}_${col}_${row}`;
        const prng = new PRNG(cellSeed);

        const expectedCount = densityPerUnit * this.cellSize * this.cellSize;
        let count = Math.floor(expectedCount);
        if (prng.random() < (expectedCount % 1)) count++;

        const items = [];
        for (let n = 0; n < count; n++) {
            const localX = prng.random() * this.cellSize;
            const localY = prng.random() * this.cellSize;

            const item = this.createItem(prng);
            // Store coordinates relative to the TOP-LEFT of the plane
            item.userData.planeLocalPos = { x: cellX + localX, y: cellY + localY };
            items.push(item);
        }
        this.cells.set(`${col}_${row}`, { items });
    }

    createItem(prng) {
        const {
            minScale = 1,
            maxScale = 1,
            randomRotation = true,
            rotationAxis = 'z',
            xRot = null,
            yRot = null,
            zRot = null
        } = this.settings;

        let item;
        if (this.library.length > 0) {
            const template = prng.pick(this.library);
            item = template.clone();
        } else {
            item = this.model.clone();
        }

        const degToRad = THREE.MathUtils.degToRad;
        item.rotation.x = Math.PI / 2;

        if (randomRotation) {
            if (xRot || yRot || zRot) {
                const rx = xRot ? degToRad(prng.range(xRot[0], xRot[1])) : 0;
                const ry = yRot ? degToRad(prng.range(yRot[0], yRot[1])) : 0;
                const rz = zRot ? degToRad(prng.range(zRot[0], zRot[1])) : 0;
                item.rotateX(rx);
                item.rotateY(ry);
                item.rotateZ(rz);
            } else {
                const angle = prng.random() * Math.PI * 2;
                if (rotationAxis === 'y') item.rotation.y = angle;
                else item.rotation.z = angle;
            }
        }

        const s = prng.range(minScale, maxScale);
        item.scale.set(s, s, s);

        return item;
    }

    setShadows(enabled) {
        this.shadowEnabled = enabled;
        for (const cell of this.cells.values()) {
            cell.items.forEach(item => {
                if (item.parent) {
                    item.traverse(child => {
                        if (child.isMesh) {
                            child.receiveShadow = enabled;
                            child.castShadow = enabled;
                        }
                    });
                }
            });
        }
    }

    updateItems(gW, gH) {
        const { yOffset = 0 } = this.settings;

        // Calculate Prism Bounds in World Space
        const worldPos = new THREE.Vector3();
        const prismBounds = this.prisms.map(p => {
            const w = p.scale.x;
            const h = p.scale.y;
            const margin = 0.5;

            // FIX: Get actual world position, as 'p' is usually inside a centered group
            worldPos.setFromMatrixPosition(p.matrixWorld);

            return {
                xMin: worldPos.x - w/2 - margin,
                xMax: worldPos.x + w/2 + margin,
                yMin: worldPos.y - h/2 - margin,
                yMax: worldPos.y + h/2 + margin
            };
        });

        // We are now positioned relative to the center of the plane
        // Local center is (0,0). Top-left is (-gW/2, gH/2).
        const localLeft = -gW / 2;
        const localTop = gH / 2;

        const itemWorldPos = new THREE.Vector3();

        for (const cell of this.cells.values()) {
            cell.items.forEach(item => {
                const lPos = item.userData.planeLocalPos;

                // Position relative to plane center
                const lx = localLeft + lPos.x;
                const ly = localTop - lPos.y;

                // Plane bounds check
                let visible = lPos.x >= 0 && lPos.x <= gW && lPos.y >= 0 && lPos.y <= gH;

                // Prism culling check (needs world space)
                if (visible) {
                    // Update matrix world if parent moved so we get correct world position for culling
                    if (this.parent) this.parent.updateMatrixWorld();
                    
                    // Temp set position to calculate world pos for culling
                    item.position.set(lx, ly, yOffset);
                    item.getWorldPosition(itemWorldPos);

                    for (const b of prismBounds) {
                        if (itemWorldPos.x >= b.xMin && itemWorldPos.x <= b.xMax && itemWorldPos.y >= b.yMin && itemWorldPos.y <= b.yMax) {
                            visible = false;
                            break;
                        }
                    }
                }

                if (visible) {
                    if (!item.parent) {
                        this.add(item);
                        // Apply shadows if enabled
                        if (this.shadowEnabled) {
                             item.traverse(child => {
                                if (child.isMesh) {
                                    child.receiveShadow = true;
                                    child.castShadow = true;
                                }
                            });
                        }
                    }
                    item.position.set(lx, ly, yOffset);
                } else {
                    if (item.parent) this.remove(item);
                }
            });
        }
    }

    clearAll() {
        for (const cell of this.cells.values()) {
            cell.items.forEach(item => {
                if (item.parent) this.remove(item);
            });
        }
        this.cells.clear();
        this.lastPrismState = '';
        this.lastBgState = '';
    }

    cleanup() {
        this.clearAll();
        // Traverse and dispose geometries/materials if they are unique
        // Since we are cloning, we might be sharing some.
        // But GardenSystem.cleanup calls this, so it's good to be thorough.
        this.cells.forEach(cell => {
            cell.items.forEach(item => {
                item.traverse(node => {
                    if (node.isMesh) {
                        if (node.geometry) node.geometry.dispose();
                        if (node.material) {
                            if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
                            else node.material.dispose();
                        }
                    }
                });
            });
        });
        this.cells.clear();
    }
}
