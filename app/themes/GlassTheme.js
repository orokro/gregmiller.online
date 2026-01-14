/*
	GlassTheme.js
	-------------

	Glass slice theme:
	- Loads /models/glass_slice_2.glb which contains 9 named pieces:
	  Top_Left, Top, Top_Right, Left, Center, Right, Bottom_Left, Bottom, Bottom_Right

	Scaling rules:
	- Never scale/move on Z (depth). Everything lives flat on the empties plane.
	- Corner pieces never scale.
	- Top/Bottom scale X only (width between their corners).
	- Left/Right scale Y only (height between their corners).
	- Center scales X/Y only (between all four corners).

	Works for both:
	- Container3D via buildBox/updateBox
	- ContainerCustom3D via buildCustomBox/updateCustomBox (optional in the system, but this theme provides them)
*/

import * as THREE from 'three';

export class GlassTheme {

	// define this themes colors (will be applied to CSS when loaded)
	static themeColors = {
		primaryColor: '#00ABAE',
		secondaryColor: '#7561AA',
		accentColor: '#b0ec6b',
		bgAccent1: '#f8f8f8',
		bgAccent2: '#e6e6e6',
		colorScroll: '#ffffff',
	};

	constructor() {

		// load state
		this.isReady = false;
		this.sliceTemplates = {};
		this.sliceSizes = {};

		// lighting
		this.camLight = null;

		// materials
		this.glassMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xAAEFEF,
			transmission: 0.5,  // Full transmission
			opacity: 1.0,
			metalness: 0.1,
			roughness: 0.0,     // Perfectly smooth
			ior: 1.5,           // Glass Refractive Index
			thickness: 1.5,     // Volume
			envMapIntensity: 3.0, // Bright reflections
			clearcoat: 1.0,
			clearcoatRoughness: 0.0,
			// side: THREE.DoubleSide,
			transparent: true,
		});

		// internal
		this._loadPromise = null;
	}

	/**
	 * Called by ThreeManager when the theme becomes active.
	 * NOTE: ThreeManager does not await this, so we load async internally and rebuild when ready.
	 */
	init(manager) {

		// 1. Load HDR Environment (High exposure for brightness)
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 1.0);

		// 2. Add Camera Light (Dynamic Flash)
		this.camLight = new THREE.PointLight(0xffffff, 50000, 5000); // Color, Intensity, Distance
		this.camLight.position.set(50, 50, 50);
		manager.camera.add(this.camLight);

		// 3. Load GLB (async)
		this._loadPromise = this._loadModel(manager);
	}

	/**
	 * Cleanup when theme is unloaded.
	 */
	destroy(manager) {

		// remove camera light
		if (this.camLight) {
			manager.camera.remove(this.camLight);
			this.camLight = null;
		}

		// clear refs
		this.isReady = false;
		this.sliceTemplates = {};
		this.sliceSizes = {};
	}

	async _loadModel(manager) {

		const [gltfScene] = await manager.assetsReady(['/models/glass_slice_2.glb']);

		if (!gltfScene) {
			console.error("GlassTheme: Failed to load model.");
			return;
		}

		// grab the 9 pieces by name
		const names = [
			'Top_Left', 'Top', 'Top_Right',
			'Left', 'Center', 'Right',
			'Bottom_Left', 'Bottom', 'Bottom_Right'
		];

		names.forEach((name) => {

			const obj = gltfScene.getObjectByName(name);

			if (!obj) {
				console.warn(`GlassTheme: Missing object in GLB: ${name}`);
				return;
			}

			// store a template (we clone this per element)
			this.sliceTemplates[name] = obj;

			// store its base size (used to compute scale ratios later)
			const box = new THREE.Box3().setFromObject(obj);
			const size = new THREE.Vector3();
			box.getSize(size);

			// avoid divide-by-zero in case any axis is 0
			if (size.x === 0) size.x = 1;
			if (size.y === 0) size.y = 1;
			if (size.z === 0) size.z = 1;

			this.sliceSizes[name] = size;
		});

		this.isReady = true;

		// model is ready now: rebuild everything with this theme
		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data);
		});

		// and force a position update
		manager.onResize();
		manager.requestRender();
	}

	/**
	 * Container3D default build.
	 */
	buildBox(manager, data) {

		if (!this.isReady)
			return;

		this._buildGlassSlices(manager, data);
	}

	/**
	 * Container3D default update.
	 */
	updateBox(manager, data, rect) {

		if (!this.isReady)
			return;

		this._updateGlassSlices(manager, data, rect);
	}

	/**
	 * ContainerCustom3D default build.
	 * (ThreeManager will call this unless a component supplied buildFn, or if buildFn calls defaultBuild())
	 */
	buildCustomBox(manager, data) {

		if (!this.isReady)
			return;

		this._buildGlassSlices(manager, data);
	}

	/**
	 * ContainerCustom3D default update.
	 */
	updateCustomBox(manager, data, rect) {

		if (!this.isReady)
			return;

		this._updateGlassSlices(manager, data, rect);
	}

	_buildGlassSlices(manager, data) {

		// ensure per-element storage
		if (!data.themeData)
			data.themeData = {};

		// if theme is rebuilding, manager should already have cleaned children,
		// but this guards hot-rebuilds and accidental double-builds.
		if (data.themeData.glassParts) {
			Object.values(data.themeData.glassParts).forEach((obj) => {
				if (obj && obj.parent)
					obj.parent.remove(obj);
			});
		}

		const parts = {};

		const cloneSlice = (name) => {

			const template = this.sliceTemplates[name];
			if (!template)
				return null;

			// deep clone so meshes/materials are safe per element
			const clone = template.clone(true);

			clone.traverse((o) => {
				if (o.isMesh) {
					o.material = this.glassMaterial;
					o.castShadow = false;
					o.receiveShadow = true;
				}
			});

			// never let three decide to auto-scale Z later
			clone.scale.z = 1;

			data.group.add(clone);
			return clone;
		};

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

		// immediately position/scale once (update will refine on resize/scroll)
		this._updateGlassSlices(manager, data);
	}

	_updateGlassSlices(manager, data, rect = null) {

		if (!data.themeData || !data.themeData.glassParts)
			return;

		const parts = data.themeData.glassParts;

		// corner/center positions in the SAME local space as data.group (empties are children of group)
		const tl = data.empties.tl.position.clone();
		const tr = data.empties.tr.position.clone();
		const bl = data.empties.bl.position.clone();
		const br = data.empties.br.position.clone();
		const c = data.empties.center.position.clone();

		// measures
		const topWidth = tl.distanceTo(tr);
		const bottomWidth = bl.distanceTo(br);
		const leftHeight = tl.distanceTo(bl);
		const rightHeight = tr.distanceTo(br);

		// midpoints
		const topMid = tl.clone().add(tr).multiplyScalar(0.5);
		const bottomMid = bl.clone().add(br).multiplyScalar(0.5);
		const leftMid = tl.clone().add(bl).multiplyScalar(0.5);
		const rightMid = tr.clone().add(br).multiplyScalar(0.5);

		// helper: scale only on X/Y, never Z
		const scaleXY = (obj, sx, sy) => {
			if (!obj)
				return;
			obj.scale.set(sx, 1, sy);
		};

		// helper: set pos flat (never move on Z)
		const setPosFlat = (obj, v) => {
			if (!obj)
				return;
			obj.position.set(v.x, v.y, 0);
		};

		// corners: never scale, just snap to corners
		if (parts.Top_Left) {
			parts.Top_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Left, tl);
		}
		if (parts.Top_Right) {
			parts.Top_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Right, tr);
		}
		if (parts.Bottom_Left) {
			parts.Bottom_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Left, bl);
		}
		if (parts.Bottom_Right) {
			parts.Bottom_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Right, br);
		}

		// top: position at top midpoint, scale X only
		if (parts.Top) {
			const base = this.sliceSizes.Top;
			const sx = topWidth / base.x;
			scaleXY(parts.Top, sx, 1);
			setPosFlat(parts.Top, topMid);
		}

		// bottom: position at bottom midpoint, scale X only
		if (parts.Bottom) {
			const base = this.sliceSizes.Bottom;
			const sx = bottomWidth / base.x;
			scaleXY(parts.Bottom, sx, 1);
			setPosFlat(parts.Bottom, bottomMid);
		}

		// left: position at left midpoint, scale Y only
		if (parts.Left) {
			const base = this.sliceSizes.Left;
			const sy = leftHeight / base.y;
			scaleXY(parts.Left, 1, sy);
			setPosFlat(parts.Left, leftMid);
		}

		// right: position at right midpoint, scale Y only
		if (parts.Right) {
			const base = this.sliceSizes.Right;
			const sy = rightHeight / base.y;
			scaleXY(parts.Right, 1, sy);
			setPosFlat(parts.Right, rightMid);
		}

		// center: position at center empty, scale X/Y only
		if (parts.Center) {
			const base = this.sliceSizes.Center;

			// center width/height should match the full corner-to-corner spans
			const sx = topWidth / base.x;
			const sy = leftHeight / base.y;

			scaleXY(parts.Center, sx, sy);
			setPosFlat(parts.Center, c);
		}

		// ask for a render (lazy themes rely on this)
		manager.requestRender();
	}
}
