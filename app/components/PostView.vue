<!--
	PostView.vue
	------------

	Renders a post on both the
	- /posts/[slug].vue page (for the main post content)
	- /[year]/[month]/[slug].vue page (for the main post content, but with a different layout and some extra related posts at the bottom)
-->
<script setup>

// vue
import { computed } from 'vue';

// components
import Container3D from './Container3D.vue';
import FlickrGallery from './FlickrGallery.vue';
import Spacer3D from './Spacer3D.vue';
import PostBody from './PostBody.vue';


// props
const props = defineProps({

	slug: {
		type: String,
		required: true,
	},
});

// We only really need the slug to find the post
const { data: post, error } = await useFetch(`/api/post/${props.slug}`);

if (error.value) {
	throw createError({ statusCode: 404, statusMessage: 'Post not found' });
}

// --- Date Logic ---
const formatDate = (dateStr) => {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
};

const isOldPost = computed(() => {
	if (!post.value || !post.value.date) return false;
	const postDate = new Date(post.value.date);
	const tenYearsAgo = new Date();
	tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
	return postDate < tenYearsAgo;
});


// --- NEW CODE: Formatter Function ---
const processedContent = computed(() => {
// ... (rest of processedContent logic)

    // 1. Safety check: return empty string if content hasn't loaded
    if (!post.value || !post.value.content) return '';

    let content = post.value.content;

    // 2. Normalize line endings (handle Windows \r\n vs Unix \n)
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 3. Convert double newlines to paragraph breaks
    // This looks for 2 or more newlines and turns them into </p><p>
    content = content.replace(/\n\n+/g, '</p><p>');

    // 4. Convert remaining single newlines to <br> tags
    content = content.replace(/\n/g, '<br />');

    // 5. Wrap the whole thing in <p> tags if it doesn't start with one
    // (This ensures the first and last paragraphs are valid)
    if (!content.trim().startsWith('<p>')) {
        content = '<p>' + content + '</p>';
    }

    return content;
});

</script>
<template>

	<Container3D class="container">

		<h1><span>{{ post.title }}</span></h1>

		<div class="white-box text main">

			<!-- row to contain categories and tags -->
			<div class="category-tags-row"  v-if="post.tags?.length">

				<!-- box on left with categories -->
				<!-- <div class="categories">
					📂 {{ post.categories?.join(', ') }}
				</div> -->

				<!-- box on right with tags -->
				<div class="tags" v-if="post.tags?.length">

					<NuxtLink
						v-for="tag in post.tags"
						:to="`/tagged/${tag}`"
						:key="tag"
						class="tag-link"
					>
						<div>{{ tag }}</div>
					</NuxtLink>

				</div>

			</div>

			<!-- Row for Date and Thumbnail -->
			<div class="date-row">

				<!-- Post Thumbnail (Floating Top Right, below tags) -->
				<img
					v-if="post.featuredImage"
					:src="post.featuredImage"
					class="post-thumbnail-float"
					:alt="post.title"
				/>

				<div class="date-text">
					Originally posted on: {{ formatDate(post.date) }}
				</div>

				<p class="date-warning" v-if="isOldPost">
					⚠️ Note: This post is over 10 years old. It was originally published on {{ formatDate(post.date) }}. It may contain outdated information on my skills, or reflect my views at that time, which could differ from my current perspectives.
				</p>
			</div>


			<PostBody :post="post" />

			<div style="clear: both;"></div>
		</div>
	</Container3D>

	<Spacer3D v-if="post.flickrSetId"/>
	<Container3D
		v-if="post.flickrSetId"
		class="container"
	>
		<h1><span>{{ post.title }}</span></h1>

		<div class="white-box text">
			<FlickrGallery :set-id="post.flickrSetId" />
		</div>
	</Container3D>

</template>
<style lang="scss" scoped>

	// main post container
	.container {

		max-width: 1000px;
		margin: 0 auto;

		// row to contain both categories and tags, with categories on the left and tags on the right
		// however for now, I'm only showing tags, so the categories section is commented out in the template and the tags section is aligned to the left
		.category-tags-row {

			.categories, .tags {
				font-size: 0.9rem;
				color: #666;
			}

			border-bottom: 2px solid var(--tag-box-color);
			.tags {
				text-align: center;

				.tag-link {
					text-decoration: none;
					color: var(--tag-text-color);
					&:hover {
						text-decoration: underline;
						color: var(--tag-text-hover-color);
					}

					// make pill shaped
					div {
						display: inline-block;

						background-color: var(--tag-box-color);
						padding: 0.2rem 0.5rem;
						border-radius: 9999px;

						margin: 0px 3px 6px 3px;
						&:hover {
							background-color: var(--tag-box-hover-color);
							color: var(--tag-text-hover-color);
							text-decoration: none;
						}

					}// div

				}// .tag-link

			}// .tags

		}// .category-tags-row

	}// .container

	.white-box {

		padding: 0.5rem 1rem 2rem 1rem;

		// The row containing the date and potentially the floating image
		.date-row {

			margin-bottom: 10px;

			// Floating thumbnail in top right
			.post-thumbnail-float {
				float: right;
				width: 250px;
				height: 250px;
				object-fit: cover;
				border: 3px solid white;
				border-radius: 3px;
				margin-left: 20px;
				margin-bottom: 15px;
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

				// mobile: center and make it bigger
				@media (max-width: 600px) {
					float: none;
					display: block;
					margin: 10px auto 20px auto;
					width: 100%;
					height: auto;
					max-width: 450px;
				}
			}

			.date-text {

				display: inline-block;
				margin: 0px;
				padding: 2px 15px 2px 10px;

				background: var(--tag-box-color);
				border-bottom-right-radius: 15px;

				font-style: italic;
				font-size: 0.9rem;
				color: var(--tag-text-color);

				// mobile: round all corners and take full width
				@media (max-width: 600px) {
					display: block;
					border-radius: 15px;
					text-align: center;
					width: 100%;
					padding: 6px 15px;
				}

			}// .date-text

			.date-warning {

				// BFC trick to stay to the left of the float and not go under it
				overflow: hidden;

				background: rgb(255, 221, 28);
				border-radius: 15px;
				margin-top: 10px;
				padding: 10px;
				color: #333; // dark text for readability on yellow

				// nice drop shadow
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

				@media (max-width: 600px) {
					width: 100%;
					max-width: 100%;
					overflow: visible; // No need for BFC if no float
				}
			}
		}// .date-row

		&.main {
			padding-top: 5px;
		}
	}// .white-box

</style>
