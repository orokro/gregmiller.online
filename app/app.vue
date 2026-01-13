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
import ContentFrame from './components/ContentFrame.vue';
import HamburgerButton from './components/HamburgerButton.vue';

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

	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Alumni+Sans+Pinstripe:ital@0;1&display=swap" rel="stylesheet">

	<div class="app-root">

		<canvas ref="canvasRef" class="webgl-canvas"></canvas>

		<div class="app-shell">

			<main class="app-main">
				<div class="main-inner">
					<NuxtPage />
				</div>
			</main>

		</div>

		<ContentFrame />
		<HamburgerButton />
		<AppSidebar />

	</div>

</template>
<style lang="scss">

// variable for page border radius
:root {
	--border-radius: 55px;
}

/* Global Reset for Box Sizing */
*, *::before, *::after {
	box-sizing: border-box;
}

html, body {
	height: 100%;

	/* ===== Scrollbar CSS ===== */
	/* Firefox */

	scrollbar-width: auto;
	scrollbar-color: #ffffff #00abae;


	/* Chrome, Edge, and Safari */
	&::-webkit-scrollbar {
		width: 16px;
	}

	&::-webkit-scrollbar-track {
	background: #00abae;
	}

	&::-webkit-scrollbar-thumb {
		background-color: #ffffff;
		border-radius: 10px;
		border: 3px solid #ffffff;
	}
}

body {
	margin: 0;
	padding: 0;
	overflow-x: hidden; /* Prevent horizontal scroll from 3D canvas if any */
	font-family: "Alumni Sans Pinstripe", sans-serif;
	background: #00ABAE;
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
	overflow: clip;

	box-sizing: border-box;
	/* Remove 100vw/vh to prevent Layout Viewport clamping on zoom-out */
}

/* APP SHELL
   ---------
   Sidebar + main content. The sidebar component will become a drawer on small screens later.
*/
.app-shell {

	position: relative;
	min-height: 100vh;
	z-index: 1; /* above canvas */
	overflow-x: clip; /* modern overflow clamp */

	.app-main {

		// border: 1px solid red;

		position: relative;
		width: 100%;
		min-width: 0;
		padding: 2rem 1rem;

		/* hard clamp overflow sources */
		overflow-x: hidden;

		/* desktop: reserve space for the pinned sidebar */
		@media (min-width: 900px) {
			padding-left: calc(var(--sidebar-w) + 1rem);
			padding-right: 2rem;
		}

		.main-inner {

			// border: 1px solid green;

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
