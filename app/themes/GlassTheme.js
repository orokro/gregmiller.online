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
	- Left/Right scale "height" only (your export uses Z for height here).
	- Center scales X/"height" only (between all four corners).

	Map + UV rules:
	- We keep a good glass MeshPhysicalMaterial
	- We COPY maps (normal/roughness/etc) from the GLB materials onto the glass material
	- We scale UVs per piece by CLONING each mesh geometry and modifying its uv attribute
	  (this avoids shared texture repeat/offset issues that can make everything disappear)
*/

import * as THREE from 'three';

export class GlassTheme {

	static themeColors = {
		primaryColor: '#00ABAE',
		secondaryColor: '#7561AA',
		accentColor: '#b0ec6b',
		bgAccent1: '#f8f8f8',
		bgAccent2: '#e6e6e6',
		colorScroll: '#ffffff',
	};

	constructor() {

		this.isReady = false;
		this.sliceTemplates = {};
		this.sliceSizes = {};

		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.fillLight = null;
		this.backLight = null;

		// One shared glass material (stable).
		// We'll "donate" maps from the GLB material(s) onto this once we load.
		this.glassMaterial = new THREE.MeshPhysicalMaterial({
			color: 0xffffff,

			transmission: 1.0,
			transparent: true,
			opacity: 1.0,

			ior: 1.45,
			thickness: 0.6,

			roughness: 0.05,
			metalness: 0.0,

			clearcoat: 1.0,
			clearcoatRoughness: 0.02,

			envMapIntensity: 2.5,

			attenuationColor: new THREE.Color(0xe6ffff),
			attenuationDistance: 0.8,

			side: THREE.DoubleSide
		});

		// internal
		this._loadPromise = null;

		// once we copy maps from GLB -> glassMaterial, don't do it again
		this._didCopyMaps = false;
	}

	init(manager) {

		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 2.0);

		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		this.camLight = new THREE.PointLight(0xffffff, 50000, 5000);
		this.camLight.position.set(50, 50, 50);
		manager.camera.add(this.camLight);

		this.rimLightL = new THREE.PointLight(0xffffff, 18000, 4000);
		this.rimLightL.position.set(-180, 10, 0);
		manager.scene.add(this.rimLightL);

		this.rimLightR = new THREE.PointLight(0xffffff, 18000, 4000);
		this.rimLightR.position.set(180, 10, 0);
		manager.scene.add(this.rimLightR);

		// Low/front fill to keep faces readable (since camera is elevated)
		this.fillLight = new THREE.PointLight(0xffffff, 12000, 6000);
		this.fillLight.position.set(0, -120, 60);
		manager.scene.add(this.fillLight);

		// Back rim to separate edges from background
		this.backLight = new THREE.PointLight(0xffffff, 14000, 6000);
		this.backLight.position.set(0, 140, -80);
		manager.scene.add(this.backLight);

		this._loadPromise = this._loadModel(manager);
	}

	destroy(manager) {

		if (this.camLight) {
			manager.camera.remove(this.camLight);
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
		this.sliceTemplates = {};
		this.sliceSizes = {};
		this._didCopyMaps = false;
	}

	async _loadModel(manager) {

		const [gltfScene] = await manager.assetsReady(['/models/glass_slice_2.glb']);

		if (!gltfScene) {
			console.error("GlassTheme: Failed to load model.");
			return;
		}

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

			this.sliceTemplates[name] = obj;

			const box = new THREE.Box3().setFromObject(obj);
			const size = new THREE.Vector3();
			box.getSize(size);

			if (size.x === 0) size.x = 1;
			if (size.y === 0) size.y = 1;
			if (size.z === 0) size.z = 1;

			this.sliceSizes[name] = size;
		});

		// Copy maps from the GLB material(s) onto our glass material (once).
		// We pick the first mesh material we find.
		if (!this._didCopyMaps) {
			const donor = this._findFirstMeshMaterial(gltfScene);
			if (donor)
				this._copyMapsOntoGlassMaterial(donor);
			this._didCopyMaps = true;
		}

		this.isReady = true;

		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data);
		});

		manager.onResize();
		manager.requestRender();
	}

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

	_copyMapsOntoGlassMaterial(sourceMaterial) {

		if (!sourceMaterial)
			return;

		// IMPORTANT: we are NOT changing texture repeat/offset here.
		// We'll scale UVs by modifying cloned geometries per piece.

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

		keys.forEach((k) => {
			if (sourceMaterial[k])
				this.glassMaterial[k] = sourceMaterial[k];
		});

		// enable wrapping so UV scaling tiles correctly
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

	buildBox(manager, data) {
		if (!this.isReady) return;
		this._buildGlassSlices(manager, data);
	}

	updateBox(manager, data, rect) {
		if (!this.isReady) return;
		this._updateGlassSlices(manager, data, rect);
	}

	buildCustomBox(manager, data) {
		if (!this.isReady) return;
		this._buildGlassSlices(manager, data);
	}

	updateCustomBox(manager, data, rect) {
		if (!this.isReady) return;
		this._updateGlassSlices(manager, data, rect);
	}

	_buildGlassSlices(manager, data) {

		if (!data.themeData)
			data.themeData = {};

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

			const clone = template.clone(true);

			clone.traverse((o) => {
				if (o.isMesh) {

					// Use our shared glass material
					o.material = this.glassMaterial;

					// IMPORTANT for UV scaling:
					// clone geometry per mesh so uv edits don't affect other instances
					if (o.geometry) {
						o.geometry = o.geometry.clone();

						// store original UVs so we can re-apply scaling each update without accumulating
						const uv = o.geometry.attributes.uv;
						if (uv && !o.geometry.userData.__baseUV) {
							o.geometry.userData.__baseUV = new Float32Array(uv.array);
						}
					}

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

		this._updateGlassSlices(manager, data);
	}

	// Scale UVs around 0.5, 0.5 by modifying geometry UVs (per-cloned geometry).
	_scalePieceUV(piece, repeatX, repeatY) {

		if (!piece)
			return;

		piece.traverse((o) => {

			if (!o.isMesh || !o.geometry)
				return;

			const uv = o.geometry.attributes.uv;
			const baseUV = o.geometry.userData.__baseUV;

			if (!uv || !baseUV)
				return;

			// scale around center: (u-0.5)*repeat + 0.5
			const arr = uv.array;

			for (let i = 0; i < arr.length; i += 2) {

				const u0 = baseUV[i];
				const v0 = baseUV[i + 1];

				arr[i] = (u0 - 0.5) * repeatX + 0.5;
				arr[i + 1] = (v0 - 0.5) * repeatY + 0.5;
			}

			uv.needsUpdate = true;
		});
	}

	_updateGlassSlices(manager, data, rect = null) {

		if (!data.themeData || !data.themeData.glassParts)
			return;

		const parts = data.themeData.glassParts;

		const tl = data.empties.tl.position.clone();
		const tr = data.empties.tr.position.clone();
		const bl = data.empties.bl.position.clone();
		const br = data.empties.br.position.clone();
		const c = data.empties.center.position.clone();

		const topWidth = tl.distanceTo(tr);
		const bottomWidth = bl.distanceTo(br);
		const leftHeight = tl.distanceTo(bl);
		const rightHeight = tr.distanceTo(br);

		const topMid = tl.clone().add(tr).multiplyScalar(0.5);
		const bottomMid = bl.clone().add(br).multiplyScalar(0.5);
		const leftMid = tl.clone().add(bl).multiplyScalar(0.5);
		const rightMid = tr.clone().add(br).multiplyScalar(0.5);

		// your axis fix: height is on Z in your exported slices
		const scaleXY = (obj, sx, sy) => {
			if (!obj)
				return;
			obj.scale.set(sx, 1, sy);
		};

		const setPosFlat = (obj, v) => {
			if (!obj)
				return;
			obj.position.set(v.x, v.y, 0);
		};

		// corners (no scaling, no UV scaling)
		if (parts.Top_Left) {
			parts.Top_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Left, tl);
			this._scalePieceUV(parts.Top_Left, 1, 1);
		}
		if (parts.Top_Right) {
			parts.Top_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Top_Right, tr);
			this._scalePieceUV(parts.Top_Right, 1, 1);
		}
		if (parts.Bottom_Left) {
			parts.Bottom_Left.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Left, bl);
			this._scalePieceUV(parts.Bottom_Left, 1, 1);
		}
		if (parts.Bottom_Right) {
			parts.Bottom_Right.scale.set(1, 1, 1);
			setPosFlat(parts.Bottom_Right, br);
			this._scalePieceUV(parts.Bottom_Right, 1, 1);
		}

		// top: scale width only
		if (parts.Top) {
			const base = this.sliceSizes.Top;
			const sx = topWidth / base.x;
			scaleXY(parts.Top, sx, 1);
			setPosFlat(parts.Top, topMid);
			this._scalePieceUV(parts.Top, sx, 1);
		}

		// bottom: scale width only
		if (parts.Bottom) {
			const base = this.sliceSizes.Bottom;
			const sx = bottomWidth / base.x;
			scaleXY(parts.Bottom, sx, 1);
			setPosFlat(parts.Bottom, bottomMid);
			this._scalePieceUV(parts.Bottom, sx, 1);
		}

		// left: scale height only (IMPORTANT: base.z because we scale on Z)
		if (parts.Left) {
			const base = this.sliceSizes.Left;
			const sy = leftHeight / base.z;
			scaleXY(parts.Left, 1, sy);
			setPosFlat(parts.Left, leftMid);
			this._scalePieceUV(parts.Left, 1, sy);
		}

		// right: scale height only (IMPORTANT: base.z because we scale on Z)
		if (parts.Right) {
			const base = this.sliceSizes.Right;
			const sy = rightHeight / base.z;
			scaleXY(parts.Right, 1, sy);
			setPosFlat(parts.Right, rightMid);
			this._scalePieceUV(parts.Right, 1, sy);
		}

		// center: scale width + height
		if (parts.Center) {
			const base = this.sliceSizes.Center;
			const sx = topWidth / base.x;
			const sy = leftHeight / base.z;
			scaleXY(parts.Center, sx, sy);
			setPosFlat(parts.Center, c);
			this._scalePieceUV(parts.Center, sx, sy);
		}

		manager.requestRender();
	}
}
