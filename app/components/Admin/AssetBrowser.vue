<!--
	AssetBrowser.vue
	----------------

	Admin component for browsing and selecting assets
-->
<script setup>

// imports
import { RemoteDriver, contextMenuItems } from 'vuefinder';

// components
import PanelTitleBar from './PanelTitleBar.vue';
import AssetDestinationPickerModal from './AssetDestinationPickerModal.vue';

const moveModalOpen = ref(false);
const moveStartPath = ref('local://');
const itemsToMove = ref([]);
let vfInstance = null;

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

const myContextMenuItems = [
	...contextMenuItems,
	{
		id: 'move_to',
		title: () => 'Move to…',
		action: (vf, selection) => {
			vfInstance = vf;
			itemsToMove.value = selection;
			moveStartPath.value = vf.fs.path.get().path;
			moveModalOpen.value = true;
		},
		show: (vf, { items }) => {
			return items.length > 0;
		},
		order: 100,
	}
];

function refreshAssets() {
	if (vfInstance) {
		vfInstance.adapter.invalidateListQuery(vfInstance.fs.path.get().path);
		vfInstance.adapter.open(vfInstance.fs.path.get().path);
	}
}


async function onMovePicked(destination) {
	if (!itemsToMove.value.length)
		return;

	try {
		await $fetch('/api/admin/vuefinder/move', {
			method: 'POST',
			body: {
				path: vfInstance?.fs?.path?.get()?.path || 'local://',
				sources: itemsToMove.value.map(i => i.path),
				destination: destination,
			}
		});

		refreshAssets();
		moveModalOpen.value = false;
		itemsToMove.value = [];
	} catch (err) {
		console.error('Failed to move files:', err);
		alert('Failed to move files: ' + (err.data?.statusMessage || err.message));
	}
}


defineExpose({
	refreshAssets,
});

</script>
<template>

	<div class="asset-manager">

		<PanelTitleBar>Asset Browser</PanelTitleBar>
		<vue-finder
			id="gm_asset_manager"
			:driver="driver"
			:context-menu-items="myContextMenuItems"
			@ready="vfInstance = $event"
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
		padding-left: 3px;
	}

	:deep(.vf-item img),
	:deep(img){
		-webkit-user-drag: none;
		user-select: none;
	}

</style>
