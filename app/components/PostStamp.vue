<!--
	PostStamp.vue
	-------------

	Smaller card component used for post listings, category/tag pages, and "See All" links.
-->
<script setup>

// vue
import { computed } from 'vue';

// define props
const props = defineProps({

	// The post data (optional if creating a special link)
	post: {
		type: Object,
		default: null,
	},

	// If set, this overrides the post logic and creates a text-only card
	// used for "See All...", etc.
	specialLabel: {
		type: String,
		default: '',
	},

	// Where to link. If not provided, it generates from post.slug
	to: {
		type: String,
		default: '',
	},

	basePath: {
		type: String,
		default: '/posts/',
	}
});


// Calculate the destination URL
const linkTarget = computed(() => {
	if (props.to) return props.to;
	if (props.post?.slug) return `${props.basePath}${props.post.slug}`;
	return '#';
});


// Resolve the image URL safely
const thumbUrl = computed(() => props.post?.featuredImage || '');


// Format Title
const displayTitle = computed(() => {
	if (props.specialLabel) return props.specialLabel;
	return props.post?.title || 'Untitled';
});

</script>
<template>

	<NuxtLink :to="linkTarget" class="postStamp" :class="{ 'is-special': !!specialLabel }">

		<div class="stamp-thumb">

			<img
				v-if="!specialLabel && thumbUrl"
				:src="thumbUrl"
				:alt="displayTitle"
				loading="lazy"
				decoding="async"
			/>

			<div v-else-if="!specialLabel" class="placeholder">
				<span>NO IMG</span>
			</div>

			<div v-else class="special-card">
				<span class="arrow">→</span>
			</div>

		</div>

		<div class="stamp-title">
			{{ displayTitle }}
		</div>

	</NuxtLink>

</template>
<style lang="scss" scoped>

.postStamp {

	display: flex;
	flex-direction: column;
	width: 150px; /* Fixed width to match your previous thumb size */
	gap: 10px;
	text-decoration: none;
	color: inherit;

	/* Subtle hover effect (no zoom) */
	transition: opacity 0.2s;
	&:hover {
		opacity: 0.8;
	}

	&.is-special {
		/* Optional styles for the 'See All' wrapper */
	}

	.stamp-thumb {

		// box styles
		width: 150px;
		height: 150px;
		border-radius: 4px;
		background: rgba(0, 0, 0, 0.05);
		overflow: hidden;
		border: 3px solid white;
		box-shadow: 0 2px 5px rgba(0,0,0,0.05);

		// Image styles
		img {
			width: 100%;
			height: 100%;
			object-fit: cover;
			display: block;

		}// img

		.placeholder {

			// box styles
			width: 100%;
			height: 100%;

			// layout
			display: grid;
			place-items: center;

			//
			color: #999;
			font-size: 11px;
			font-weight: bold;
			letter-spacing: 1px;

		}// .placeholder

		.special-card {

			// box styles
			width: 100%;
			height: 100%;
			background: rgba(var(--color-secondary-rgb, 0, 0, 0), 0.05); /* Fallback or use your variable */

			// layout
			display: grid;
			place-items: center;

			.arrow {

				font-size: 40px;
				color: var(--color-secondary);
				font-family: "Alumni Sans Pinstripe", sans-serif;
				line-height: 1;
			}// .arrow

		}// .special-card

	}// .stamp-thumb

	.stamp-title {

		// bpx styles
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;

		// text styles
		font-family: "Alumni Sans Pinstripe", sans-serif;
		font-weight: 700;
		font-size: 22px;
		line-height: 1.1;
		color: var(--color-secondary);
		text-overflow: ellipsis;

	}// .stamp-title

}// .postStamp

</style>
