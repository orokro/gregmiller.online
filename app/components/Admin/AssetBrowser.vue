<!--
	AssetBrowser.vue
	----------------

	Admin component for browsing and selecting assets
-->
<script setup>

// vue
import { ref, computed } from 'vue';

// components
import PanelTitleBar from './PanelTitleBar.vue';


// provide emits
const emit = defineEmits([]);


// refs
const assetsPath = ref('');
const assetsSearch = ref('');
const assets = ref([]);
const assetsLoading = ref(false);
const assetsInputEl = ref(null);


/**
 * Get the list of assets from the server
 */
const filteredAssets = computed(() => {

	const q = assetsSearch.value.trim().toLowerCase();
	if (!q)
		return assets.value;

	return assets.value.filter(it => String(it.name || '').toLowerCase().includes(q));
});


/**
 * Refresh the assets list from the server
 */
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


/**
 * Open file picker to upload assets
 */
function pickAssetsUpload() {

	if (!assetsInputEl.value)
		return;
	assetsInputEl.value.value = '';
	assetsInputEl.value.click();
}


/**
 * Handle when asset files are picked
 *
 * @param {Event} e - file input change event
 */
async function onAssetsPicked(e) {

	const files = Array.from(e.target.files || []);
	if (!files.length)
		return;

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


/**
 * Handle when an asset item is clicked
 *
 * @param it - clicked asset item
 */
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


// provide methods to parent
defineExpose({
	refreshAssets,
});

</script>
<template>

	<div class="card assets">

		<PanelTitleBar>Asset Browser</PanelTitleBar>

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
				class="asset-item btn"
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

</template>
<style lang="scss" scoped>

$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

/* ====== ASSETS PANEL ====== */
.assets{
	flex: 0 0 320px;
	overflow: hidden;

	.assets-top{
		padding: 10px;
		display: grid;
		grid-template-columns: auto 1fr auto 1fr;
		gap: 8px;
		align-items: center;
		margin-bottom: 10px;

	}// .assets-top

	.assets-list{
		flex: 1;
		overflow: auto;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
		padding-right: 4px;

	}// .assets-list

}// .assets

</style>
