<!--
	[category]/[slug].vue
	---------------------

	This page displays a list of posts for a given category
	The category is determined by the URL slug.
-->
<script setup>

const route = useRoute();
const categorySlug = route.params.slug;

// Handle legacy category slugs that don't match the current category names
const legacySlugMap = {
	"video": "Video",
	"favorite-musicians": "Favorite Musicians",
	"geocaching": "Geocaching",
	"uncategorized": "Uncategorized",
	"my-beats": "My Music",
	"3d-modeling": "3D Modeling",
	"code-projects": "Code Projects",
	"other-projects": "Other Projects",
	"art": "Art",
	"websites": "Websites",
	"music-articles": "Music Articles",
	"urban-ex-articles": "Urban Ex Articles",
	"urban-dx": "Urban Ex",
	"code-projects": "Code Projects",
	"graffiti-yards": "Graffiti Yards",
	"technology-reviews": "Technology Reviews",
}

// get the slug and correct it if it's a legacy slug
let slug = categorySlug;
if (legacySlugMap[categorySlug]) {
	slug = legacySlugMap[categorySlug];
}

const { data: posts } = await useFetch('/api/posts', {
	query: { category: slug }
});

</script>
<template>

	<div class="container">

		<h1>Category: {{ categorySlug }}</h1>

		<div v-if="posts && posts.length" class="list">

			<div v-for="post in posts" :key="post._id" class="item">
				<NuxtLink
					:to="`/${new Date(post.date).getFullYear()}/${String(new Date(post.date).getMonth() + 1).padStart(2, '0')}/${post.slug}`">
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
<style scoped>

.container {
	max-width: 800px;
	margin: 0 auto;
	padding: 2rem;
	font-family: sans-serif;
}

.item {
	margin-bottom: 1.5rem;
}

a {
	text-decoration: none;
	color: #0063dc;
}

a:hover {
	text-decoration: underline;
}

</style>
