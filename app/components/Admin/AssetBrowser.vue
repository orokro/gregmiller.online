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

const moveModalOpen = ref(false);
const moveStartPath = ref('local://');

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

function refreshAssets() {

	// do nothing currently
}


async function onMovePicked(destination) {

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
	}

	:deep(.vf-item img),
	:deep(img){
		-webkit-user-drag: none;
		user-select: none;
	}

</style>
