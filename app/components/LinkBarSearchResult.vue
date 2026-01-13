<!--
	LinkBarSearchResult.vue
	-----------------------

	A row in the side column for a search result
	(Styled to match LinkBarRow.vue)
-->
<script setup>

import { computed } from 'vue';

// Props
const props = defineProps({

	// the full search result post object
	result: {
		type: Object,
		default: null,
	},
});

// Emits
const emits = defineEmits(['close']);

function close() {
	emits('close');
}

// build the same post link format used elsewhere: /YYYY/MM/slug :contentReference[oaicite:0]{index=0}
const url = computed(() => {

	if (!props.result)
		return '/';

	const d = new Date(props.result.date);
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, '0');

	return `/${year}/${month}/${props.result.slug}`;
});

const featuredImage = computed(() => props.result?.featuredImage || null);

function stripHtml(html) {
	return String(html || '')
		.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;/gi, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

const excerpt = computed(() => {
	if (!props.result?.content)
		return '';
	return stripHtml(props.result.content);
});

</script>
<template>

	<NuxtLink :to="url" @click="close">

		<div class="link-row">

			<!-- animated bg pattern -->
			<div class="bg-pattern"></div>

			<!-- featured image thumbnail -->
			<div class="thumb">
				<img
					v-if="featuredImage"
					:src="featuredImage"
					:alt="result?.title || 'Search Result'"
					loading="lazy"
				/>
			</div>

			<!-- the actual text for the link -->
			<div class="text">

				<!-- bold title row -->
				<div class="title">
					{{ result?.title }}
				</div>

				<!-- truncated excerpt row -->
				<div class="excerpt">
					{{ excerpt }}
				</div>

			</div>

		</div>

	</NuxtLink>

</template>
<style lang="scss" scoped>

	// main outer wrapper for the link row
	.link-row {

		// box settings
		background: var(--color-bg-accent-1);
		position: relative;
		height: 62px;

		// spacing
		margin-bottom: 2px;

		// animate background color
		transition: background 0.3s ease;

		// background pattern than fades in/out & animates a bit
		.bg-pattern {

			// fill our parent container
			position: absolute;
			inset: 0px 0px 0px 0px;

			// bg pattern mixed
			background-image: url('/img/link_bg_gray.png');
			mix-blend-mode: overlay;

			// animate opacity & position for a subtle moving effect
			transition: opacity 0.3s ease, background-position-x 0.3s ease;
			opacity: 0;
			background-position-x: 0px;

		}// .bg-pattern

		// featured image thumbnail (same positioning as icon)
		.thumb {

			// positioned absolutely to the left of the row, with some padding
			position: absolute;
			left: 0.75rem;
			top: 50%;
			transform: translateY(-50%);

			// box settings (slightly larger than icons)
			width: 46px;
			height: 46px;
			margin-right: 10px;
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			border-radius: 6px;

			img {
				width: 100%;
				height: 100%;
				object-fit: cover;
				display: block;
			}

		}// .thumb

		// the text for the link
		.text {

			// right of the thumbnail, with some padding
			position: absolute;
			inset: 0px 0px 0px 70px;

			// spacing
			padding-top: 8px;
			padding-right: 10px;

			// animate color on hover
			transition: color 0.3s ease;

			.title {

				position: relative;
				top: -5px;

				// font settings (same vibe as LinkBarRow)
				font-size: 22px;
				font-weight: bold;
				color: var(--color-primary);
				letter-spacing: 1px;

				// truncate
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;

				// animate color on hover
				transition: color 0.3s ease;

			}// .title

			.excerpt {

				position: relative;
				top: -10px;
				height: 30px;

				// secondary line
				margin-top: 2px;
				font-size: 14px;
				// font-weight: bold;
				color: var(--color-secondary);
				opacity: 0.9;
				line-height: 15px;
				font-family: sans-serif;
				// truncate
				overflow: hidden;
				text-overflow: ellipsis;

				// animate on hover
				transition: color 0.3s ease;

			}// .excerpt

		}// .text

		// hover effect to show the bg pattern and change text color
		&:hover {

			background: var(--color-secondary);

			.bg-pattern {
				opacity: 0.9;
				background-position-x: 140px;
			}

			.text {

				.title {
					color: var(--color-hover);
					font-weight: bolder;
				}

				.excerpt {
					color: var(--color-hover);
					opacity: 1;
				}

			}// .text

		}// &:hover

	}// .link-row

</style>
