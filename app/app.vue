<!--
	app.vue
	-------

	The root component of the app. It sets up the main layout and initializes the 3D system.
-->
<template>

	<div class="app-root">

		<canvas ref="canvasRef" class="webgl-canvas"></canvas>

		<div class="content-layer">
			<AppHeader />
			<NuxtPage />
		</div>

	</div>

</template>
<script setup>

// imports
import { onMounted, ref } from 'vue';
import { useThree } from '~/composables/useThree';

const canvasRef = ref(null);
const { initThree } = useThree();

onMounted(() => {

	// Initialize the 3D System
	if (canvasRef.value) {
		initThree(canvasRef.value);
	}

});

</script>
<style scoped>

/* Global Reset for Box Sizing */
*, *::before, *::after {
	box-sizing: border-box;
}

body {
	margin: 0;
	padding: 0;
	overflow-x: hidden; /* Prevent horizontal scroll from 3D canvas if any */
}

.app-root {
	position: relative;
	width: 100%;
	min-height: 100vh;
}

.webgl-canvas {
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: -1;
	pointer-events: none;
}

.content-layer {
	position: relative;
	z-index: 1;
}

</style>
