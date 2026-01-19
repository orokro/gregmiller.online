/*
	KoiPondTheme.js
	---------------

	Makes a koi pond!
*/

import * as THREE from 'three';
import { ThreeManager } from '../utils/ThreeManager';

// Vertex Shader
const WATER_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

void main() {
    vUv = uv;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewPosition = cameraPosition - worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

// Fragment Shader
const WATER_FRAGMENT_SHADER = `
uniform float uTime;
uniform vec3 uColorShallow;
uniform vec3 uColorDeep;
uniform float uOpacity;
uniform vec3 uSunPosition;
uniform vec3 uSunColor;

varying vec2 vUv;
varying vec3 vWorldPosition;
varying vec3 vViewPosition;

// Simple pseudo-random
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

// 2D Noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}

// FBM for water surface
float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.50));
    for (int i = 0; i < 4; ++i) {
        v += a * noise(p);
        p = rot * p * 2.0 + shift;
        a *= 0.5;
    }
    return v;
}

void main() {
    // 1. Calculate Surface Height / Normal
    // Slow gentle movement
    vec2 uv = vUv * 8.0; // Scale ripples
    vec2 move = vec2(uTime * 0.05, uTime * 0.02);

    float height = fbm(uv + move);
    float h2 = fbm(uv + move + vec2(0.02, 0.0));
    float h3 = fbm(uv + move + vec2(0.0, 0.02));

    // Approximate normal from height field
    vec3 normal = normalize(vec3(height - h2, 1.0, height - h3)); // Up is Y in tangent space?
    // Actually let's just cheat and assume flat plane Z-up in world space for lighting
    // We'll perturb the 'view' normal

    vec3 viewDir = normalize(vViewPosition);
    vec3 lightDir = normalize(uSunPosition);

    // Perturb normal for lighting
    // Since plane is flat facing camera (mostly), let's treat normal as mostly Z with some XY perturbation
    vec3 N = normalize(vec3(normal.x * 0.5, normal.z * 0.5, 1.0)); // Tangent space normal

    // Specular (Blinn-Phong)
    vec3 halfDir = normalize(lightDir + viewDir);
    float NdotH = max(0.0, dot(N, halfDir));
    float specular = pow(NdotH, 120.0); // Sharp highlights

    // Fresnel-ish term for opacity/color
    float viewAngle = max(0.0, dot(viewDir, N));
    float fresnel = 0.1 + 0.9 * pow(1.0 - viewAngle, 3.0);

    // Color mixing
    vec3 col = mix(uColorDeep, uColorShallow, height + fresnel * 0.5);

    // Add sun reflection
    col += uSunColor * specular * 0.8;

    // Fake "Distortion" via refraction edging (just visual style, not real refraction)
    // Darken the 'troughs' of the waves slightly
    col *= 0.9 + 0.1 * height;

    // Output
    // Increase opacity at glancing angles
    float alpha = uOpacity + (1.0 - uOpacity) * fresnel;

    gl_FragColor = vec4(col, alpha);

    // Fog logic (Optional - linear fog matching scene if needed, but let's stick to simple fade)
    // float depth = gl_FragCoord.z / gl_FragCoord.w;
    // float fogFactor = smoothstep(200.0, 1000.0, depth);
    // gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.9), fogFactor * 0.5);
}
`;


export class KoiPondTheme {

	/**
	 * Constructs the theme, initializing properties and default materials.
	 */
	constructor() {

		// true when the theme is ready
		this.isReady = false;

		// store our lights
		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.fillLight = null;
		this.backLight = null;

		// reference to our water plane once it's created
		this.waterPlane = null;

		// build our materials once on load
		this.buildMaterials();

		// promise for loading the model
		this._loadPromise = null;
	}


	/**
	 * Builds materials used by the theme.
	 */
	buildMaterials() {

		// Glass Material (kept as is, though maybe unused if we don't have glass boxes)
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
			attenuationColor: new THREE.Color(0xfaffff),
			attenuationDistance: 0.08,
			side: THREE.DoubleSide
		});

		// Custom Water Shader Material
		this.waterMaterial = new THREE.ShaderMaterial({
			vertexShader: WATER_VERTEX_SHADER,
			fragmentShader: WATER_FRAGMENT_SHADER,
			uniforms: {
				uTime: { value: 0.0 },
				uColorShallow: { value: new THREE.Color('#4FA8BB') }, // Light blue-teal
				uColorDeep: { value: new THREE.Color('#205566') },    // Darker teal
				uOpacity: { value: 0.55 }, // Transparency
				uSunPosition: { value: new THREE.Vector3(100, 200, 200).normalize() },
				uSunColor: { value: new THREE.Color(0xffffff) },
			},
			transparent: true,
			side: THREE.DoubleSide,
			// depthWrite: false, // Usually good for water to avoid hiding things incorrectly, but we want it to sort properly
		});

		// Debug box materials
		this.boxMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});

		this.customLineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffff
		});
	}


	/**
	 * Builds the lighting setup for the theme.
	 */
	buildThemeLighting(manager) {

		// set our environment map for this theme
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 0.65);

		manager.enableMouseLight(false);

		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		// Main directional light
		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0);
		this.camLight.position.set(-300, 500, 500);
		this.camLight.castShadow = true;
		manager.scene.add(this.camLight);
		manager.scene.add(this.camLight.target);
		this.camLight.target.position.set(-500, 400, 0);

		// Rim lights
		this.rimLightL = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightL.position.set(-180, 10, 0);
		manager.scene.add(this.rimLightL);

		this.rimLightR = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightR.position.set(280, 50, 0);
		manager.scene.add(this.rimLightR);

		// Shadows
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


	/**
	 * Builds the animated water plane for the Koi pond
	 */
	buildWater(manager) {

		// Create Geometry & water mesh
		const geometry = new THREE.PlaneGeometry(10, 10);
		this.waterPlane = new THREE.Mesh(geometry, this.waterMaterial);

		// Get reference to the center empty of the main frame
		const data = manager.getRegisteredElementByName('main_frame_ref');
		if (!data)
			return;

		data.empties.center.add(this.waterPlane);

		// Position
		this.waterPlane.position.x = 0;
		this.waterPlane.position.y = 0;
		this.waterPlane.position.z = -70; // Behind content, in front of background

		// Scale huge to cover screen
		const scale = 2000;
		this.waterPlane.scale.set(scale, scale, 10);
	}


	/**
	 * Init
	 */
	init(manager) {

		manager.setFrameMode('active');

		// Background
		const bgTexture = manager.loadPBR('rocky-rugged-terrain', true, false, false, {});
		manager.setBackground(bgTexture, 200, 0.5, true);

		// Lighting
		this.buildThemeLighting(manager);

		// Water
		setTimeout(() => {
			this.buildWater(manager);
		}, 500);

		// Load Model
		this._loadPromise = this._loadModel(manager);
	}


	/**
	 * Cleanup
	 */
	destroy(manager) {
		if (this.camLight) {
			manager.scene.remove(this.camLight);
			manager.scene.remove(this.camLight.target);
			this.camLight = null;
		}
		if (this.rimLightL) {
			manager.scene.remove(this.rimLightL);
			this.rimLightL = null;
		}
		if (this.rimLightR) {
			manager.scene.remove(this.rimLightR);
			this.rimLightR = null;
		}
		if (this.fillLight) {
			manager.scene.remove(this.fillLight);
			this.fillLight = null;
		}
		if (this.backLight) {
			manager.scene.remove(this.backLight);
			this.backLight = null;
		}

		this.isReady = false;
	}


	/**
	 * Load Model
	 */
	async _loadModel(manager) {
		// Placeholder for model loading logic
		// const [gltfScene] = await manager.assetsReady(['/models/glass_slice.glb']);
		this.isReady = true;
	}


	/**
	 * Build Box
	 */
	buildBox(manager, data) {
		const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.boxMaterial);
		cube.name = "debug_cube";
		data.empties.center.add(cube);
	}


	/**
	 * Update Box
	 */
	updateBox(manager, data, rect) {
		const cube = data.empties.center.getObjectByName("debug_cube");
		if (cube) {
			const depth = 100;
			cube.scale.set(rect.width, rect.height, depth);
			cube.position.z = -depth / 2;
		}
	}


	/**
	 * Build Custom Box
	 */
	buildCustomBox(manager, data) {
		const lines = new THREE.LineSegments(this.customEdgesGeometry, this.customLineMaterial);
		lines.name = "debug_custom_outline";
		data.empties.center.add(lines);
	}


	/**
	 * Update Custom Box
	 */
	updateCustomBox(manager, data, rect) {
		const lines = data.empties.center.getObjectByName("debug_custom_outline");
		if (lines) {
			const depth = this.customDepth || 50;
			lines.scale.set(rect.width, rect.height, depth);
			lines.position.z = -depth / 2;
		}
	}


	/**
	 * Animation Tick
	 */
	onTick(manager, time) {
		// Animate water
		if (this.waterMaterial && this.waterMaterial.uniforms) {
			// Convert time to seconds
			this.waterMaterial.uniforms.uTime.value = time * 0.01; // * 0.001;
		}
	}

}
