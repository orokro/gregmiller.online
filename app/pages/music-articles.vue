<!--
	music-articles.vue
	------------------

	Some various music-related articles that I wrote over the years. Some of these are pretty old and may be a bit cringe, but I thought it would be fun to share them anyway. Maybe one day I'll write some new ones that aren't as cringe, who knows!
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategoryGrid from '../components/CategoryGrid.vue';
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Music Articles" :scale="0.5" :x-offset="20" fallback-image="img/2D_headers/H_MUSICARTICLES.png" />
		</div>
	</div>

	<div class="static-page">

		<CategoryGrid category="Music Articles" title="Music Articles"/>
	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
