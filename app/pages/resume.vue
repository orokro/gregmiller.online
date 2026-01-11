<!--
	resume.vue
	----------

	The resume page. This is a placeholder while I migrate content from the old site.
-->
<template>

	<div class="static-page">
		<h1>{{ $route.path }}</h1>
		<p>🚧 Migration in progress. Content coming soon.</p>
		<p v-if="$route.hash">Anchor requested: {{ $route.hash }}</p>
	</div>

</template>
<style scoped>

.static-page {
	padding: 4rem;
	text-align: center;
	font-family: sans-serif;
}

</style>
