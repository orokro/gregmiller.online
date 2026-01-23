<!--
	admin.vue
	---------

	Admin layout shell
-->
<script setup>

definePageMeta({
	layout: 'admin',
	middleware: ['admin'],
});

const err = ref('');

async function logout() {
	err.value = '';

	try {
		await $fetch('/api/admin/logout', { method: 'POST' });
		await navigateTo('/gm-admin/login');
	} catch (e) {
		err.value = 'Logout failed';
	}
}

</script>
<template>

	<div class="card">
		<h1>Hello, admin.</h1>

		<div class="row">
			<button type="button" @click="logout">Logout</button>
		</div>

		<p v-if="err" class="err">{{ err }}</p>
	</div>

</template>
<style scoped>

.card{
	background: rgba(255,255,255,0.06);
	border: 1px solid rgba(255,255,255,0.10);
	border-radius: 14px;
	padding: 18px;
}

h1{
	margin: 0 0 14px 0;
	font-size: 18px;
}

.row{
	display: flex;
	gap: 10px;
}

button{
	padding: 10px 12px;
	border-radius: 10px;
	border: 0;
	background: rgba(255,255,255,0.16);
	color: rgba(255,255,255,0.92);
	cursor: pointer;
}

.err{
	margin-top: 12px;
	opacity: 0.9;
}

</style>
