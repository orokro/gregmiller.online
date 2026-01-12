<!-- app/components/AppSidebar.vue -->

<!--
	AppSidebar.vue
	--------------

	Temporary minimal sidebar scaffold so the new App Shell compiles.
	Next step: make this a pinned sidebar on desktop + hamburger drawer on mobile.
-->
<script setup>

const { data: categories } = await useFetch('/api/categories');

</script>
<template>

	<aside class="app-sidebar">

		<div class="sidebar-top">
			<NuxtLink to="/" class="brand">Greg Miller Online</NuxtLink>

			<input
				class="search"
				type="search"
				placeholder="Search (coming soon)"
				disabled
			/>
		</div>

		<nav class="sidebar-links">
			<NuxtLink to="/">Home</NuxtLink>
			<NuxtLink to="/resume">Resume</NuxtLink>
			<NuxtLink to="/contact">Contact</NuxtLink>

			<div class="category-block" v-if="categories && categories.length">
				<div class="label">Categories</div>
				<NuxtLink
					v-for="cat in categories"
					:key="cat"
					:to="`/category/${encodeURIComponent(cat)}`"
					class="category-link"
				>
					{{ cat }}
				</NuxtLink>
			</div>
		</nav>

	</aside>

</template>
<style lang="scss" scoped>

.app-sidebar {

	width: 280px;
	min-width: 280px;
	padding: 1rem;
	border-right: 1px solid #eee;
	background: #fff;

	display: flex;
	flex-direction: column;
	min-height: 100vh;
	min-width: 0;

	.sidebar-top {

		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		.brand {
			font-size: 1.25rem;
			font-weight: bold;
			text-decoration: none;
			color: #333;

		}// .brand

		.search {
			width: 100%;
			padding: 0.6rem 0.75rem;
			border: 1px solid #ddd;
			border-radius: 8px;
			font-size: 1rem;

		}// .search

	}// .sidebar-top

	.sidebar-links {

		margin-top: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;

		/* In the final version this will become the scroll region */
		overflow: hidden;

		a {
			text-decoration: none;
			color: #666;
			font-weight: 500;
		}

		a.router-link-active {
			color: #0063dc;
		}

		.category-block {
			margin-top: 1.25rem;
			padding-top: 1rem;
			border-top: 1px solid #eee;

			.label {
				font-size: 0.85rem;
				color: #999;
				margin-bottom: 0.5rem;
				text-transform: uppercase;
				letter-spacing: 0.03em;
			}

			.category-link {
				font-size: 0.95rem;
			}

		}// .category-block

	}// .sidebar-links

}// .app-sidebar

</style>
