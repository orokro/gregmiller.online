<!--
	[tagged]/[slug].vue
	-------------------
-->
<script setup>

// vue
import { computed } from 'vue';

// components
import CategoryGrid from '../../components/CategoryGrid.vue';
import DynamicText3D from '../../app/components/Custom3D/DynamicText3D.vue';

// nuxt
const route = useRoute();
const slug = route.params.slug;

</script>
<template>

	<div align="center">
		<DynamicText3D text="Tag" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_OTHER.png" />
	</div>

	<div class="static-page">

		<CategoryGrid :title="`Posts tagged with '${slug}'`" :tag="slug" />

	</div>

</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;

}// .white-box

</style>
