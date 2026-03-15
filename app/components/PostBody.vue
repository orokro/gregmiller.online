<script setup>

import { computed } from 'vue';

const props = defineProps({

	post: {
		type: Object,
		required: true,
	},
});

function hasPostData(p) {
	return !!(p && p.postData && typeof p.postData === 'object' && p.postData.type === 'doc' && Array.isArray(p.postData.content));
}

const processedLegacyHtml = computed(() => {

	if (!props.post || !props.post.content) return '';

	let content = String(props.post.content);

	// Normalize line endings
	content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

	// Convert double newlines to paragraph breaks
	content = content.replace(/\n\n+/g, '</p><p>');

	// Convert remaining single newlines to <br>
	content = content.replace(/\n/g, '<br />');

	// Wrap if needed
	if (!content.trim().startsWith('<p>')) {
		content = '<p>' + content + '</p>';
	}

	return content;
});

const htmlToRender = computed(() => {

	// New world: postData is source-of-truth, and server has rendered HTML into content already.
	if (hasPostData(props.post)) {
		return String(props.post.content || '');
	}

	// Legacy: keep current behavior
	return processedLegacyHtml.value;
});


/**
 * Handle clicks inside the post body.
 * If an image is clicked, open it in a new tab.
 */
function handleBodyClick(event) {

	const target = event.target;

	// If it's an image, and not already wrapped in a link
	if (target.tagName === 'IMG') {

		// Check if it's already inside an <a> tag
		if (target.closest('a')) {
			return;
		}

		// Open in new tab
		window.open(target.src, '_blank');
	}
}

</script>

<template>
	<div
		class="post-body"
		v-html="htmlToRender"
		@click="handleBodyClick"
	></div>
</template>

<style lang="scss" scoped>

	.post-body {

		background: transparent;
		line-height: 1.6;
		font-family: "Quicksand", sans-serif;
		font-size: 1.1rem;

		// Media elements (images, videos, etc.)
		:deep(img),
		:deep(video),
		:deep(iframe) {

			// Centered
			display: block;
			margin: 2rem auto;

			// Jump below the floating thumbnail if it exists
			clear: right;

			// Sizing: 80% on desktop, 100% on mobile
			width: 80%;
			max-width: 100%;

			@media (max-width: 650px) {
				width: 100%;
			}

			// Maintain aspect ratio
			height: auto;
		}

		// YouTube embeds and other iframes
		:deep(iframe) {
			aspect-ratio: 16 / 9;
		}

		// Image specific styles
		:deep(img) {

			// click pointer
			cursor: pointer;

			// styles
			border: 3px solid white;
			border-radius: 10px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

			// animation
			transition: transform 0.3s;
			&:hover {
				transform: scale(1.02);
			}

			// override for center alignments that might be in legacy html
			&[align="center"] {
				float: none !important;
				display: block !important;
				margin: 2rem auto !important;
			}
		}

		// Blockquotes
		:deep(blockquote){
			margin: 1rem 0;
			padding: 0.75rem 1rem;
			border-left: 4px solid rgba(0,0,0,0.15);
			background: rgba(0,0,0,0.03);
			font-style: italic;
		}

		// Handle legacy centering divs from wordpress
		:deep(div[style*="text-align: center"]),
		:deep(center) {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
		}

	}// .post-body

</style>
