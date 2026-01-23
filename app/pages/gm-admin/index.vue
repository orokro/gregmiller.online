<!--
	index.vue
	---------

	Admin landing page
-->
<script setup>

definePageMeta({
	layout: 'admin',
	middleware: [ 'admin' ],
});

</script>
<template>

	<div class="card">
		<h1>Hello, admin.</h1>
	</div>

</template>
<style scoped>

.card{
	background: rgba(255,255,255,0.06);
	border: 1px solid rgba(255,255,255,0.10);
	border-radius: 14px;
	padding: 18px;
}

</style>
