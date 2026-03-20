<!--
	CategorySampler.vue
	-------------------

	Shows a few posts from a category, with a link to see the full archive.
-->
<script setup>

// vue
import { computed } from 'vue';
import { useDeviceContext } from '~/composables/useDeviceContext';

// components
import PostStamp from './PostStamp.vue';
import PostCard from './PostCard.vue';

const { windowWidth } = useDeviceContext();

// Use PostCard on narrow mobile screens (single column mode)
const useCards = computed(() => {
	// If the screen is narrow enough that PostStamps would only fit one column,
	// swap to PostCards for better layout.
	return windowWidth.value < 350;
});
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

		<div class="grid" :class="{ 'as-cards': useCards }">

            <template v-if="useCards">
                <PostCard
                    v-for="post in posts"
                    :key="post.slug"
                    :post="post"
                    :thumb-url="post.featuredImage"
                />
                <PostCard
                    v-if="!disableSeeAll"
                    :post="{ title: 'See All...', slug: '' }"
                    :to="seeAllLink"
                />
            </template>
            <template v-else>
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
            </template>

		</div>

	</section>

</template>
<style lang="scss" scoped>

	.category-sampler {
		// margin-bottom: 40px;

		.grid {
			display: flex;
			flex-wrap: wrap;
			gap: 10px; /* tighter gap for mobile 2-col */
            justify-content: center;

            @media (min-width: 600px) {
                gap: 20px;
                // Center the grid of stamps on desktop too
                justify-content: center;
            }

            &.as-cards {
                display: flex;
                flex-direction: column;
                gap: 1rem;
                justify-content: flex-start;
            }

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
