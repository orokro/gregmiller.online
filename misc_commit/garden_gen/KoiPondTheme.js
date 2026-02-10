/*
	KoiPondTheme.js
	---------------

	Makes a koi pond!
*/

// three
import * as THREE from 'three';
import { ThreeManager } from '../utils/ThreeManager';
import { LilyGroup } from './includes/LilyGroup';
import { PondElements } from './includes/PondElements';

// our app
import { KoiSystem } from './includes/KoiSystem';


// main money
export class KoiPondTheme {

	// static theme colors for UI elements, etc. (not used by theme code directly)
	static themeColors = {
		primaryColor: '#4da83bff',
		secondaryColor: '#30a6aaff',
		accentColor: '#b0ec6b',
		bgAccent1: '#eaf8ffff',
		bgAccent2: '#d9e3f0ff',
		colorScroll: '#ffffff',
		textColor: '#ffffff',
	};

	// other CSS vars not specifically colors
	static themeStyles = {
		contentFrameShadow: 'inset 0px 0px 20px 5px rgba(0, 0, 0, 1.25)',
		contentHeaderTextColor: '#FFFFFF',
		contentHeaderBGColor: 'rgba(54, 150, 102, 0.8)',
		contentBoxBGColor: 'rgba(54, 150, 102, 0.8)',
		contentBoxBGBlur: '5px',
		tagBoxColor: '#83da4aff',
		tagBoxHoverColor: '#FFFFFF',
		tagTextColor: '#FFFFFF',
		tagTextHoverColor: '#83da4aff',
	};


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

		// our koi system once we're ready to initialize it
		this.koiSystem = null;

		// our pond elements on the sides
		this.pondElements = null;

		// store our extra models on this
		this.models = {};

		// build our materials once on load
		this.buildMaterials();

		// promise for loading the model, so we don't try to build boxes before it's ready
		this._loadPromise = null;
	}


	/**
	 * Builds materials used by the theme, such as the glass material. This is called once during initialization.
	 */
	buildMaterials() {

		// make our glass material
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

		// make our water material
		this.waterMaterial = new THREE.ShaderMaterial({
			uniforms: {
				foamColor: { value: new THREE.Color(0xEFEFEF) },
				waterColor: { value: new THREE.Color(0x88AAAA) },
				blendDepth: { value: 30.0 },
				tDepth: { value: null },
				tDiffuse: { value: null },
				cameraNear: { value: 0.1 },
				cameraFar: { value: 10000.0 },
				time: { value: 0 },

				// Primary Wave
				waveSize: { value: 0.00015 },
				waveIntensity: { value: 2 }, //12.5 },
				waveSpeed: { value: 0.001 },

				// Secondary Wave (Break up pattern)
				waveSize2: { value: 0.00002 },
				waveIntensity2: { value: 6.0 },
				waveSpeed2: { value: 0.0007 },

				distortIntensity: { value: 20.0 },
				waterDirX: { value: 1.0 },
				waterDirY: { value: 1.0 },
				scrollY: { value: 0.0 },
				envMap: { value: null },
				envMapIntensity: { value: 0.1 },
				sunColor: { value: new THREE.Color(0xAAAAAA) },
									},
			vertexShader,
			fragmentShader,
			transparent: true,
			depthWrite: false
		});

		// Prepare reusable materials/geometries
		this.boxMaterial = new THREE.MeshBasicMaterial({
			color: 0xff0000,
			wireframe: true
		});

		// box line material
		this.customLineMaterial = new THREE.LineBasicMaterial({
			color: 0x00ffff
		});
	}


	/**
	 * Builds the lighting setup for the theme, including environment maps and scene lights. Called during initialization.
	 *
	 * @param {ThreeManager} manager - ThreeManager instance
	 */
	buildThemeLighting(manager) {

		// set our environment map for this theme
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 0.65);

		// enable or disable the mouse-light feature
		manager.enableMouseLight(false);

		// configure scene lighting
		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		// Add a directional light as main shadow caster
		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0);
		this.camLight.position.set(-300, 500, 500);
		this.camLight.castShadow = true;
		manager.scene.add(this.camLight);
		manager.scene.add(this.camLight.target);
		this.camLight.target.position.set(-500, 400, 0);

		// Add some rim lights to make the glass pop more
		this.rimLightL = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightL.position.set(-180, 10, 0);
		manager.scene.add(this.rimLightL);

		this.rimLightR = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightR.position.set(280, 50, 0);
		manager.scene.add(this.rimLightR);

		// --- SHADOW CONFIGURATION ---
		const d = 2500;
		this.camLight.shadow.camera.left = -d;
		this.camLight.shadow.camera.right = d;
		this.camLight.shadow.camera.top = d;
		this.camLight.shadow.camera.bottom = -d;

		this.camLight.shadow.camera.near = 1;
		this.camLight.shadow.camera.far = 5000;

		this.camLight.shadow.bias = 0; // Reset bias
		this.camLight.shadow.mapSize.width = 2048 * 2;
		this.camLight.shadow.mapSize.height = 2048 * 2;

		// Reduce shadow acne without needing a bias
		this.camLight.shadow.normalBias = 0.05;
		this.camLight.shadow.radius = 4;
		this.camLight.shadow.needsUpdate = true;

		// Ensure renderer settings are correct
		manager.renderer.shadowMap.enabled = true;
		manager.renderer.shadowMap.type = THREE.PCFShadowMap; // THREE.PCFSoftShadowMap;
	}


	/**
	 * Builds the animated water plane for the Koi pond
	 *
	 * @param {ThreeManager} manager - reference to the ThreeManager instance
	 */
	buildWater(manager) {

		// Create Geometry & water mesh
		const geometry = new THREE.PlaneGeometry(10, 10);
		this.waterPlane = new THREE.Mesh(geometry, this.waterMaterial);
		this.waterPlane.renderOrder = 100; // Render after everything else so we can read depth

		// get reference to the plane that covers the screen (not the background plane)
		// get the registered element data for the background cover component or GTFO if doesn't exist
		const data = manager.getRegisteredElementByName('main_frame_ref');
		if (!data)
			return;

		// add the plane to our center empty
		data.empties.center.add(this.waterPlane);

		// rotate it flat like a pond, and position it deeper into the scene
		// this.waterPlane.rotation.x = -Math.PI / 2;
		this.waterPlane.position.x = 0;
		this.waterPlane.position.y = 0;
		this.waterPlane.position.z = -70;

		// scale the plane big enough to cover the whole screen, even on large monitors
		const scale = 2000;
		this.waterPlane.scale.set(scale, scale, 10);
	}


	/**
	 * Called by ThemeManager when the theme is initialized. Sets up environment, lighting, and starts loading the model.
	 *
	 * @param {ThreeManager} manager - The ThreeManager Instance
	 */
	init(manager) {

		// this theme will render actively with a rAF loop, so set the frame mode to 'active' (instead of 'demand' or 'manual')
		manager.setFrameMode('active');

		// set the background texture for our built-in bg plane
		const bgTexture = manager.loadPBR('rocky-rugged-terrain', true, false, false, {});
		manager.setBackground(bgTexture, 200, 0.5, true);

		// set up our lighting
		this.buildThemeLighting(manager);

		// Initialize depth target for foam calculations
		this.depthTarget = new THREE.WebGLRenderTarget(manager.width, manager.height);
		this.depthTarget.depthBuffer = true;
		this.depthTarget.depthTexture = new THREE.DepthTexture();

		// Initialize diffuse target for fake refraction
		this.diffuseTarget = new THREE.WebGLRenderTarget(manager.width, manager.height, {
			format: THREE.RGBAFormat,
		});

		// load our glass slice model used for boxes
		this._loadModels(manager);
	}


	/**
	 * Cleans up theme before another one is loaded
	 *
	 * @param {ThreeManager} manager - ThreeManager instance reference
	 */
	destroy(manager) {

		// clean lights
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

		// dispose depth target
		if (this.depthTarget) {
			this.depthTarget.dispose();
			this.depthTarget = null;
		}

		if (this.diffuseTarget) {
			this.diffuseTarget.dispose();
			this.diffuseTarget = null;
		}

		// clear and reset references
		this.isReady = false;
		this._didCopyMaps = false;

		// clean up koi system
		if (this.koiSystem) {
			this.koiSystem.destroy();
			this.koiSystem = null;
		}

		// remove water plane
		if (this.waterPlane) {
			this.waterPlane.geometry.dispose();
			this.waterPlane.material.dispose();
			this.waterPlane.parent.remove(this.waterPlane);
			this.waterPlane = null;
		}

		// clean pond elements
		if (this.pondElements) {
			this.pondElements.destroy();
			this.pondElements = null;
		}

		// clean lilies
		// calling this on all our registered elements will cause them to rebuild with our new glass slices
		// we just loaded & processed above
		manager.registeredElements.forEach((data) => {

			// if there's a lily group, destroy it
			if(data.lilyGroup){
				data.lilyGroup.destroy();
				data.empties.center.remove(data.lilyGroup);
				data.lilyGroup = null;
				delete data.lilyGroup;
			}
		});

	}


	/**
	 * Loads the glass slice model used for boxes
	 *
	 * @param {ThreeManager} manager - ThreeManager instances
	 */
	async _loadModels(manager) {

		// load the GLB model using our ThreeManager's asset loading system, which will cache it for future use and ensure it's loaded before we try to build boxes with it
		const [lilyPad, lilyFlower, pondRock] = await manager.assetsReady([
			'/models/Lily_Pad.glb',
			'/models/Lily_Flower.glb',
			'/models/Pond_Rock.glb',
		]);

		// if we got nothing, GTFO
		if (!lilyPad || !lilyFlower || !pondRock) {
			console.error("KoiPondTheme: Failed to load models.");
			return;
		}

		// break out the models from their scenes & save them
		this.models = {};
		this.models.lily_pad = lilyPad.children[0];
		this.models.lily_flower = lilyFlower.children[0];
		this.models.pond_rock = pondRock.children[0];

		// enable the shadow casting/receiving for the whole model, since we'll be cloning pieces of it to make our boxes, and we want them all to cast/receive shadows. We can be more selective if we want later, but this is easier.
		manager.setShadows(this.models.lily_pad, true);
		manager.setShadows(this.models.pond_rock, true);

		// we have everything we need to start building boxes
		this.isReady = true;

		// calling this on all our registered elements will cause them to rebuild with our new glass slices
		// we just loaded & processed above
		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data, false);
		});

		// initialize our pond elements on the sides
		const empties = manager.getRegisteredElementByName('app-cover-bg').empties;
		this.pondElements = new PondElements(empties, this.models.pond_rock, this.models.lily_flower, "rocks");

		// init our fish
		this.koiSystem = new KoiSystem(manager);

		// builds the animated water layer
		this.buildWater(manager);

		// trigger relayout & rerender just to prevent any misalignment or glitches
		manager.onResize();
		manager.requestRender();
	}


	/**
	 * Called by the ThreeManager when a box needs to be built
	 *
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the box we're building from the ThreeManagers registered element system
	 */
	buildBox(manager, data) {

		// gtfo if not ready yet
		if (!this.isReady)
			return;

		if(!data.lilyGroup){
			data.lilyGroup = new LilyGroup(manager, this.models);
			data.lilyGroup.buildLilyGroup(data);
		}else
		{
			data.lilyGroup.updateLilyGroup(data);
		}

		// ensure it's added to the scene (in case it was removed by manager cleanup during rebuild)
		data.empties.center.add(data.lilyGroup);

		// // Add a wireframe cube to the center
		// // We'll scale it in updateBox
		// const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.boxMaterial);
		// cube.name = "debug_cube";
		// data.empties.center.add(cube);


	}


	/**
	 * Updates a box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateBox(manager, data, rect) {

		// gtfo if not ready yet
		if (!this.isReady)
			return;

		if(!data.lilyGroup){
			data.lilyGroup = new LilyGroup(manager, this.models);
			data.lilyGroup.buildLilyGroup(data);
		}else
		{
			data.lilyGroup.updateLilyGroup(data);
		}

		// ensure it's added to the scene (in case it was removed by manager cleanup during rebuild)
		data.empties.center.add(data.lilyGroup);

		// // Resize the center cube to match the div size
		// const cube = data.empties.center.getObjectByName("debug_cube");

		// if (cube) {
		// 	const depth = 100; // Arbitrary depth for the debug box

		// 	// 1. Scale
		// 	cube.scale.set(rect.width, rect.height, depth);

		// 	// 2. Position Shift
		// 	// By default, a box is centered at (0,0,0).
		// 	// We want the front face to be at Z = 0.
		// 	// Since the box is 'depth' thick, it extends from +depth/2 to -depth/2.
		// 	// We need to move it back by depth/2 so it extends from 0 to -depth.
		// 	cube.position.z = -depth / 2;
		// }
	}


	/**
	 * Called by the ThreeManager when a custom box needs to be built
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the custom box we're building from the ThreeManagers registered element system
	 */
	buildCustomBox(manager, data) {

		// A simple cyan wireframe outline (no corner cubes)
		const lines = new THREE.LineSegments(this.customEdgesGeometry, this.customLineMaterial);
		lines.name = "debug_custom_outline";
		data.empties.center.add(lines);
	}


	/**
	 * Updates a custom box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the custom box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateCustomBox(manager, data, rect) {

		const lines = data.empties.center.getObjectByName("debug_custom_outline");

		if (lines) {

			// Keep it thinner than the normal debug box so it's visually distinct
			const depth = this.customDepth;

			lines.scale.set(rect.width, rect.height, depth);
			lines.position.z = -depth / 2;
		}
	}


	/**
	 * Called when the window is resized.
	 */
	onResize(){

		// make sure pond elements reposition themselves
		if (this.pondElements) {
			this.pondElements.update();
		}

	}


	/**
	 * Called when the page is scrolled.
	 *
	 * @param {number} scrollX - The current horizontal scroll position.
	 * @param {number} scrollY - The current vertical scroll position.
	 */
	onScroll(scrollX, scrollY){

	}


	/**
	 * Used for frame adjustments on themes that are "active" (rendered in a rAF loop).
	 * This is where you would put any per-frame animation code for your theme, such as animating the water in our koi pond.
	 * If your theme doesn't need per-frame updates, you can just leave this empty.
	 *
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Number} time - current performance.now() timestamp
	 */
	onTick(manager, time) {

		if (!this.waterPlane || !this.isReady || !this.depthTarget || !this.diffuseTarget)
			return;

		if (this.koiSystem) {
			this.koiSystem.update(time);
		}

		// 1. Update resolution if it changed
		const width = manager.width;
		const height = manager.height;
		const pixelRatio = manager.renderer.getPixelRatio();
		const dWidth = Math.floor(width * pixelRatio);
		const dHeight = Math.floor(height * pixelRatio);

		if (this.depthTarget.width !== dWidth || this.depthTarget.height !== dHeight) {
			this.depthTarget.setSize(dWidth, dHeight);
			this.diffuseTarget.setSize(dWidth, dHeight);
		}

		// 2. Perform depth and diffuse pass
		// Hide water so it doesn't write to its own depth/color buffer
		const wasVisible = this.waterPlane.visible;
		this.waterPlane.visible = false;

		// Render the scene to our targets
		manager.renderer.setRenderTarget(this.depthTarget);
		manager.renderer.render(manager.scene, manager.camera);

		manager.renderer.setRenderTarget(this.diffuseTarget);
		manager.renderer.render(manager.scene, manager.camera);

		manager.renderer.setRenderTarget(null);

		// Restore visibility
		this.waterPlane.visible = wasVisible;

		// 3. Update Uniforms
		this.waterMaterial.uniforms.tDepth.value = this.depthTarget.depthTexture;
		this.waterMaterial.uniforms.tDiffuse.value = this.diffuseTarget.texture;
		this.waterMaterial.uniforms.cameraNear.value = manager.camera.near;
		this.waterMaterial.uniforms.cameraFar.value = manager.camera.far;
		this.waterMaterial.uniforms.time.value = time;
		this.waterMaterial.uniforms.scrollY.value = manager.scrollY;

		// Update envMap if it's set in the scene
		if (manager.scene.environment && !this.waterMaterial.uniforms.envMap.value) {
			this.waterMaterial.uniforms.envMap.value = manager.scene.environment;
		}

	}

}

const vertexShader = `
	varying vec2 vUv;
	varying vec4 vViewPosition;
	varying vec4 vScreenPos;
	varying vec3 vWorldPosition;

	void main() {
		vUv = uv;
		vec4 worldPosition = modelMatrix * vec4(position, 1.0);
		vWorldPosition = worldPosition.xyz;
		vec4 mvPosition = viewMatrix * worldPosition;
		vViewPosition = mvPosition;
		vScreenPos = projectionMatrix * mvPosition;
		gl_Position = vScreenPos;
	}
`;

const fragmentShader = `
	#include <packing>

	varying vec2 vUv;
	varying vec4 vViewPosition;
	varying vec4 vScreenPos;
	varying vec3 vWorldPosition;

	uniform vec3 foamColor;
	uniform vec3 waterColor;
	uniform float blendDepth;
	uniform sampler2D tDepth;
	uniform sampler2D tDiffuse;
	uniform float cameraNear;
	uniform float cameraFar;

	uniform float time;

	uniform float waveSize;
	uniform float waveIntensity;
	uniform float waveSpeed;

	uniform float waveSize2;
	uniform float waveIntensity2;
	uniform float waveSpeed2;

	uniform float distortIntensity;
	uniform float waterDirX;
	uniform float waterDirY;
	uniform float scrollY;
	uniform sampler2D envMap;


	uniform float envMapIntensity;
	uniform vec3 sunColor;
	uniform vec3 sunDirection;

	// Equirectangular mapping function
	vec2 equirectUv(vec3 v) {
		vec2 uv = vec2(atan(v.z, v.x), asin(v.y));
		uv *= vec2(0.15915494309, 0.31830988618); // 1/(2*PI), 1/PI
		uv += 0.5;
		return uv;
	}

	// Primary wave function
	float getWave1(vec2 p) {
		vec2 flow = vec2(waterDirX, waterDirY) * time * waveSpeed;

		// Rotate coords slightly to break alignment
		float c = cos(0.2);
		float s = sin(0.2);
		vec2 pRot = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

		vec2 p1 = pRot * 100.0 * waveSize + flow;
		vec2 p2 = pRot * 120.0 * waveSize - flow * 0.8;
		vec2 p3 = (pRot.x + pRot.y) * 80.0 * waveSize + flow * 1.2;

		float w = sin(p1.x + p1.y) * 0.5;
		w += sin(p2.x - p2.y) * 0.5;
		w += sin(p3.x + p3.y) * 0.5;
		return w * waveIntensity;
	}

	// Secondary wave function (different scale/speed)
	float getWave2(vec2 p) {
		vec2 flow = vec2(waterDirX, waterDirY) * time * waveSpeed2;

		// Different rotation
		float c = cos(-0.5);
		float s = sin(-0.5);
		vec2 pRot = vec2(p.x * c - p.y * s, p.x * s + p.y * c);

		vec2 p1 = pRot * 150.0 * waveSize2 + flow * 1.5;
		vec2 p2 = pRot * 90.0 * waveSize2 - flow * 0.5;

		float w = sin(p1.x) * 0.5;
		w += sin(p2.y) * 0.5;
		w += sin((p1.x + p2.y) * 0.7) * 0.5;
		return w * waveIntensity2;
	}

	// Combined wave function
	float getCombinedWave(vec2 p) {
		return getWave1(p) + getWave2(p);
	}

					void main() {
						vec2 screenUV = vScreenPos.xy / vScreenPos.w * 0.5 + 0.5;

						// Offset world position by scroll to lock waves to the content
						vec2 wavePos = vWorldPosition.xy;
						wavePos.y -= scrollY;

						// Calculate normals from combined wave gradient
						float delta = 0.5; // Larger delta for smoother derivatives
						float w = getCombinedWave(wavePos);
						float wX = getCombinedWave(wavePos + vec2(delta, 0.0));
						float wY = getCombinedWave(wavePos + vec2(0.0, delta));

						vec3 normal = normalize(vec3(w - wX, w - wY, delta));
								// Distort screen UV for fake refraction
		vec2 distortedUV = screenUV + normal.xy * (distortIntensity / 1000.0);

		// Sample depth and color with distortion
		float depthZ = texture2D(tDepth, distortedUV).x;
		vec3 sceneColor = texture2D(tDiffuse, distortedUV).rgb;

		float sceneViewZ = perspectiveDepthToViewZ(depthZ, cameraNear, cameraFar);
		float fragmentViewZ = vViewPosition.z;

		// Difference in depth
		float depthDiff = fragmentViewZ - sceneViewZ;

		// Foam factor
		float foam = 1.0 - clamp(depthDiff / blendDepth, 0.0, 1.0);
		foam = smoothstep(0.0, 1.0, foam);

		// Lighting
		vec3 viewDir = normalize(-vViewPosition.xyz);
		vec3 worldNormal = normalize(normal);
		vec3 worldViewDir = normalize(cameraPosition - vWorldPosition);

		// Fresnel effect
		float fresnel = pow(1.0 - max(dot(worldNormal, worldViewDir), 0.0), 4.0);
		fresnel = clamp(fresnel, 0.0, 1.0);

		// Specular (Sun)
		vec3 halfDir = normalize(sunDirection + worldViewDir);
		float spec = pow(max(dot(worldNormal, halfDir), 0.0), 64.0); // Softer specular
		vec3 specular = sunColor * spec;

		// Environment Reflection (Equirectangular)
		vec3 reflectDir = reflect(-worldViewDir, worldNormal);
		vec2 envUv = equirectUv(reflectDir);

		// Offset env UVs slightly by wave normal to "wobble" the reflection
		envUv += normal.xy * 0.05;

		vec3 reflection = texture2D(envMap, envUv).rgb * envMapIntensity;

		// Mix final color
		// Darken base water slightly for better contrast with foam/spec
		vec3 baseWater = mix(sceneColor * waterColor * 1.2, waterColor * 0.8, 0.6);

		// Apply reflection based on fresnel
		vec3 finalColor = mix(baseWater, reflection, fresnel * 0.9 + 0.05);

		// Add foam
		finalColor = mix(finalColor, foamColor, foam);

		// Add specular
		finalColor += specular;

		gl_FragColor = vec4(finalColor, 0.92);
	}
`;
