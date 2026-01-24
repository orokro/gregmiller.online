<!--
	index.vue
	---------

	Admin landing page
-->
<template>
	<div class="admin">

		<div class="grid">

			<!-- LEFT: POSTS LIST -->
			<aside class="left">
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
							class="list-item"
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

			<!-- MAIN: EDITOR -->
			<section class="main">
				<div class="card">

					<div class="header-row">
						<h1 class="title">Post Editor</h1>
						<div class="hint muted">
							Click a post on the left to edit.
						</div>
					</div>

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

				<!-- BOTTOM: ASSETS -->
				<div class="card assets">
					<div class="assets-head">
						<h2 class="subtitle">Assets</h2>
						<span class="muted">Served from <code>/wp-content/</code></span>
					</div>

					<div class="assets-top">
						<div class="row wrap">
							<button class="btn" type="button" @click="pickAssetsUpload">
								Upload Assets
							</button>

							<input
								v-model="assetsPath"
								class="input"
								type="text"
								placeholder="Path under wp-content (e.g. new_uploads)"
							/>

							<button class="btn" type="button" @click="refreshAssets">
								Refresh
							</button>

							<input
								v-model="assetsSearch"
								class="input"
								type="text"
								placeholder="Search in this folder…"
							/>
						</div>

						<input
							ref="assetsInputEl"
							type="file"
							multiple
							class="hidden"
							@change="onAssetsPicked"
						/>
					</div>

					<div class="assets-list">
						<div v-if="assetsLoading" class="status">Loading assets…</div>

						<button
							v-for="it in filteredAssets"
							:key="it.path"
							type="button"
							class="asset-item"
							@click="onAssetClick(it)"
						>
							<div class="asset-name">
								<span class="pill" :class="{ dir: it.type === 'dir' }">
									{{ it.type }}
								</span>
								<span>{{ it.name }}</span>
							</div>

							<div class="asset-meta muted">
								<span v-if="it.type === 'file'">{{ it.url }}</span>
								<span v-else>Open folder</span>
							</div>
						</button>
					</div>
				</div>

			</section>

		</div>

	</div>
</template>

<script setup>
definePageMeta({
	layout: 'admin',
	middleware: [ 'admin' ],
});

const postSearch = ref('');
const posts = ref([]);
const selectedId = ref('');
const post = ref(null);
const draft = ref(null);
const loadingPost = ref(false);
const saving = ref(false);
const dirty = ref(false);

const ok = ref('');
const err = ref('');

const editorTab = ref('rich');

const categories = ref([]);
const tagsText = ref('');
const categoryText = ref('');

const featuredInputEl = ref(null);

const assetsPath = ref('');
const assetsSearch = ref('');
const assets = ref([]);
const assetsLoading = ref(false);
const assetsInputEl = ref(null);

let refreshPostsTimer = null;

function clearNotices() {
	ok.value = '';
	err.value = '';
}

function formatDate(d) {
	try {
		return new Date(d).toLocaleDateString();
	} catch {
		return '';
	}
}

const filteredPosts = computed(() => {
	const q = postSearch.value.trim().toLowerCase();
	if (!q) return posts.value;
	return posts.value.filter(p => {
		return String(p.title || '').toLowerCase().includes(q) || String(p.slug || '').toLowerCase().includes(q);
	});
});

const filteredAssets = computed(() => {
	const q = assetsSearch.value.trim().toLowerCase();
	if (!q) return assets.value;
	return assets.value.filter(it => String(it.name || '').toLowerCase().includes(q));
});

async function refreshPosts() {
	try {
		const res = await $fetch('/api/admin/posts', {
			query: postSearch.value.trim() ? { q: postSearch.value.trim() } : undefined,
			credentials: 'include',
		});
		posts.value = Array.isArray(res) ? res : [];
	} catch (e) {
		err.value = 'Failed to load posts list';
	}
}

function refreshPostsDebounced() {
	if (refreshPostsTimer) clearTimeout(refreshPostsTimer);
	refreshPostsTimer = setTimeout(() => {
		refreshPosts();
	}, 200);
}

async function loadCategories() {
	try {
		const res = await $fetch('/api/admin/categories', { credentials: 'include' });
		categories.value = Array.isArray(res) ? res : [];
	} catch {
		categories.value = [];
	}
}

async function selectPost(id) {
	if (!id) return;

	clearNotices();
	selectedId.value = id;
	loadingPost.value = true;

	try {
		const p = await $fetch(`/api/admin/posts/${id}`, { credentials: 'include' });

		post.value = p;
		draft.value = structuredClone(p);

		const tags = Array.isArray(draft.value.tags) ? draft.value.tags : [];
		tagsText.value = tags.join(', ');

		const cats = Array.isArray(draft.value.categories) ? draft.value.categories : [];
		categoryText.value = cats[0] || '';

		dirty.value = false;
	} catch (e) {
		post.value = null;
		draft.value = null;
		err.value = 'Failed to load selected post (check server console / API response)';
	} finally {
		loadingPost.value = false;
	}
}

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

watch([draft, tagsText, categoryText], () => {
	if (!draft.value) return;
	dirty.value = true;
}, { deep: true });

async function saveDraft() {
	if (!draft.value || !selectedId.value) return;

	clearNotices();
	saving.value = true;

	try {
		const payload = computeDraftPayload();

		const updated = await $fetch(`/api/admin/posts/${selectedId.value}`, {
			method: 'PUT',
			body: payload,
			credentials: 'include',
		});

		post.value = updated;
		draft.value = structuredClone(updated);

		tagsText.value = (Array.isArray(draft.value.tags) ? draft.value.tags : []).join(', ');
		categoryText.value = (Array.isArray(draft.value.categories) ? draft.value.categories : [])[0] || '';

		dirty.value = false;
		ok.value = 'Saved';
		await refreshPosts();
	} catch (e) {
		err.value = 'Save failed';
	} finally {
		saving.value = false;
	}
}

async function publish() {
	if (!selectedId.value) return;

	clearNotices();

	try {
		const updated = await $fetch(`/api/admin/posts/${selectedId.value}/publish`, {
			method: 'POST',
			credentials: 'include',
		});
		post.value = updated;
		draft.value = structuredClone(updated);
		ok.value = 'Published';
		await refreshPosts();
	} catch (e) {
		err.value = 'Publish failed';
	}
}

async function unpublish() {
	if (!selectedId.value) return;

	clearNotices();

	try {
		const updated = await $fetch(`/api/admin/posts/${selectedId.value}/unpublish`, {
			method: 'POST',
			credentials: 'include',
		});
		post.value = updated;
		draft.value = structuredClone(updated);
		ok.value = 'Unpublished';
		await refreshPosts();
	} catch (e) {
		err.value = 'Unpublish failed';
	}
}

function previewPost() {
	if (!draft.value?.slug) return;
	window.open(`/posts/${draft.value.slug}`, '_blank');
}

async function deletePost() {
	if (!selectedId.value) return;

	clearNotices();

	const sure = window.confirm('Delete this post? This cannot be undone.');
	if (!sure) return;

	try {
		await $fetch(`/api/admin/posts/${selectedId.value}`, {
			method: 'DELETE',
			credentials: 'include',
		});

		ok.value = 'Deleted';
		selectedId.value = '';
		post.value = null;
		draft.value = null;
		dirty.value = false;

		await refreshPosts();
	} catch (e) {
		err.value = 'Delete failed';
	}
}

async function createDraft() {
	clearNotices();

	try {
		const created = await $fetch('/api/admin/posts', {
			method: 'POST',
			body: { title: 'Untitled' },
			credentials: 'include',
		});

		await refreshPosts();
		await selectPost(created._id);
		ok.value = 'Draft created';
	} catch (e) {
		err.value = 'Create failed';
	}
}

function pickFeatured() {
	if (!featuredInputEl.value) return;
	featuredInputEl.value.value = '';
	featuredInputEl.value.click();
}

async function onFeaturedPicked(e) {
	const file = e.target.files?.[0];
	if (!file || !draft.value) return;

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

async function refreshAssets() {
	assetsLoading.value = true;

	try {
		const res = await $fetch('/api/admin/assets/list', {
			query: { path: assetsPath.value.trim() },
			credentials: 'include',
		});

		assets.value = Array.isArray(res?.items) ? res.items : [];
	} catch {
		assets.value = [];
		err.value = 'Failed to load assets';
	} finally {
		assetsLoading.value = false;
	}
}

function pickAssetsUpload() {
	if (!assetsInputEl.value) return;
	assetsInputEl.value.value = '';
	assetsInputEl.value.click();
}

async function onAssetsPicked(e) {
	const files = Array.from(e.target.files || []);
	if (!files.length) return;

	clearNotices();

	try {
		for (const f of files) {
			const form = new FormData();
			form.append('path', assetsPath.value.trim());
			form.append('file', f, f.name);

			await $fetch('/api/admin/assets/upload', {
				method: 'POST',
				body: form,
				credentials: 'include',
			});
		}

		ok.value = 'Uploaded';
		await refreshAssets();
	} catch {
		err.value = 'Asset upload failed';
	}
}

function onAssetClick(it) {
	if (it.type === 'dir') {
		assetsPath.value = it.path;
		refreshAssets();
		return;
	}

	if (it.url && navigator.clipboard?.writeText) {
		navigator.clipboard.writeText(it.url);
		ok.value = 'Copied URL';
	}
}

onMounted(async () => {
	await Promise.all([
		refreshPosts(),
		loadCategories(),
		refreshAssets(),
	]);
});
</script>
<style scoped lang="scss">
$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

.admin{
	height: 100%;
	overflow: hidden;
	color: $text;
}

/* ====== MAIN GRID ====== */

.grid{
	height: 100%;
	display: grid;
	grid-template-columns: 340px 1fr;
	gap: 14px;
	align-items: stretch;
	overflow: hidden;
}

/* ====== LEFT COLUMN ====== */

.left{
	height: 100%;
	overflow: hidden;
}

.left .row{
	display: flex;
	gap: 10px;
	margin-bottom: 10px;
}

.list{
	flex: 1;
	overflow: auto;
	padding-right: 4px;
	display: grid;
	gap: 8px;
}

/* ====== MAIN COLUMN ====== */

.main{
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 14px;
	overflow: hidden;
	min-width: 0;
}

/* ====== CARDS ====== */

.card{
	background: #fff;
	border-radius: 16px;
	border: 1px solid $border;
	box-shadow: $shadow;
	padding: 14px 16px;

	display: flex;
	flex-direction: column;
	overflow: hidden;
	min-width: 0;
}

/* ====== EDITOR ====== */

.editor{
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 12px;
	min-height: 0;
	overflow: hidden;
}

.editor-header{
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.editor-title{
	color: $primary;
	font-weight: 800;
	letter-spacing: .2px;
}

.top-grid{
	display: grid;
	grid-template-columns: 1fr 260px;
	gap: 12px;
	align-items: start;
}

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
}

.thumb-box img{
	width: 100%;
	height: 100%;
	object-fit: contain;
	background: #999;
}

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

/* ====== POST LIST ====== */

.post-row{
	padding: 8px 10px;
	border-radius: 12px;
	border: 1px solid $border;
	background: #fff;
	cursor: pointer;
	transition: .15s;
}

.post-row:hover{
	border-color: $primary;
}

.post-row.active{
	border-color: $primary;
	box-shadow: 0 0 0 3px rgba($primary, .12);
}

/* ====== EDITOR BODY ====== */

.editor-body{
	flex: 1;
	min-height: 0;
	overflow: hidden;
}

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
	}
}

/* ====== TABS ====== */

.tabs{
	display: flex;
	gap: 8px;
}

.tab{
	padding: 6px 10px;
	border-radius: 10px;
	border: 1px solid $border;
	cursor: pointer;
	font-size: 13px;
}

.tab.active{
	border-color: $secondary;
	color: $secondary;
	box-shadow: 0 0 0 3px rgba($secondary, .12);
}

/* ====== ASSETS PANEL ====== */

.assets{
	flex: 0 0 320px;
	overflow: hidden;
}

.assets-top{
	display: grid;
	grid-template-columns: auto 1fr auto 1fr;
	gap: 8px;
	align-items: center;
	margin-bottom: 10px;
}

.assets-list{
	flex: 1;
	overflow: auto;
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
	gap: 10px;
	padding-right: 4px;
}

/* ====== MOBILE ====== */

@media (max-width: 1100px){
	.grid{
		grid-template-columns: 1fr;
	}

	.left{
		height: 260px;
	}

	.assets{
		flex: 0 0 280px;
	}

	.top-grid{
		grid-template-columns: 1fr;
	}
}
</style>
