<template>
	<div class="post-container" v-if="post">
		<header class="post-header">
			<h1 class="title">{{ post.title }}</h1>
			<div class="meta">
				<time>{{ new Date(post.date).toLocaleDateString() }}</time>
				<div class="categories" v-if="post.categories?.length">
					📂 {{ post.categories.join(', ') }}
				</div>
			</div>
		</header>

		<div class="post-content" v-html="post.content"></div>
	</div>
</template>
<script setup>

const route = useRoute();

// We only really need the slug to find the post
const { data: post, error } = await useFetch(`/api/post/${route.params.slug}`);

if (error.value) {
	throw createError({ statusCode: 404, statusMessage: 'Post not found' });
}
</script>
<style scoped>

/* Minimal "Reader" Styles */
.post-container {
	max-width: 800px;
	margin: 0 auto;
	padding: 2rem;
	font-family: sans-serif;
	line-height: 1.6;
}

.post-header {
	margin-bottom: 3rem;
	border-bottom: 1px solid #eee;
	padding-bottom: 1rem;
}

.title {
	font-size: 2.5rem;
	margin-bottom: 0.5rem;
}

.meta {
	color: #666;
	font-size: 0.9rem;
}

/* Ensure images fit */
:deep(.post-content img) {
	max-width: 100%;
	height: auto;
}
</style>
