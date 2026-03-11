<!--
	contact.vue
	-----------

	The contact page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

</script>
<template>

	<div class="static-page">
		<h1>{{ $route.path }}</h1>
		<p>🚧 Migration in progress. Content coming soon.</p>
		<p v-if="$route.hash">Anchor requested: {{ $route.hash }}</p>
	</div>

</template>
<style scoped>

</style>
