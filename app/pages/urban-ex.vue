<!--
	urban-ex.vue
	------------

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
const category = 'Urban Ex';
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category,
	},
});

console.log(data.value.posts[0]);

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1><span>Urban Ex</span></h1>
			<div class="white-box text">

				<i>Via wikipedia: "Urban exploration is the exploration of man-made structures, usually abandoned ruins or not usually seen components of the man-made environment."</i>
				<br/><br/>
				For many years I made it a point to check out and document as many abandoned/off-limit places as possible. It's been quite a hobby, ranging from abandoned hospitals and prisons, to underground tunnels, storm drains, black mold, and rat infested houses in the middle of the woods.
				<br/><br/>
				When I shoot photos, I'm not usually trying to be artistic. Most of these simply tell the story one frame at a time. I shoot as many photos as I can to capture feeling of exploring each step of the way. Of course, sometimes I like to frame a pretty shot as well.
				<br/><br/>
				Below you'll find many of the abandoned, or seldom seen urban areas I've visited.

			</div>
		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1><span>Urban Ex Posts</span></h1>
			<div class="white-box">

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

.grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 1rem 2rem;
	padding-right: 20px;
}


</style>
