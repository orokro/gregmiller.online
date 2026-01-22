<!--
	gm-admin.vue
	------------

	Admin page
-->
<script setup>

const password = ref('');
const err = ref('');

const { data: session, pending, refresh } = await useFetch('/api/admin/session');

async function login() {
	err.value = '';

	try {
		await $fetch('/api/admin/login', {
			method: 'POST',
			body: { password: password.value },
		});

		password.value = '';
		await refresh();
	} catch (e) {
		err.value = 'Login failed';
	}
}

async function logout() {
	err.value = '';

	try {
		await $fetch('/api/admin/logout', { method: 'POST' });
		await refresh();
	} catch (e) {
		err.value = 'Logout failed';
	}
}

</script>
<template>

	<div class="admin">
		<h1>GM Admin</h1>

		<div v-if="pending">Loading…</div>

		<div v-else>
			<div v-if="session?.authenticated">
				<p><strong>Hello, admin.</strong></p>

				<button type="button" @click="logout">Logout</button>
			</div>

			<form v-else @submit.prevent="login">
				<p>Please log in.</p>

				<input
					v-model="password"
					type="password"
					autocomplete="current-password"
					placeholder="Admin password"
				/>

				<button type="submit">Login</button>

				<p v-if="err" class="err">{{ err }}</p>
			</form>
		</div>
	</div>

</template>
<style scoped>

.admin{
	max-width: 640px;
	margin: 0 auto;
	padding: 24px;
}
.err{
	margin-top: 10px;
}
input{
	width: 100%;
	padding: 10px;
	margin: 10px 0;
}
button{
	padding: 10px 14px;
}

</style>
