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

<style lang="scss" scoped>
$primary: #00ABAE;
$secondary: #7561AA;

$text: #101828;
$muted: rgba(16, 24, 40, 0.62);

$border: rgba(16, 24, 40, 0.12);
$border2: rgba(16, 24, 40, 0.18);

$bg: #f6f8fb;
$card: #ffffff;

$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

.admin{
	background: $bg;
	color: $text;
	min-height: 100vh;
	padding: 16px;
}

.grid{
	display: grid;
	grid-template-columns: 340px 1fr;
	gap: 14px;
	align-items: start;
}

.card{
	background: $card;
	border: 1px solid $border;
	border-radius: 14px;
	padding: 12px;
	box-shadow: $shadow;
}

.left{
	position: sticky;
	top: 12px;
	align-self: start;
	height: calc(100vh - 24px);
	overflow: auto;
}

.row{
	display: flex;
	gap: 10px;
	align-items: center;

	&.wrap{
		flex-wrap: wrap;
	}
}

.input{
	width: 100%;
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid $border2;
	background: #fff;
	color: $text;
	outline: none;

	&:focus{
		border-color: rgba($primary, 0.55);
		box-shadow: 0 0 0 3px rgba($primary, 0.12);
	}
}

.btn{
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid $border2;
	background: #fff;
	color: $text;
	cursor: pointer;
	white-space: nowrap;

	&:hover{
		border-color: rgba($primary, 0.45);
	}

	&.primary{
		border-color: rgba($primary, 0.55);
		box-shadow: 0 0 0 3px rgba($primary, 0.10);
	}

	&.danger{
		border-color: rgba(220, 38, 38, 0.35);
		color: #b42318;
	}
}

.title{
	margin: 0;
	font-size: 18px;
	color: $primary;
	letter-spacing: 0.2px;
}

.subtitle{
	margin: 0;
	font-size: 14px;
	color: $secondary;
}

.header-row{
	display: flex;
	justify-content: space-between;
	align-items: baseline;
	gap: 10px;
	padding: 6px 4px 10px 4px;
	border-bottom: 1px solid $border;
	margin-bottom: 10px;
}

.hint{
	text-align: right;
}

.list{
	margin-top: 12px;
	display: grid;
	gap: 8px;
}

.list-item{
	text-align: left;
	border: 1px solid $border;
	background: #fff;
	color: $text;
	border-radius: 12px;
	padding: 10px;
	cursor: pointer;

	&:hover{
		border-color: rgba($primary, 0.45);
	}

	&.active{
		border-color: rgba($primary, 0.65);
		box-shadow: 0 0 0 3px rgba($primary, 0.10);
	}
}

.li-title{
	font-weight: 700;
	margin-bottom: 6px;
}

.li-meta{
	display: flex;
	gap: 8px;
	align-items: center;
}

.pill{
	display: inline-block;
	padding: 2px 8px;
	border-radius: 999px;
	border: 1px solid $border2;
	font-size: 12px;
	color: $text;

	&.dir{
		border-color: rgba($secondary, 0.35);
		color: $secondary;
	}
}

.muted{
	color: $muted;
	font-size: 12px;
}

.empty{
	padding: 10px;
	border: 1px dashed $border2;
	border-radius: 12px;
	color: $muted;
	text-align: center;
}

.notice{
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid $border;
	margin: 10px 0;

	&.error{
		border-color: rgba(220, 38, 38, 0.28);
		background: rgba(220, 38, 38, 0.06);
		color: #7a271a;
	}

	&.ok{
		border-color: rgba($primary, 0.30);
		background: rgba($primary, 0.06);
		color: $text;
	}
}

.status{
	padding: 12px 6px;
	color: $muted;
}

.editor{
	display: grid;
	gap: 12px;
}

.top-grid{
	display: grid;
	grid-template-columns: 1fr 240px;
	gap: 12px;
	align-items: start;
}

.fields{
	display: grid;
	gap: 10px;
}

.field{
	display: grid;
	gap: 6px;
}

.label{
	font-size: 12px;
	color: $muted;
}

.dirty{
	color: $secondary;
	font-weight: 600;
}

.thumb{
	display: grid;
	gap: 10px;
}

.thumb-label{
	font-size: 12px;
	color: $muted;
}

.thumb-box{
	width: 240px;
	height: 240px;
	border-radius: 14px;
	border: 1px dashed rgba($primary, 0.55);
	background: #fff;
	color: $text;
	cursor: pointer;
	display: grid;
	place-items: center;
	overflow: hidden;
	padding: 0;

	&:hover{
		box-shadow: 0 0 0 3px rgba($primary, 0.10);
	}
}

.thumb-box img{
	width: 100%;
	height: 100%;
	object-fit: cover;
	display: block;
}

.thumb-placeholder{
	color: $muted;
}

.thumb-path{
	word-break: break-all;
}

.tabs{
	display: flex;
	gap: 8px;
	margin-top: 6px;
}

.tab{
	padding: 8px 10px;
	border-radius: 12px;
	border: 1px solid $border;
	background: #fff;
	color: $text;
	cursor: pointer;

	&.active{
		border-color: rgba($primary, 0.65);
		box-shadow: 0 0 0 3px rgba($primary, 0.10);
	}
}

.editor-body{
	min-height: 320px;
}

.textarea{
	width: 100%;
	min-height: 320px;
	resize: vertical;
	padding: 12px;
	border-radius: 12px;
	border: 1px solid $border2;
	background: #fff;
	color: $text;
	outline: none;
	font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;

	&:focus{
		border-color: rgba($primary, 0.55);
		box-shadow: 0 0 0 3px rgba($primary, 0.12);
	}
}

.assets{
	margin-top: 14px;
}

.assets-head{
	display: flex;
	align-items: baseline;
	justify-content: space-between;
	gap: 10px;
	padding: 6px 4px 10px 4px;
	border-bottom: 1px solid $border;
	margin-bottom: 10px;

	code{
		background: rgba($secondary, 0.08);
		border: 1px solid rgba($secondary, 0.14);
		padding: 2px 6px;
		border-radius: 8px;
	}
}

.assets-top{
	display: grid;
	gap: 10px;
	margin-bottom: 10px;
}

.assets-list{
	display: grid;
	gap: 8px;
	max-height: 320px;
	overflow: auto;
	border-radius: 12px;
}

.asset-item{
	text-align: left;
	border: 1px solid $border;
	background: #fff;
	color: $text;
	border-radius: 12px;
	padding: 10px;
	cursor: pointer;

	&:hover{
		border-color: rgba($secondary, 0.45);
	}
}

.asset-name{
	display: flex;
	gap: 10px;
	align-items: center;
	margin-bottom: 6px;
}

.asset-meta{
	word-break: break-all;
}

.hidden{
	display: none;
}

@media (max-width: 1100px){
	.grid{
		grid-template-columns: 1fr;
	}
	.left{
		position: relative;
		height: auto;
	}
	.top-grid{
		grid-template-columns: 1fr;
	}
	.thumb-box{
		width: 100%;
		height: 220px;
	}
}
</style>
