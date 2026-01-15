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

			<div class="post-content" v-html="post.content"></div>
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
			border-bottom: 2px solid var(--color-secondary);
			.tags {
				text-align: center;

				.tag-link {
					text-decoration: none;
					color: var(--color-hover);
					&:hover {
						text-decoration: underline;
					}

					// make pill shaped
					div {
						display: inline-block;

						background-color: var(--color-secondary);
						padding: 0.2rem 0.5rem;
						border-radius: 9999px;

						margin: 0px 3px 6px 3px;
						&:hover {
							background-color: var(--color-primary);

							text-decoration: none;
						}
					}
				}

			}// .tags

		}// .category-tags-row

	}// .container

	.white-box {

		padding: 0.5rem 1rem 2rem 1rem;

	}// .white-box

</style>
