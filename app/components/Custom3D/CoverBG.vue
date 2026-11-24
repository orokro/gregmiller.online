<!--
	CoverBG.vue
	-----------

	Component for rendering a 3D background image that covers the entire container.
-->
<script setup>

// vue
import { ref, toRefs, watch } from 'vue';

// components
import ContainerCustom3D from '../ContainerCustom3D.vue';

// three
import * as THREE from 'three';

// define props
const props = defineProps({

	// The image source URL for the background texture. This is required.
	src: {
		type: String,
		required: true
	},

	// Optional Texture Maps
	normalSrc: { type: String, default: null },
	roughSrc: { type: String, default: null },
	metalSrc: { type: String, default: null },

	// The depth position of the background plane. Default is -30 units.
	depth: {
		type: Number,
		default: 30
	},

	// Whether this background should receive shadows. Default is true.
	catchShadows: {
		type: Boolean,
		default: true
	},

	// If true, recalculates UVs based on width/height so texture stays stable (tiles)
	reprojectUvs: {
		type: Boolean,
		default: false
	},

	// Scaling factor for the texture.
	// If reprojectUvs is false: 1 = stretch to fit.
	// If reprojectUvs is true: acts as a multiplier for screen-space tiling.
	uvScale: {
		type: Number,
		default: 1
	},

	// optional name parameter for the ContainerCustom3D registry
	name: {
		type: String,
		default: null,
	},

});

const { src, depth, catchShadows, reprojectUvs, uvScale, normalSrc, roughSrc, metalSrc } = toRefs(props);

// References
const el = ref(null);
let mesh = null;
let material = null;
let localMaterial = null; // Track the locally created material to dispose safely

let textures = {}; // Store refs to dispose later
let buildId = 0; // Track build versions to prevent race conditions

// current plane size in page px (element size + padding), set by update()
const PAD = 120;
let planeW = 0;
let planeH = 0;
let currentDepth = 30;


/**
 * Called by the ThreeManager before every render.
 *
 * The paper sits `depth` px behind the page. In parallax renders the eye moves with the
 * viewport, so (like the old applyPerspectiveTransform) we scale the plane by
 * (cameraZ + depth) / cameraZ and slide it so its projection lands exactly on the element:
 * the paper stays locked to the page while things above it get parallax.
 * In flat renders the plane just sits behind the element (padding covers the oblique shift).
 *
 * @param {Object} customRoot - { group, empties }
 * @param {ThreeManager} threeManager - manager
 * @param {Object} view - { perspective, eye, cameraZ }
 */
function viewUpdate(customRoot, threeManager, view) {

	if (!mesh || !planeW)
		return;

	if (!view.perspective) {
		mesh.scale.set(planeW, planeH, 1);
		mesh.position.set(0, 0, -currentDepth);
		return;
	}

	const D = view.cameraZ;
	const s = (D + currentDepth) / D;
	const g = customRoot.group.position;

	mesh.scale.set(planeW * s, planeH * s, 1);
	mesh.position.set(
		(g.x - view.eye.x) * (s - 1),
		(g.y - view.eye.y) * (s - 1),
		-currentDepth
	);
}


/**
 * Sets texture repeat so the pattern is 1000px per tile (reprojectUvs) and anchored to the
 * element's top-left, so it doesn't slide when the page height changes.
 *
 * @param {number} elW - element width
 * @param {number} elH - element height
 * @param {number|null} scaleOverride - uv scale override
 */
function updateUVs(elW, elH, scaleOverride = null) {

	if (!material || !material.map) return;

	const map = material.map;
	const s = (scaleOverride !== null) ? scaleOverride : uvScale.value;

	if (reprojectUvs.value) {
		const REFERENCE_UNIT = 1000 / s;
		map.repeat.set(planeW / REFERENCE_UNIT, planeH / REFERENCE_UNIT);
		map.offset.set(
			-(PAD / REFERENCE_UNIT) % 1,
			-((PAD + elH) / REFERENCE_UNIT) % 1
		);
	} else {
		map.repeat.set(s, s);
		map.offset.set(0, 0);
	}

	for (const key of ['normalMap', 'roughnessMap', 'metalnessMap']) {
		if (material[key]) {
			material[key].repeat.copy(map.repeat);
			material[key].offset.copy(map.offset);
		}
	}
}



async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	if (!rebuildCustom)
		return;

	// Increment build ID to invalidate any previous pending builds
	const myId = ++buildId;

	// 1. Prepare asset list
	const mapKeys = [
		{ key: 'map', url: src.value },
		{ key: 'normalMap', url: normalSrc.value },
		{ key: 'roughnessMap', url: roughSrc.value },
		{ key: 'metalnessMap', url: metalSrc.value }
	].filter(item => item.url);

	const urls = mapKeys.map(i => i.url);
	const assets = await threeManager.assetsReady(urls);

	// If a new build started while we were loading, or if the component was unmounted, abort
	if (myId !== buildId || !customRoot.group.parent)
		return;

	// 2. Process loaded textures
	const loadedMaps = {};
	assets.forEach((tex, i) => {
		if (tex) {
			tex.colorSpace = (mapKeys[i].key === 'map') ? THREE.SRGBColorSpace : THREE.NoColorSpace;
			tex.wrapS = THREE.RepeatWrapping;
			tex.wrapT = THREE.RepeatWrapping;
			loadedMaps[mapKeys[i].key] = tex;
			textures[mapKeys[i].key] = tex; // Save for cleanup
		}
	});

	if (!loadedMaps.map) {
		console.warn(`CoverBG: Failed to load main texture ${src.value}`);
		return;
	}

	// 3. Create Material
	localMaterial = new THREE.MeshStandardMaterial({
		color: 0xffffff,
		roughness: 1,
		metalness: 0,
		side: THREE.DoubleSide,
		...loadedMaps // Spread in map, normalMap, etc.
	});
	material = localMaterial;

	// 4. Create Geometry
	const geometry = new THREE.PlaneGeometry(1, 1);

	// 5. Create Mesh
	mesh = new THREE.Mesh(geometry, material);

	// 6. Configure Shadows
	if (catchShadows.value) {
		threeManager.setShadowReceiving(mesh, true);
	}

	// 7. Add to Scene
	customRoot.empties.center.add(mesh);

	// 8. Size, UVs, and sync with current manager state (in case theme changed while we were loading)
	update(null, customRoot, threeManager);

	threeManager.requestRender(true);
}


function update(defaultUpdate, customRoot, threeManager) {

	if (!mesh || !el.value)
		return;

	// Check for dynamic config from ThreeManager (via setBackground)
	currentDepth = depth.value;
	let currentScale = uvScale.value;
	let currentShadows = catchShadows.value;

	if (props.name) {
		const data = threeManager.getRegisteredElementByName(props.name);
		if (data && data.bgConfig) {
			if (data.bgConfig.depth !== undefined) currentDepth = data.bgConfig.depth;
			if (data.bgConfig.uvScale !== undefined) currentScale = data.bgConfig.uvScale;
			if (data.bgConfig.catchShadows !== undefined) currentShadows = data.bgConfig.catchShadows;

			// Handle Material Swap
			if (data.bgConfig.material && mesh.material !== data.bgConfig.material) {
				mesh.material = data.bgConfig.material;
				material = data.bgConfig.material;
			}
		}
	}

	// 1. Get current dimensions (padded so edges never show)
	const rect = el.value.$el.getBoundingClientRect();
	planeW = rect.width + PAD * 2;
	planeH = rect.height + PAD * 2;

	// 2. Base transform (parallax renders adjust it per frame in viewUpdate)
	mesh.scale.set(planeW, planeH, 1);
	mesh.position.set(0, 0, -currentDepth);

	// 3. Update UVs
	updateUVs(rect.width, rect.height, currentScale);

	// 4. Update Shadow setting
	if (mesh.receiveShadow !== currentShadows) {
		mesh.receiveShadow = currentShadows;
	}
}


function destroy(customRoot, threeManager) {

	// Cancel any pending builds
	buildId++;

	const center = customRoot.empties.center;

	if (mesh) {
		center.remove(mesh);
		if (mesh.geometry) mesh.geometry.dispose();
	}

	// Only dispose the material if we created it locally
	if (material && material === localMaterial) {
		material.dispose();
	}

	// Dispose all textures
	Object.values(textures).forEach(t => t.dispose());
	textures = {};

	mesh = null;
	material = null;
	localMaterial = null;
	planeW = 0;
	planeH = 0;

	threeManager.requestRender(true);
}


// Watchers
watch(src, () => {
	if (el.value) el.value.rebuild();
});

watch(depth, () => {
	if (el.value) el.value.threeManager?.requestRender();
});

</script>
<template>

	<ContainerCustom3D
		ref="el"
		class="bg-cover-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
		:viewFn="viewUpdate"
		:name="name"
	>
		<slot />
	</ContainerCustom3D>

</template>
<style lang="scss" scoped>

.bg-cover-container {
	position: relative;
}// .bg-cover-container

</style>
