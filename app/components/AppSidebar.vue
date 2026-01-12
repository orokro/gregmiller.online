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

const { data: categories } = await useFetch('/api/categories');

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
				disabled
			/>
		</div>

		<nav class="sidebar-links">
			<NuxtLink to="/" @click="close">Home</NuxtLink>
			<NuxtLink to="/resume" @click="close">Resume</NuxtLink>
			<NuxtLink to="/contact" @click="close">Contact</NuxtLink>

			<div class="category-block" v-if="categories && categories.length">
				<div class="label">Categories</div>

				<NuxtLink
					v-for="cat in categories"
					:key="cat"
					:to="`/category/${encodeURIComponent(cat)}`"
					class="category-link"
					@click="close"
				>
					{{ cat }}
				</NuxtLink>
			</div>
		</nav>

	</aside>

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
	background: rgba(0, 0, 0, 0.35);
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
	transform: translate3d(-105%, 0, 0);
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
		padding: 1rem;
		background: #EFF4F7;
		border-radius: 10px;

		// layout
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

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

		// category blocks
		.category-block {

			margin-top: 1.25rem;
			padding-top: 1rem;
			border-top: 1px solid #eee;

			.label {

				// text styling
				font-size: 0.85rem;
				color: #999;
				margin-bottom: 0.5rem;
				text-transform: uppercase;
				letter-spacing: 0.03em;
			}

			.category-link {

				// text styling
				font-size: 0.95rem;
				padding: 0.15rem 0;

			}// .category-link

		}// .category-block

	}// .sidebar-links

}// .app-sidebar

</style>
