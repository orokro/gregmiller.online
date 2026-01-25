<!--
	AdminSidebar.vue
	----------------

	Admin sidebar component for the admin layout
-->
<script setup>

// vue
import { ref, computed } from 'vue';

// props
const props = defineProps({

	// current list of posts
	posts: {
		type: Array,
		required: true,
	},
});


// provide emits
const emit = defineEmits(['newPostLoading', 'postChanged', 'refreshPosts', 'createDraft']);


// refs
const postSearch = ref('');
const selectedId = ref('');


// vars
let refreshPostsTimer = null;


// get filtered posts from parent component
const filteredPosts = computed(() => {

	console.log(props.posts);

	const q = postSearch.value.trim().toLowerCase();

	if (!q) return
		props.posts;

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
function refreshPostsDebounced() {

	if (refreshPostsTimer)
		clearTimeout(refreshPostsTimer);

	refreshPostsTimer = setTimeout(() => {
		emit('refreshPosts');
	}, 200);
}


/**
 * Handle create draft button click
 */
function createDraft() {
	emit('createDraft');
}


</script>
<template>

	<aside class="left-column">

		<div class="card">
			<div class="row">
				<input
					v-model="postSearch"
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
				<button
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
				</button>

				<div v-if="!posts.length" class="empty">
					No posts found.
				</div>
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

/* ====== CARDS ====== */
.card {
	background: #fff;
	border-radius: 16px;
	border: 1px solid $border;
	box-shadow: $shadow;
	padding: 14px 16px;

	display: flex;
	flex-direction: column;
	overflow: hidden;
	min-width: 0;
}// .card

/* ====== LEFT COLUMN ====== */
.left-column {

	height: 100%;
	overflow: hidden;

	// row in the left column
	.row{
		display: flex;
		gap: 10px;
		margin-bottom: 10px;

	}// .row

	.list{
		flex: 1;
		overflow: auto;
		padding-right: 4px;
		display: grid;
		gap: 8px;

		/* ====== POST LIST ====== */
		.post-row{
			padding: 8px 10px;
			border-radius: 12px;
			border: 1px solid $border;
			background: #fff;
			cursor: pointer;
			transition: .15s;

			&:hover{
				border-color: $primary;
			}// &:hover

			&.active{
				border-color: $primary;
				box-shadow: 0 0 0 3px rgba($primary, .12);
			}// &.active

		}// .post-row

	}// .list

}// .left-column

</style>
