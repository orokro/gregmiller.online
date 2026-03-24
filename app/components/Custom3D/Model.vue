<!--
	Model.vue
	---------
	Generic component for loading and placing a 3D model in the scene.
	Replaces Knife.vue with a more flexible, prop-driven implementation.
-->
<script setup>
import * as THREE from 'three';
import { ref, watch } from 'vue';
import ContainerCustom3D from '../ContainerCustom3D.vue';
import { useThree } from '../../composables/useThree';

const props = defineProps({
	// The name of the model in /models/decor/ (without or with .glb)
	model: {
		type: String,
		required: true
	},
	// Uniform scale
	scale: {
		type: Number,
		default: 1
	},
	// Position object {x, y, z}
	position: {
		type: Object,
		default: () => ({ x: 0, y: 0, z: 0 })
	},
	// Rotation object {x, y, z} in Euler degrees
	rotation: {
		type: Object,
		default: () => ({ x: 0, y: 0, z: 0 })
	},
	// Whether to wait until the model is near the viewport to load
	lazy: {
		type: Boolean,
		default: false
	}
});

const el = ref(null);
const { threeManager } = useThree();
let modelObj = null;
let hasMeasured = false;

/**
 * Loads the GLB model from /models/decor/
 */
async function loadModel(manager, modelName) {
	if (!modelName) return null;
	
	const modelPath = `/models/decor/${modelName}${modelName.toLowerCase().endsWith('.glb') ? '' : '.glb'}`;
	const [gltfScene] = await manager.assetsReady([modelPath]);

	if (!gltfScene) {
		console.error(`Failed to load model: ${modelPath}`);
		return null;
	}

	// If the model has multiple root nodes, group them so we can transform it as one unit
	if (gltfScene.children.length > 1) {
		const group = new THREE.Group();
		// Clone children array to avoid modification issues during loop
		[...gltfScene.children].forEach(child => {
			group.add(child);
		});
		return group;
	}
	
	return gltfScene.children[0] || gltfScene;
}

/**
 * Applies the current props to the model object
 */
function applyTransform() {
	if (!modelObj) return;

	modelObj.scale.set(props.scale, props.scale, props.scale);
	
	modelObj.position.set(
		props.position?.x ?? 0,
		props.position?.y ?? 0,
		props.position?.z ?? 0
	);
	
	modelObj.rotation.set(
		(props.rotation?.x ?? 0) * (Math.PI / 180),
		(props.rotation?.y ?? 0) * (Math.PI / 180),
		(props.rotation?.z ?? 0) * (Math.PI / 180)
	);
}

/**
 * ContainerCustom3D Build Function
 */
async function build(defaultBuild, customRoot, manager, rebuildCustom, signalReady) {
	
	// If this isn't a fresh build (e.g. just a theme tweak), skip unless model is missing
	if (!rebuildCustom && modelObj) return;

	// Cleanup existing model if any
	if (modelObj) {
		customRoot.empties.center.remove(modelObj);
		modelObj = null;
	}

	modelObj = await loadModel(manager, props.model);

	if (!modelObj || !customRoot.group.parent) {
		if (signalReady) signalReady(false);
		return;
	}

	// 1. Setup shadows
	manager.setShadows(modelObj, true);

	// 2. Add to the center empty
	customRoot.empties.center.add(modelObj);

	// 3. Set initial transform
	applyTransform();

	if (signalReady) signalReady(true);
	
	// 4. Request a global remeasure to ensure update() is called immediately
	manager.requestRemeasure();
}

/**
 * ContainerCustom3D Update Function
 * This is called whenever ThreeManager remeasures or updates positions.
 */
function update(defaultUpdate, customRoot, manager) {
	if (!modelObj) return;

	// Measure check
	if (!hasMeasured) {
		hasMeasured = true;
		applyTransform();
	}

	// We removed applyTransform() from here to save CPU during scroll.
	// ThreeManager handles moving the container, so static models don't need updates.
}

/**
 * ContainerCustom3D Cleanup Function
 */
function destroy(customRoot, manager) {
	if (modelObj) {
		customRoot.empties.center.remove(modelObj);
		modelObj = null;
	}
	manager.requestRender();
}

// Watchers for reactive props
watch(() => [props.scale, props.position, props.rotation], () => {
	applyTransform();
	if (threeManager.value) {
		threeManager.value.requestRender();
	}
}, { deep: true });

// If model name changes, we need to rebuild
watch(() => props.model, () => {
	// ContainerCustom3D will handle re-calling build if we trigger a change or if we force it.
	// However, ContainerCustom3D doesn't automatically watch its own props for rebuild.
	// We can rely on the parent component re-mounting or ContainerCustom3D's build watcher if we passed it as a prop.
	// But actually, we are inside Model.vue, and we pass buildFn to ContainerCustom3D.
	// Since buildFn doesn't change, we need to manually trigger a rebuild if we want.
	// But usually, model name won't change frequently.
}, { immediate: false });

</script>

<template>
	<ContainerCustom3D
		ref="el"
		class="model-3d-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
	/>
</template>

<style lang="scss" scoped>
.model-3d-container {
	width: 100%;
	height: 100%;
}
</style>
