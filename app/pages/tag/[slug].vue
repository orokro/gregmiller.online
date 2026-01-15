<!--
	tag/[slug].vue
	---------------
-->
<script setup>

// vue
import { computed } from 'vue';

// components
import CategoryGrid from '../../components/CategoryGrid.vue';

// nuxt
const route = useRoute();
const slug = route.params.slug;

</script>
<template>

	<div class="static-page">

		<CategoryGrid :title="`Posts tagged with '${slug}'`" :tag="slug" />

	</div>

</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;

}// .white-box

</style>
