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

	// The depth position of the background plane. Default is -30 units.
	depth: {
		type: Number,
		default: 30
	},

	// Whether this background should receive shadows. Default is true.
	catchShadows: {
		type: Boolean,
		default: true
	}

});

const { src, depth, catchShadows } = toRefs(props);

// References
const el = ref(null);
let mesh = null;
let material = null;
let texture = null;


// --- Helper: Perspective Correction ---

function applyPerspectiveTransform(rect, group, camera, cameraZ, depthVal) {

	if (!mesh) return;

	// 1. Calculate Perspective Scale Factor (S)
	// S = (CameraZ + Depth) / CameraZ
	// This ensures the plane is scaled up enough to fill the visual angle of the container at distance -Depth.
	const scaleFactor = (cameraZ + depthVal) / cameraZ;

	mesh.scale.set(rect.width * scaleFactor, rect.height * scaleFactor, 1);

	// 2. Calculate Parallax Alignment Offset
	// Since the mesh is deeper (further from camera), it effectively moves "slower" in screen space
	// than the group (which is at Z=0). We must shift the mesh in world space to align its
	// perspective projection with the group's projection.
	// Formula: Offset = (ObjectWorldPos - CameraWorldPos) * (ScaleFactor - 1)

	const offsetX = (group.position.x - camera.position.x) * (scaleFactor - 1);
	const offsetY = (group.position.y - camera.position.y) * (scaleFactor - 1);

	mesh.position.set(offsetX, offsetY, -depthVal);
}


// --- Lifecycle Methods ---

async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	if (!rebuildCustom)
		return;

	// 1. Load the texture
	const assets = await threeManager.assetsReady([src.value]);
	texture = assets[0];

	if (!texture) {
		console.warn(`BGCover: Failed to load texture ${src.value}`);
		return;
	}

	// Configure texture for color space if it's a color map
	texture.colorSpace = THREE.SRGBColorSpace;

	// 2. Create Material
	material = new THREE.MeshStandardMaterial({
		map: texture,
		color: 0xffffff,
		roughness: 1,
		metalness: 0,
		side: THREE.DoubleSide
	});

	// 3. Create Geometry
	const geometry = new THREE.PlaneGeometry(1, 1);

	// 4. Create Mesh
	mesh = new THREE.Mesh(geometry, material);

	// 5. Configure Shadows
	if (catchShadows.value) {
		threeManager.setShadowReceiving(mesh, true);
	}

	// 6. Initial Transform
	if (el.value?.$el) {
		const rect = el.value.$el.getBoundingClientRect();
		applyPerspectiveTransform(
			rect,
			customRoot.group,
			threeManager.camera,
			threeManager.config.cameraZ,
			depth.value
		);
	}

	// 7. Add to Scene
	// We attach to the center empty. The offsets calculated above are local to this empty.
	// (Since the empty is at 0,0,0 relative to the group, the math works out).
	customRoot.empties.center.add(mesh);

	threeManager.requestRender();
}


function update(defaultUpdate, customRoot, threeManager) {

	if (!mesh || !el.value)
		return;

	// 1. Get current dimensions
	const rect = el.value.$el.getBoundingClientRect();

	// 2. Apply Transform (Size + Parallax Position)
	applyPerspectiveTransform(
		rect,
		customRoot.group,
		threeManager.camera,
		threeManager.config.cameraZ,
		depth.value
	);

	// 3. Update Shadow setting
	mesh.receiveShadow = catchShadows.value;
}


function destroy(customRoot, threeManager) {

	const center = customRoot.empties.center;

	if (mesh) {
		center.remove(mesh);
		if (mesh.geometry) mesh.geometry.dispose();
	}

	if (material) material.dispose();
	if (texture) texture.dispose();

	mesh = null;
	material = null;
	texture = null;

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
	>
		<slot />
	</ContainerCustom3D>

</template>
<style lang="scss" scoped>

.bg-cover-container {
	position: relative;
}

</style>
