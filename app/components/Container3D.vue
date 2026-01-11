<!--
	Contained3D.vue
	---------------

	This will be used as a wrapper for any page sections that want to use 3D content.
	It handles the registration and cleanup of ThreeManager resources, and also provides a fallback UI if WebGL isn't available.
-->
<script setup>

// Imports
import { ref, onMounted, onUnmounted } from 'vue';
import { useThree } from '~/composables/useThree';

// State
const el = ref(null);
const isFallback = ref(false);
const registeredId = ref(null);

// Composable
const { getThree } = useThree();

// We store the raw manager instance here for cleanup later
let threeManagerInstance = null;

onMounted(async () => {

	// 1. Immediate Fail check
	if (!window.WebGLRenderingContext) {
		isFallback.value = true;
		return;
	}

	// 2. Wait for ThreeManager to boot
	// This will pause execution until App.vue calls initThree()
	const mgr = await getThree();
	threeManagerInstance = mgr; // Save for unmount

	// 3. Register
	if (mgr.isOk && el.value) {

		const result = mgr.register(el.value, 'box');

		if (result) {
			registeredId.value = result.id;
		}

	} else {
		// Manager loaded but reported error (e.g. WebGL disabled)
		isFallback.value = true;
	}

});

onUnmounted(() => {

	// Clean up 3D resources
	if (registeredId.value && threeManagerInstance) {
		threeManagerInstance.unregister(registeredId.value);
	}

});

</script>
<template>

	<div ref="el" class="container-3d" :class="{ 'no-3d': isFallback }">
		<slot />
	</div>

</template>
<style scoped>

.container-3d {
	position: relative;
}

.container-3d.no-3d {
	background: #f0f0f0;
	border: 1px solid #ddd;
}

</style>
