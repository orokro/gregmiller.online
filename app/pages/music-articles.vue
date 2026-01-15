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

</script>
<template>

	<div class="static-page">

		<CategoryGrid category="Music Articles" title="Music Articles"/>
	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
