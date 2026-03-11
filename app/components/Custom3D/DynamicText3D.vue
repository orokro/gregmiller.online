<script setup>

// vue
import { computed, ref, toRefs } from 'vue';

// components
import ContainerCustom3D from '../ContainerCustom3D.vue';

// three
import * as THREE from 'three';

// composables
import { use3DLettering } from '@/composables/use3DLettering'; // Adjust path as needed
import { useDeviceContext } from '@/composables/useDeviceContext';

// define props
const props = defineProps({

	// The text to display in 3D. Default is "HELLO" for testing, but can be set to anything.
	text: {
		type: String,
		default: 'HELLO',
	},

	// optional scaler
	scale: {
		type: Number,
		default: 1.0,
	},

	// adjustable x-offset
	xOffset: {
		type: Number,
		default: 0.0,
	},

	// height max
	heightMax: {
		type: Number,
		default: -30,
	},

	// height min
	heightMin: {
		type: Number,
		default: -90,
	},

	// fallback image url
	fallbackImage: {
		type: String,
		default: '',
	},

	// fallback scale (background-size)
	fallbackScale: {
		type: String,
		default: 'contain',
	},


});

const { text } = toRefs(props);
const { loadAndMeasureLetters, assembleTextGroup } = use3DLettering();
const { has3DCapability } = useDeviceContext();

// References
const el = ref(null);
let textGroup = null;
let glassMaterial = null;

const fallbackStyle = computed(() => {
	// Show fallback if 3D is disabled OR if it's not ready yet
	const isReady = el.value?.is3DReady || false;
	if (!props.fallbackImage || (has3DCapability.value && isReady)) return {};
	
	let url = props.fallbackImage;
	if (url && !url.startsWith('/') && !url.startsWith('http')) {
		url = '/' + url;
	}

	return {
		backgroundImage: `url("${url}")`,
		backgroundSize: props.fallbackScale,
		backgroundPosition: 'center',
		backgroundRepeat: 'no-repeat',
		transform: 'translateY(30%)', // Adjust as needed to visually align with 3D version
		border: 'none',
		backgroundColor: 'transparent',
	};
});


// --- DRY Helper for Transforms ---
// Applies the scale and position logic based on container width.
// Used in both build (initial) and update (resize).
function applyTransform(object3d, containerWidth) {

	if (!object3d)
		return;

	// Scale logic from original GmillerText.vue
	const baseScale = 200 * props.scale;
	const refWidth = 800;
	const scale = baseScale * (containerWidth / refWidth);

	object3d.scale.set(scale, scale, scale);

	// Position logic
	// Original: model.position.set(0, 30, (1 - scale/200) * -90);
	const zPos = props.heightMax + (1 - scale / baseScale) * (props.heightMin - props.heightMax);
	object3d.position.set(props.xOffset * (containerWidth / refWidth) , -10, zPos);
}


async function build(defaultBuild, customRoot, threeManager, rebuildCustom, setReady) {

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
		side: THREE.DoubleSide,
		depthWrite: true
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

	if (setReady) setReady(true);
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
		:class="{ 'has-fallback': (!has3DCapability || !el?.is3DReady) && fallbackImage }"
		:style="fallbackStyle"
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

		height: 150px;

	}// .dynamic-text-container

</style>
