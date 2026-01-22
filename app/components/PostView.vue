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


// --- NEW CODE: Formatter Function ---
const processedContent = computed(() => {

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

		<div class="white-box text">

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

			<div class="post-content" v-html="processedContent"></div>
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

			margin-bottom: 10px;
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

	}// .white-box

</style>
