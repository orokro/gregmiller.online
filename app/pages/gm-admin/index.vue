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
		<div class="row">
			<h1>Hello, admin.</h1>

			<button type="button" class="btn" @click="logout">
				Log out
			</button>
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

.row{
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;
}

h1{
	margin: 0;
	font-size: 18px;
}

.btn{
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
