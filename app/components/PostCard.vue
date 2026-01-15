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

				<div class="body">
					<header class="header">
						<NuxtLink class="title" :to="href">
							{{ post.title }}
						</NuxtLink>

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

					<NuxtLink class="readMore" :to="href">
						Continue reading →
					</NuxtLink>
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
    width: 390px;
    border-radius: 6px;
    background: rgba(255, 255, 255, 1);

	// layout
	 display: grid;
    grid-template-columns: 150px 1fr;
    gap: 14px;
    padding: 6px;

	// hover animation
	transition: translate 0.3s, box-shadow 0.3s;
	&:hover {
		translate: 0 -5px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

		img {
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
			transform: scale(1.4) translate(-20px, 0px);
		}
	}// &:hover

   // thumbnail image
    img {

		// box styles
        display: block;
        width: 150px;
        height: 150px;
        border-radius: 4px;
        object-fit: cover;
        background: rgba(0, 0, 0, 0.08);
		border: 3px solid white;

		// hover animation
		transition: transform 0.3s;
		transform: scale(1.05) translate(0, 0);

    }// img

    // Placeholder styling if no image exists
    .thumbPlaceholder {

		// box styles
        width: 150px;
        height: 150px;
        opacity: 0.65;
        background: rgba(0, 0, 0, 0.08);
        border-radius: 4px;

		// layout
		display: grid;
        place-items: center;

		// text styles
        font-size: 12px;
        letter-spacing: 0.08em;

   	}// .thumbPlaceholder

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
                font-size: 20px;
                line-height: 1.15;
                color: var(--color-secondary);
                font-weight: 700;
                white-space: nowrap;

                text-overflow: ellipsis;
				text-align: left;

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

		// blurb text from articl
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

        }// .readMore

    }// .body

}// .postCard

/* Responsive */
@media (max-width: 520px) {
    .postCard {
        grid-template-columns: 1fr;
    }

    .postCard img,
    .postCard .thumbPlaceholder {
        width: 100%;
        height: 180px;
    }
}
</style>
