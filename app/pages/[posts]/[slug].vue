<!--
	[month]/[year]/[slug].vue
	-------------------------

	This page displays a single post based on the year, month, and slug in the URL.
-->
<script setup>

// vue
import { computed } from 'vue';

// components
import PostView from '../../app/components/PostView.vue';

// nuxt
const route = useRoute();

</script>
<template>

	<div class="static-page">

		<PostView :slug="route.params.slug" />

	</div>

</template>
<style lang="scss" scoped>

</style>
