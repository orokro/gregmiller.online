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

	<!-- main wrapper that the user can style from outside classes / style blocks -->
	<div ref="el" class="container-3d" :class="{ 'no-3d': isFallback }">

		<!-- special wrapper to reset stacking context for our corners-->
		<div class="measure-wrapper">

			<!-- we will measure these corners viewport space to get 3d coordinates -->
			<div class="corner top-left"></div>
			<div class="corner top-right"></div>
			<div class="corner bottom-left"></div>
			<div class="corner bottom-right"></div>

			<!-- pass thru whatever this container is supposed to contain -->
			<div class="content">
				<slot />
			</div>
		</div>

	</div>

</template>
<style lang="scss" scoped>

.container-3d {

	position: relative;
	display: block;
	max-width: 100%;
	min-width: 0;
	box-sizing: border-box;

	&.no-3d {
		background: #f0f0f0;
		border: 1px solid #ddd;
	}


	.content {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	/* MEASUREMENT SYSTEM
  	   ------------------
	   Internal markers to get exact corner coordinates, bypassing potential
	   box-sizing/border quirks of the parent container.
	*/
	.measure-wrapper {

		width: 100%;
		position: relative;

		// reset stacking context for corners, so they are always behind content but above the canvas
		position: relative;

		.corner {
			position: absolute;
			width: 1px;
			height: 1px;
			background: transparent; /* Invisible but measurable */
			pointer-events: none;
			opacity: 0;
			z-index: -1;

			&.top-left {
				top: 0;
				left: 0;
			}

			&.top-right {
				top: 0;
				right: -1px; /* Pushes the 1px box outside, so its Left edge is exactly at container Right */
			}

			&.bottom-left {
				bottom: -1px; /* Pushes the 1px box outside, so its Top edge is exactly at container Bottom */
				left: 0;
			}

			&.bottom-right {
				bottom: -1px;
				right: -1px;
			}

		}// .corner

	}// .measure-wrapper

}// .container-3d

</style>
