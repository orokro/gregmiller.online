<!--
	index.vue
	---------

	This is the main page of the site
-->
<script setup>

// imports
const { data, error } = await useFetch('/api/posts');

// components
import GmillerText from '../components/Custom3D/GmillerText.vue';

const getPostLink = (post) => {
    const d = new Date(post.date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `/${year}/${month}/${post.slug}`;
};

</script>
<template>

	<div class="container">

		<div align="center">
			<GmillerText />
		</div>

		<div v-if="error" class="error">
			<p>Error loading posts: {{ error }}</p>
		</div>

		<div v-else-if="data" class="post-grid">
			<article v-for="post in data" :key="post._id" class="card">

                <NuxtLink :to="getPostLink(post)" class="card-link">

                    <div v-if="post.featuredImage" class="card-image">
                        <img :src="post.featuredImage" :alt="post.title" loading="lazy" />
                    </div>
                    <div v-else class="card-image placeholder">
                        <span>No Image</span>
                    </div>

                    <div class="card-content">
                        <div class="meta">
                            <span class="date">{{ new Date(post.date).toLocaleDateString() }}</span>
                            <span v-if="post.categories?.length" class="category">{{ post.categories[0] }}</span>
                        </div>

                        <h2>{{ post.title }}</h2>

                        <div class="tags" v-if="post.tags?.length">
                            <span v-for="tag in post.tags.slice(0, 3)" :key="tag">#{{ tag }}</span>
                        </div>

                        <div class="badges">
                            <span v-if="post.flickrSetId" class="badge flickr">📸 Flickr Set</span>
                        </div>
                    </div>

                </NuxtLink>

			</article>
		</div>

	</div>
</template>
<style scoped>
.container {
	max-width: 1200px;
	margin: 0 auto;
	padding: 2rem;
	font-family: "Alumni Sans Pinstripe", sans-serif;
}

header {
	margin-bottom: 3rem;
	text-align: center;
}

.post-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
	gap: 2rem;
}

.card {
	border: 1px solid #ddd;
	border-radius: 8px;
	overflow: hidden;
	transition: transform 0.2s;
}

.card:hover {
	transform: translateY(-5px);
	box-shadow: 0 10px 20px rgba(0, 0, 0, 0.1);
}

.card-link {
    text-decoration: none;
    color: inherit;
    display: block;
    height: 100%;
}

.card-image {
	height: 200px;
	background: #eee;
	overflow: hidden;
}

.card-image img {
	width: 100%;
	height: 100%;
	object-fit: cover;
}

.placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	color: #999;
}

.card-content {
	padding: 1.5rem;
}

.meta {
	font-size: 0.85rem;
	color: #666;
	margin-bottom: 0.5rem;
	display: flex;
	justify-content: space-between;
}

.category {
	color: #2c3e50;
	font-weight: bold;
	text-transform: uppercase;
}

h2 {
	margin: 0 0 1rem 0;
	font-size: 1.4rem;
	line-height: 1.3;
}

.tags {
	font-size: 0.8rem;
	color: #888;
	margin-bottom: 1rem;
}

.tags span {
	margin-right: 8px;
}

.badge {
	display: inline-block;
	background: #0063dc;
	/* Flickr Blue */
	color: white;
	padding: 2px 8px;
	border-radius: 4px;
	font-size: 0.75rem;
	font-weight: bold;
}
</style>
