<!--
	AppSidebar.vue
	--------------

	Fixed sidebar:
	- Desktop (>= 900px): pinned and always visible
	- Mobile (< 900px): hamburger opens drawer from left
	- When open on mobile: effectively full-screen width
	- Top section (brand + search) is sticky
	- Link list scrolls independently (overflow-y: auto)
-->
<script setup>

// imports
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

// components
import  LinkBarRow from './LinkBarRow.vue';
import Ico3D from './Link_Icons/Ico3D.vue';
import IcoArt from './Link_Icons/IcoArt.vue';
import IcoCode from './Link_Icons/IcoCode.vue';
import IcoContact from './Link_Icons/IcoContact.vue';
import IcoGraffiti from './Link_Icons/IcoGraffiti.vue';
import IcoHome from './Link_Icons/IcoHome.vue';
import IcoMusic from './Link_Icons/IcoMusic.vue';
import IcoMusicArticles from './Link_Icons/IcoMusicArticles.vue';
import IcoMusicians from './Link_Icons/IcoMusicians.vue';
import IcoOther from './Link_Icons/IcoOther.vue';
import IcoOtherStuffs from './Link_Icons/IcoOtherStuffs.vue';
import IcoResume from './Link_Icons/IcoResume.vue';
import IcoTech from './Link_Icons/IcoTech.vue';
import IcoUrbEx from './Link_Icons/IcoUrbEx.vue';
import IcoUrbExArticles from './Link_Icons/IcoUrbExArticles.vue';

// composables
const { data: categories } = await useFetch('/api/categories');

// refs
const isOpen = ref(false);
const route = useRoute();

// close drawer on navigation (mobile UX)
watch(() => route.fullPath, () => {
	isOpen.value = false;
});

// lock body scroll while drawer is open (mobile)
watch(isOpen, (open) => {
	if (process.client) {
		document.body.style.overflow = open ? 'hidden' : '';
	}
});

const toggle = () => {
	isOpen.value = !isOpen.value;
};

const close = () => {
	isOpen.value = false;
};

const drawerClass = computed(() => ({
	'is-open': isOpen.value
}));

</script>
<template>

	<!-- Mobile hamburger (hidden on desktop via CSS) -->
	<button class="hamburger" type="button" @click="toggle" aria-label="Open menu">
		<span class="bar"></span>
		<span class="bar"></span>
		<span class="bar"></span>
	</button>

	<!-- Overlay (mobile only) -->
	<div class="overlay" :class="drawerClass" @click="close"></div>

	<!-- Sidebar / Drawer -->
	<aside class="app-sidebar" :class="drawerClass">

		<div class="sidebar-top">
			<NuxtLink to="/" class="brand" @click="close">Greg Miller Online</NuxtLink>

			<input
				class="search"
				type="search"
				placeholder="Search (coming soon)"
			/>
		</div>

		<nav class="sidebar-links">

			<!-- top default links -->
			<LinkBarRow title="Home" @close="close" url="/" :icon="IcoHome" />
			<LinkBarRow title="Resume" @close="close" url="/resume" :icon="IcoResume" />
			<LinkBarRow title="Contact" @close="close" url="/contact" :icon="IcoContact" />

			<!-- stuff I make category -->
			<div class="category-row">Stuff I Make</div>
			<LinkBarRow title="3D" @close="close" url="category/3D-modeling" :icon="Ico3D" />
			<LinkBarRow title="Art" @close="close" url="category/art" :icon="IcoArt" />
			<LinkBarRow title="Code" @close="close" url="category/code-projects" :icon="IcoCode" />
			<LinkBarRow title="Other Cool Junk" @close="close" url="category/other-projects" :icon="IcoOtherStuffs" />

			<!-- I explore category -->
			<div class="category-row">I Explore</div>
			<LinkBarRow title="Urban Exploration" @close="close" url="/urban-ex" :icon="IcoUrbEx" />
			<LinkBarRow title="Graffiti" @close="close" url="/graffiti-yards" :icon="IcoGraffiti" />
			<LinkBarRow title="UrbEx Articles" @close="close" url="/urbex-articles" :icon="IcoUrbExArticles" />

			<!-- music category -->
			<div class="category-row">Music</div>
			<LinkBarRow title="Musicians" @close="close" url="/musicians" :icon="IcoMusicians" />
			<LinkBarRow title="My beats" @close="close" url="/music" :icon="IcoMusic" />
			<LinkBarRow title="Music Articles" @close="close" url="/music-articles" :icon="IcoMusicArticles" />

			<!-- other category -->
			<div class="category-row">Other</div>
			<LinkBarRow title="Tech Reviews" @close="close" url="/technology-reviews" :icon="IcoTech" />
			<LinkBarRow title="Other Articles" @close="close" url="/other-articles" :icon="IcoOther" />

		</nav>

	</aside>

	<div class="main-frame">
		<div class="tl"></div>
		<div class="bl"></div>
	</div>

</template>
<style lang="scss" scoped>
:root {
	--sidebar-w: 280px;
	--shell-bp: 900px;
}

/* HAMBURGER
   ---------
   Visible only on mobile.
*/
.hamburger {

	// fixed on bottom right, so it has easy access to the thumb on mobile devices
	position: fixed;
	bottom: 0.75rem;
	right: 0.75rem;
	z-index: 50;

	// box styling
	width: 44px;
	height: 44px;
	padding: 0;
	border: 4px solid #00ABAE;
	border-radius: 10px;
	background: rgba(255, 255, 255, 0.92);
	backdrop-filter: blur(10px);
	-webkit-backdrop-filter: blur(10px);

	// layout for the bars
	display: flex;
	flex-direction: column;
	justify-content: center;
	align-items: center;
	gap: 5px;

	// the bars themselves
	.bar {
		display: block;
		width: 18px;
		height: 3px;
		background: #00ABAE;
	}// .bar

	@media (min-width: 900px) {
		display: none;
	}

}// ..hamburger

/* OVERLAY (mobile/narrow only) */
.overlay {

	// fill the screen, above the canvas but below the sidebar
	position: fixed;
	inset: 0;
	z-index: 45;

	// box styling
	background: rgba(0, 0, 0, 0.3);
	opacity: 0;

	// turn off pointer events and opacity when closed
	pointer-events: none;
	transition: opacity 180ms ease;

	// open state
	&.is-open {
		opacity: 1;
		pointer-events: auto;
	}

	@media (min-width: 900px) {
		display: none;
	}
}// .overlay


/* SIDEBAR
   -------
   Always fixed, never affects layout width.
*/
.app-sidebar {

	// fixed on the left, above the canvas and overlay
	position: fixed;
	top: 0;
	left: 0;
	bottom: 0;
	z-index: 46;

	// box styling
	width: var(--sidebar-w);
	max-width: 92vw; /* mobile: near full screen */
	background: #00ABAE;
	border-right: 4px solid #00ABAE;
	border-left: 4px solid #00ABAE;
	border-bottom: 4px solid #00ABAE;

	// layout
	display: flex;
	flex-direction: column;
	min-width: 0;

	// for mobile / narrow, we animate the sidebar in from the left as a drawer,
	// using transform for GPU-accelerated animation
	transform: translate3d(-100%, 0, 0);
	transition: transform 220ms ease;

	// open state
	&.is-open {
		transform: translate3d(0, 0, 0);
	}

	// Desktop pinned behavior
	@media (min-width: 900px) {
		transform: none;
		width: var(--sidebar-w);
		max-width: var(--sidebar-w);
	}

	// top section of the side bar
	.sidebar-top {

		// sticky on top of the sidebar, so it remains visible while scrolling links
		position: sticky;
		top: 0;
		z-index: 1;

		// box styling
		padding: 1rem;
		background: #00ABAE;
		background-image: url('/img/header_bg.png');
		box-sizing: border-box;

		// layout
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		// text styling for all children
		text-align: center;

		// logo/brand link
		.brand {

			// text styling
			font-size: 2.7rem;
			font-weight: bold;
			text-decoration: none;
			color: #FFFFFF;

		}// .brand

		// search bar
		.search {

			// box styling
			width: 100%;
			padding: 0.4rem 0.75rem;

			// border: 4px solid white;
			border: 1px solid #00ABAE;
			border-radius: 100px;
			box-sizing: border-box;
			background: #EFF4F7;
			box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

			// text styling
			font-size: 1rem;

		}// .search

	}// .sidebar-top

	//  list of links
	.sidebar-links {

		// box styling
		flex: 1;
		min-height: 0;
		background: #EFF4F7;
		border-radius: 10px;

		// allow scrolling if content exceeds viewport height
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;

		// links
		a {
			display: block; /* fixes “categories run together” */
			text-decoration: none;
			color: #666;
			font-weight: 500;

			background: #E1EEF5;
		}

		a.router-link-active {
			color: #0063dc;
		}

		// category row
		.category-row {

			// box styling
			padding: 0.2rem 1rem;
			// border-bottom: 1px solid #DDD;

			// text styling
			font-size: 1.2rem;
			font-weight: bold;
			color: #333;
			text-transform: uppercase;
			text-align: center;

		}// .category-row

		/* iOS-like minimal scrollbar */
		overflow-y: auto;
		scrollbar-width: thin;              /* Firefox */
		scrollbar-color: #7561AA transparent;

		/* WebKit */
		&::-webkit-scrollbar {
			width: 6px;
			margin-top: 4px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
			margin-top: 4px;
		}

		&::-webkit-scrollbar-thumb {
			background-color: #7561AA;
			border-radius: 999px;
			border: 2px solid transparent;    /* creates the gap */
			background-clip: padding-box;
		}

		&::-webkit-scrollbar-thumb:hover {
			background-color: #584885;
		}

		/* Explicitly hide buttons anyway */
		&::-webkit-scrollbar-button {
			display: none;
			width: 0;
			height: 0;
		}

	}// .sidebar-links

}// .app-sidebar


// frame to frame the content area
.main-frame {

	// don't interfere with pointer events on the content, but still be above the canvas
	pointer-events: none;

	// fill viewport
	position: fixed;
	inset: -1px -1px -1px -1px;
	z-index: 9001;

	// nice rounded corners and border
	border-radius: 55px;
	border: 5px solid #00ABAE;

	transition: left 220ms ease;
	@media (min-width: 900px) {
		left: 257px;
	}

	// the corner decorations, which are just background images in divs
	// to fill the teal
	.tl, .bl {
		position: absolute;
		left: -4px;
		width: 54px;
		height: 54px;
	}

	.tl {
		top: -4px;
		background-image: url(data:image/png;base64,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);
	}

	.bl {
		bottom: -4px;

		background-image: url(data:image/png;base64,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);
	}
}// .main-frame
</style>
