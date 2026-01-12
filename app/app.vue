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
<style>

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
	/* FIX: Use fixed positioning but allow JS to override top/left/width/height */
	position: fixed;
	top: 0;
	left: 0;
	z-index: -1;
	pointer-events: none;
	display: block;

	/* Remove 100vw/vh to prevent Layout Viewport clamping on zoom-out */
}

.content-layer {
	position: relative;
	z-index: 1;
}

</style>
