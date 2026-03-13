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

</script>

<template>
	<div class="post-body" v-html="htmlToRender"></div>
</template>

<style lang="scss" scoped>

	.post-body {

		background: transparent;

		:deep(blockquote){
			margin: 1rem 0;
			padding: 0.75rem 1rem;
			border-left: 4px solid rgba(0,0,0,0.15);
			background: rgba(0,0,0,0.03);
		}

		:deep(iframe),
		:deep(video),
		:deep(audio) {
			max-width: 100%;
			display: block;
			margin: 1rem auto;
			border: 0;
		}

	}// .post-body

</style>
