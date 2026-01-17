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
	// We use Standard material to support receiving shadows
	material = new THREE.MeshStandardMaterial({
		map: texture,
		color: 0xffffff,
		roughness: 1,
		metalness: 0,
		side: THREE.DoubleSide // Ensure it's visible from both sides
	});

	// 3. Create Geometry
	// PlaneGeometry(1, 1) creates a 1x1 unit quad facing Z.
	// We will scale this in the update() loop to match the container dimensions.
	const geometry = new THREE.PlaneGeometry(1, 1);

	// 4. Create Mesh
	mesh = new THREE.Mesh(geometry, material);

	// 5. Configure Shadows
	if (catchShadows.value) {
		threeManager.setShadowReceiving(mesh, true);
	}

	// 6. Initial Transform
	// Apply depth immediately
	mesh.position.z = -depth.value;

	// If we have DOM dimensions ready, apply them now to prevent FOUC
	if (el.value?.$el) {
		const rect = el.value.$el.getBoundingClientRect();

		// Calculate perspective scale so it fills the screen area at this depth
		const cameraZ = threeManager.config.cameraZ;
		const scaleFactor = (cameraZ + depth.value) / cameraZ;

		mesh.scale.set(rect.width * scaleFactor, rect.height * scaleFactor, 1);
	}

	// 7. Add to Scene
	// We attach to the center empty.
	customRoot.empties.center.add(mesh);

	threeManager.requestRender();
}


function update(defaultUpdate, customRoot, threeManager) {

	if (!mesh || !el.value)
		return;

	// 1. Get current dimensions of the DOM element
	const rect = el.value.$el.getBoundingClientRect();

	// 2. Scale the 1x1 plane to match the pixel dimensions
	// We calculate the perspective ratio: (CameraZ + Depth) / CameraZ
	// This ensures the plane looks the exact same size as the container, even when pushed back.
	const cameraZ = threeManager.config.cameraZ;
	const scaleFactor = (cameraZ + depth.value) / cameraZ;

	mesh.scale.set(rect.width * scaleFactor, rect.height * scaleFactor, 1);

	// 3. Update Depth (in case prop changed dynamically)
	mesh.position.z = -depth.value;

	// 4. Update Shadow setting (in case prop changed)
	mesh.receiveShadow = catchShadows.value;
}


function destroy(customRoot, threeManager) {

	const center = customRoot.empties.center;

	if (mesh) {
		center.remove(mesh);

		if (mesh.geometry) mesh.geometry.dispose();
	}

	if (material) material.dispose();

	// Note: We dispose the texture here because ThreeManager returns clones.
	if (texture) texture.dispose();

	mesh = null;
	material = null;
	texture = null;

	threeManager.requestRender();
}


// Watch for src changes to trigger a full rebuild
watch(src, () => {

	if (el.value)
		el.value.rebuild();
});


// Watch for depth changes to trigger a render (handled in update loop)
watch(depth, () => {

	// We don't need a full rebuild for depth, just a render request
	// The update() loop runs on scroll/resize, but we force one here
	if (el.value)
		el.value.threeManager?.requestRender();
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

	// Default styles, usually this component wraps content
	position: relative;
}

</style>
