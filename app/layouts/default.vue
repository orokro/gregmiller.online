<!--
 	app/layouts/default.vue
	-----------

	The root layout component of the application. It sets up the main layout and initializes the 3D system.
-->
<script setup>

// vue
import { onMounted, ref, watch } from 'vue';
import { useHead } from '#app';

// app imports
import { useThree } from '~/composables/useThree';
import { useTheming } from '~/composables/useTheming';
import { useDeviceContext } from '../composables/useDeviceContext';

// components
import UILayer from '../components/UILayer.vue';
import DebugConsole from '../components/DebugConsole.vue';
import CoverBG from '../components/Custom3D/CoverBG.vue';
import ContainerCustom3D from '../components/ContainerCustom3D.vue';

// composables
const { initThree } = useThree();
const { themeCSSVars } = useTheming();
const { has3DCapability, classObject } = useDeviceContext();


// refs
const canvasRef = ref(null);

// update theme CSS variables and device classes in the document head whenever they change
watch([themeCSSVars, classObject], ([vars, classes]) => {
	useHead({
		htmlAttrs: {
			style: vars,
			class: Object.entries(classes)
				.filter(([_, value]) => value)
				.map(([key]) => key)
				.join(' '),
		},
	});
}, { immediate: true });


// Start up the 3D system when the component mounts
onMounted(() => {

	// Initialize the 3D System (even if disabled, to unblock getThree() promises)
	initThree(has3DCapability.value ? canvasRef.value : null);
});



</script>
<template>

	<link rel="preconnect" href="https://fonts.googleapis.com">
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
	<link href="https://fonts.googleapis.com/css2?family=Alumni+Sans+Pinstripe:ital,wght@0,400;1,400&family=Alumni+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css?family=Montserrat&display=swap" rel="stylesheet">
	<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap" rel="stylesheet">

	<div class="app-root">

		<!-- static fallback background for when 3D is disabled -->
		<div v-if="!has3DCapability" class="static-bg-layer"></div>

		<!-- three graphics rendered below everything else -->
		<canvas v-show="has3DCapability" ref="canvasRef" class="webgl-canvas"></canvas>

		<!-- main content area -->
		<div class="app-shell">

			<CoverBG
				class="cover-test"
				src="/textures/bg_graph_paper.jpg"
				:depth="100"
				:catchShadows="true"
				:reproject-uvs="true"
				:uv-scale="1"
				name="app-cover-bg"
			>
				<main class="app-main">
					<div class="main-inner">
						<NuxtPage />
					</div>
				</main>

			</CoverBG>

		</div>

		<!-- main UI layer -->
		<UILayer />

		<!-- Debug console for developer commands and logs -->
		<DebugConsole />

	</div>

</template>
<style lang="scss">

/* variable for page border radius */
:root {
	--border-radius: 55px;
}

/* Global Reset for Box Sizing */
*, *::before, *::after {
	box-sizing: border-box;
}

html, body {
	height: auto;
	min-height: 100%;
	overflow-y: auto;

	/* ===== Scrollbar CSS ===== */
	/* Firefox */

	scrollbar-width: auto;
	scrollbar-color: var(--color-scroll) var(--color-primary);

	/* Chrome, Edge, and Safari */
	&::-webkit-scrollbar {
		width: 16px;
	}

	&::-webkit-scrollbar-track {
	background: var(--color-primary);
	}

	&::-webkit-scrollbar-thumb {
		background-color: var(--color-primary);
		border-radius: 10px;
		border: 3px solid var(--color-primary);
	}
}

body {
	margin: 0;
	padding: 0;
	overflow-x: hidden; /* Prevent horizontal scroll from 3D canvas if any */
	font-family: "Alumni Sans Pinstripe", sans-serif;
	background: var(--color-primary);
	background: #DDD;
}

.app-root {
	position: relative;
	width: 100%;
	min-height: 100vh;

	transition: padding-left 0.3s ease	;
	padding-left: 0px;

	@media (min-width: 900px) {
		padding-left: 260px;
	}
}

.static-bg-layer {
	position: absolute;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	z-index: -2;
	background-color: var(--fallback-bg);
	background-image: var(--fallback-bg-image);
	background-size: 1000px 1000px;
	background-repeat: repeat;
	transition: background 0.5s ease;
	opacity: 0.5;
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

        }/* .main-inner */

    }/* .app-main */

}/* .app-shell */

.app-shell {
    /* min-height: 100vh; */
    overflow: hidden; /* not clip */
}

.app-shell .app-main {
    overflow: visible; /* not hidden on y */
}


/* reusable per-page styling */
.static-page {

    padding: 4rem;
    text-align: center;
    font-family: sans-serif;

    min-height: 100vh;

    h1 {
        padding-top: 15px;
        margin-bottom: 15px;
        font-family: "Alumni Sans Pinstripe", sans-serif;
        font-weight: 400;
        text-shadow: 0.5px 0 0 currentColor, -0.5px 0 0 currentColor;
        letter-spacing: 1px;
        color: var(--content-header-text-color);
        span {
        	display: inline-block;
        	padding: 0em 1em;
        	background: var(--content-header-bg-color);
        	border-radius: 40px;
        	font-weight: 400;
        	white-space: nowrap;

        	/* backdrop blur */
        	backdrop-filter: blur(var(--content-box-bg-blur, 10px));
        }    }

    h3 {
        margin-bottom: 2rem;
        color: var(--content-header-text-color);
    }

    .white-box {
        background: var(--content-box-bg-color);
        border-radius: 3px;
        padding: 1rem;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);

        /* backdrop blur */
        backdrop-filter: blur(var(--content-box-bg-blur, 10px));

        &.text {
            text-align: left !important;
            color: var(--color-text);
            font-size: 16px;
            font-family: "Quicksand", sans-serif;
            font-optical-sizing: auto;
        }
    }/* .white-box */

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(390px, 1fr));
		gap: 1rem 1rem;
		padding-right: 0px;
		justify-content: center;
	}

}/* .static-page */

</style>
