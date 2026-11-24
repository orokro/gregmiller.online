/*
	poc/src/GlassTheme.js
	---------------------

	Port of app/themes/GlassTheme.js (plus the CoverBG + DynamicText3D pieces it relies on)
	to the tiled engine.

	What's the same as the live theme:
		- glass_slice.glb 9-slice frames, same MeshPhysicalMaterial (transmission, clearcoat, ...)
		- maps copied from the model onto the glass material, UV repeat scaling per slice
		- graph paper PBR cover background at depth 100, catching shadows
		- brown_photostudio_02_2k.hdr environment, ACES tone mapping, exposure 0.65
		- directional key light w/ PCF shadows, two rim point lights, optional mouse light
		- 3D glass lettering for the page header (DynamicText3D)

	What's different (because of the tiled approach):
		- lights are positioned relative to the tile being rendered instead of the screen
		- shadow frustum is fitted to the tile instead of a fixed ±2500 box
		- shadow map 2048 (tile-fitted, so similar or better texel density than 4096 @ ±2500)
*/

// three
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';


/**
 * Glass theme for the tiled engine.
 */
export class GlassTheme {

	constructor() {

		// slice templates from the glb
		this.sliceTemplates = {};
		this.sliceSizes = {};

		// lights
		this.camLight = null;
		this.rimLightL = null;
		this.rimLightR = null;
		this.mouseLight = null;

		// toggles (HUD)
		this.rimLightsEnabled = true;
		this.transmissionEnabled = true;
		this.paperDepth = false;          // false = paper locked to the page like the live site

		// light offsets copied from the live theme (relative to "screen center" there,
		// relative to the tile center here)
		this.keyLightOffset = new THREE.Vector3(200, 100, 500);   // (-300,500,500) - target (-500,400,0)
		this.rimOffsetL = new THREE.Vector3(-180, 10, 0);
		this.rimOffsetR = new THREE.Vector3(280, 50, 0);

		// letters cache for 3D text
		this.letterCache = new Map();

		// temps
		this._vTL = new THREE.Vector3();
		this._vTR = new THREE.Vector3();
		this._vBL = new THREE.Vector3();
		this._vBR = new THREE.Vector3();
		this._vC = new THREE.Vector3();
		this._vTmp1 = new THREE.Vector3();
		this._vTmp2 = new THREE.Vector3();
		this._uvEps = 0.0005;

		this.buildMaterials();
	}


	/* ==========================================================================
	   INIT
	   ========================================================================== */

	/**
	 * Loads everything the theme needs before any tile is rendered.
	 *
	 * @param {TileEngine} engine - engine instance
	 */
	async init(engine) {

		this.engine = engine;

		// loaders
		const draco = new DRACOLoader();
		draco.setDecoderPath('/three/examples/jsm/libs/draco/gltf/');
		this.gltfLoader = new GLTFLoader();
		this.gltfLoader.setDRACOLoader(draco);

		// renderer look (same as live)
		const r = engine.renderer;
		r.toneMapping = THREE.ACESFilmicToneMapping;
		r.toneMappingExposure = 0.65;

		this.buildLights(engine.scene);

		// load everything in parallel
		await Promise.all([
			this._loadEnvironment(engine, '/env/brown_photostudio_02_2k.hdr'),
			this._loadSlices(),
			this._loadCoverMaterial(),
		]);
	}


	/**
	 * Glass material (verbatim from the live theme).
	 */
	buildMaterials() {

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

		// lettering glass (from DynamicText3D.vue)
		this.letterMaterial = new THREE.MeshPhysicalMaterial({
			color: 0x99AAFF,
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
			attenuationDistance: 0.8,
			side: THREE.DoubleSide,
			depthWrite: true
		});
	}


	/**
	 * Key light, rim lights, mouse light.
	 *
	 * @param {THREE.Scene} scene - scene to add lights to
	 */
	buildLights(scene) {

		// key light / shadow caster
		this.camLight = new THREE.DirectionalLight(0xffffff, 3.0);
		this.camLight.castShadow = true;
		this.camLight.shadow.mapSize.set(2048, 2048);
		this.camLight.shadow.bias = 0;
		this.camLight.shadow.normalBias = 0.05;
		this.camLight.shadow.radius = 4;
		this.camLight.shadow.camera.near = 1;
		this.camLight.shadow.camera.far = 3000;
		scene.add(this.camLight);
		scene.add(this.camLight.target);

		// rim lights
		this.rimLightL = new THREE.PointLight(0xffffff, 5000, 4000);
		this.rimLightR = new THREE.PointLight(0xffffff, 5000, 4000);
		scene.add(this.rimLightL);
		scene.add(this.rimLightR);

		// mouse light: always in the scene (intensity 0 when off) so toggling never recompiles shaders
		this.mouseLight = new THREE.PointLight(0xffffff, 0, 500);
		this.mouseLight.castShadow = false;
		scene.add(this.mouseLight);
	}


	/**
	 * Loads the HDR environment.
	 *
	 * @param {TileEngine} engine - engine instance
	 * @param {string} url - hdr url
	 */
	async _loadEnvironment(engine, url) {

		const tex = await new HDRLoader().loadAsync(url);
		tex.mapping = THREE.EquirectangularReflectionMapping;
		engine.scene.environment = tex;
	}


	/**
	 * Loads glass_slice.glb and caches the 9 slice templates (same as live _loadModel).
	 */
	async _loadSlices() {

		const gltf = await this.gltfLoader.loadAsync('/models/glass_slice.glb');
		const root = gltf.scene;

		const names = [
			'Top_Left', 'Top', 'Top_Right',
			'Left', 'Center', 'Right',
			'Bottom_Left', 'Bottom', 'Bottom_Right'
		];

		root.traverse((o) => {
			if (o.isMesh) {
				o.castShadow = true;
				o.receiveShadow = true;
			}
		});

		names.forEach((name) => {

			const obj = root.getObjectByName(name);
			if (!obj) {
				console.warn(`GlassTheme: Missing object in GLB: ${name}`);
				return;
			}

			this.sliceTemplates[name] = obj;

			const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
			if (size.x === 0) size.x = 1;
			if (size.y === 0) size.y = 1;
			if (size.z === 0) size.z = 1;
			this.sliceSizes[name] = size;
		});

		// copy the model's maps onto our glass material
		let donor = null;
		root.traverse((o) => {
			if (!donor && o.isMesh)
				donor = Array.isArray(o.material) ? o.material[0] : o.material;
		});

		if (donor) {
			const keys = [
				'map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap',
				'emissiveMap', 'thicknessMap', 'transmissionMap', 'clearcoatMap',
				'clearcoatNormalMap', 'clearcoatRoughnessMap',
			];
			keys.forEach((k) => {
				if (donor[k]) {
					this.glassMaterial[k] = donor[k];
					donor[k].wrapS = THREE.RepeatWrapping;
					donor[k].wrapT = THREE.RepeatWrapping;
					donor[k].needsUpdate = true;
				}
			});
			this.glassMaterial.needsUpdate = true;
		}
	}


	/**
	 * Graph paper PBR material (manager.loadPBR('bg_graph_paper', normal=true)).
	 */
	async _loadCoverMaterial() {

		const loader = new THREE.TextureLoader();
		const [albedo, normal] = await Promise.all([
			loader.loadAsync('/textures/bg_graph_paper_ALBEDO.png'),
			loader.loadAsync('/textures/bg_graph_paper_NORMAL.png'),
		]);

		albedo.colorSpace = THREE.SRGBColorSpace;
		[albedo, normal].forEach((t) => {
			t.wrapS = THREE.RepeatWrapping;
			t.wrapT = THREE.RepeatWrapping;
			t.anisotropy = 4;
		});

		this.coverMaterial = new THREE.MeshStandardMaterial({
			color: 0xffffff,
			roughness: 1,
			metalness: 0,
			side: THREE.DoubleSide,
			map: albedo,
			normalMap: normal,
		});
	}


	/* ==========================================================================
	   ITEM BUILD / UPDATE
	   ========================================================================== */

	/**
	 * Builds geometry for an item.
	 *
	 * @param {Object} item - engine item
	 */
	async build(item) {

		if (item.kind === 'box')
			return this._buildGlassSlices(item);

		if (item.kind === 'cover')
			return this._buildCover(item);

		if (item.kind === 'text3d')
			return this._buildText(item);
	}


	/**
	 * Updates geometry for an item after its rect changed.
	 *
	 * @param {Object} item - engine item
	 */
	update(item) {

		if (item.kind === 'box')
			return this._updateGlassSlices(item);

		if (item.kind === 'cover')
			return this._updateCover(item);

		if (item.kind === 'text3d')
			return this._updateText(item);
	}


	/* ---------- glass frames (verbatim logic from the live theme) ---------- */

	/**
	 * Clones the 9 slices into the item's group.
	 *
	 * @param {Object} item - engine item
	 */
	_buildGlassSlices(item) {

		const parts = {};

		const cloneSlice = (name) => {

			const template = this.sliceTemplates[name];
			if (!template)
				return null;

			const clone = template.clone(true);
			const uvMeshes = [];

			clone.traverse((o) => {
				if (!o.isMesh)
					return;

				o.material = this.glassMaterial;

				if (o.geometry) {
					o.geometry = o.geometry.clone();

					const uv = o.geometry.attributes.uv;
					if (uv && !o.geometry.userData.__baseUV)
						o.geometry.userData.__baseUV = new Float32Array(uv.array);

					if (uv && o.geometry.userData.__baseUV)
						uvMeshes.push({ uv, baseUV: o.geometry.userData.__baseUV });
				}

				o.castShadow = true;
				o.receiveShadow = true;
			});

			clone.scale.z = 1;
			clone.userData.__uvMeshes = uvMeshes;
			clone.userData.__lastUV = { x: 1, y: 1 };

			item.group.add(clone);
			return clone;
		};

		['Top_Left', 'Top', 'Top_Right', 'Left', 'Center', 'Right', 'Bottom_Left', 'Bottom', 'Bottom_Right']
			.forEach((n) => { parts[n] = cloneSlice(n); });

		item.themeData.glassParts = parts;
		this._updateGlassSlices(item);
	}


	/**
	 * UV scaling around 0.5/0.5 (verbatim).
	 *
	 * @param {THREE.Object3D} piece - slice
	 * @param {number} repeatX - repeat in x
	 * @param {number} repeatY - repeat in y
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

			for (let i = 0; i < arr.length; i += 2) {
				arr[i] = (baseUV[i] - 0.5) * repeatX + 0.5;
				arr[i + 1] = (baseUV[i + 1] - 0.5) * repeatY + 0.5;
			}

			uv.needsUpdate = true;
		}
	}


	/**
	 * Positions/scales the 9 slices to the item's empties (verbatim logic).
	 *
	 * @param {Object} item - engine item
	 */
	_updateGlassSlices(item) {

		const parts = item.themeData.glassParts;
		if (!parts)
			return;

		const tl = this._vTL.copy(item.empties.tl.position);
		const tr = this._vTR.copy(item.empties.tr.position);
		const bl = this._vBL.copy(item.empties.bl.position);
		const br = this._vBR.copy(item.empties.br.position);
		const c = this._vC.copy(item.empties.center.position);

		const topWidth = tl.distanceTo(tr);
		const bottomWidth = bl.distanceTo(br);
		const leftHeight = tl.distanceTo(bl);
		const rightHeight = tr.distanceTo(br);

		const topMid = this._vTmp1.copy(tl).add(tr).multiplyScalar(0.5);
		const bottomMid = this._vTmp2.copy(bl).add(br).multiplyScalar(0.5);

		const leftMidX = (tl.x + bl.x) * 0.5;
		const leftMidY = (tl.y + bl.y) * 0.5;
		const rightMidX = (tr.x + br.x) * 0.5;
		const rightMidY = (tr.y + br.y) * 0.5;

		// height is Z scale in the exported slices
		const scaleXY = (obj, sx, sy) => { if (obj) obj.scale.set(sx, 1, sy); };
		const setPosFlat = (obj, x, y) => { if (obj) obj.position.set(x, y, 0); };

		// corners
		for (const [name, v] of [['Top_Left', tl], ['Top_Right', tr], ['Bottom_Left', bl], ['Bottom_Right', br]]) {
			if (parts[name]) {
				parts[name].scale.set(1, 1, 1);
				setPosFlat(parts[name], v.x, v.y);
			}
		}

		// edges
		if (parts.Top) {
			const sx = topWidth / this.sliceSizes.Top.x;
			scaleXY(parts.Top, sx, 1);
			setPosFlat(parts.Top, topMid.x, topMid.y);
			this._scalePieceUV(parts.Top, sx, 1);
		}
		if (parts.Bottom) {
			const sx = bottomWidth / this.sliceSizes.Bottom.x;
			scaleXY(parts.Bottom, sx, 1);
			setPosFlat(parts.Bottom, bottomMid.x, bottomMid.y);
			this._scalePieceUV(parts.Bottom, sx, 1);
		}
		if (parts.Left) {
			const sy = leftHeight / this.sliceSizes.Left.z;
			scaleXY(parts.Left, 1, sy);
			setPosFlat(parts.Left, leftMidX, leftMidY);
			this._scalePieceUV(parts.Left, 1, sy);
		}
		if (parts.Right) {
			const sy = rightHeight / this.sliceSizes.Right.z;
			scaleXY(parts.Right, 1, sy);
			setPosFlat(parts.Right, rightMidX, rightMidY);
			this._scalePieceUV(parts.Right, 1, sy);
		}

		// center
		if (parts.Center) {
			const sx = topWidth / this.sliceSizes.Center.x;
			const sy = leftHeight / this.sliceSizes.Center.z;
			scaleXY(parts.Center, sx, sy);
			setPosFlat(parts.Center, c.x, c.y);
			this._scalePieceUV(parts.Center, sx, sy);
		}
	}


	/* ---------- cover background (CoverBG.vue + setBackground) ---------- */

	/**
	 * Builds the graph paper plane.
	 *
	 * @param {Object} item - engine item
	 */
	_buildCover(item) {

		// each cover gets its own material clone so its UV repeat can match its size
		const mat = this.coverMaterial.clone();
		mat.map = this.coverMaterial.map.clone();
		mat.normalMap = this.coverMaterial.normalMap.clone();

		const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
		mesh.receiveShadow = true;
		mesh.castShadow = false;

		item.empties.center.add(mesh);
		item.themeData.cover = { mesh, mat, w: 0, h: 0, depth: 100 };

		this.coverItems = this.coverItems || [];
		this.coverItems.push(item);

		this._updateCover(item);
	}


	/**
	 * Sizes the cover plane to its element and keeps the paper at 1000px per repeat.
	 *
	 * @param {Object} item - engine item
	 */
	_updateCover(item) {

		const cover = item.themeData.cover;
		if (!cover || !item.rect)
			return;

		const depth = 100;

		// pad so the oblique shear never reveals an edge
		const pad = 200;
		const w = item.rect.width + pad * 2;
		const h = item.rect.height + pad * 2;

		cover.w = w;
		cover.h = h;
		cover.depth = depth;
		cover.mesh.scale.set(w, h, 1);
		cover.mesh.position.set(0, 0, -depth);

		// REFERENCE_UNIT = 1000 (reprojectUvs), anchored to the element's top-left
		const rx = w / 1000;
		const ry = h / 1000;
		cover.mat.map.repeat.set(rx, ry);
		cover.mat.normalMap.repeat.set(rx, ry);

		// anchor the pattern to the element's top-left (uv v=0 is the plane bottom), so the
		// paper doesn't slide when the page height changes
		const ox = -(pad / 1000) % 1;
		const oy = -((pad + item.rect.height) / 1000) % 1;
		cover.mat.map.offset.set(ox, oy);
		cover.mat.normalMap.offset.copy(cover.mat.map.offset);
	}


	/* ---------- 3D header text (DynamicText3D.vue + use3DLettering.js) ---------- */

	/**
	 * Loads letter models and assembles the word.
	 *
	 * @param {Object} item - engine item
	 */
	async _buildText(item) {

		const text = item.el.dataset.text3d;
		if (!text)
			return;

		// load unique letters
		const chars = [...new Set(text.split('').filter((ch) => ch.trim() !== ''))];
		await Promise.all(chars.map(async (ch) => {

			if (this.letterCache.has(ch))
				return;

			const gltf = await this.gltfLoader.loadAsync(`/models/text/${ch.toUpperCase()}.glb`);
			const mesh = gltf.scene.children[0].clone();
			const box = new THREE.Box3().setFromObject(mesh);
			this.letterCache.set(ch, { mesh, width: box.max.x - box.min.x });
		}));

		// assemble (same spacing as use3DLettering)
		const group = new THREE.Group();
		const spacing = 0.15;
		let x = 0;

		for (const ch of text) {

			if (ch === ' ') {
				x += spacing * 2;
				continue;
			}

			const entry = this.letterCache.get(ch);
			if (!entry)
				continue;

			const mesh = entry.mesh.clone();
			mesh.material = this.letterMaterial;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			mesh.position.x = x + entry.width / 2;
			group.add(mesh);
			x += entry.width + spacing;
		}

		group.children.forEach((c) => { c.position.x -= x / 2; });
		group.rotation.x = Math.PI / 2;

		item.empties.center.add(group);
		item.themeData.text = group;

		this._updateText(item);
		document.documentElement.classList.add('poc-text-ready');
	}


	/**
	 * Scales/positions the word to its container width (DynamicText3D applyTransform).
	 *
	 * @param {Object} item - engine item
	 */
	_updateText(item) {

		const group = item.themeData.text;
		if (!group || !item.rect)
			return;

		// page props: scale 0.7, xOffset 20, heightMax -30, heightMin -90
		const propScale = 0.7;
		const xOffset = 20;
		const heightMax = -30;
		const heightMin = -90;

		const baseScale = 200 * propScale;
		const refWidth = 800;
		const scale = baseScale * (item.rect.width / refWidth);
		group.scale.set(scale, scale, scale);

		const zPos = heightMax + (1 - scale / baseScale) * (heightMin - heightMax);
		group.position.set(xOffset * (item.rect.width / refWidth), -10, zPos);
	}


	/* ==========================================================================
	   PER-TILE LIGHT RIG
	   ========================================================================== */

	/**
	 * Called by the engine right before rendering a region. Moves the light rig so the
	 * region is lit like the old "screen", and fits the shadow frustum to it.
	 *
	 * The key light is a directional light, so its shadows only depend on its direction,
	 * not where the rig sits. We therefore snap the rig to a coarse grid with some slack
	 * and only ask for a new shadow pass when the region leaves the current cell. While
	 * scrolling that skips the shadow pass on most frames.
	 *
	 * @param {{x:number,y:number,w:number,h:number}} region - doc-space region
	 * @returns {boolean} true if the shadow map must be re-rendered
	 */
	prepareRegion(region) {

		const cx = region.x + region.w / 2;
		const cy = -(region.y + region.h / 2);

		// rim lights follow the region every time (cheap uniforms, no shadows)
		const rim = this.rimLightsEnabled ? 5000 : 0;
		this.rimLightL.intensity = rim;
		this.rimLightR.intensity = rim;
		this.rimLightL.position.set(cx, cy, 0).add(this.rimOffsetL);
		this.rimLightR.position.set(cx, cy, 0).add(this.rimOffsetR);

		// key light rig snapped to a grid
		const step = 600;
		const ax = Math.round(cx / step) * step;
		const ay = Math.round(cy / step) * step;
		const half = Math.ceil((Math.max(region.w, region.h) / 2 + 300 + step) / 100) * 100;

		const key = `${ax},${ay},${half}`;
		if (key === this._shadowKey)
			return false;
		this._shadowKey = key;

		this.camLight.target.position.set(ax, ay, 0);
		this.camLight.position.set(ax, ay, 0).add(this.keyLightOffset);
		this.camLight.target.updateMatrixWorld();

		const sc = this.camLight.shadow.camera;
		sc.left = -half;
		sc.right = half;
		sc.top = half;
		sc.bottom = -half;
		sc.updateProjectionMatrix();

		return true;
	}


	/**
	 * Forces the next render to redo the shadow map (geometry or settings changed).
	 */
	invalidateShadows() {
		this._shadowKey = null;
	}


	/**
	 * Called by the engine right before rendering, with the eye for parallax renders
	 * (or null for flat renders).
	 *
	 * The live site counter-scales the paper plane every frame (CoverBG applyPerspectiveTransform)
	 * so the paper stays locked to the page while things above it get parallax. Same math here.
	 * With paperDepth on, the paper is left where it is and gets real depth parallax instead.
	 *
	 * @param {{eye:THREE.Vector3, D:number}|null} view - eye info or null
	 */
	prepareView(view) {

		if (!this.coverItems)
			return;

		for (const item of this.coverItems) {

			const cover = item.themeData.cover;
			if (!cover || !item.rect)
				continue;

			// flat render, or real paper depth: plain plane at -depth
			if (!view || this.paperDepth) {
				cover.mesh.scale.set(cover.w, cover.h, 1);
				cover.mesh.position.set(0, 0, -cover.depth);
				continue;
			}

			// lock the paper's projection onto its element rect from this eye
			const s = (view.D + cover.depth) / view.D;
			const g = item.group.position;
			cover.mesh.scale.set(cover.w * s, cover.h * s, 1);
			cover.mesh.position.set(
				(g.x - view.eye.x) * (s - 1),
				(g.y - view.eye.y) * (s - 1),
				-cover.depth
			);
		}
	}


	/**
	 * Moves the mouse light (doc coords).
	 *
	 * @param {number} pageX - cursor x in document px
	 * @param {number} pageY - cursor y in document px
	 */
	setMouseLight(pageX, pageY) {
		this.mouseLight.position.set(pageX, -pageY, 150);
	}


	/**
	 * Turns the mouse light on/off.
	 *
	 * @param {boolean} on - enabled
	 */
	enableMouseLight(on) {
		this.mouseLight.intensity = on ? 500000 : 0;
	}


	/**
	 * Toggles physical transmission on the glass (the most expensive part of the look).
	 *
	 * @param {boolean} on - enabled
	 */
	setTransmission(on) {

		this.transmissionEnabled = on;
		for (const m of [this.glassMaterial, this.letterMaterial]) {
			m.transmission = on ? 1.0 : 0.0;
			m.opacity = on ? 1.0 : 0.35;
			m.needsUpdate = true;
		}
	}

}
