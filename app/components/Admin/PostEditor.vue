<!--
	PostEditor.vue
	---------------

	Admin post editor component
-->
<script setup>

// vue
import { ref, watch, computed, onMounted, toRaw } from 'vue';

// props
const props = defineProps({

	// current post data
	post: {
		type: Object,
		required: false,
		default: null,
	},
});


// emits
const emit = defineEmits(['refresh', 'update']);


// current draft being edited
const draft = ref(null);

// true when loading a post
const loadingPost = ref(false);

// true when saving a post
const saving = ref(false);

// whether the draft has unsaved changes
const dirty = ref(false);

const ok = ref('');
const err = ref('');

// which editor tab is active
const editorTab = ref('rich');

// current list of categories
const categories = ref([]);

// current post tags
const tagsText = ref('');

// current category text
const categoryText = ref('');

// ref to our featured image file input
const featuredInputEl = ref(null);


/**
 * Clear notices
 */
function clearNotices() {
	ok.value = '';
	err.value = '';
}


/**
 * Open file picker to select featured image
 */
function pickFeatured() {

	if (!featuredInputEl.value)
		return;
	featuredInputEl.value.value = '';
	featuredInputEl.value.click();
}


/**
 * Load the list of categories from the server
 */
async function loadCategories() {

	try {
		const res = await $fetch('/api/admin/categories', { credentials: 'include' });
		categories.value = Array.isArray(res) ? res : [];

	} catch {
		categories.value = [];
	}
}


/**
 * Compute the payload to send to the server for saving the draft
 *
 * @returns payload object
 */
function computeDraftPayload() {

	const payload = {
		title: String(draft.value.title || ''),
		slug: String(draft.value.slug || ''),
		content: String(draft.value.content || ''),
		flickrSetId: draft.value.flickrSetId ? String(draft.value.flickrSetId) : null,
		featuredImage: String(draft.value.featuredImage || ''),
		status: String(draft.value.status || 'published'),
	};

	const tags = tagsText.value
		.split(',')
		.map(s => s.trim())
		.filter(Boolean);

	payload.tags = tags;

	const cat = categoryText.value.trim();
	payload.categories = cat ? [ cat ] : [];

	return payload;
}


/**
 * Save the current draft to the server
 */
async function saveDraft() {

	if (!draft.value || !props.post?._id)
		return;

	clearNotices();
	saving.value = true;

	try {
		const payload = computeDraftPayload();

		const updated = await $fetch(`/api/admin/posts/${props.post._id}`, {
			method: 'PUT',
			body: payload,
			credentials: 'include',
		});

		emit('update', updated);
		draft.value = structuredClone(toRaw(updated));

		tagsText.value = (Array.isArray(draft.value.tags) ? draft.value.tags : []).join(', ');
		categoryText.value = (Array.isArray(draft.value.categories) ? draft.value.categories : [])[0] || '';

		dirty.value = false;
		ok.value = 'Saved';
		emit('refresh');

	} catch (e) {
		err.value = 'Save failed';

	} finally {
		saving.value = false;
	}
}


/**
 * Publish the current draft
 */
async function publish() {

	if (!props.post?._id)
		return;

	clearNotices();

	try {
		const updated = await $fetch(`/api/admin/posts/${props.post._id}/publish`, {
			method: 'POST',
			credentials: 'include',
		});
		emit('update', updated);
		draft.value = structuredClone(toRaw(updated));
		ok.value = 'Published';
		emit('refresh');

	} catch (e) {
		err.value = 'Publish failed';
	}
}


/**
 * Unpublish the current post
 */
async function unpublish() {

	if (!props.post?._id)
		return;

	clearNotices();

	try {
		const updated = await $fetch(`/api/admin/posts/${props.post._id}/unpublish`, {
			method: 'POST',
			credentials: 'include',
		});
		emit('update', updated);
		draft.value = structuredClone(toRaw(updated));
		ok.value = 'Unpublished';
		emit('refresh');

	} catch (e) {
		err.value = 'Unpublish failed';
	}
}


/**
 * Preview the current draft in a new tab
 */
function previewPost() {

	if (!draft.value?.slug)
		return;
	window.open(`/posts/${draft.value.slug}`, '_blank');
}


/**
 * Delete the current post
 */
async function deletePost() {

	if (!props.post?._id)
		return;

	clearNotices();

	const sure = window.confirm('Delete this post? This cannot be undone.');
	if (!sure)
		return;

	try {
		await $fetch(`/api/admin/posts/${props.post._id}`, {
			method: 'DELETE',
			credentials: 'include',
		});

		ok.value = 'Deleted';
		dirty.value = false;

		emit('refresh');

	} catch (e) {
		err.value = 'Delete failed';
	}
}


/**
 * Handle when a featured image file is picked
 *
 * @param {Event} e - file input change event
 */
async function onFeaturedPicked(e) {

	const file = e.target.files?.[0];
	if (!file || !draft.value)
		return;

	clearNotices();

	try {
		const form = new FormData();
		form.append('path', 'featured-images');
		form.append('file', file, file.name);

		const res = await $fetch('/api/admin/assets/upload', {
			method: 'POST',
			body: form,
			credentials: 'include',
		});

		const saved = res?.saved?.[0];
		if (saved?.url) {
			draft.value.featuredImage = saved.url;
			ok.value = 'Thumbnail uploaded';
			dirty.value = true;

		} else {
			err.value = 'Thumbnail upload failed';
		}

	} catch {
		err.value = 'Thumbnail upload failed';
	}
}


/*
	Automatically update when post changes
*/
watch(() => props.post, (newPost) => {

	clearNotices();

	if (newPost) {
		draft.value = structuredClone(toRaw(newPost));
		tagsText.value = Array.isArray(newPost.tags) ? newPost.tags.join(', ') : '';
		categoryText.value = newPost.category || '';
		loadingPost.value = false;

	} else {
		draft.value = null;
		tagsText.value = '';
		categoryText.value = '';
		loadingPost.value = true;
	}

	dirty.value = false;

}, { immediate: true, deep: true });

/*
	Automatically mark draft as dirty when relevant fields change
*/
watch([draft, tagsText, categoryText], () => {

	if (!draft.value)
		return;
	dirty.value = true;

}, { deep: true });


/**
 * When the component mounts, load initial data
 */
onMounted(async () => {

	await Promise.all([
		loadCategories(),
	]);
});

</script>
<template>

	<div class="post-editor-wrapper">

		<div v-if="err" class="notice error">{{ err }}</div>
		<div v-if="ok" class="notice ok">{{ ok }}</div>

		<div v-if="loadingPost" class="status">
			Loading selected post…
		</div>

		<div v-else-if="!post" class="status">
			Select a post.
		</div>

		<div v-else class="editor">

			<div class="top-grid">

				<div class="fields">

					<div class="field">
						<label class="label">Post Title</label>
						<input v-model="draft.title" class="input" type="text" />
					</div>

					<div class="row">
						<div class="field">
							<label class="label">Slug</label>
							<input v-model="draft.slug" class="input" type="text" />
						</div>

						<div class="field">
							<label class="label">Status</label>
							<input class="input" type="text" :value="draft.status || 'published'" disabled />
						</div>
					</div>

					<div class="row">
						<div class="field">
							<label class="label">Tags (comma separated)</label>
							<input v-model="tagsText" class="input" type="text" placeholder="urbex, night, film" />
						</div>

						<div class="field">
							<label class="label">Category</label>
							<input
								v-model="categoryText"
								class="input"
								type="text"
								list="categoryOptions"
								placeholder="Type or pick…"
							/>
							<datalist id="categoryOptions">
								<option v-for="c in categories" :key="c" :value="c" />
							</datalist>
						</div>
					</div>

					<div class="row wrap">
						<button class="btn" type="button" @click="saveDraft" :disabled="saving">
							{{ saving ? 'Saving…' : 'Save Draft' }}
						</button>

						<button class="btn" type="button" @click="previewPost" :disabled="!draft.slug">
							Preview
						</button>

						<button
							v-if="(draft.status || 'published') !== 'published'"
							class="btn primary"
							type="button"
							@click="publish"
						>
							Publish
						</button>

						<button
							v-else
							class="btn"
							type="button"
							@click="unpublish"
						>
							Unpublish
						</button>

						<button class="btn danger" type="button" @click="deletePost">
							Delete
						</button>

						<span v-if="dirty" class="dirty">
							● Unsaved changes
						</span>
					</div>

				</div>

				<!-- THUMBNAIL PICKER -->
				<div class="thumb">
					<div class="thumb-label">Featured Image</div>

					<button class="thumb-box" type="button" @click="pickFeatured">
						<img
							v-if="draft.featuredImage"
							:src="draft.featuredImage"
							alt="Featured"
						/>
						<div v-else class="thumb-placeholder">
							Pick thumbnail
						</div>
					</button>

					<input
						ref="featuredInputEl"
						type="file"
						accept="image/*"
						class="hidden"
						@change="onFeaturedPicked"
					/>

					<div v-if="draft.featuredImage" class="thumb-path muted">
						{{ draft.featuredImage }}
					</div>
				</div>

			</div>

			<!-- EDITOR TABS -->
			<div class="tabs">
				<button class="tab" :class="{ active: editorTab === 'rich' }" type="button" @click="editorTab = 'rich'">
					Rich Text
				</button>
				<button class="tab" :class="{ active: editorTab === 'html' }" type="button" @click="editorTab = 'html'">
					Raw HTML
				</button>
			</div>

			<div class="editor-body">
				<textarea
					v-model="draft.content"
					class="textarea"
					:placeholder="editorTab === 'rich' ? 'WYSIWYG will go here next…' : 'Edit raw HTML…'"
				/>
			</div>

		</div>
	</div>

</template>
<style lang="scss" scoped>

$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

.post-editor-wrapper{

	// box settings
	padding: 10px;

	/* ====== EDITOR ====== */
	.editor{
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-height: 0;
		overflow: hidden;

		.top-grid{
			display: grid;
			grid-template-columns: 1fr 260px;
			gap: 12px;
			align-items: start;
		}// .top-grid

		/* ====== FEATURED IMAGE ====== */
		.thumb-box{
			width: 100%;
			aspect-ratio: 1 / 1;
			border-radius: 14px;
			border: 2px dashed rgba($primary, .4);
			display: flex;
			align-items: center;
			justify-content: center;
			overflow: hidden;
			background: rgba($primary, .05);
			cursor: pointer;

			img{
				width: 100%;
				height: 100%;
				object-fit: contain;
				background: #999;
			}// img

		}// .thumb-box

		/* ====== EDITOR BODY ====== */
		.editor-body{

			flex: 1;
			min-height: 0;
			overflow: hidden;

			.textarea{
				width: 100%;
				height: 100%;
				min-height: 0;
				resize: none;
				border-radius: 12px;
				padding: 12px;
				font-family: monospace;
				font-size: 13px;
				line-height: 1.5;
				border: 1px solid $border;
				overflow: auto;

				&:focus{
					outline: none;
					border-color: $primary;

				}// &:focus

			}// .textarea

		}// .editor-body

		/* ====== TABS ====== */
		.tabs{
			display: flex;
			gap: 8px;

			.tab{
				padding: 6px 10px;
				border-radius: 10px;
				border: 1px solid $border;
				cursor: pointer;
				font-size: 13px;

				&.active{
					border-color: $secondary;
					color: $secondary;
					box-shadow: 0 0 0 3px rgba($secondary, .12);
				}// &.active

			}// .tab

		} // .tabs

	}// .editor

}// .post-editor-wrapper

/* ====== FORM CONTROLS ====== */
.input{
	border: 1px solid $border;
	border-radius: 12px;
	padding: 8px 10px;
	font-size: 14px;
	background: #fff;
	color: $text;
	width: 100%;

	&:focus{
		outline: none;
		border-color: $primary;
		box-shadow: 0 0 0 3px rgba($primary, .12);
	}
}

.row{
	display: flex;
	gap: 10px;
	align-items: center;
}

.wrap{
	flex-wrap: wrap;
}

.btn{
	border-radius: 12px;
	padding: 8px 12px;
	border: 1px solid rgba($primary, .4);
	background: #fff;
	color: $text;
	cursor: pointer;
	font-size: 14px;

	&:hover{
		box-shadow: 0 0 0 3px rgba($primary, .1);
	}

	&.danger{
		border-color: #e54848;
		color: #e54848;
	}
}

</style>
