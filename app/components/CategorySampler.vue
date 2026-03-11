<!--
	CategorySampler.vue
	-------------------

	Shows a few posts from a category, with a link to see the full archive.
-->
<script setup>

// vue
import { computed } from 'vue';

// components
const props = defineProps({

	// The name of the category (e.g. "Urban Ex")
	category: {
		type: String,
		required: true,
	},

	// Path to the category archive page (e.g. "/category/urban-ex"). If not provided, it will be generated from the category name.
	categoryLink: {
		type: String,
		default: '',
	},

	// The array of post objects from your API
	posts: {
		type: Array,
		default: () => [],
	},

	// Base path for category archives
	categoryBase: {
		type: String,
		default: '/category/',
	},

	// Optional: disable the see all link if the category is empty
	disableSeeAll: {
		type: Boolean,
		default: false,
	},
});


// Convert "Urban Ex" -> "urban-ex" for the link
const categorySlug = computed(() => {
	return props.category
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
});

const seeAllLink = computed(() => {
	if (props.categoryLink)
		return props.categoryLink;
	return `${props.categoryBase}${categorySlug.value}`;
});

</script>
<template>

	<section class="category-sampler">

		<h3 v-if="false" class="category-title">
			{{ category }}
		</h3>

		<div class="grid">

			<PostStamp
				v-for="post in posts"
				:key="post.slug"
				:post="post"
			/>

			<PostStamp
				v-if="!disableSeeAll"
				special-label="See All..."
				:to="seeAllLink"
			/>

		</div>

	</section>

</template>
<style lang="scss" scoped>

	.category-sampler {
		// margin-bottom: 40px;

		.grid {
			display: flex;
			flex-wrap: wrap;
			gap: 20px;

			/* If you want a strict grid instead of flex-wrap, use this:
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
			*/

		}// .grid

		.category-title {
			font-family: "Alumni Sans Pinstripe", sans-serif;
			font-size: 32px;
			font-weight: 400;
			text-shadow: 0.5px 0 0 currentColor, -0.5px 0 0 currentColor;
			margin-bottom: 15px;
			color: var(--color-text, #333);
			border-bottom: 1px solid rgba(0,0,0,0.1);
			padding-bottom: 5px;

		}// .category-title

	}// .category-sampler

</style>
