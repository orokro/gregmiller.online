/*
	KoiPondTheme.js
	---------------

	Makes a koi pond!
*/

import * as THREE from 'three';
import { ThreeManager } from '../utils/ThreeManager';

// --- SHADERS ---

const WATER_VERTEX_SHADER = `
uniform float uTime;
uniform float uSpeed;
uniform float uGlobalScale;
uniform float uWaveAmp;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying float vElevation;

// Psuedo-random
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// Calculate wave height at a position
float getWaveHeight(vec2 pos, float time) {
    float height = 0.0;

    // Base wave scaling (pixels -> radians)
    vec2 p = pos * uGlobalScale;

    // Sum of sines for rolling waves
    // Wave 1
    float t1 = time * uSpeed;
    height += sin(p.x * 1.0 + t1) * 1.0;
    height += sin(p.y * 0.8 + t1 * 1.1) * 1.0;

    // Wave 2 (Detail)
    float t2 = time * uSpeed * 1.5;
    vec2 p2 = p * 2.5;
    p2 = vec2(p2.x * 0.8 - p2.y * 0.6, p2.x * 0.6 + p2.y * 0.8); // Rotate
    height += sin(p2.x + t2) * 0.4;
    height += sin(p2.y + t2 * 1.2) * 0.4;

    // Noise for fine ripples
    float t3 = time * uSpeed * 0.5;
    height += noise(p * 4.0 + t3) * 0.3;

    return height * uWaveAmp;
}

void main() {
    vUv = uv;

    // Get world position of the vertex
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = modelPosition.xyz;

    // Calculate elevation
    float elevation = getWaveHeight(vWorldPosition.xy, uTime);
    vElevation = elevation;

    // Apply displacement along Z (towards camera)
    modelPosition.z += elevation;

    vViewPosition = cameraPosition - modelPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * modelPosition;
}
`;

const WATER_FRAGMENT_SHADER = `
uniform float uTime;
uniform float uSpeed;
uniform float uGlobalScale;
uniform float uWaveAmp;

uniform vec3 uColorShallow;
uniform vec3 uColorDeep;
uniform float uOpacity;
uniform vec3 uSunPosition;
uniform vec3 uSunColor;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;
varying float vElevation;

// Re-implement wave function for normal calculation
// Needs to match vertex shader EXACTLY for consistent lighting
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

float getWaveHeight(vec2 pos, float time) {
    float height = 0.0;
    vec2 p = pos * uGlobalScale;

    float t1 = time * uSpeed;
    height += sin(p.x * 1.0 + t1) * 1.0;
    height += sin(p.y * 0.8 + t1 * 1.1) * 1.0;

    float t2 = time * uSpeed * 1.5;
    vec2 p2 = p * 2.5;
    p2 = vec2(p2.x * 0.8 - p2.y * 0.6, p2.x * 0.6 + p2.y * 0.8);
    height += sin(p2.x + t2) * 0.4;
    height += sin(p2.y + t2 * 1.2) * 0.4;

    float t3 = time * uSpeed * 0.5;
    height += noise(p * 4.0 + t3) * 0.3;

    return height * uWaveAmp;
}

void main() {
    // 1. Calculate Normal analytically (finite difference)
    float delta = 1.0; // Distance to sample neighbors (1 pixel unit approx)
    vec2 p = vWorldPosition.xy;

    float hC = vElevation; // Center
    float hR = getWaveHeight(p + vec2(delta, 0.0), uTime);
    float hU = getWaveHeight(p + vec2(0.0, delta), uTime);

    // Tangents
    vec3 tanX = normalize(vec3(delta, 0.0, hR - hC));
    vec3 tanY = normalize(vec3(0.0, delta, hU - hC));

    // Normal is cross product of tangents
    vec3 normal = normalize(cross(tanX, tanY));

    // 2. Lighting
    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(uSunPosition);
    vec3 halfDir = normalize(lightDir + viewDir);

    // Specular (Blinn-Phong)
    float NdotH = max(0.0, dot(normal, halfDir));
    float specular = pow(NdotH, 80.0); // Sharper highlights

    // Diffuse / Ambient
    // Just a bit of directional shading
    float diff = max(0.0, dot(normal, lightDir)) * 0.2 + 0.8;

    // 3. Fresnel & Opacity
    float viewAngle = max(0.0, dot(viewDir, normal));
    float fresnel = 0.05 + 0.95 * pow(1.0 - viewAngle, 4.0); // Reflective at angles

    // 4. Color Mixing
    // Mix based on height and fresnel
    float heightFactor = smoothstep(-uWaveAmp, uWaveAmp, vElevation);
    vec3 waterColor = mix(uColorDeep, uColorShallow, heightFactor * 0.6 + fresnel * 0.4);

    // Add Specular
    vec3 finalColor = waterColor + uSunColor * specular * 1.2;

    // 5. Fake Distortion / Refraction Effect
    // We can't actually distort the background, but we can modulate opacity
    // to make the background 'shimmer' slightly.
    // Higher opacity at crests, lower at troughs? Or strictly Fresnel based.

    // Let's use Fresnel for the main alpha logic
    // Glancing angle = opaque (reflecting sky/env)
    // Direct angle = transparent (seeing through)
    float alpha = uOpacity + (0.95 - uOpacity) * fresnel;

    // Enhance alpha with wave height to give volume
    alpha = clamp(alpha + vElevation * 0.01, 0.0, 1.0);

    gl_FragColor = vec4(finalColor, alpha);

    // Distance fog (simple linear fade if needed, but we'll skip for now as transparency handles it)
}
`;


export class KoiPondTheme {

	constructor() {
		this.isReady = false;
		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.fillLight = null;
		this.backLight = null;
		this.waterPlane = null;
		this.buildMaterials();
		this._loadPromise = null;
	}

	buildMaterials() {
		// Glass (Standard)
		this.glassMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,
			emissive: 0x00AABAE,
			emissiveIntensity: 0.15,
			transmission: 1.0,
			transparent: true,
			opacity: 1.0,
			ior: 1.45,
			thickness: 0.6,
			roughness: 0.05,
			metalness: 0.1,
			clearcoat: 1.0,
			clearcoatRoughness: 0.02,
			envMapIntensity: 20.5,
			side: THREE.DoubleSide
		});

		// Water (Shader)
		this.waterMaterial = new THREE.ShaderMaterial({
			vertexShader: WATER_VERTEX_SHADER,
			fragmentShader: WATER_FRAGMENT_SHADER,
			uniforms: {
				uTime: { value: 0.0 },
				uSpeed: { value: 1.0 },       // Animation speed
				uGlobalScale: { value: 0.01 }, // Scale of ripples (approx 0.01-0.05)
				uWaveAmp: { value: 10.0 },     // Amplitude of waves in World Units (pixels)

				uColorShallow: { value: new THREE.Color('#68c3d4') },
				uColorDeep: { value: new THREE.Color('#2d5e6e') },
				// uColorDeep: { value: new THREE.Color('#68c3d4') },
				uOpacity: { value: 0.7 },     // Base transparency (lower = clearer)
				uSunPosition: { value: new THREE.Vector3(100, 500, 500).normalize() },
				uSunColor: { value: new THREE.Color(0xffffff) },
			},
			transparent: true,
			side: THREE.DoubleSide,
		});

		this.boxMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
		this.customLineMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff });
	}

	buildThemeLighting(manager) {
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 0.65);
		manager.enableMouseLight(false);
		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0);
		this.camLight.position.set(-300, 500, 500);
		this.camLight.castShadow = true;
		manager.scene.add(this.camLight);
		manager.scene.add(this.camLight.target);
		this.camLight.target.position.set(-500, 400, 0);

		this.rimLightL = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightL.position.set(-180, 10, 0);
		manager.scene.add(this.rimLightL);

		this.rimLightR = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightR.position.set(280, 50, 0);
		manager.scene.add(this.rimLightR);

		const d = 2500;
		this.camLight.shadow.camera.left = -d;
		this.camLight.shadow.camera.right = d;
		this.camLight.shadow.camera.top = d;
		this.camLight.shadow.camera.bottom = -d;
		this.camLight.shadow.camera.near = 1;
		this.camLight.shadow.camera.far = 5000;
		this.camLight.shadow.bias = 0;
		this.camLight.shadow.mapSize.width = 2048 * 2;
		this.camLight.shadow.mapSize.height = 2048 * 2;
		this.camLight.shadow.normalBias = 0.05;
		this.camLight.shadow.radius = 4;
		this.camLight.shadow.needsUpdate = true;

		manager.renderer.shadowMap.enabled = true;
		manager.renderer.shadowMap.type = THREE.PCFShadowMap;
	}

	buildWater(manager) {
		// High segment count for vertex displacement
		const geometry = new THREE.PlaneGeometry(10, 10, 256, 256);
		this.waterPlane = new THREE.Mesh(geometry, this.waterMaterial);

		const data = manager.getRegisteredElementByName('main_frame_ref');
		if (!data) return;

		data.empties.center.add(this.waterPlane);

		this.waterPlane.position.set(0, 0, -30);

		// Scale to cover screen (geometry is 10x10, so 200 scale = 2000 units)
		const scale = 250;
		this.waterPlane.scale.set(scale, scale, 1);
	}

	init(manager) {
		manager.setFrameMode('active');


		// set the background texture for our built-in bg plane
		const bgTexture = manager.loadPBR('bg_graph_paper', true, false, false, {});
		manager.setBackground(bgTexture, 100, 1, true);

		// const bgTexture = manager.loadPBR('rocky-rugged-terrain', true, false, false, {});
		// manager.setBackground(bgTexture, 200, 0.5, true;

		this.buildThemeLighting(manager);
		setTimeout(() => { this.buildWater(manager); }, 500);
		this._loadPromise = this._loadModel(manager);
	}

	destroy(manager) {
		if (this.camLight) {
			manager.scene.remove(this.camLight);
			manager.scene.remove(this.camLight.target);
			this.camLight = null;
		}
		if (this.rimLightL) { manager.scene.remove(this.rimLightL); this.rimLightL = null; }
		if (this.rimLightR) { manager.scene.remove(this.rimLightR); this.rimLightR = null; }
		if (this.fillLight) { manager.scene.remove(this.fillLight); this.fillLight = null; }
		if (this.backLight) { manager.scene.remove(this.backLight); this.backLight = null; }
		this.isReady = false;
	}

	async _loadModel(manager) {
		this.isReady = true;
	}

	buildBox(manager, data) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.boxMaterial);
		cube.name = "debug_cube";
		data.empties.center.add(cube);
	}

	updateBox(manager, data, rect) {
		const cube = data.empties.center.getObjectByName("debug_cube");
		if (cube) {
			const depth = 100;
			cube.scale.set(rect.width, rect.height, depth);
			cube.position.z = -depth / 2;
		}
	}

	buildCustomBox(manager, data) {
		const lines = new THREE.LineSegments(this.customEdgesGeometry, this.customLineMaterial);
		lines.name = "debug_custom_outline";
		data.empties.center.add(lines);
	}

	updateCustomBox(manager, data, rect) {
		const lines = data.empties.center.getObjectByName("debug_custom_outline");
		if (lines) {
			const depth = this.customDepth || 50;
			lines.scale.set(rect.width, rect.height, depth);
			lines.position.z = -depth / 2;
		}
	}

	onTick(manager, time) {
		if (this.waterMaterial && this.waterMaterial.uniforms) {
			// Slow down time passing to shader for gentle waves
			this.waterMaterial.uniforms.uTime.value = time * 0.001;
		}
	}
}
