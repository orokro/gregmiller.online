<!--
	admin.vue
	---------

	Admin layout shell
-->
<script setup>

const route = useRoute();

const err = ref('');

const showLogout = computed(() => {
	return route.path !== '/gm-admin/login';
});

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

	<div class="admin-shell">

		<header class="admin-topbar">
			<div class="brand">
				<NuxtLink to="/gm-admin">GM Admin</NuxtLink>
			</div>

			<div class="actions">
				<button v-if="showLogout" type="button" class="btn" @click="logout">
					Log out
				</button>
			</div>
		</header>

		<main class="admin-main">
			<slot />
		</main>

		<p v-if="err" class="err">{{ err }}</p>

	</div>

</template>
<style scoped>

.admin-shell{
	min-height: 100vh;
	padding: 18px;
}

.admin-topbar{
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	margin-bottom: 18px;
	padding: 12px 14px;

	background: rgba(255,255,255,0.06);
	border: 1px solid rgba(255,255,255,0.10);
	border-radius: 14px;
}

.brand a{
	color: rgba(255,255,255,0.92);
	text-decoration: none;
	font-weight: 700;
}

.btn{
	padding: 10px 12px;
	border-radius: 10px;
	border: 0;
	background: rgba(255,255,255,0.16);
	color: rgba(255,255,255,0.92);
	cursor: pointer;
}

.admin-main{
	max-width: 900px;
}

.err{
	margin-top: 12px;
	opacity: 0.9;
}

</style>
