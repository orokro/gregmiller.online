<!--
	index.vue
	---------

	Admin landing page
-->
<script setup>

// vue
import { ref, onMounted } from 'vue';

// components
import AdminSidebar from '../../components/Admin/AdminSidebar.vue';
import AssetBrowser from '../../components/Admin/AssetBrowser.vue';
import PostEditor from '../../components/Admin/PostEditor.vue';


// Page metadata
definePageMeta({
	layout: 'admin',
	middleware: [ 'admin' ],
});


// our total list of posts from the server
const posts = ref([]);

// current selected post data
const post = ref(null);

// our asset browser / post-editor components refs
const assetBrowserRef = ref(null);
const postEditorRef = ref(null);


/**
 * Refresh the list of posts from the server
 */
async function refreshPosts() {

	try {
		const res = await $fetch('/api/admin/posts', {
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

		await refreshPosts();
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
});

</script>
<template>

	<div class="admin">

		<div class="left-column">

			<AdminSidebar
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
				class="card"
			>
				<p>Select a post to edit from the left sidebar, or create a new post.</p>
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
