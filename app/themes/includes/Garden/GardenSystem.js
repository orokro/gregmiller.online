/*
	GardenSystem.js
	---------------

	The main class that manages the logic for fleshing out the Garden Theme
*/

// Three
import * as THREE from 'three';
import { GardenBlock } from './GardenBlock.js';
import { GardenScatter } from './GardenScatter.js';
import { Butterfly } from './Butterfly.js';
import PRNG from '../../../utils/PRNG.js';

// main export
export class GardenSystem extends THREE.Object3D {

	/**
	 * GardenSystem
	 * Manages garden scene elements including models, background plane, camera, settings, PRNG, blocks, grass, and butterflies.
	 * Initializes materials/textures, grass meshes, and scene groups, then updates state based on prisms.
	 *
	 * @class
	 * @extends THREE.Object3D
     * @param {Object} manager - The ThreeManager instance.
	 * @param {Object<string, THREE.Object3D>} models - Loaded model assets (e.g., block model containing DirtRefPlane).
	 * @param {Object} bgData - The background element data containing group and empties.
	 * @param {Array<THREE.Object3D>} prisms - Prism objects used to seed/update garden state.
	 * @param {Object} [gardenSettings={}] - Configuration for garden generation/behavior.
	 * @param {Object} [blockSettings={}] - Configuration for block generation/behavior.
	 * @param {Object} [grassSettings={}] - Configuration for grass material/mesh creation.
	 * @param {string} [seed='default_seed'] - Seed for deterministic PRNG.
	 * @param {THREE.Camera} camera - Scene camera used for view-dependent effects.
	 */
    constructor(manager, models, bgData, prisms, gardenSettings, blockSettings, grassSettings, seed = 'default_seed', camera) {

		// call parent constructor
        super();

		// save our refs
        this.manager = manager;
        this.models = models;
        this.bgData = bgData;
        this.camera = camera;

        // Extract plane mesh from bgData
        this.bgPlane = null;
        if (this.bgData && this.bgData.group) {
            this.bgData.group.traverse(child => {
                if (child.isMesh && child.name.includes('plane')) {
                    this.bgPlane = child;
                }
            });
            if (!this.bgPlane) {
                this.bgData.group.traverse(child => {
                    if (child.isMesh) this.bgPlane = child;
                });
            }
        }

		// save our settings
        this.gardenSettings = gardenSettings || {};
        this.blockSettings = blockSettings || {};
        this.grassSettings = grassSettings || {};
        this.seed = seed;
        this.prng = new PRNG(this.seed);

		// store references to the blocks we generate based on the prisms from the theme
        this.gardenBlocks = new Map();

        // Cache for change detection
        this.lastPrismState = '';
        this.lastBgState = '';

		// we'll store scatterer instances for flowers and leaves
        this.scatterers = {
            flowers: null,
            leaves: null
        };

		// we'll store butterfly instances
        this.butterflies = [];

		// we'll store shadow settings
        this.shadowEnabled = false;
        this.shadowSettings = {};

		// we're going to store the original material of the background plane so we can restore it later if needed
        this.originalPlaneMaterial = this.bgPlane ? this.bgPlane.material : null;

		// the garden block mesh has a dirt reference plane with textures
        this.dirtTextures = { map: null, normalMap: null };
        if (this.models.block) {
            this.models.block.traverse((child) => {
                if (child.isMesh && child.name === 'DirtRefPlane' && child.material) {
                    if (child.material.map) {
                        this.dirtTextures.map = child.material.map;
                        this.dirtTextures.map.wrapS = THREE.RepeatWrapping;
                        this.dirtTextures.map.wrapT = THREE.RepeatWrapping;
                    }
                    if (child.material.normalMap) {
                        this.dirtTextures.normalMap = child.material.normalMap;
                        this.dirtTextures.normalMap.wrapS = THREE.RepeatWrapping;
                        this.dirtTextures.normalMap.wrapT = THREE.RepeatWrapping;
                    }
                }
            });
        }

		// we'll build the grass material
        this.grassMaterial = null;
        this.grassMesh = null;
        this.initGrass();

		// update our garden layout to match the prisms passed in from the theme file
        this.update(prisms);

		// set up some butterflies to fly around
        this.initButterflies(prisms);
    }


	/**
	 * Set up butterflies in the garden.
	 *
	 * @param {Object3d[]} prisms - Array of prism objects representing the garden layout.
	 */
    initButterflies(prisms) {

		// Remove existing butterflies if any
        this.butterflies.forEach(b => {
            if (b.parent)
				b.parent.remove(b);
            b.cleanup();
        });
        this.butterflies = [];

		// spawn one butterfly on each side of the garden
        if (this.models.butterfly && this.gardenSettings.butterfly) {

            const left = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'left');
            const right = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'right');
            this.add(left);
            this.add(right);
            this.butterflies.push(left, right);
        }

		// if shadows are enabled, make the butterflies cast shadows
        if (this.shadowEnabled) {
            this.butterflies.forEach(b => {
                b.traverse(c => { if(c.isMesh) c.castShadow = true; });
            });
        }
    }


	/**
	 * Initialize the grass in the garden.
	 *
	 * We'll create a new grass shader and apply it to a plane.
	 */
    initGrass() {

		// Remove existing grass mesh if any
        if (this.grassMesh) {
            if (this.grassMesh.parent) this.grassMesh.parent.remove(this.grassMesh);
            if (this.grassMesh.geometry) this.grassMesh.geometry.dispose();
            this.grassMesh = null;
        }

		// prepare our settings
        const settings = this.grassSettings;
        const count = settings.density || 7000;
        const segments = settings.segments || 4;
        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

		// Remove existing grass material if any
        if (this.grassMaterial)
			this.grassMaterial.dispose();

        // Use MeshStandardMaterial with onBeforeCompile for custom logic + shadows
        this.grassMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(settings.grassColor1 || "#4da83b"),
            side: THREE.DoubleSide
        });

		        // prepare our uniforms with default values
		        const uniforms = {
		            uTime: { value: 0 },
		            uNoiseScale: { value: settings.noiseScale || 2.0 },
		            uWindIntensity: { value: settings.windIntensity || 0.3 },
		            uWindDirection: { value: new THREE.Vector2(settings.windX || 1.0, settings.windY || 1.0) },
		            uColor1: { value: new THREE.Color(settings.grassColor1 || "#4da83b") },
		            uColor2: { value: new THREE.Color(settings.grassColor2 || "#83da4a") },
		            uBendIntensity: { value: 0.5 },
		            uLeanBias: { value: new THREE.Vector2(
		                settings.grassRotation ? settings.grassRotation[0] : 0,
		                settings.grassRotation ? settings.grassRotation[1] : 0
		            ) }
		        };

				// build the grass shader
		        this.grassMaterial.onBeforeCompile = (shader) => {
		            shader.uniforms.uTime = uniforms.uTime;
		            shader.uniforms.uNoiseScale = uniforms.uNoiseScale;
		            shader.uniforms.uWindIntensity = uniforms.uWindIntensity;
		            shader.uniforms.uWindDirection = uniforms.uWindDirection;
		            shader.uniforms.uColor1 = uniforms.uColor1;
		            shader.uniforms.uColor2 = uniforms.uColor2;
		            shader.uniforms.uBendIntensity = uniforms.uBendIntensity;
		            shader.uniforms.uLeanBias = uniforms.uLeanBias;

		            // Store for updateAnimation
		            this.grassMaterial.userData.shader = shader;

		            shader.vertexShader = `
		                uniform float uTime;
		                uniform float uNoiseScale;
		                uniform float uWindIntensity;
		                uniform vec2 uWindDirection;
		                uniform float uBendIntensity;
		                uniform vec2 uLeanBias;

		                attribute float aSize;
		                attribute float aWidth;
		                attribute float aTipWidth;
		                attribute vec3 aOffset;
		                attribute float aAngle;

		                varying float vHeightPercent;
		                varying float vRandom;

		                float hash(float n) { return fract(sin(n) * 43758.5453123); }
		                float noise(vec3 x) {
		                    vec3 p = floor(x);
		                    vec3 f = fract(x);
		                    f = f*f*(3.0-2.0*f);
		                    float n = p.x + p.y*57.0 + 113.0*p.z;
		                    return mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
		                                   mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
		                               mix(mix( hash(n+113.0), hash(n+114.0),f.x),
		                                   mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
		                }
		                ${shader.vertexShader}
		            `;

		            shader.vertexShader = shader.vertexShader.replace(
		                '#include <begin_vertex>',
		                `
		                vHeightPercent = uv.y;
		                vRandom = aAngle;

		                vec3 pos = position;
		                float currentWidth = mix(aWidth, aTipWidth, uv.y);
		                pos.x *= currentWidth;
		                pos.y *= aSize;

		                float angle = aAngle;
		                float s = sin(angle);
		                float c = cos(angle);
		                float rx = pos.x * c - pos.z * s;
		                float rz = pos.x * s + pos.z * c;
		                pos.x = rx;
		                pos.z = rz;

		                float windFactor = uv.y * uv.y;
		                float noiseVal = noise(vec3(aOffset.xy * uNoiseScale, uTime * 0.5));
		                vec2 windMove = uWindDirection * uWindIntensity * (noiseVal + 0.5);
		                pos.x += windMove.x * windFactor;
		                pos.y += windMove.y * windFactor;

		                                float bendX = sin(aAngle * 1.5) * uBendIntensity;
		                                float bendY = cos(aAngle * 1.5) * uBendIntensity;
		                                pos.x += bendX * windFactor;
		                                pos.y += bendY * windFactor;
		                                
		                                // Apply Lean Bias (corrected to shift position without growing height)
		                                pos.x += uLeanBias.x * windFactor;
		                                pos.z -= uLeanBias.y * windFactor; // pos.z maps to finalLocal.y (screen Y)
		                
		                                pos.z += windFactor * uBendIntensity * 0.5;
		                		                vec3 finalLocal;
		                finalLocal.x = pos.x;
		                finalLocal.y = -pos.z;
		                finalLocal.z = pos.y;

		                vec3 transformed = finalLocal + aOffset;
		                `
		            );
		            shader.fragmentShader = `
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                varying float vHeightPercent;
                varying float vRandom;
                ${shader.fragmentShader}
            `;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <color_fragment>',
                `
                #include <color_fragment>
                float shade = mix(0.2, 1.0, vHeightPercent);
                vec3 baseGrassColor = mix(uColor1, uColor2, fract(vRandom * 7.0));
                diffuseColor.rgb = baseGrassColor * shade;
                `
            );
        };

		// create the base geometry for the grass blades
        const baseGeom = new THREE.PlaneGeometry(1, 1, 1, segments);
        baseGeom.translate(0, 0.5, 0);
        const instancedGeom = new THREE.InstancedBufferGeometry();
        instancedGeom.index = baseGeom.index;
        instancedGeom.attributes.position = baseGeom.attributes.position;
        instancedGeom.attributes.uv = baseGeom.attributes.uv;
        const offsets = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        const widths = new Float32Array(count);
        const tipWidths = new Float32Array(count);
        const angles = new Float32Array(count);

        // create a pseudo-random number generator for the grass
        const grassPRNG = new PRNG(this.seed + "_grass");

		        // populate the attributes for each grass blade

		        const offX = settings.grassOffset ? settings.grassOffset[0] : 0;

		        const offY = settings.grassOffset ? settings.grassOffset[1] : 0;



		        // Widen the field to cover parallax edges

		        const spreadMult = 1.2;



		        for (let i = 0; i < count; i++) {



		            offsets[i * 3] = ((grassPRNG.random() - 0.5) * gW * spreadMult) + offX;

		            offsets[i * 3 + 1] = ((grassPRNG.random() - 0.5) * gH * spreadMult) + offY;

		            offsets[i * 3 + 2] = 0.01;


            sizes[i] = settings.minLength + grassPRNG.random() * (settings.maxLength - settings.minLength);
            widths[i] = settings.minWidth + grassPRNG.random() * (settings.maxWidth - settings.minWidth);
            tipWidths[i] = settings.minTipWidth + grassPRNG.random() * (settings.maxTipWidth - settings.minTipWidth);
            angles[i] = grassPRNG.random() * Math.PI * 2;
        }
        instancedGeom.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeom.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
        instancedGeom.setAttribute('aWidth', new THREE.InstancedBufferAttribute(widths, 1));
        instancedGeom.setAttribute('aTipWidth', new THREE.InstancedBufferAttribute(tipWidths, 1));
        instancedGeom.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));

		// create the grass mesh
        this.grassMesh = new THREE.Mesh(instancedGeom, this.grassMaterial);
        this.grassMesh.frustumCulled = false;
        this.grassMesh.renderOrder = 2;
        if (this.shadowEnabled) {
            this.grassMesh.receiveShadow = true;
        }

        // Add to background center instead of this object
        if (this.bgData && this.bgData.empties && this.bgData.empties.center) {
            this.bgData.empties.center.add(this.grassMesh);
        } else {
            this.add(this.grassMesh);
        }

		// set up the uvs for the dirt plane in the background
        const uvScale = settings.dirtUVScale || 4.0;
        const normalScale = settings.normalStrength || 1.0;

		// prepare the ground material
        const groundMat = new THREE.MeshStandardMaterial({
            color: settings.dirtColor || "#ffffffff",
            side: THREE.DoubleSide
        });
        if (this.dirtTextures.map) {
            groundMat.map = this.dirtTextures.map;
        }
        if (this.dirtTextures.normalMap) {
            groundMat.normalMap = this.dirtTextures.normalMap;
            groundMat.normalScale.set(normalScale, normalScale);
        }

        // Apply background using manager to ensure it sticks
        if (this.manager) {
            // Note: uvScale is handled by setBackground
            this.manager.setBackground(groundMat, 100, uvScale, this.shadowEnabled);
        }

        baseGeom.dispose();
    }


	/**
	 * Update the grass shader with new settings
	 *
	 * @param {Object} settings - Object w/ settings for shader so it can be tweaked externally
	 */
    updateShader(settings) {
        this.grassSettings = settings;
        this.initGrass();
    }


	/**
	 * Enable or disable shadows for the garden
	 *
	 * @param {Boolean} enabled - Whether shadows should be enabled
	 * @param {Object} settings - Object w/ settings for shadows
	 */
    enableShadows(enabled, settings) {

		// save enable state & settings
        this.shadowEnabled = enabled;
        this.shadowSettings = settings;

		// update shadows for all garden blocks
        for (const block of this.gardenBlocks.values()) {
            block.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = enabled;
                    child.receiveShadow = enabled;
                }
            });
        }

		// update shadows for the butterflies
        this.butterflies.forEach(b => {
            b.traverse(child => {
                if (child.isMesh) child.castShadow = enabled;
            });
        });

		// update shadows for the scatterers
        Object.values(this.scatterers).forEach(scatter => {
            if (scatter) {
                scatter.setShadows(enabled);
            }
        });

        this.initGrass();
    }


	/**
	 * Update the garden layout to fit new prisms and bg plane
	 *
	 * @param {Object[]} prisms - Array of prism objects to update the garden blocks with
	 */
    update(prisms) {

        // Check if bg state changed (resize)
        let bgState = "";
        if (this.bgPlane) {
            bgState = `${this.bgPlane.scale.x.toFixed(0)}_${this.bgPlane.scale.y.toFixed(0)}`;
        }
        if (bgState !== "" && bgState !== this.lastBgState) {
            this.lastBgState = bgState;
            this.initGrass();
        }

        // Check if state changed
        let sig = "";
        for (let i = 0; i < prisms.length; i++) {
            const p = prisms[i];
            sig += `${p.id}:${p.scale.x.toFixed(2)},${p.scale.y.toFixed(2)}|`;
        }

        if (sig === this.lastPrismState) {
            return;
        }
        this.lastPrismState = sig;

		// remove any garden blocks that are no longer in the prisms array
        const currentPrisms = new Set(prisms);
        for (const [prism, block] of this.gardenBlocks) {
            if (!currentPrisms.has(prism)) {
                block.cleanup();
                if (block.parent) block.parent.remove(block);
                this.gardenBlocks.delete(prism);
            }
        }

		// add or update garden blocks for each prism
        prisms.forEach((prism, index) => {
            if (!this.gardenBlocks.has(prism)) {
                const blockSeed = `${this.seed}_${index}`;
                // Remove snailGroup argument
                const block = new GardenBlock(this.models.block, prism, this.blockSettings, blockSeed, this.models.snail);
                prism.add(block);
                this.gardenBlocks.set(prism, block);
                if (this.shadowEnabled) {
                    block.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                }
            } else {
                const block = this.gardenBlocks.get(prism);
                block.settings = this.blockSettings;
                block.update();
            }
        });

		// make sure our scatters are updated
        this.updateScatter('flowers', this.models.sunflower, this.gardenSettings.flowers, prisms, `${this.seed}_flowers`);
        this.updateScatter('leaves', this.models.leaves, this.gardenSettings.leaves, prisms, `${this.seed}_leaves`);

		// make sure our butterflies are updated
        this.butterflies.forEach(b => b.prisms = prisms);
        if (this.butterflies.length === 0 && this.models.butterfly) {
            this.initButterflies(prisms);
        }
    }


	/**
	 * Updates the various animations for the garden system
	 *
	 * @param {number} time - The current time in seconds
	 * @param {number} dt - The delta time since the last update
	 */
    		updateAnimation(time, dt) {

    	        // Re-acquire bgPlane if lost (e.g. CoverBG rebuilt it)
    	        if (!this.bgPlane || !this.bgPlane.parent) {
    	             if (this.bgData && this.bgData.group) {
    	                this.bgData.group.traverse(child => {
    	                    if (child.isMesh && child.name.includes('plane')) {
    	                        this.bgPlane = child;
    	                    }
    	                });
    	                if (!this.bgPlane) { // Fallback
    	                    this.bgData.group.traverse(child => {
    	                        if (child.isMesh) this.bgPlane = child;
    	                    });
    	                }
    	             }
    	        }

    	                        // Sync positions with bgPlane for parallax

    	                        if (this.bgPlane) {

    	                            if (this.grassMesh) this.grassMesh.position.copy(this.bgPlane.position);

    	                            Object.values(this.scatterers).forEach(s => {

    	                                if (s) s.position.copy(this.bgPlane.position);

    	                            });

    	                        }




    	    		// wave grass blades

        if (this.grassMaterial && this.grassMaterial.userData.shader)
            this.grassMaterial.userData.shader.uniforms.uTime.value = time;

		// update snails animation on each garden block
        for (const block of this.gardenBlocks.values())
            block.updateAnimation(time);

		// update butterflies animation
        this.butterflies.forEach(b => b.update(time, dt));
    }


	/**
	 * Updates the scatterer for the given key
	 *
	 * @param {string} key - The key identifying the scatterer. Either 'flowers' or 'leaves'.
	 * @param {*} model - The model to use for the scatterer
	 * @param {*} settings - The settings for the scatterer
	 * @param {*} prisms - The prisms to avoid scattering the objects on
	 * @param {*} seed - The seed for randomization
	 */
    updateScatter(key, model, settings, prisms, seed) {

		// remove the scatterer if settings are invalid
        if (!settings || !model || settings.density <= 0) {
            if (this.scatterers[key]) {
                if (this.scatterers[key].parent) this.scatterers[key].parent.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
            return;
        }

		// merge the settings with the seed
        const mergedSettings = { ...settings, seed: seed || settings.seed };

		// create or update the scatterer
        if (!this.scatterers[key]) {
            this.scatterers[key] = new GardenScatter(model, this.bgPlane, prisms, mergedSettings);
            if (this.bgData && this.bgData.empties && this.bgData.empties.center) {
                this.bgData.empties.center.add(this.scatterers[key]);
            } else {
                this.add(this.scatterers[key]);
            }
        } else {
            this.scatterers[key].update(prisms, mergedSettings);
        }
        if (this.shadowEnabled && this.scatterers[key]) {
             this.scatterers[key].setShadows(true);
        }
    }


	/**
	 * Cleans up all resources used by the garden system
	 */
    cleanup() {

		// clean up all garden blocks
        for (const block of this.gardenBlocks.values()) {
            block.cleanup();
            if (block.parent) block.parent.remove(block);
        }
        this.gardenBlocks.clear();

		// clean up all scatterers
        Object.keys(this.scatterers).forEach(key => {
            if (this.scatterers[key]) {
                if (this.scatterers[key].parent) this.scatterers[key].parent.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
        });

		// clean up all butterflies
        this.butterflies.forEach(b => {
            if (b.parent) b.parent.remove(b);
            b.cleanup();
        });
        this.butterflies = [];

		// clean up the grass mesh and material
        if (this.grassMesh) {
            if (this.grassMesh.parent) this.grassMesh.parent.remove(this.grassMesh);
            if (this.grassMesh.geometry) this.grassMesh.geometry.dispose();
            this.grassMesh = null;
        }
        if (this.grassMaterial) {
            this.grassMaterial.dispose();
            this.grassMaterial = null;
        }
    }


	/**
	 * Destroys the garden system and cleans up all resources
	 */
    destroy() {

		// clean up all resources
        this.cleanup();
    }

}
