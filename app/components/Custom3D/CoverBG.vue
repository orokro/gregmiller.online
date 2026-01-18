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


// --- Helper: Perspective Correction ---

function applyPerspectiveTransform(rect, group, camera, cameraZ, depthVal) {

	if (!mesh) return;

	// 1. Calculate Perspective Scale Factor (S)
	// S = (CameraZ + Depth) / CameraZ
	const scaleFactor = (cameraZ + depthVal) / cameraZ;

	mesh.scale.set(rect.width * scaleFactor, rect.height * scaleFactor, 1);

	// 2. Calculate Parallax Alignment Offset
	const offsetX = (group.position.x - camera.position.x) * (scaleFactor - 1);
	const offsetY = (group.position.y - camera.position.y) * (scaleFactor - 1);

	mesh.position.set(offsetX, offsetY, -depthVal);
}

// --- Helper: UV Reprojection ---

function updateUVs(width, height, scaleOverride = null) {

	if (!material || !material.map) return;

	const map = material.map;
	const s = (scaleOverride !== null) ? scaleOverride : uvScale.value;

	if (reprojectUvs.value) {
		// "Stable" mapping:
		// We normalize by a reference size (1000px) so s=1 means "1 tile per 1000px"
		// If we didn't divide, s=1 would mean "1 tile per pixel", causing the solid color bug.
		const REFERENCE_UNIT = 1000;

		map.repeat.set(
			(width / REFERENCE_UNIT) * s,
			(height / REFERENCE_UNIT) * s
		);
	} else {
		// "Stretch" mapping: constant repeat
		map.repeat.set(s, s);
	}

	// Apply same transform to other maps if they exist
	if (material.normalMap) material.normalMap.repeat.copy(map.repeat);
	if (material.roughnessMap) material.roughnessMap.repeat.copy(map.repeat);
	if (material.metalnessMap) material.metalnessMap.repeat.copy(map.repeat);
}


// --- Lifecycle Methods ---

async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	if (!rebuildCustom)
		return;

	// 1. Prepare asset list
	const mapKeys = [
		{ key: 'map', url: src.value },
		{ key: 'normalMap', url: normalSrc.value },
		{ key: 'roughnessMap', url: roughSrc.value },
		{ key: 'metalnessMap', url: metalSrc.value }
	].filter(item => item.url);

	const urls = mapKeys.map(i => i.url);
	const assets = await threeManager.assetsReady(urls);

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

	// 7. Initial Transform & UVs
	if (el.value?.$el) {
		const rect = el.value.$el.getBoundingClientRect();

		applyPerspectiveTransform(
			rect,
			customRoot.group,
			threeManager.camera,
			threeManager.config.cameraZ,
			depth.value
		);

		updateUVs(rect.width, rect.height);
	}

	// 8. Add to Scene
	customRoot.empties.center.add(mesh);

	threeManager.requestRender();
}


function update(defaultUpdate, customRoot, threeManager) {

	if (!mesh || !el.value)
		return;

	// Check for dynamic config from ThreeManager (via setBackground)
	let currentDepth = depth.value;
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

	// 1. Get current dimensions
	const rect = el.value.$el.getBoundingClientRect();

	// 2. Apply Transform (Size + Parallax Position)
	applyPerspectiveTransform(
		rect,
		customRoot.group,
		threeManager.camera,
		threeManager.config.cameraZ,
		currentDepth
	);

	// 3. Update UVs
	updateUVs(rect.width, rect.height, currentScale);

	// 4. Update Shadow setting
	if (mesh.receiveShadow !== currentShadows) {
		mesh.receiveShadow = currentShadows;
	}
}


function destroy(customRoot, threeManager) {

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

	threeManager.requestRender();
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
		:name="name"
	>
		<slot />
	</ContainerCustom3D>

</template>
<style lang="scss" scoped>

.bg-cover-container {
	position: relative;
}

</style>
