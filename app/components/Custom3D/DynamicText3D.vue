<script setup>

// vue
import { ref, toRefs } from 'vue';

// components
import ContainerCustom3D from '../ContainerCustom3D.vue';

// three
import * as THREE from 'three';

// composables
import { use3DLettering } from '@/composables/use3DLettering'; // Adjust path as needed

// define props
const props = defineProps({
	text: {
		type: String,
		default: 'HELLO',
	}
});

const { text } = toRefs(props);
const { loadAndMeasureLetters, assembleTextGroup } = use3DLettering();

// References
const el = ref(null);
let textGroup = null;
let glassMaterial = null;


// --- DRY Helper for Transforms ---
// Applies the scale and position logic based on container width.
// Used in both build (initial) and update (resize).
function applyTransform(object3d, containerWidth) {

	if (!object3d)
		return;

	// Scale logic from original GmillerText.vue
	const baseScale = 200;
	const refWidth = 800;
	const scale = baseScale * (containerWidth / refWidth);

	object3d.scale.set(scale, scale, scale);

	// Position logic
	// Original: model.position.set(0, 30, (1 - scale/200) * -90);
	const zPos = (1 - scale / baseScale) * -90;
	object3d.position.set(0, 30, zPos);
}


async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	if (!rebuildCustom)
		return;

	// 1. Create Material (Reused from GmillerText)
	glassMaterial = new THREE.MeshPhysicalMaterial({
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
		side: THREE.DoubleSide
	});

	// 2. Load & Cache Letters
	const letterData = await loadAndMeasureLetters(threeManager, text.value);

	// 3. Assemble Group
	textGroup = assembleTextGroup(text.value, letterData, glassMaterial);

	// 4. Set Initial Rotation (From GmillerText: 90 deg on X)
	textGroup.rotation.x = 90 * (Math.PI / 180);

	// 5. Initial Transform (avoids FOUC or jumping)
	if (el.value?.$el) {

		const rect = el.value.$el.getBoundingClientRect();
		applyTransform(textGroup, rect.width);
	} else {

		// Fallback if DOM isn't ready, use default ref width
		applyTransform(textGroup, 800);
	}

	// 6. Add to Scene
	const center = customRoot.empties.center;
	center.add(textGroup);

	// Register shadows for all children
	textGroup.traverse((child) => {
		if (child.isMesh) {
			threeManager.setShadows(child, true);
		}
	});

	threeManager.requestRender();
}


function update(defaultUpdate, customRoot, threeManager) {

	if (!el.value || !textGroup)
		return;

	const rect = el.value.$el.getBoundingClientRect();
	applyTransform(textGroup, rect.width);
}


function destroy(customRoot, threeManager) {

	const center = customRoot.empties.center;

	if (textGroup) {
		center.remove(textGroup);

		// Cleanup geometry memory if strictly necessary,
		// though we are caching the raw assets in the composable.
		// We mostly need to clear the specific group structure here.
		textGroup.traverse((child) => {
			if (child.isMesh) {
				// Don't dispose geometry if we want to keep the cache valid!
				// Just unparent.
			}
		});
	}

	if (glassMaterial) {
		glassMaterial.dispose();
		glassMaterial = null;
	}

	textGroup = null;
	threeManager.requestRender();
}


function tick(root, LockManager, time) {
	// Optional: Add floating animation or similar here
}

</script>
<template>

	<ContainerCustom3D
		ref="el"
		class="dynamic-text-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
		:tickFn="tick"
	>
		<slot />
	</ContainerCustom3D>

</template>
<style lang="scss" scoped>

	.dynamic-text-container {
		height: 250px;
		// border: 1px solid blue; // Debug

	}// .dynamic-text-container

</style>
