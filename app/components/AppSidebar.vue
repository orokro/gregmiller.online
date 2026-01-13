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
import { useHamburger } from '../composables/useHamburger';

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
const { toggle, isOpen, close } = useHamburger();

// refs
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

const drawerClass = computed(() => ({
	'is-open': isOpen.value
}));

</script>
<template>

	<!-- Overlay (mobile only) -->
	<div class="overlay" :class="drawerClass" @click="close"></div>

	<!-- Sidebar / Drawer -->
	<aside class="app-sidebar" :class="drawerClass">

		<div class="sidebar-top">
			<NuxtLink to="/" class="brand" @click="close">Greg Miller Online</NuxtLink>

			<!-- for theming we'll mix-blend this image over the theme color -->
			<div class="bg-blend-pattern"></div>

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

</template>
<style lang="scss" scoped>

:root {
	--sidebar-w: 280px;
	--shell-bp: 900px;
}

/* OVERLAY (mobile/narrow only) */
.overlay {

	// fill the screen, above the canvas but below the sidebar
	position: fixed;
	inset: 0;
	z-index: 44;

	// box styling
	background: rgba(0, 0, 0, 0.3);
	backdrop-filter: blur(4px);
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
	background: var(--color-primary);
	border-right: 4px solid var(--color-primary);
	border-left: 4px solid var(--color-primary);
	border-bottom: 4px solid var(--color-primary);

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
		background: var(--color-primary);

		box-sizing: border-box;

		// layout
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		// text styling for all children
		text-align: center;

		// pattern to mix-blend over the theme color for a subtle textured effect
		.bg-blend-pattern {

			position: absolute;
			inset: 0;
			z-index: -1; /* behind content */
			background-image: url('/img/header_bg_gray.png');
			mix-blend-mode: overlay

		}// .bg-blend-pattern

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
			padding: 0.5rem 0.75rem 0.4rem;

			// border: 4px solid white;
			border: 1px solid var(--color-primary);
			border-radius: 100px;
			box-sizing: border-box;
			background: var(--color-bg-accent-2);
			box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

			// text styling
			font-size: 1rem;
			color: var(--color-secondary);

			// placeholder styling
			&::placeholder {
				color: var(--color-secondary);
				opacity: 0.8;
				font-style: italic;
			}

		}// .search

	}// .sidebar-top

	//  list of links
	.sidebar-links {

		// box styling
		flex: 1;
		min-height: 0;
		background: var(--color-bg-accent-2);
		border-radius: 10px;

		// allow scrolling if content exceeds viewport height
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;

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
		scrollbar-color: var(--color-secondary) transparent;

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
			background-color: var(--color-secondary);
			border-radius: 999px;
			border: 2px solid transparent;    /* creates the gap */
			background-clip: padding-box;
		}

		&::-webkit-scrollbar-thumb:hover {
			background-color: var(--color-secondary);
		}

		/* Explicitly hide buttons anyway */
		&::-webkit-scrollbar-button {
			display: none;
			width: 0;
			height: 0;
		}

	}// .sidebar-links

}// .app-sidebar

</style>
