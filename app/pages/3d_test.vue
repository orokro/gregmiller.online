<!--
	3d_test.vue
	-----------

	A test page for 3D content. This is a placeholder while I experiment with 3D libraries and content.
-->
<script setup>


</script>
<template>

	<div class="static-page">
		<h1>{{ $route.path }}</h1>
		<p>🚧 3D test page. Content coming soon.</p>
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
