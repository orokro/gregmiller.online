<template>
	<div>
		<h1>Greg Miller Online</h1>
		<p>Migration Status: Connected!</p>

		<div v-if="posts" class="post-list">
			<div v-for="post in posts" :key="post._id" class="post-preview">
				<h2>{{ post.title }}</h2>
				<p class="date">{{ new Date(post.date).toLocaleDateString() }}</p>
				<p v-if="post.flickrSetId">📸 Has Gallery</p>
				<hr />
			</div>
		</div>
	</div>
</template>
<script setup lang="ts">

const { data: posts } = await useFetch('/api/posts');
</script>
<style scoped>

	.post-preview {
		margin-bottom: 2rem;
	}

	.date {
		color: #666;
		font-size: 0.9rem;
	}
</style>
