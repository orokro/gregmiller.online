import * as THREE from 'three';
import { GardenBlock } from './GardenBlock.js';
import { GardenScatter } from './GardenScatter.js';
import { Butterfly } from './Butterfly.js';
import PRNG from './utils/PRNG.js';

export class GardenSystem extends THREE.Object3D {
    constructor(models, bgPlane, prisms, gardenSettings, blockSettings, grassSettings, seed = 'default_seed', camera) {
        super();
        this.models = models;
        this.bgPlane = bgPlane;
        this.camera = camera;
        this.gardenSettings = gardenSettings || {};
        this.blockSettings = blockSettings || {};
        this.grassSettings = grassSettings || {};
        this.seed = seed;
        this.prng = new PRNG(this.seed);
        
        this.gardenBlocks = new Map(); // Map prism -> GardenBlock
        this.snailGroup = new THREE.Group();
        this.add(this.snailGroup);
        this.butterflyGroup = new THREE.Group();
        this.add(this.butterflyGroup);
        
        this.scatterers = {
            flowers: null,
            leaves: null
        };

        this.butterflies = [];

        // Cache original material
        this.originalPlaneMaterial = this.bgPlane.material;

        // Find Dirt Textures from Block Model
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

        // Initialize Grass
        this.grassMaterial = null;
        this.grassMesh = null;
        this.initGrass();

        this.update(prisms);
        this.initButterflies(prisms);
    }

    initButterflies(prisms) {
        // Clear existing
        this.butterflies.forEach(b => {
            if (b.parent) b.parent.remove(b);
            b.cleanup();
        });
        this.butterflies = [];

        if (this.models.butterfly && this.gardenSettings.butterfly) {
            const left = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'left');
            const right = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'right');
            
            // Add to unscaled group to prevent skewing
            this.butterflyGroup.add(left);
            this.butterflyGroup.add(right);
            
            this.butterflies.push(left, right);
        }
    }

    initGrass() {
        if (this.grassMesh) {
            this.remove(this.grassMesh);
            if (this.grassMesh.geometry) this.grassMesh.geometry.dispose();
            this.grassMesh = null;
        }

        const settings = this.grassSettings;
        const count = settings.density || 7000;
        const minLen = settings.minLength || 0;
        const maxLen = settings.maxLength || 4;
        const minWid = settings.minWidth || 0.25;
        const maxWid = settings.maxWidth || 0.68;
        const minTipWid = settings.minTipWidth || 0;
        const maxTipWid = settings.maxTipWidth || 0.2;
        const segments = settings.segments || 4;
        
        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

        // Reuse material if it exists, or create new
        if (!this.grassMaterial) {
            this.grassMaterial = new THREE.ShaderMaterial({
                uniforms: {
                    uTime: { value: 0 },
                    uNoiseScale: { value: settings.noiseScale || 2.0 },
                    uWindIntensity: { value: settings.windIntensity || 0.3 },
                    uWindDirection: { value: new THREE.Vector2(settings.windX || 1.0, settings.windY || 1.0) },
                    uColor1: { value: new THREE.Color(settings.grassColor1 || "#4da83b") },
                    uColor2: { value: new THREE.Color(settings.grassColor2 || "#83da4a") },
                    uBendIntensity: { value: 0.5 } 
                },
                vertexShader: `
                    uniform float uTime;
                    uniform float uNoiseScale;
                    uniform float uWindIntensity;
                    uniform vec2 uWindDirection;
                    uniform float uBendIntensity;

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

                    void main() {
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
                        pos.z += windFactor * uBendIntensity * 0.5;
                        vec3 finalLocal;
                        finalLocal.x = pos.x;
                        finalLocal.y = pos.y;
                        finalLocal.z = pos.z;
                        vec3 normalOriented;
                        normalOriented.x = finalLocal.x;
                        normalOriented.y = -finalLocal.z;
                        normalOriented.z = finalLocal.y;
                        vec3 worldPos = aOffset + normalOriented;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(worldPos, 1.0);
                    }
                `,
                fragmentShader: `
                    uniform vec3 uColor1;
                    uniform vec3 uColor2;
                    varying float vHeightPercent;
                    varying float vRandom;
                    void main() {
                        float shade = mix(0.2, 1.0, vHeightPercent);
                        vec3 baseColor = mix(uColor1, uColor2, fract(vRandom * 7.0));
                        gl_FragColor = vec4(baseColor * shade, 1.0);
                    }
                `,
                side: THREE.DoubleSide
            });
        }

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
        
        const grassPRNG = new PRNG(this.seed + "_grass");

        for (let i = 0; i < count; i++) {
            offsets[i * 3] = (grassPRNG.random() - 0.5) * gW;
            offsets[i * 3 + 1] = (grassPRNG.random() - 0.5) * gH;
            offsets[i * 3 + 2] = 0.01;
            sizes[i] = minLen + grassPRNG.random() * (maxLen - minLen);
            widths[i] = minWid + grassPRNG.random() * (maxWid - minWid);
            tipWidths[i] = minTipWid + grassPRNG.random() * (maxTipWid - minTipWid);
            angles[i] = grassPRNG.random() * Math.PI * 2;
        }
        instancedGeom.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 3));
        instancedGeom.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1));
        instancedGeom.setAttribute('aWidth', new THREE.InstancedBufferAttribute(widths, 1));
        instancedGeom.setAttribute('aTipWidth', new THREE.InstancedBufferAttribute(tipWidths, 1));
        instancedGeom.setAttribute('aAngle', new THREE.InstancedBufferAttribute(angles, 1));
        
        this.grassMesh = new THREE.Mesh(instancedGeom, this.grassMaterial);
        this.grassMesh.frustumCulled = false; 
        this.grassMesh.renderOrder = 2;
        this.add(this.grassMesh);

        // Update ground material
        const uvScale = settings.dirtUVScale || 4.0;
        const normalScale = settings.normalStrength || 1.0;
        
        // Dispose old material if it's not the original (we created it)
        if (this.bgPlane.material && this.bgPlane.material !== this.originalPlaneMaterial) {
            this.bgPlane.material.dispose();
        }

        const groundMat = new THREE.MeshStandardMaterial({ 
            color: settings.dirtColor || "#3d2b1f", 
            side: THREE.DoubleSide 
        });

        if (this.dirtTextures.map) {
            groundMat.map = this.dirtTextures.map;
            groundMat.map.repeat.set(uvScale, uvScale);
        }
        if (this.dirtTextures.normalMap) {
            groundMat.normalMap = this.dirtTextures.normalMap;
            groundMat.normalMap.repeat.set(uvScale, uvScale);
            groundMat.normalScale.set(normalScale, normalScale);
        }

        this.bgPlane.material = groundMat;
    }

    updateShader(settings) {
        this.grassSettings = settings;
        if (this.grassMaterial) {
            this.grassMaterial.uniforms.uNoiseScale.value = settings.noiseScale;
            this.grassMaterial.uniforms.uWindIntensity.value = settings.windIntensity;
            this.grassMaterial.uniforms.uWindDirection.value.set(settings.windX, settings.windY);
            this.grassMaterial.uniforms.uColor1.value.set(settings.grassColor1);
            this.grassMaterial.uniforms.uColor2.value.set(settings.grassColor2);
        }
        
        // Update Ground Material Properties
        if (this.bgPlane && this.bgPlane.material && this.bgPlane.material.isMeshStandardMaterial) {
            this.bgPlane.material.color.set(settings.dirtColor);
            const uvScale = settings.dirtUVScale || 4.0;
            const normalScale = settings.normalStrength || 1.0;

            if (this.bgPlane.material.map) {
                this.bgPlane.material.map.repeat.set(uvScale, uvScale);
            }
            if (this.bgPlane.material.normalMap) {
                this.bgPlane.material.normalMap.repeat.set(uvScale, uvScale);
                this.bgPlane.material.normalScale.set(normalScale, normalScale);
            }
        }

        this.initGrass();
    }

    update(prisms) {
        // 1. Update Blocks
        const currentPrisms = new Set(prisms);

        // Remove old blocks
        for (const [prism, block] of this.gardenBlocks) {
            if (!currentPrisms.has(prism)) {
                block.cleanup();
                if (block.parent) block.parent.remove(block);
                this.gardenBlocks.delete(prism);
            }
        }

        // Add or Update blocks
        prisms.forEach((prism, index) => {
            if (!this.gardenBlocks.has(prism)) {
                const blockSeed = `${this.seed}_${index}`;
                const block = new GardenBlock(this.models.block, prism, this.blockSettings, blockSeed, this.models.snail, this.snailGroup);
                prism.add(block);
                this.gardenBlocks.set(prism, block);
            } else {
                const block = this.gardenBlocks.get(prism);
                block.settings = this.blockSettings; // Pass latest settings
                block.update();
            }
        });

        // 2. Update Scatterers
        // Snails handled by GardenBlock now
        this.updateScatter('flowers', this.models.sunflower, this.gardenSettings.flowers, prisms, `${this.seed}_flowers`);
        this.updateScatter('leaves', this.models.leaves, this.gardenSettings.leaves, prisms, `${this.seed}_leaves`);
        
        // 3. Update Butterflies
        // (Re-init if prisms changed? or just update their ref?)
        // Currently initButterflies clears and rebuilds. 
        // We can just update their prism ref if we want, but rebuilding is safer for lane calc.
        // But rebuilding resets position.
        // Let's just update the prisms ref in the butterflies.
        this.butterflies.forEach(b => b.prisms = prisms);
        // But if prisms count changed drastically, lanes might change.
        // initButterflies checks this.models.butterfly.
        if (this.butterflies.length === 0 && this.models.butterfly) {
            this.initButterflies(prisms);
        }
    }

    updateAnimation(time, dt) {
        if (this.grassMaterial) {
            this.grassMaterial.uniforms.uTime.value = time;
        }
        for (const block of this.gardenBlocks.values()) {
            block.updateAnimation(time);
        }
        this.butterflies.forEach(b => b.update(time, dt));
    }

    updateScatter(key, model, settings, prisms, seed) {
        if (!settings || !model || settings.density <= 0) {
            if (this.scatterers[key]) {
                this.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
            return;
        }

        const mergedSettings = { ...settings, seed: seed || settings.seed };

        if (!this.scatterers[key]) {
            this.scatterers[key] = new GardenScatter(model, this.bgPlane, prisms, mergedSettings);
            this.add(this.scatterers[key]);
        } else {
            // Check if settings or prisms changed significantly to warrant regen
            // For now, always update when called (since it's UI driven)
            this.scatterers[key].update(prisms, mergedSettings);
        }
    }

    cleanup() {
        for (const block of this.gardenBlocks.values()) {
            block.cleanup();
            if (block.parent) block.parent.remove(block);
        }
        this.gardenBlocks.clear();
        
        // Clear global snail group
        while(this.snailGroup.children.length > 0){ 
            const child = this.snailGroup.children[0];
            this.snailGroup.remove(child);
            if (child.cleanup) child.cleanup();
        }
        
        while(this.butterflyGroup.children.length > 0){
            const child = this.butterflyGroup.children[0];
            this.butterflyGroup.remove(child);
            if (child.cleanup) child.cleanup();
        }

        Object.keys(this.scatterers).forEach(key => {
            if (this.scatterers[key]) {
                this.remove(this.scatterers[key]);
                this.scatterers[key].cleanup();
                this.scatterers[key] = null;
            }
        });
        
        this.butterflies.forEach(b => {
            if (b.parent) b.parent.remove(b);
            b.cleanup();
        });
        this.butterflies = [];

        if (this.grassMesh) {
            this.remove(this.grassMesh);
            if (this.grassMesh.geometry) this.grassMesh.geometry.dispose();
            this.grassMesh = null;
        }
        
        if (this.grassMaterial) {
            this.grassMaterial.dispose();
            this.grassMaterial = null;
        }
    }

    destroy() {
        this.cleanup();
        // Restore original material
        if (this.bgPlane) {
            if (this.bgPlane.material && this.bgPlane.material !== this.originalPlaneMaterial) {
                this.bgPlane.material.dispose();
            }
            this.bgPlane.material = this.originalPlaneMaterial;
        }
    }
}
