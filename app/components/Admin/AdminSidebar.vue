<!--
	AdminSidebar.vue
	----------------

	Admin sidebar component for the admin layout
-->
<script setup>

// vue
import { ref, computed } from 'vue';

// components
import PanelTitleBar from './PanelTitleBar.vue';


// props
const props = defineProps({

	// current list of posts
	posts: {
		type: Array,
		required: true,
	},

	// current search query
	search: {
		type: String,
		default: '',
	},
});


// provide emits
const emit = defineEmits(['newPostLoading', 'postChanged', 'refreshPosts', 'createDraft', 'update:search']);


// refs
const selectedId = ref('');


// vars
let refreshPostsTimer = null;


// get filtered posts from parent component
const filteredPosts = computed(() => {

	const q = (props.search || '').trim().toLowerCase();

	if (!q)
		return props.posts;

	return props.posts.filter(p => {
		return String(p.title || '').toLowerCase().includes(q) || String(p.slug || '').toLowerCase().includes(q);
	});
});


/**
 * Help format a date string
 *
 * @param d - date string
 * @returns formatted date string
 */
function formatDate(d) {
	try {
		return new Date(d).toLocaleDateString();
	} catch {
		return '';
	}
}


/**
 * Select a post by ID
 *
 * @param id - post ID to select
 */
async function selectPost(id) {

	if (!id)
		return;

	// notify parent we're loading a new post
	emit('newPostLoading');

	// set our new local selected idea
	selectedId.value = id;

	try {
		const p = await $fetch(`/api/admin/posts/${id}`, { credentials: 'include' });

		const postData = {
			post: p,
		};
		emit('postChanged', postData);

	} catch (e) {
		// post.value = null;
		// draft.value = null;
		// err.value = 'Failed to load selected post (check server console / API response)';

	} finally {
		// nothing yet
	}
}


/**
 * Debounced refresh posts list
 */
function refreshPostsDebounced(e) {

	const val = e.target.value;
	emit('update:search', val);

	if (refreshPostsTimer)
		clearTimeout(refreshPostsTimer);

	refreshPostsTimer = setTimeout(() => {
		emit('refreshPosts', val);
	}, 200);
}


/**
 * Handle create draft button click
 */
function createDraft() {
	emit('createDraft');
}


// expose functions to parent (for auto-select by slug)
defineExpose({
	selectPost,
});


</script>
<template>

	<aside class="left-column">

		<PanelTitleBar>Posts</PanelTitleBar>

		<div class="row controls">
			<input
				:value="search"
				class="input"
				type="text"
				placeholder="Search posts…"
				@input="refreshPostsDebounced"
			/>
			<button class="btn" type="button" @click="createDraft">
				New
			</button>
		</div>

		<div class="list">
			<div
				v-for="p in filteredPosts"
				:key="p._id"
				type="button"
				class="list-item post-row"
				:class="{ active: p._id === selectedId }"
				@click="selectPost(p._id)"
			>
				<div class="li-title">{{ p.title || '(Untitled)' }}</div>
				<div class="li-meta">
					<span class="pill">{{ p.status || 'published' }}</span>

					<span v-if="p.date" class="muted">{{ formatDate(p.date) }}</span>
				</div>
			</div>

			<div v-if="!posts.length" class="empty">
				No posts found.
			</div>
		</div>


	</aside>

</template>
<style lang="scss" scoped>

$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

/* ====== LEFT COLUMN ====== */
.left-column {

	// allow nothing to escape
	overflow: hidden;

	// box settings
	position: relative;

	// row in the left column
	.row{

		// lay out
		display: flex;
		gap: 10px;
		margin-bottom: 10px;

	}// .row

	// row with the search box & new button
	.controls {

		// box settings
		padding: 10px;
		border-bottom: 1px solid $border;
		background: #fff;

		// the search text box
		input {
			width: 160px;
			border-radius: 8px;
			padding: 4px;
		}// input


		// the "new" button
		button {

			// box styles
			background: $primary;
			border-radius: 100px;
			border: 2px solid white;
			padding: 6px 14px;

			// text styles
			color: white;
			font-weight: bolder;

			// cursor styles
			cursor: pointer;

			// hover effect
			&:hover{
				background: white;
				color: $primary;
			}// &:hover

		}// button

	}// .controls

	// list of posts
	.list{

		// position fixed
		position: absolute;
		top: 74px;
		bottom: 0px;
		left: 0px;
		right: 0px;

		// allow scrolling
		overflow: auto;
		// padding-right: 4px;

		// one of the rows in the list
		.post-row{

			// box styles
			background: white;
			padding: 8px 10px;
			margin-bottom: 2px;

			// text styles
			color: $secondary;
			font-weight: bold;

			// cursor styles
			cursor: pointer;

			// for animation
			transition: .15s;

			&:hover{
				border-color: $primary;

				background: $secondary;
				color: white;
			}// &:hover

			&.active{
				background: $primary;
				color: white;
			}// &.active

			.pill, .muted {

				// box styles
				margin-right: 5px;

				// text styles
				font-weight: normal;
				font-size: 12px;
				font-style: italic;

			}// .pill, .muted

		}// .post-row

	}// .list

}// .left-column

</style>
