<!--
	AssetBrowser.vue
	----------------

	Admin component for browsing and selecting assets
-->
<script setup>

// imports
import { RemoteDriver } from 'vuefinder';

// components
import PanelTitleBar from './PanelTitleBar.vue';
import AssetDestinationPickerModal from './AssetDestinationPickerModal.vue';


// provide emits
const emit = defineEmits([ 'pick' ]);

// build our VueFinder remote driver
const driver = new RemoteDriver({
	baseURL: '/api/admin/vuefinder',
	url: {
		list: '/',
		upload: '/upload',
		delete: '/delete',
		rename: '/rename',
		createFolder: '/create-folder',
		preview: '/preview',
		download: '/download',
		move: '/move',
		copy: '/copy',
		search: '/search',
	},
});

const vfRef = ref(null);

const moveModalOpen = ref(false);
const moveSources = ref([]);
const moveStartPath = ref('local://');
const vfCurrentPath = ref('local://');
const moveApp = ref(null);
const vfApp = ref(null);
const vueFinderKey = ref(0);

function onVfPathChanged(p) {
	if (typeof p === 'string' && p)
		vfCurrentPath.value = p;
}

function openMoveModalFromSelection(app, selectedItems) {

	vfApp.value = app;

	const items = Array.isArray(selectedItems) ? selectedItems : [];
	if (!items.length)
		return;

	moveApp.value = app || null;
	moveSources.value = items.map(it => it.path).filter(Boolean);
	moveStartPath.value = vfCurrentPath.value || 'local://';
	moveModalOpen.value = true;
}

async function refreshAfterMove() {
	if (vfApp.value?.refresh) {
		await vfApp.value.refresh();
	}
}

const contextMenuItems = [
	{
		id: 'move-to',
		title: () => 'Move to…',
		action: (app, selectedItems) => openMoveModalFromSelection(app, selectedItems),
		show: () => true,
		order: 22,
	},
];

async function onMovePicked(destination) {

	const dest = String(destination || '').trim();
	if (!dest)
		return;

	await $fetch('/api/admin/vuefinder/move', {
		method: 'POST',
		body: {
			sources: moveSources.value,
			destination: dest,
			path: vfCurrentPath.value,
		},
		credentials: 'include',
	});

	await refreshAfterMove();
	// await refreshVueFinderSoft(moveApp.value);
}

async function refreshVueFinderSoft(appArg) {

	const app = appArg || null;

	// Try common patterns (depends on build)
	if (app?.refresh) {
		await app.refresh();
		return;
	}
	if (app?.open && vfCurrentPath.value) {
		await app.open(vfCurrentPath.value);
		return;
	}

	// Fallback: if you have vfRef, try that too
	if (vfRef.value?.refresh) {
		await vfRef.value.refresh();
	}
}


function handleFileDclick(e) {

	// VueFinder file object includes `path` like local://foo/bar.jpg
	// We also attached `url` in list response for convenience.
	const item = e?.item || null;
	if (!item) return;

	emit('pick', item);
}

function refreshAssets() {
	// vueFinderKey.value++;
}

function handlePathChange() {
	// always refetch directory contents on navigation
	refreshAssets();
}

defineExpose({
	refreshAssets,
});

</script>
<template>

	<div class="asset-manager">

		<PanelTitleBar>Asset Browser</PanelTitleBar>
		<vue-finder
			:key="vueFinderKey"
			id="gm_asset_manager"
			:driver="driver"
			:config="{
				initialPath: 'local://',
				persist: true,
				showMenuBar: false,
			}"
			:features="{
				preview: true,
				rename: true,
				upload: true,
				delete: true,
				newfolder: true,
				download: true,
				move: true,
				copy: true,
				paste: true,
				search: true,
				fullscreen: true,

				archive: false,
				unarchive: false,
				language: false,
				history: false,
				theme: false,
				pinned: false,
			}"
			:contextMenuItems="contextMenuItems"
			@file-dclick="handleFileDclick"
			@path-change="onVfPathChanged"
		/>

		<AssetDestinationPickerModal
			:show="moveModalOpen"
			:driver="driver"
			:startPath="moveStartPath"
			title="Move to…"
			@close="moveModalOpen = false"
			@picked="onMovePicked"
		/>
	</div>

</template>
<style scoped lang="scss">

	.asset-manager{
		height: 100%;
		min-height: 0;
	}

	:deep(.vf-item img),
	:deep(img){
		-webkit-user-drag: none;
		user-select: none;
	}

</style>
