<template>
	<div class="container">
		<h1>Category: {{ categorySlug }}</h1>
		<div v-if="posts && posts.length" class="list">
			<div v-for="post in posts" :key="post._id" class="item">
				<NuxtLink :to="`/${new Date(post.date).getFullYear()}/${String(new Date(post.date).getMonth() + 1).padStart(2, '0')}/${post.slug}`">
					<h3>{{ post.title }}</h3>
				</NuxtLink>
				<p>{{ new Date(post.date).toLocaleDateString() }}</p>
			</div>
		</div>
		<div v-else>
			<p>No posts found in this category.</p>
		</div>
	</div>
</template>
<script setup>
	const route = useRoute();
	const categorySlug = route.params.slug;

	const { data: posts } = await useFetch('/api/posts', {
		query: { category: categorySlug }
	});
</script>
<style scoped>
	.container { max-width: 800px; margin: 0 auto; padding: 2rem; font-family: sans-serif; }
	.item { margin-bottom: 1.5rem; }
	a { text-decoration: none; color: #0063dc; }
	a:hover { text-decoration: underline; }
</style>
