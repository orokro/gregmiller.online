/*
	GardenScatter.js
	----------------

	Handles the logic for scattering garden elements on a plane.
*/

// imports
import * as THREE from 'three';
import PRNG from '../../../utils/PRNG.js';
import { Object3D } from 'three';

// main export
export class GardenScatter extends THREE.Object3D {

	/**
	 * Constructs a new GardenScatter instance.
	 *
	 * @param {Object3D} model - The 3D model to scatter.
	 * @param {Object3D} bgPlane - The background plane on which to scatter elements.
	 * @param {Object3D[]} prisms - The prisms to use for scattering.
	 * @param {Object} settings - The settings for scattering.
	 */
    constructor(model, bgPlane, prisms, settings) {

		// call parent constructor
        super();

		// save references & settings
        this.model = model;
        this.bgPlane = bgPlane;
        this.prisms = prisms;
        this.settings = settings || {};

		// initialize cells that will hold scattered items
        this.cells = new Map(); // key -> { items: [] }
        this.cellSize = 10;
        this.shadowEnabled = false;

		// initialize library of scatterable items
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
	 * Updates settings for the scatter and regenerates cells if necessary.
	 *
	 * @param {Object3D[]} prisms - The prisms to use for scattering.
	 * @param {Object} settings - The settings for scattering.
	 */
    update(prisms, settings) {

		// Save the old settings for comparison
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

        if (needsRegen) {
            this.clearAll();
        }

        this.refresh();
    }


	/**
	 * Refreshes the scattered items on the background plane.
	 *
	 * I.e. it recalculates positions and removes out-of-bounds items.
	 */
    refresh() {

		// get width and height of the background plane
        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

		// pull & compute our density setting
        const { density = 0 } = this.settings;
        const refArea = 270; // Reference area for density
        const densityPerUnit = density / refArea;

        // We want stability relative to the top-left corner.
        // In world space, the plane is centered at (0,0).
        // Top-left is (-gW/2, gH/2).
        // Let's define a grid origin that is "stable" relative to top-left.
        // However, if we want items to stay at (localX, localY) from top-left,
        // we can just use a local grid [0, gW] x [0, gH].

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
        this.updateItems(gW, gH);

        // Remove cells that are way out of bounds
        // (We keep a small buffer or just remove those not in activeKeys)
        for (const key of this.cells.keys()) {
            if (!activeKeys.has(key)) {
                const cell = this.cells.get(key);
                cell.items.forEach(item => {
                    if (item.parent) this.remove(item);
                });
                this.cells.delete(key);
            }
        }
    }


	/**
	 * Generates a cell of scattered items.
	 *
	 * @param {number} col - The column index of the cell.
	 * @param {number} row - The row index of the cell.
	 * @param {number} densityPerUnit - The density of items per unit area.
	 */
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


	/**
	 * Spawns a new item.
	 *
	 * @param {PRNG} prng - A pseudo-random number generator instance.
	 * @returns {THREE.Object3D} - The created item.
	 */
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


	/**
	 * Sets whether shadows should be enabled or disabled for all items.
	 *
	 * @param {Boolean} enabled - Whether shadows should be enabled or disabled.
	 */
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


	/**
	 * Updates the positions and visibility of all items based on the garden dimensions.
	 *
	 * @param {number} gW - The width of the garden.
	 * @param {number} gH - The height of the garden.
	 */
    updateItems(gW, gH) {

        const { yOffset = 0 } = this.settings;

        // Calculate Prism Bounds in World Space
        const prismBounds = this.prisms.map(p => {
            const w = p.scale.x;
            const h = p.scale.y;
            const margin = 0.5;
            return {
                xMin: p.position.x - w/2 - margin,
                xMax: p.position.x + w/2 + margin,
                yMin: p.position.y - h/2 - margin,
                yMax: p.position.y + h/2 + margin
            };
        });

        const worldLeft = -gW / 2;
        const worldTop = gH / 2;

        for (const cell of this.cells.values()) {
            cell.items.forEach(item => {
                const lPos = item.userData.planeLocalPos;

                // Convert local (top-left) to world
                const wx = worldLeft + lPos.x;
                const wy = worldTop - lPos.y;

                // Plane bounds check
                let visible = lPos.x >= 0 && lPos.x <= gW && lPos.y >= 0 && lPos.y <= gH;

                // Prism culling check
                if (visible) {
                    for (const b of prismBounds) {
                        if (wx >= b.xMin && wx <= b.xMax && wy >= b.yMin && wy <= b.yMax) {
                            visible = false;
                            break;
                        }
                    }
                }

                if (visible) {
                    if (!item.parent) {
                        this.add(item);
                        // Apply shadows if enabled
                        item.traverse(child => {
                            if (child.isMesh) {
                                child.receiveShadow = this.shadowEnabled;
                                child.castShadow = this.shadowEnabled;
                            }
                        });
                    }
                    item.position.set(wx, wy, yOffset);
                } else {
                    if (item.parent) this.remove(item);
                }
            });
        }
    }


	/**
	 * Clears all items from all cells.
	 */
    clearAll() {

        for (const cell of this.cells.values()) {
            cell.items.forEach(item => {
                if (item.parent) this.remove(item);
            });
        }
        this.cells.clear();
    }


	/**
	 * Cleans up all resources used by the scatter, including geometries and materials.
	 */
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
