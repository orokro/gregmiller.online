<!--
	art.vue
	-------

	The Art page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import PostCard from '../../components/PostCard.vue';

// get our art posts
const category = 'Art';
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category,
	},
});

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1><span>Art</span></h1>
			<div class="white-box text">
				I've always enjoyed creativity of all kinds. I consider coding a creative hobby just as much as traditional art.
				<br/><br/>
				I studied both art and computer science in college, and continue to develop both skill sets to this day.
				<br/><br/>
				While I have less experience doing Art professionally, the skills have helped me in my engineering career constantly - being able to make assets without relying on others, and having a good eye for design and aesthetics has been a huge help in my work. Many of the work I've generated ended up in the final products I've worked on, and I enjoy being able to contribute in that way.
				<br/><br/>
				Because I've always had a focus in 3D, I got interested in 3D printing as soon as I could afford my first machine. Many projects below are either digital art, or 3D printed sculptures and objects. Though, there's some traditional art in there as well.
			</div>
		</Container3D>

		<Spacer3D/>

		<Container3D style="min-width: 400px;">
			<h1><span>Art Projects</span></h1>
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
