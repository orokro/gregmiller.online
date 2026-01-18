/*
	GlassTheme.js
	--------------

	Performance-focused rewrite of GlassTheme.js that preserves:
	- Exact layout / axis assumptions:
		- X = left/right
		- Y = up/down (on screen)
		- Z = depth
		- Slices live on the ground plane, so we keep Z position = 0
		- "Height" scaling for your exported slices is on Z scale (not Y)
	- Same glass MeshPhysicalMaterial + map-donation behavior
	- Same 9-slice piece names + scaling rules

	Key perf changes vs GlassTheme:
	- NO per-update Vector.clone() allocations (reuses temp vectors)
	- NO per-update traverse() for UV scaling:
		- caches mesh UV refs per piece at build time
	- UV scaling is SKIPPED unless (repeatX/repeatY) changed meaningfully
	- Corners never UV-scale (they never scale anyway)
	- RequestRender still called, but only once per update call
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

		this._loadPromise = null;
		this._didCopyMaps = false;

		// Temp vectors to avoid per-frame allocations
		this._vTL = new THREE.Vector3();
		this._vTR = new THREE.Vector3();
		this._vBL = new THREE.Vector3();
		this._vBR = new THREE.Vector3();
		this._vC = new THREE.Vector3();

		this._vTmp1 = new THREE.Vector3();
		this._vTmp2 = new THREE.Vector3();

		// epsilon for “changed enough to update UVs”
		this._uvEps = 0.0005;
	}

	init(manager) {
		manager.setEnvironmentTexture('/env/brown_photostudio_02_2k.hdr', 0.65);

		manager.enableMouseLight(false);

		manager.setFrameMode('active');

		// manager.enableDefaultBGPlane(true);

		manager.renderer.physicallyCorrectLights = true;
		manager.renderer.toneMapping = THREE.ACESFilmicToneMapping;
		manager.renderer.toneMappingExposure = 1.0;

		// --- CHANGE 1: Use DirectionalLight for the main shadow caster ---
		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0); // Boost intensity

		// Position it to cast a clear diagonal shadow
		this.camLight.position.set(-300, 500, 500);
		this.camLight.castShadow = true;

		manager.scene.add(this.camLight);
		manager.scene.add(this.camLight.target);
		this.camLight.target.position.set(-500, 400, 0);

		// --- RIM LIGHTS (Reduced for testing) ---
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
		this.camLight.shadow.normalBias = 0.05; // Reduce shadow acne without needing a bias
		this.camLight.shadow.radius = 1;

		// Ensure renderer settings are correct
		manager.renderer.shadowMap.enabled = true;
		// manager.renderer.shadowMap.type = THREE.BasicShadowMap;
		manager.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		manager.renderer.shadowMap.type = THREE.PCFShadowMap;

		this.camLight.shadow.radius = 4;	// try 2–8
		this.camLight.shadow.needsUpdate = true;

        // console.log("GlassTheme: Shadows enabled.", {
        //     light: this.camLight,
        //     shadow: this.camLight.shadow,
        //     mapSize: this.camLight.shadow.mapSize,
        //     camera: this.camLight.shadow.camera
        // });

		this._loadPromise = this._loadModel(manager);
	}

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
		this.sliceTemplates = {};
		this.sliceSizes = {};
		this._didCopyMaps = false;
	}

	async _loadModel(manager) {

		const [gltfScene] = await manager.assetsReady(['/models/glass_slice.glb']);

		if (!gltfScene) {
			console.error("GlassTheme2: Failed to load model.");
			return;
		}

		const names = [
			'Top_Left', 'Top', 'Top_Right',
			'Left', 'Center', 'Right',
			'Bottom_Left', 'Bottom', 'Bottom_Right'
		];

		manager.setShadows(gltfScene, true);

		names.forEach((name) => {

			const obj = gltfScene.getObjectByName(name);

			if (!obj) {
				console.warn(`GlassTheme2: Missing object in GLB: ${name}`);
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

		if (!this._didCopyMaps) {
			const donor = this._findFirstMeshMaterial(gltfScene);
			if (donor)
				this._copyMapsOntoGlassMaterial(donor);
			this._didCopyMaps = true;
		}

		this.isReady = true;

		manager.registeredElements.forEach((data) => {
			manager.buildRegisteredElement(data, false);
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

			// Cache UV refs per mesh so we don't traverse() every update
			const uvMeshes = [];

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

			clone.scale.z = 1;

			// Store cached UV mesh list + last uv scales
			clone.userData.__uvMeshes = uvMeshes;
			clone.userData.__lastUV = { x: 1, y: 1 };

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

	// UV scaling around 0.5/0.5, but:
	// - Uses cached mesh UV refs
	// - Skips if unchanged (within epsilon)
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

}
