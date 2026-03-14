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
let modalObserver = null;

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

			// Set the data for the editor
			e.dataTransfer.setData('text/plain', finalUrl);
			e.dataTransfer.setData('application/x-gm-asset', finalUrl);
			e.dataTransfer.effectAllowed = 'copy';

			// CRITICAL: For massive images (like 155MP), the browser might freeze or abort
			// the drag if it tries to generate a ghost image of the source.
			// We force a tiny, transparent ghost image to avoid this.
			try {
				const img = new Image();
				// 1x1 transparent pixel
				img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
				e.dataTransfer.setDragImage(img, 0, 0);
			} catch (err) {
				// fallback if setDragImage fails
			}

			e.stopPropagation();
			return;
		}
	}
}

// setup dragstart listener and modal observer
onMounted(() => {
	if (rootRef.value) {
		rootRef.value.addEventListener('dragstart', handleDragStart, true);
	}

	// Watch for VueFinder modals (Rename, New Folder, etc.) and auto-focus/select the input
	modalObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node.nodeType === 1) { // ELEMENT_NODE
					
					// Look for the input. It might be the node itself or a child.
					const input = node.matches?.('input') ? node : node.querySelector?.('input');

					if (input) {
						// Heuristic check: is this a VueFinder modal? 
						// We check for common VueFinder classes or container IDs.
						const isVF = node.closest?.('.vf-main-container') || 
									node.closest?.('.vf-modal') ||
									node.querySelector?.('.vf-modal') ||
									node.classList?.contains('vf-modal') ||
									document.querySelector('.vf-modal'); // Fallback to global check if modal just appeared

						if (isVF) {
							// Vue and the browser need a moment to settle before focus/select works reliably
							setTimeout(() => {
								input.focus();
								if (typeof input.select === 'function') {
									input.select();
								}
							}, 100);
						}
					}
				}
			}
		}
	});

	modalObserver.observe(document.body, { childList: true, subtree: true });
});


// cleanup listener and observer
onBeforeUnmount(() => {
	if (rootRef.value) {
		rootRef.value.removeEventListener('dragstart', handleDragStart, true);
	}

	if (modalObserver) {
		modalObserver.disconnect();
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
				maxFileSize: '100mb',
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
	:deep(.vf-item svg),
	:deep(.vf-item i),
	:deep(img){
		-webkit-user-drag: none;
		user-select: none;
		pointer-events: none; // make it transparent to clicks so the parent item gets them
	}// :deep(.vf-item img), ...

</style>
