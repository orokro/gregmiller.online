/*
	GardenTheme.js
	----------------

	Garden Theme - Procedural Garden Implementation
*/

import * as THREE from 'three';
import { GardenSystem } from './includes/Garden/GardenSystem';

export class GardenTheme {

	// static theme colors for UI elements
	static themeColors = {
		primaryColor: '#4da83bff',
		secondaryColor: '#30a6aaff',
		accentColor: '#b0ec6b',
		bgAccent1: '#eaf8ffff',
		bgAccent2: '#d9e3f0ff',
		colorScroll: '#ffffff',
	};

	static themeStyles = {
		contentFrameShadow: 'inset 0px 0px 20px 5px rgba(0, 0, 0, 0.3)',
		contentHeaderBGColor: 'rgba(255, 255, 255, 0.8)',
		contentBoxBGColor: 'rgba(150, 150, 150, 0.5)',
		contentHeaderTextColor: '#FFFFFF',
		contentBoxBGBlur: '5px',
		tagBoxColor: '#83da4aff',
		tagBoxHoverColor: '#FFFFFF',
		tagTextColor: '#FFFFFF',
		tagTextHoverColor: '#83da4aff',
	};

	constructor() {
		this.isReady = false;
		this.gardenSystem = null;
		this.models = {};

		// Default Settings from our demo
		this.gardenSettings = {
			flowers: {
				density: 0.0005,
				minScale: 200.8,
				maxScale: 250.5,
				yOffset: 60,
				randomRotation: true,
				rotationAxis: "y"
			},
			leaves: { density: 0.005,
				minScale: 7,
				maxScale: 12,
				yOffset: 110,
				randomRotation: true,
				xRot: [70, 120],
				yRot: [-45, 45],
				zRot: [0, 360]
			},
			butterfly: {
				scale: 100,
				speed: 1,
				animationSpeed: 1,
				yOffset: 3,
				butterflyXOffset: 0,
				butterflyYOffset: 0,
				butterflyZOffset: 0,
				butterflyBodyScale: 1,
				baseRotation: [0, 0, 0],
				showDebugTarget: false
			}
		};

		this.blockSettings = {
			blockScaleSize: 200,
			overScaleDepth: 1.1,
			centerScaler: 1.666666667,
			uvScale: 0.003,
			reprojectUVs: true,
			blockHasSnailsOdds: 0.7,
			maxSnails: 2,
			minSnailScale: 70,
			maxSnailScale: 100,
			snailXOffset: 0,
			snailYOffset: -0.004,
			snailZOffset: -0.1,
			debugSnails: false,
			snailAnimationSpeed: 1,
			snailRotationMultiplier: [0, 1, 0],
			snailRotationXOffset: 0,
			snailRotationYOffset: 0,
			snailRotationZOffset: 0
		};

		this.grassSettings = {
			density: 50000,
			minLength: 0,
			maxLength: 40,
			minWidth: 15,
			maxWidth: 38,
			minTipWidth: 0,
			maxTipWidth: 10,
			segments: 4,
			noiseScale: 20,
			windIntensity: 30,
			windX: 1,
			windY: 1,
			dirtColor: "#ffffff",
			grassColor1: "#4da83b",
			grassColor2: "#9fc785",
			dirtUVScale: 4.0,
			normalStrength: 1.0
		};

		this.buildMaterials();
		this._loadPromise = null;
	}

	buildMaterials() {
		this.boxMaterial = new THREE.MeshStandardMaterial({
			color: 0x83da4a,
			roughness: 0.7,
			metalness: 0.2
		});
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

		// Shadow config matching KoiPond's large scale
		const d = 2500;
		this.camLight.shadow.camera.left = -d;
		this.camLight.shadow.camera.right = d;
		this.camLight.shadow.camera.top = d;
		this.camLight.shadow.camera.bottom = -d;
		this.camLight.shadow.camera.near = 1;
		this.camLight.shadow.camera.far = 5000;
		this.camLight.shadow.mapSize.width = 2048;
		this.camLight.shadow.mapSize.height = 2048;
		this.camLight.shadow.normalBias = 0.05;

		manager.renderer.shadowMap.enabled = true;
		manager.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	}

	init(manager) {
		manager.setFrameMode('active');

		// Set the background texture
		const bgTexture = manager.loadPBR('bg_graph_paper', true, false, false, {});
		manager.setBackground(bgTexture, 100, 1, true);

		this.buildThemeLighting(manager);
		this._loadPromise = this._loadModels(manager);
	}

	async _loadModels(manager) {
		const assets = await manager.assetsReady([
			'/models/GardenBlock.glb',
			'/models/Snail.glb',
			'/models/Sunflower.glb',
			'/models/Leaves.glb',
			'/models/Butterfly.glb'
		]);

		if (!assets || assets.length < 5) {
			console.error("GardenTheme: Failed to load models.");
			return;
		}

		this.models = {
			block: assets[0],
			snail: assets[1],
			sunflower: assets[2],
			leaves: assets[3],
			butterfly: { scene: assets[4], animations: assets[4].animations }
		};

		// Find the background plane mesh
		const bgData = manager.getRegisteredElementByName('app-cover-bg');
		let bgPlaneMesh = null;
		if (bgData && bgData.group) {
			bgData.group.traverse(child => {
				if (child.isMesh && child.name.includes('plane')) {
					bgPlaneMesh = child;
				}
			});
			// Fallback: search by type if name check fails
			if (!bgPlaneMesh) {
				bgData.group.traverse(child => {
					if (child.isMesh) bgPlaneMesh = child;
				});
			}
		}

		if (!bgPlaneMesh) {
			console.warn("GardenTheme: Could not find background plane mesh.");
		}

		// Initialize GardenSystem
		// Note: we'll update prisms in the first tick
		this.gardenSystem = new GardenSystem(
			manager, // Pass manager
			this.models,
			bgData, // Pass bgData instead of just the mesh
			[],
			this.gardenSettings,
			this.blockSettings,
			this.grassSettings,
			"garden_theme_seed",
			manager.camera
		);

		manager.scene.add(this.gardenSystem);
		this.isReady = true;

		// Force rebuild of existing elements
		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data, false);
		});

		manager.onResize();
		manager.requestRender();
	}

	buildBox(manager, data) {
		// Use an invisible material so the box doesn't render, but set visible=true so children DO render
		const cube = new THREE.Mesh(
			new THREE.BoxGeometry(1, 1, 1),
			new THREE.MeshBasicMaterial({ visible: false })
		);
		cube.name = "garden_prism";
		// cube.visible = true; // Default is true
		data.empties.center.add(cube);
	}

	updateBox(manager, data, rect) {
		const cube = data.empties.center.getObjectByName("garden_prism");
		if (cube) {
			const depth = 100;
			cube.scale.set(rect.width, rect.height, depth);
			cube.position.z = -depth / 2;
		}
	}

	onTick(manager, time) {
		if (!this.isReady || !this.gardenSystem) return;

		// 1. Gather current prisms
		const prisms = [];
		manager.registeredElements.forEach(data => {
			if (data.type === 'box') {
				const cube = data.empties.center.getObjectByName("garden_prism");
				if (cube) prisms.push(cube);
			}
		});

		// 2. Update System
		this.gardenSystem.update(prisms);

		// 3. Animation
		// Need dt for butterflies
		const now = performance.now();
		const dt = this._lastTime ? (now - this._lastTime) / 1000 : 0.016;
		this._lastTime = now;

		this.gardenSystem.updateAnimation(time / 1000, dt);
	}

	destroy(manager) {
		if (this.gardenSystem) {
			this.gardenSystem.destroy();
			manager.scene.remove(this.gardenSystem);
			this.gardenSystem = null;
		}
		this.isReady = false;
	}

	onResize() {}
	onScroll() {}
}
