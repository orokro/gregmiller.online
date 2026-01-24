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
		await $fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
		await navigateTo('/gm-admin/login');
	} catch {
		err.value = 'Logout failed';
	}
}
</script>

<template>
	<div class="admin-shell">

		<header class="topbar">
			<div class="brand">
				<NuxtLink to="/gm-admin" class="brand-link">GM Admin</NuxtLink>
			</div>

			<div class="actions">
				<button v-if="showLogout" type="button" class="btn" @click="logout">
					Log out
				</button>
			</div>
		</header>

		<main class="main">
			<slot />
		</main>

		<div v-if="err" class="toast">
			{{ err }}
		</div>

	</div>
</template>

<style scoped lang="scss">
$primary: #00ABAE;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

.admin-shell{
	height: 100vh;
	overflow: hidden;
	background: $bg;
	color: $text;
}

.topbar{
	height: 56px;
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 12px;

	padding: 0 16px;

	background: #fff;
	border-bottom: 1px solid $border;
	box-shadow: $shadow;
}

.brand-link{
	text-decoration: none;
	font-weight: 800;
	letter-spacing: 0.3px;
	color: $primary;
}

.actions{
	display: flex;
	gap: 10px;
	align-items: center;
}

.btn{
	padding: 8px 12px;
	border-radius: 12px;
	border: 1px solid rgba($primary, 0.35);
	background: #fff;
	color: $text;
	cursor: pointer;

	&:hover{
		box-shadow: 0 0 0 3px rgba($primary, 0.10);
	}
}

.main{
	height: calc(100vh - 56px);
	overflow: hidden;
	padding: 14px 16px;
}

.toast{
	position: fixed;
	right: 16px;
	bottom: 16px;

	background: rgba(16, 24, 40, 0.90);
	color: #fff;

	padding: 10px 12px;
	border-radius: 12px;
	max-width: 360px;
}
</style>
