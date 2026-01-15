<!--
	CategoryGrid.vue
	----------------

	All the pages that use a grid of posts for their category can generate it with this component.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from './Container3D.vue';
import PostCard from './PostCard.vue';

// props
const props = defineProps({

	// title for box
	title: {
		type: String,
		required: true,
	},

	// category name to fetch posts for
	category: {
		type: String,
		required: true,
	},

});

// get our posts for this category
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category: props.category,
	},
});

</script>
<template>

	<Container3D style="min-width: 400px;">

		<h1><span>{{ props.title }}</span></h1>
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

</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
