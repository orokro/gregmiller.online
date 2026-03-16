<!--
	index.vue
	---------

	Admin landing page
-->
<script setup>

// vue
import { ref, onMounted, nextTick } from 'vue';

// components
import AdminSidebar from '../../components/Admin/AdminSidebar.vue';
import AssetBrowser from '../../components/Admin/AssetBrowser.vue';
import PostEditor from '../../components/Admin/PostEditor.vue';
import PanelTitleBar from '../../components/Admin/PanelTitleBar.vue';


// Page metadata
definePageMeta({
	layout: 'admin',
	middleware: [ 'admin' ],
});


// our total list of posts from the server
const posts = ref([]);

// current search query
const currentSearch = ref('');

// current selected post data
const post = ref(null);

// our asset browser / post-editor components refs
const assetBrowserRef = ref(null);
const postEditorRef = ref(null);
const adminSidebarRef = ref(null);

const route = useRoute();


/**
 * Refresh the list of posts from the server
 *
 * @param {string} q - search query
 */
async function refreshPosts(q = null) {

	if (q !== null) {
		currentSearch.value = q;
	}

	try {
		const res = await $fetch('/api/admin/posts', {
			params: { q: currentSearch.value },
			credentials: 'include',
		});
		posts.value = Array.isArray(res) ? res : [];

	} catch (e) {
		// failed to load posts
	}
}


/**
 * Handle when our side bar notifies us of a new post loading
 */
function onNewPostLoading() {

	post.value = null;
}


/**
 * Handle when our side bar notifies us of a post change
 *
 * @param {Object} data - post data from child component
 */
function onPostChanged(data) {

	// update our refs
	post.value = data.post;
}


/**
 * Handle when our side bar notifies us to create a new draft
 */
async function onCreateDraft() {

	try {
		const created = await $fetch('/api/admin/posts', {
			method: 'POST',
			body: { title: 'Untitled' },
			credentials: 'include',
		});

		// clear search to ensure the new post is visible
		await refreshPosts('');
		post.value = created;

	} catch (e) {
		console.error('Failed to create draft', e);
	}
}


/**
 * When the component mounts, load initial data
 */
onMounted(async () => {

	await Promise.all([
		refreshPosts(),
		assetBrowserRef.value?.refreshAssets(),
	]);

	// Auto-select post by slug if provided in query
	const slug = route.query.slug;
	if (slug) {
		let found = posts.value.find(p => p.slug === slug);
		
		// If not found in the initial list, search for it specifically
		if (!found) {
			try {
				const searchRes = await $fetch('/api/admin/posts', {
					params: { q: slug, limit: 1 },
					credentials: 'include',
				});
				if (searchRes && searchRes.length) {
					// Add it to the list so it appears in the sidebar
					posts.value.unshift(searchRes[0]);
					found = searchRes[0];
				}
			} catch (e) {
				console.error('Failed to search for slug', e);
			}
		}

		if (found && adminSidebarRef.value) {
			// Give the DOM/Sidebar a moment to react to the new posts.value
			await nextTick();
			adminSidebarRef.value.selectPost(found._id);
		}
	}
});

</script>
<template>

	<div class="admin">

		<div class="left-column">

			<AdminSidebar
				ref="adminSidebarRef"
				v-model:search="currentSearch"
				:posts="posts"
				@refresh-posts="refreshPosts"
				@create-draft="onCreateDraft"
				@new-post-loading="onNewPostLoading"
				@postChanged="onPostChanged"
			/>

		</div>

		<section class="main-area">

			<PostEditor
				v-if="post"
				ref="postEditorRef"
				:key="post._id"
				:post="post"
				@refresh="refreshPosts"
				@update="(p) => post = p"
			/>

			<div
				v-else
				class="card else-card"
			>
				<PanelTitleBar>
					Post Editor
				</PanelTitleBar>

				<div class="msg">
					<p>Select a post to edit from the left sidebar, or create a new post.</p>
				</div>
			</div>

		</section>

		<div class="asset-tray">
			<AssetBrowser ref="assetBrowserRef" />
		</div>

	</div>
</template>
<style lang="scss">

$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

$topBarHeight: 56px;
$leftColWidth: 250px;
$assetTrayHeight: 350px;

// main admin page wrapper
.admin{

	color: $text;
	font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;

	// left column fixed sidebar
	.left-column {

		// position
		position: fixed;
		inset: $topBarHeight auto 0px 0px;

		// box settings
		width: $leftColWidth;
		border-right: 3px solid white;

	}// .left-column

	// main area fills right of sidebar
	.main-area {

		// position
		position: fixed;
		inset: $topBarHeight 0px $assetTrayHeight $leftColWidth;

		// box settings
		border-bottom: 3px solid white;

		.else-card {
			padding-left: 3px;

			.msg {
				padding: 20px;
			}
		}// .else-card
	}// .main-area

	// asset drawer on bottom right
	.asset-tray{

		// position
		position: fixed;
		inset: auto 0px 0px $leftColWidth;

		// box settings
		height: $assetTrayHeight;

	}// .asset-tray

}// .admin

</style>
