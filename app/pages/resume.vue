<template>
	<div class="static-page">
		<h1>{{ $route.path }}</h1>
		<p>🚧 Migration in progress. Content coming soon.</p>
		<p v-if="$route.hash">Anchor requested: {{ $route.hash }}</p>
	</div>
</template>

<style scoped>
.static-page { padding: 4rem; text-align: center; font-family: sans-serif; }
</style>
