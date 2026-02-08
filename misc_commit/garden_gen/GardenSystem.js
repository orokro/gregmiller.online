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
        
        this.gardenBlocks = new Map(); 
        this.snailGroup = new THREE.Group();
        this.add(this.snailGroup);
        
        this.scatterers = {
            flowers: null,
            leaves: null
        };

        this.butterflies = [];
        this.shadowEnabled = false;
        this.shadowSettings = {};

        this.originalPlaneMaterial = this.bgPlane.material;

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

        this.grassMaterial = null;
        this.grassMesh = null;
        this.initGrass();

        this.update(prisms);
        this.initButterflies(prisms);
    }

    initButterflies(prisms) {
        this.butterflies.forEach(b => {
            if (b.parent) b.parent.remove(b);
            b.cleanup();
        });
        this.butterflies = [];

        if (this.models.butterfly && this.gardenSettings.butterfly) {
            const left = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'left');
            const right = new Butterfly(this.models.butterfly, this.bgPlane, this.camera, prisms, this.gardenSettings.butterfly, 'right');
            this.add(left);
            this.add(right);
            this.butterflies.push(left, right);
        }
        
        if (this.shadowEnabled) {
            this.butterflies.forEach(b => {
                b.traverse(c => { if(c.isMesh) c.castShadow = true; });
            });
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
        const segments = settings.segments || 4;
        const gW = this.bgPlane.scale.x;
        const gH = this.bgPlane.scale.y;

        if (this.grassMaterial) this.grassMaterial.dispose();

        // Use MeshStandardMaterial with onBeforeCompile for custom logic + shadows
        this.grassMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(settings.grassColor1 || "#4da83b"),
            side: THREE.DoubleSide
        });

        const uniforms = {
            uTime: { value: 0 },
            uNoiseScale: { value: settings.noiseScale || 2.0 },
            uWindIntensity: { value: settings.windIntensity || 0.3 },
            uWindDirection: { value: new THREE.Vector2(settings.windX || 1.0, settings.windY || 1.0) },
            uColor1: { value: new THREE.Color(settings.grassColor1 || "#4da83b") },
            uColor2: { value: new THREE.Color(settings.grassColor2 || "#83da4a") },
            uBendIntensity: { value: 0.5 }
        };

        this.grassMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uTime = uniforms.uTime;
            shader.uniforms.uNoiseScale = uniforms.uNoiseScale;
            shader.uniforms.uWindIntensity = uniforms.uWindIntensity;
            shader.uniforms.uWindDirection = uniforms.uWindDirection;
            shader.uniforms.uColor1 = uniforms.uColor1;
            shader.uniforms.uColor2 = uniforms.uColor2;
            shader.uniforms.uBendIntensity = uniforms.uBendIntensity;

            // Store for updateAnimation
            this.grassMaterial.userData.shader = shader;

            shader.vertexShader = `
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
        
        this.grassMesh = new THREE.Mesh(instancedGeom, this.grassMaterial);
        this.grassMesh.frustumCulled = false; 
        this.grassMesh.renderOrder = 2;
        if (this.shadowEnabled) {
            this.grassMesh.receiveShadow = true;
        }
        this.add(this.grassMesh);

        const uvScale = settings.dirtUVScale || 4.0;
        const normalScale = settings.normalStrength || 1.0;
        
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
        if (this.shadowEnabled) {
            this.bgPlane.receiveShadow = true;
        }
        
        baseGeom.dispose();
    }

    updateShader(settings) {
        this.grassSettings = settings;
        this.initGrass();
    }

    enableShadows(enabled, settings) {
        this.shadowEnabled = enabled;
        this.shadowSettings = settings;

        for (const block of this.gardenBlocks.values()) {
            block.traverse(child => {
                if (child.isMesh) {
                    child.castShadow = enabled;
                    child.receiveShadow = enabled;
                }
            });
        }

        this.snailGroup.traverse(child => {
            if (child.isMesh) {
                child.castShadow = enabled;
            }
        });

        this.butterflies.forEach(b => {
            b.traverse(child => {
                if (child.isMesh) child.castShadow = enabled;
            });
        });

        Object.values(this.scatterers).forEach(scatter => {
            if (scatter) {
                scatter.setShadows(enabled);
            }
        });

        this.initGrass();
    }

    update(prisms) {
        const currentPrisms = new Set(prisms);
        for (const [prism, block] of this.gardenBlocks) {
            if (!currentPrisms.has(prism)) {
                block.cleanup();
                if (block.parent) block.parent.remove(block);
                this.gardenBlocks.delete(prism);
            }
        }
        prisms.forEach((prism, index) => {
            if (!this.gardenBlocks.has(prism)) {
                const blockSeed = `${this.seed}_${index}`;
                const block = new GardenBlock(this.models.block, prism, this.blockSettings, blockSeed, this.models.snail, this.snailGroup);
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
        this.updateScatter('flowers', this.models.sunflower, this.gardenSettings.flowers, prisms, `${this.seed}_flowers`);
        this.updateScatter('leaves', this.models.leaves, this.gardenSettings.leaves, prisms, `${this.seed}_leaves`);
        this.butterflies.forEach(b => b.prisms = prisms);
        if (this.butterflies.length === 0 && this.models.butterfly) {
            this.initButterflies(prisms);
        }
    }

    updateAnimation(time, dt) {
        if (this.grassMaterial && this.grassMaterial.userData.shader) {
            this.grassMaterial.userData.shader.uniforms.uTime.value = time;
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
            this.scatterers[key].update(prisms, mergedSettings);
        }
        if (this.shadowEnabled && this.scatterers[key]) {
             this.scatterers[key].setShadows(true);
        }
    }

    cleanup() {
        for (const block of this.gardenBlocks.values()) {
            block.cleanup();
            if (block.parent) block.parent.remove(block);
        }
        this.gardenBlocks.clear();
        while(this.snailGroup.children.length > 0){ 
            const child = this.snailGroup.children[0];
            this.snailGroup.remove(child);
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
        if (this.bgPlane) {
            if (this.bgPlane.material && this.bgPlane.material !== this.originalPlaneMaterial) {
                this.bgPlane.material.dispose();
            }
            this.bgPlane.material = this.originalPlaneMaterial;
        }
    }
}
