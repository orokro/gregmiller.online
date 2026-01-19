/*
	GlassTheme.js
	-------------

	Makes a koi pond!
*/

import * as THREE from 'three';
import { ThreeManager } from '../utils/ThreeManager';
import { Object3D } from 'three';

export class GlassTheme {

	// static theme colors for UI elements, etc. (not used by theme code directly)
	static themeColors = {
		primaryColor: '#00ABAE',
		secondaryColor: '#7561AA',
		accentColor: '#b0ec6b',
		bgAccent1: '#f8f8f8',
		bgAccent2: '#e6e6e6',
		colorScroll: '#ffffff',
	};


	/**
	 * Constructs the theme, initializing properties and default materials.
	 */
	constructor() {

		// true when the theme is ready
		this.isReady = false;

		// store information on the slices for the boxes
		this.sliceTemplates = {};
		this.sliceSizes = {};

		// store our lights
		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.fillLight = null;
		this.backLight = null;

		// Temp vectors to avoid per-frame allocations
		this._vTL = new THREE.Vector3();
		this._vTR = new THREE.Vector3();
		this._vBL = new THREE.Vector3();
		this._vBR = new THREE.Vector3();
		this._vC = new THREE.Vector3();
		this._vTmp1 = new THREE.Vector3();
		this._vTmp2 = new THREE.Vector3();

		// build our materials once on load
		this.buildMaterials();

		// true if we have copied the built-in normal maps from the glass model
		// int our glass material (we only need to do this once since the glass material is shared across all slices)
		this._didCopyMaps = false;

		// promise for loading the model, so we don't try to build boxes before it's ready
		this._loadPromise = null;

		// epsilon for “changed enough to update UVs”
		// since we are dynamically scaling UVs based on the size of the box, we don't want to update them if the size changes very little, since that would cause a lot of unnecessary UV updates (which are expensive). This epsilon is used to determine if the change in size is significant enough to warrant a UV update.
		this._uvEps = 0.0005;
	}


	/**
	 * Builds materials used by the theme, such as the glass material. This is called once during initialization.
	 */
	buildMaterials() {

		// make ur glass material
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
	 * Called by ThemeManager when the theme is initialized. Sets up environment, lighting, and starts loading the model.
	 *
	 * @param {ThreeManager} manager - The ThreeManager Instance
	 */
	init(manager) {

		// this theme doesn't need to be rendered every frame, so we can set the frame mode to 'lazy'
		// to only render when necessary (like on scroll/resize/reflow or when registered elements update)
		manager.setFrameMode('lazy');

		// set the background texture for our built-in bg plane
		const bgTexture = manager.loadPBR('bg_graph_paper', true, false, false, {});
		manager.setBackground(bgTexture, 100, 1, true);

		// set up our lighting
		this.buildThemeLighting(manager);

		// load our glass slice model used for boxes
		this._loadPromise = this._loadModel(manager);
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

		// clear and reset references
		this.isReady = false;
		this.sliceTemplates = {};
		this.sliceSizes = {};
		this._didCopyMaps = false;
	}


	/**
	 * Loads the glass slice model used for boxes
	 *
	 * @param {ThreeManager} manager - ThreeManager instances
	 */
	async _loadModel(manager) {

		// load the GLB model using our ThreeManager's asset loading system, which will cache it for future use and ensure it's loaded before we try to build boxes with it
		const [gltfScene] = await manager.assetsReady(['/models/glass_slice.glb']);

		// if we got nothing, GTFO
		if (!gltfScene) {
			console.error("GlassTheme2: Failed to load model.");
			return;
		}

		// Our slice model contains objects with these names
		const names = [
			'Top_Left', 'Top', 'Top_Right',
			'Left', 'Center', 'Right',
			'Bottom_Left', 'Bottom', 'Bottom_Right'
		];

		// enable the shadow casting/receiving for the whole model, since we'll be cloning pieces of it to make our boxes, and we want them all to cast/receive shadows. We can be more selective if we want later, but this is easier.
		manager.setShadows(gltfScene, true);

		// find all the sub meshes for our slices & store them
		names.forEach((name) => {

			// get the object from the GLB by name - this is the template we'll clone for each slice of our boxes, so we can have consistent geometry and UVs for the glass material to
			const obj = gltfScene.getObjectByName(name);

			// GTFO if we didn't find the object, but warn in case of a typo or model export issue
			if (!obj) {
				console.warn(`GlassTheme2: Missing object in GLB: ${name}`);
				return;
			}

			// save our slice reference
			this.sliceTemplates[name] = obj;

			// use a box to measure the size of the slice,
			// which we'll need to calculate UV scaling when we stretch the slices to fit different box sizes.
			// We want to scale the UVs so that the texture repeats instead of stretching, which looks better for large boxes.
			const box = new THREE.Box3().setFromObject(obj);
			const size = new THREE.Vector3();
			box.getSize(size);

			// if a slice is 0 in any dimension, like a top plane, make sure we don't accidentally
			// cancel out it's scale
			if (size.x === 0) size.x = 1;
			if (size.y === 0) size.y = 1;
			if (size.z === 0) size.z = 1;

			// save the slice size for later when we need to calculate UV scaling
			this.sliceSizes[name] = size;
		});

		// our glass slice model has built-in normal maps that we want to use in our glass material,
		// so copy any maps we find on the model's materials onto our glass material.
		// We only need to do this once since the glass material is shared across all slices.
		if (!this._didCopyMaps) {

			const donor = this._findFirstMeshMaterial(gltfScene);
			if (donor)
				this._copyMapsOntoGlassMaterial(donor);
			this._didCopyMaps = true;
		}

		// we have everything we need to start building boxes
		this.isReady = true;

		// calling this on all our registered elements will cause them to rebuild with our new glass slices
		// we just loaded & processed above
		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data, false);
		});

		// trigger relayout & rerender just to prevent any misalignment or glitches
		manager.onResize();
		manager.requestRender();
	}


	/**
	 * Finds first material in a given Object3D hierarchy
	 *
	 * @param {Object3D} root - Object to scan to find the first Material we come across
	 * @returns {THREE.Material} The first material found, or null if none found
	 */
	_findFirstMeshMaterial(root) {

		let found = null;

		root.traverse((o) => {
			if (found)
				return;
			if (!o.isMesh)
				return;

			const m = Array.isArray(o.material) ? o.material[0] : o.material;
			if (m)
				found = m;
		});

		return found;
	}



	/**
	 * Copies a materials maps to our glass slices
	 *
	 * @param {THREE.Material} sourceMaterial - material to copy maps from
	 */
	_copyMapsOntoGlassMaterial(sourceMaterial) {

		// gtfo if we didn't get a material, but warn in case of a model export issue
		if (!sourceMaterial)
			return;

		// all potential maps to copy from the Blender model
		const keys = [
			'map',
			'normalMap',
			'roughnessMap',
			'metalnessMap',
			'aoMap',
			'alphaMap',
			'emissiveMap',
			'thicknessMap',
			'transmissionMap',
			'clearcoatMap',
			'clearcoatNormalMap',
			'clearcoatRoughnessMap',
		];

		// copy all the maps if they exist
		keys.forEach((k) => {
			if (sourceMaterial[k])
				this.glassMaterial[k] = sourceMaterial[k];
		});

		// make sure uv wrapping is set to repeat for all the maps we copied,
		// since we'll be scaling the UVs on our slices and we want the textures to repeat instead of stretch
		keys.forEach((k) => {

			const tex = this.glassMaterial[k];
			if (!tex)
				return;

			tex.wrapS = THREE.RepeatWrapping;
			tex.wrapT = THREE.RepeatWrapping;
			tex.needsUpdate = true;
		});

		this.glassMaterial.needsUpdate = true;
	}


	/**
	 * Called by the ThreeManager when a box needs to be built
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the box we're building from the ThreeManagers registered element system
	 */
	buildBox(manager, data) {
		if (!this.isReady) return;
		this._buildGlassSlices(manager, data);
	}


	/**
	 * Updates a box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateBox(manager, data, rect) {
		if (!this.isReady) return;
		this._updateGlassSlices(manager, data, rect);
	}


	/**
	 * Called by the ThreeManager when a custom box needs to be built
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the custom box we're building from the ThreeManagers registered element system
	 */
	buildCustomBox(manager, data) {
		if (!this.isReady) return;
		this._buildGlassSlices(manager, data);
	}


	/**
	 * Updates a custom box when the themes scroll/resize/reflow events occur and the box's dimensions may have changed
	 *
	 * @param {ThreeManager} manager - ThreeManager reference
	 * @param {Object} data - info about the custom box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - info about the size and position of the element
	 */
	updateCustomBox(manager, data, rect) {
		if (!this.isReady) return;
		this._updateGlassSlices(manager, data, rect);
	}


	/**
	 * Builds the glass slices for a box/custom box
	 *
	 * @param {ThreeManager} manager - ThreeManager instance reference
	 * @param {Object} data - info about the box we're building from the ThreeManagers registered element system
	 */
	_buildGlassSlices(manager, data) {

		// If the data doesn't have a theme data key yet, create the empty object
		// to store this specific instance's glass slices on
		if (!data.themeData)
			data.themeData = {};

		// if we already have glass parts for a previous build, clean them up before we build new ones
		if (data.themeData.glassParts) {
			Object.values(data.themeData.glassParts).forEach((obj) => {
				if (obj && obj.parent)
					obj.parent.remove(obj);
			});
		}

		// keep track of our new parts as we build them
		const parts = {};

		// helper method to clone one of our corner/edge/center slices from the loaded template model
		const cloneSlice = (name) => {

			// get the slice by name
			const template = this.sliceTemplates[name];
			if (!template)
				return null;

			// make a new instance
			const clone = template.clone(true);

			// Cache UV refs per mesh so we don't traverse() every update
			const uvMeshes = [];

			// make sure we're using the correct materials, shadows, and UVs
			clone.traverse((o) => {
				if (!o.isMesh)
					return;

				o.material = this.glassMaterial;

				if (o.geometry) {
					o.geometry = o.geometry.clone();

					const uv = o.geometry.attributes.uv;
					if (uv && !o.geometry.userData.__baseUV) {
						o.geometry.userData.__baseUV = new Float32Array(uv.array);
					}

					if (uv && o.geometry.userData.__baseUV) {
						uvMeshes.push({
							uv,
							baseUV: o.geometry.userData.__baseUV
						});
					}
				}

				o.castShadow = true;
				o.receiveShadow = true;
			});

			// reset scale
			clone.scale.z = 1;

			// Store cached UV mesh list + last uv scales
			clone.userData.__uvMeshes = uvMeshes;
			clone.userData.__lastUV = { x: 1, y: 1 };

			data.group.add(clone);
			return clone;
		};

		// clone each part of the theme needed
		parts.Top_Left = cloneSlice('Top_Left');
		parts.Top = cloneSlice('Top');
		parts.Top_Right = cloneSlice('Top_Right');

		parts.Left = cloneSlice('Left');
		parts.Center = cloneSlice('Center');
		parts.Right = cloneSlice('Right');

		parts.Bottom_Left = cloneSlice('Bottom_Left');
		parts.Bottom = cloneSlice('Bottom');
		parts.Bottom_Right = cloneSlice('Bottom_Right');

		data.themeData.glassParts = parts;

		// we already have code to position and scale them correctly in update, so now that we've prepared the
		// the slice parts, we can just call the update method to do the actual positioning and scaling based on the current box size/shape
		this._updateGlassSlices(manager, data);
	}


	/**
	 * UV scaling around 0.5/0.5 to keep textures centered while repeating, but with optimizations:
	 * - Uses cached mesh UV refs to avoid traversing the hierarchy every update
	 * - Skips updating if the UV scale hasn't changed significantly (within an epsilon threshold) to avoid unnecessary updates
	 *
	 * @param {Object3D} piece - the piece to adjust UVs ono
	 * @param {Number} repeatX - repeat count in X direction
	 * @param {Number} repeatY - repeat count in Y direction
	 * @returns
	 */
	_scalePieceUV(piece, repeatX, repeatY) {

		if (!piece)
			return;

		const last = piece.userData.__lastUV;
		if (last) {
			if (Math.abs(last.x - repeatX) < this._uvEps && Math.abs(last.y - repeatY) < this._uvEps)
				return;
			last.x = repeatX;
			last.y = repeatY;
		}

		const uvMeshes = piece.userData.__uvMeshes;
		if (!uvMeshes || uvMeshes.length === 0)
			return;

		for (let mi = 0; mi < uvMeshes.length; mi++) {

			const { uv, baseUV } = uvMeshes[mi];
			const arr = uv.array;

			// (u-0.5)*repeat + 0.5
			for (let i = 0; i < arr.length; i += 2) {
				const u0 = baseUV[i];
				const v0 = baseUV[i + 1];
				arr[i] = (u0 - 0.5) * repeatX + 0.5;
				arr[i + 1] = (v0 - 0.5) * repeatY + 0.5;
			}

			uv.needsUpdate = true;
		}
	}


	/**
	 * Updates the position and scale of the glass slices based on the current size and shape of the box, using the positions of the empties as reference points for where the corners and edges should be. This is called on scroll/resize/reflow events when the box may have changed size.
	 *
	 * @param {ThreeManager} manager - reference to our ThreeManager instance
	 * @param {Object} data - info about the custom box we're updating from the ThreeManagers registered element system
	 * @param {Object} rect - rectangle defining the area to update
	 */
	_updateGlassSlices(manager, data, rect = null) {

		if (!data.themeData || !data.themeData.glassParts)
			return;

		const parts = data.themeData.glassParts;

		// Copy positions into temp vectors (NO allocations)
		this._vTL.copy(data.empties.tl.position);
		this._vTR.copy(data.empties.tr.position);
		this._vBL.copy(data.empties.bl.position);
		this._vBR.copy(data.empties.br.position);
		this._vC.copy(data.empties.center.position);

		const tl = this._vTL;
		const tr = this._vTR;
		const bl = this._vBL;
		const br = this._vBR;
		const c = this._vC;

		// Distances (no new vectors)
		const topWidth = tl.distanceTo(tr);
		const bottomWidth = bl.distanceTo(br);
		const leftHeight = tl.distanceTo(bl);
		const rightHeight = tr.distanceTo(br);

		// Midpoints using temps (NO allocations)
		const topMid = this._vTmp1.copy(tl).add(tr).multiplyScalar(0.5);
		const bottomMid = this._vTmp2.copy(bl).add(br).multiplyScalar(0.5);

		// Left/right mids need temps too; reuse tl/tr/bl/br math without extra allocs
		const leftMidX = (tl.x + bl.x) * 0.5;
		const leftMidY = (tl.y + bl.y) * 0.5;

		const rightMidX = (tr.x + br.x) * 0.5;
		const rightMidY = (tr.y + br.y) * 0.5;

		const scaleXY = (obj, sx, sy) => {
			if (!obj)
				return;
			// IMPORTANT: height is Z scale in your exported slices
			obj.scale.set(sx, 1, sy);
		};

		const setPosFlat = (obj, x, y) => {
			if (!obj)
				return;
			// IMPORTANT: keep Z position flat on ground plane
			obj.position.set(x, y, 0);
		};

		// corners (no scaling, no UV scaling)
		if (parts.Top_Left) {
			parts.Top_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Left, tl.x, tl.y);
		}
		if (parts.Top_Right) {
			parts.Top_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Right, tr.x, tr.y);
		}
		if (parts.Bottom_Left) {
			parts.Bottom_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Left, bl.x, bl.y);
		}
		if (parts.Bottom_Right) {
			parts.Bottom_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Right, br.x, br.y);
		}

		// top: scale width only
		if (parts.Top) {
			const base = this.sliceSizes.Top;
			const sx = topWidth / base.x;
			scaleXY(parts.Top, sx, 1);
			setPosFlat(parts.Top, topMid.x, topMid.y);
			this._scalePieceUV(parts.Top, sx, 1);
		}

		// bottom: scale width only
		if (parts.Bottom) {
			const base = this.sliceSizes.Bottom;
			const sx = bottomWidth / base.x;
			scaleXY(parts.Bottom, sx, 1);
			setPosFlat(parts.Bottom, bottomMid.x, bottomMid.y);
			this._scalePieceUV(parts.Bottom, sx, 1);
		}

		// left: scale height only (IMPORTANT: base.z because we scale on Z)
		if (parts.Left) {
			const base = this.sliceSizes.Left;
			const sy = leftHeight / base.z;
			scaleXY(parts.Left, 1, sy);
			setPosFlat(parts.Left, leftMidX, leftMidY);
			this._scalePieceUV(parts.Left, 1, sy);
		}

		// right: scale height only (IMPORTANT: base.z because we scale on Z)
		if (parts.Right) {
			const base = this.sliceSizes.Right;
			const sy = rightHeight / base.z;
			scaleXY(parts.Right, 1, sy);
			setPosFlat(parts.Right, rightMidX, rightMidY);
			this._scalePieceUV(parts.Right, 1, sy);
		}

		// center: scale width + height
		if (parts.Center) {
			const base = this.sliceSizes.Center;
			const sx = topWidth / base.x;
			const sy = leftHeight / base.z;
			scaleXY(parts.Center, sx, sy);
			setPosFlat(parts.Center, c.x, c.y);
			this._scalePieceUV(parts.Center, sx, sy);
		}

		manager.requestRender();
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

	}

}
