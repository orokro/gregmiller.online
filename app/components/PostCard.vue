<!--
 	PostCard.vue
	------------

	This component represents a single post in a list of posts, such as on the homepage or category pages.
-->
<script setup>

// vue
import { computed } from 'vue';


// props
const props = defineProps({

	// post data object
	post: {
		type: Object,
		required: true,
	},

	// If you already have a thumb URL somewhere, pass it in.
	// Otherwise this component will show a placeholder.
	thumbUrl: {
		type: String,
		default: '',
	},

	// Optional short excerpt (since your sample doc shape doesn’t include it)
	excerpt: {
		type: String,
		default: '',
	},

	// Base path for your post pages (change if you use /post/ or /p/)
	basePath: {
		type: String,
		default: '/posts/',
	},

	showDate: {
		type: Boolean,
		default: false,
	},

	showTags: {
		type: Boolean,
		default: false,
	},

	showCategories: {
		type: Boolean,
		default: false,
	},

});

const href = computed(() => `${props.basePath}${props.post.slug}`);

const prettyDate = computed(() => {
	const d = props.post?.date ? new Date(props.post.date) : null;
	if (!d || Number.isNaN(d.getTime())) return '';
	return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
});

const categories = computed(() => Array.isArray(props.post?.categories) ? props.post.categories : []);
const tags = computed(() => Array.isArray(props.post?.tags) ? props.post.tags : []);

const resolvedThumb = computed(() => props.thumbUrl || '');

</script>
<template>

	<NuxtLink class="thumb" :to="href" :aria-label="post.title">

		<div class="outer-box">

			<article class="postCard">

				<div class="card-thumb">
					<div class="thumb-clipper">
						<img
							v-if="resolvedThumb"
							:src="resolvedThumb"
							:alt="post.title"
							loading="lazy"
							decoding="async"
						/>
						<div v-else class="thumbPlaceholder">
							<span>NO IMAGE</span>
						</div>
					</div>
				</div>

				<div class="body">
					<header class="header">
						<div class="title">
							{{ post.title }}
						</div>

						<div v-if="(showDate && prettyDate) || (showCategories && categories.length)" class="meta">
							<span v-if="showDate && prettyDate" class="date">{{ prettyDate }}</span>
							<span v-if="showDate && prettyDate && showCategories && categories.length" class="dot">•</span>
							<span v-if="showCategories && categories.length" class="cats">
								<span v-for="c in categories" :key="c" class="pill">{{ c }}</span>
							</span>
						</div>
					</header>

					<p v-if="excerpt" class="excerpt">
						{{ excerpt }}
					</p>

					<div v-if="showTags && tags.length" class="tags">
						<span v-for="t in tags.slice(0, 8)" :key="t" class="tag">
							{{ t }}
						</span>
						<span v-if="tags.length > 8" class="tag more">+{{ tags.length - 8 }}</span>
					</div>

					<div class="readMore">
						Continue reading →
					</div>
				</div>

			</article>

		</div>

	</NuxtLink>

</template>
<style lang="scss" scoped>

/* 1. Reset all links in this component to have no underlines */
.thumb, .title, .readMore {
    text-decoration: none;
    &:hover {
        text-decoration: none;
    }
}

/* 2. Style the outer wrapper */
.thumb {
    display: block; /* Important for the wrapper link to behave like a box */
    color: inherit; /* Don't force standard blue link color */
}

// Main card styles
.postCard {

	// box styles
    // 1. Allow the card to be fluid so the Grid controls the size
    width: 100%;

    border-radius: 6px;
    background: rgba(255, 255, 255, 1);

	// layout
	display: grid;
    grid-template-columns: 1fr;
    gap: 14px;
    padding: 10px;

    @media (min-width: 500px) {
        grid-template-columns: 150px 1fr;
        padding: 6px;
    }

	// hover animation
	transition: translate 0.3s, box-shadow 0.3s;
	&:hover {
		translate: 0 -5px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		z-index: 10;

		.card-thumb {
			// box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

			.thumb-clipper {
				transform: scale(1.4) translate(-20px, 0px);
				box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
				z-index: 20;
			}

		}// .card-thumb

	}// &:hover

   // thumbnail image container
	.card-thumb {

		width: 150px;
		height: 150px;
		position: relative;
        margin: 0 auto;

        @media (min-width: 500px) {
            margin: 0;
        }

		.thumb-clipper {

			width: 100%;
			height: 100%;

			// border styles
			border-radius: 4px;
			border: 3px solid white;
			background: rgba(0, 0, 0, 0.08);

			// Clip the image to square
			overflow: hidden;

			// hover animation
			transition: transform 0.3s, box-shadow 0.3s;
			transform: scale(1.05) translate(0, 0);

			img {
				display: block;
				width: 100%;
				height: 100%;
				object-fit: cover;

			}// img

			// Placeholder styling if no image exists
			.thumbPlaceholder {

				// box styles
				width: 100%;
				height: 100%;
				opacity: 0.65;

				// layout
				display: grid;
				place-items: center;

				// text styles
				font-size: 12px;
				letter-spacing: 0.08em;

			}// .thumbPlaceholder

		}// .thumb-clipper

	}// .card-thumb

    // Body Content
    .body {

		// box styles
        min-width: 0;

		// layout
        display: flex;
        flex-direction: column;
        gap: 8px;

		// header row for title and meta
        .header {

			// layout
            display: flex;
            flex-direction: column;
            gap: 6px;

			// title styles
            .title {

				// box styles
				overflow: hidden;

				// text styles
                font-size: 26px;
                line-height: 1.15;
                color: var(--color-secondary);
                font-weight: 700;
                white-space: nowrap;
                text-overflow: ellipsis;
				text-align: left;
				font-family: "Alumni Sans Pinstripe", sans-serif;
				letter-spacing: 1px;

            }// meta info row (date, categories)

			// meta info row (date, categories)
            .meta {

				// box styles
                opacity: 0.85;

				// layout
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;

				// text styles
                font-size: 12px;

            }// .meta

			// date & dot
            .date { white-space: nowrap; }
            .dot { opacity: 0.5; }

			// categories
            .cats {

                display: inline-flex;
                gap: 6px;
                flex-wrap: wrap;
                min-width: 0;

            }// .cats

			// pill for categories
            .pill {
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 999px;
                background: rgba(0, 0, 0, 0.08);
                border: 1px solid rgba(255, 255, 255, 0.08);
                white-space: nowrap;

            }// .pill

        }// .header

		// blurb text from article
        .excerpt {

			// box styles
            margin: 0;
			opacity: 0.9;
            display: -webkit-box;
			-webkit-line-clamp: 4;
            -webkit-box-orient: vertical;
            overflow: hidden;

			// text styles
            font-size: 13px;
            line-height: 1.35;
            text-align: left;
			font-family: "Quicksand", sans-serif;
  			font-optical-sizing: auto;

        }// .excerpt

		// list of
        .tags {

			// layout
            display: flex;
            gap: 6px;
            flex-wrap: wrap;

			// actual tag styles
            .tag {

				// box styles
				padding: 2px 8px;
                border-radius: 999px;
                background: rgba(107, 191, 74, 0.12);
                border: 1px solid rgba(107, 191, 74, 0.25);

				// text styles
                font-size: 11px;
                white-space: nowrap;

                &.more { opacity: 0.75; }

            }// .tag

        }// .tags

		// read-more link
        .readMore {

			// layout
            margin-top: 2px;
            align-self: flex-start;

			// text styles
            color: var(--color-secondary);
            font-size: 13px;
			font-family: "Quicksand", sans-serif;
  			font-optical-sizing: auto;

        }// .readMore

    }// .body

}// .postCard

</style>
