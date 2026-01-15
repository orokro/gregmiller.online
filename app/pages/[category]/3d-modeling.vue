<!--
	3d-modeling.vue
	---------------

	The 3D Modeling page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import PostCard from '../../components/PostCard.vue';

// get our 3d-modeling posts
const category = '3D Modeling';
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category,
	},
});

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1><span>3D Modeling</span></h1>
			<div class="white-box text">

				Like many children of the era, when Toy Story was released it blew my young mind - and sparked an interest in 3d modeling. Shortly after that, the next generation of video games eased into 3D accelerated graphics. I got started on a cheap-o software called Design-It! 3-D, and was soon introduced me to me to the world of <a href="https://www.blender.org/">Blender</a>. Over the past decade, I've literally grown up with Blender.
				<br/><br/>
				I previously worked as a professional full-time 3D artist at Google, but have used my 3D-modeling skills in almost every job I've had, making assets for games, or tools to work with 3D data.
			</div>
		</Container3D>

		<Spacer3D/>

		<Container3D style="min-width: 400px;">
			<h1><span>3D Modeling Projects</span></h1>
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
