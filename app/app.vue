<!--
 	app/app.vue
	-----------

	The root component of the application. It sets up the main layout and initializes the 3D system.
-->
<script setup>

// imports
import { onMounted, ref } from 'vue';
import { useThree } from '~/composables/useThree';

// components
import AppSidebar from '~/components/AppSidebar.vue';

const canvasRef = ref(null);
const { initThree } = useThree();
onMounted(() => {

	// Initialize the 3D System
	if (canvasRef.value) {
		initThree(canvasRef.value);
	}

});

</script>
<template>

	<div class="app-root">

		<!-- Our 3d enabled components will render to this canvas -->
		<canvas ref="canvasRef" class="webgl-canvas"></canvas>

		<!-- main DOM content -->
		<div class="app-shell">

			<AppSidebar />

			<main class="app-main">
				<div class="main-inner">
					<NuxtPage />
				</div>
			</main>

		</div>

	</div>

</template>
<style lang="scss">

/* Global Reset for Box Sizing */
*, *::before, *::after {
	box-sizing: border-box;
}

html, body {
	height: 100%;
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

/* APP SHELL
   ---------
   Sidebar + main content. The sidebar component will become a drawer on small screens later.
*/
.app-shell {

	position: relative;
	display: flex;
	min-height: 100vh;
	min-width: 0; /* critical for preventing flex overflow */
	z-index: 1; /* above canvas */

	.app-main {

		border: 1px solid red;

		flex: 1;
		min-width: 0; /* critical for preventing flex child overflow */
		padding: 2rem 1rem;

		.main-inner {

			border: 1px solid green;

			width: 100%;
			min-width: 0;
			margin: 0 auto;

			/* Responsive reading column without "mobile breakpoints":
			   - grows with viewport (vw)
			   - caps at a comfortable max on desktop
			   - stays near full width on mobile
			*/
			max-width: clamp(22rem, 92vw, 60rem);

			/* Clamp common overflow culprits */
			img,
			video,
			svg,
			canvas {
				max-width: 100%;
				height: auto;
			}

			pre,
			code {
				max-width: 100%;
			}

			pre {
				overflow-x: auto;
			}

		}// .main-inner

	}// .app-main

}// .app-shell

</style>
