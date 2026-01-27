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


// provide emits
const emit = defineEmits([ 'pick' ]);

// build our VueFinder remote driver
const driver = new RemoteDriver({
	baseURL: '/api/admin/vuefinder',
});

const vueFinderKey = ref(0);

function handleFileDclick(e) {

	// VueFinder file object includes `path` like local://foo/bar.jpg
	// We also attached `url` in list response for convenience.
	const item = e?.item || null;
	if (!item) return;

	emit('pick', item);
}

function refreshAssets() {
	vueFinderKey.value++;
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
			}"
			@file-dclick="handleFileDclick"
		/>

	</div>

</template>
<style scoped lang="scss">

	.asset-manager{
		height: 100%;
		min-height: 0;
	}

</style>
