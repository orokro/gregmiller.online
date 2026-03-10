<!--
	AssetBrowser.vue
	----------------

	Admin component for browsing and selecting assets

	Uses VueFinder to provide a full-featured file browser interface, with a custom context menu item for moving files to a new location.
-->
<script setup>

// imports
import { RemoteDriver, contextMenuItems } from 'vuefinder';
import { onMounted, onBeforeUnmount } from 'vue';

// components
import PanelTitleBar from './PanelTitleBar.vue';
import AssetDestinationPickerModal from './AssetDestinationPickerModal.vue';

// custom move modal implementation vars
const moveModalOpen = ref(false);
const moveStartPath = ref('local://');
const itemsToMove = ref([]);
const rootRef = ref(null);
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

// define a custom context menu item for "Move to…"
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


/**
 * Refresh the asset list
 */
function refreshAssets() {

	if (vfInstance) {
		vfInstance.adapter.invalidateListQuery(vfInstance.fs.path.get().path);
		vfInstance.adapter.open(vfInstance.fs.path.get().path);
	}
}


/**
 * Handle when the move modal picks a destination
 *
 * @param {string} destination - destination path
 */
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


/**
 * Handle dragstart events within the asset browser
 *
 * @param {DragEvent} e - drag event
 */
function handleDragStart(e) {

	let target = e.target;
	let path = null;

	// Check if target has data-key (VueFinder items usually do)
	if (target.dataset?.key) {

		path = target.dataset.key;

	} else if (target.closest) {

		// Try to find ancestor with data-key
		const item = target.closest('[data-key]');
		if (item) {
			path = item.dataset.key;
		}
	}

	if (path) {
		if (path.startsWith('local://')) {
			const relPath = path.replace(/^local:\/\//, '');
			const finalUrl = 'wp-content/' + relPath;

			e.dataTransfer.setData('text/plain', finalUrl);
			e.dataTransfer.setData('application/x-gm-asset', finalUrl);
			e.dataTransfer.effectAllowed = 'copy';
			e.stopPropagation();
			return;
		}
	}
}

// setup dragstart listener
onMounted(() => {
	if (rootRef.value) {
		rootRef.value.addEventListener('dragstart', handleDragStart, true);
	}
});


// cleanup listener
onBeforeUnmount(() => {
	if (rootRef.value) {
		rootRef.value.removeEventListener('dragstart', handleDragStart, true);
	}
});


// provide refreshAssets method to parent components
defineExpose({
	refreshAssets,
});

</script>
<template>

	<div class="asset-manager" ref="rootRef">

		<PanelTitleBar>Asset Browser</PanelTitleBar>

		<!-- use our vue-finder library to provide a full-featured file browser interface -->
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
				statusbar: false,
			}"
		/>

		<!-- modal for picking a destination when moving files -->
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

	// main outer-wrapper
	.asset-manager{

		// box model and sizing
		height: 100%;
		min-height: 0;
		padding-left: 3px;

		// layout
		display: flex;
		flex-direction: column;

		// Make VueFinder fill the remaining space
		:deep(#gm_asset_manager) {
			flex: 1;
			min-height: 0;
			height: 100% !important; // Force it to respect flex container

			.vf-main {
				height: 100%; // Ensure internal container fills
			}// .vf-main

		}// :deep(#gm_asset_manager)

	}// .asset-manager

	// prevent dragging of images from the asset browser (since we handle it with custom logic)
	// and the browsers default drag is to move the image file itself, which is not what we want
	:deep(.vf-item img),
	:deep(img){
		-webkit-user-drag: none;
		user-select: none;
	}// :deep(.vf-item img), :deep(img)

</style>
