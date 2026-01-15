<!--
	urbex-articles.vue
	------------------

	The Urban Ex page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import PostCard from '../components/PostCard.vue';

// get our urban-ex posts
const category = 'Urban Ex Articles';
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category,
	},
});

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1><span>Urbex Articles</span></h1>
			<div class="white-box text">

				Below are some articles I've written about my urban exploration adventures, including tips for exploring safely and responsibly, as well as stories from some of my most memorable explorations.
			</div>
		</Container3D>

		<Spacer3D/>

		<Container3D style="min-width: 400px;">
			<h1><span>Urbex Articles Posts</span></h1>
			<div class="white-box" style="min-width: 390px;">

				<div v-if="data && data.posts && data.posts.length" class="grid">

					<div v-for="post in data.posts" :key="post._id" class="item">
						<PostCard
							:post="post"
							:thumb-url="post.featuredImage"
							:excerpt="post.excerpt"
						/>
					</div>

				</div>
				<div v-else>
					<p>No posts found in this category.</p>
				</div>

			</div>
		</Container3D>
	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
