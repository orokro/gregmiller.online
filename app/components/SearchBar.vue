<!--
	SearchBar.vue
	-------------

	Search bar component in side bar
-->
<script setup>

// app imports
import { useSearch } from '../composables/useSearch';

// components
import Search from './Other_SVGs/Search.vue';

// composables
const { searchQuery, searchActive } = useSearch();

</script>
<template>

	<div
		class="search-wrapper"
		:class="{
			'search-active': searchActive
		}"
	>

		<input
			v-model="searchQuery"
			class="search"
			type="search"
			placeholder="Search"
		/>

		<Search class="search-icon" />

	</div>

</template>
<style lang="scss" scoped>

	// main wrapper
	.search-wrapper {

		// for absolute positioning of the bg pattern
		position: relative;

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

		// fixed over search
		.search-icon {

			// don't interfere with clicks on the input
			pointer-events: none;

			// fixed on right
			position: absolute;
			right: 5px;
			top: 1px;

			// adjust size to box
			width: 30px;
			height: 30px;

			// fade in & out
			opacity: 1;
			transition: opacity 0.1s ease;

			// ret heme
			&:deep {
				svg, path, circle, rect, polygon {
					fill: var(--color-secondary);
				}
			}

		}// .search-icon

		// when search is active, hide the icon
		&.search-active {

			.search-icon {
				opacity: 0;
			}

		}// &.search-active

	}// .search-wrapper

</style>
