<!--
	admin.vue
	---------

	Admin layout shell.

	This will be the root theme / styles for admin pages.

	This is used now that app.vue has the <NuxtLayout> wrapper.
-->
<script setup>

const route = useRoute();

const err = ref('');


/**
 * Whether to show the logout button
 */
const showLogout = computed(() => {
	return route.path !== '/gm-admin/login';
});


/**
 * Log out the current admin user
 */
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
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);

.admin-shell{

	// box settings
	height: 100vh;
	overflow: hidden;
	background: $bg;

	// text settings
	color: $text;

	// bar a long the top
	.topbar{

		// box settings
		height: 56px;
		padding: 0 16px;
		background: #fff;
		border-bottom: 3px solid $secondary;
		box-shadow: $shadow;

		// layout
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;

		// title link
		.brand-link{

			// text settings
			text-decoration: none;
			font-weight: 800;
			letter-spacing: 0.3px;
			color: $primary;

		}// .brand-link

		// just a container for action buttons
		.actions{

			// layout
			display: flex;
			gap: 10px;
			align-items: center;

			// buttons in the actions area
			.btn{

				// box settings
				padding: 8px 12px;
				border-radius: 12px;
				border: 1px solid rgba($primary, 0.35);
				background: #fff;

				// text settings
				color: $text;

				// look so clickable
				cursor: pointer;

				&:hover{
					box-shadow: 0 0 0 3px rgba($primary, 0.10);
				}

			}// .btn

		}// .actions

	}// .topbar


	// main content area
	.main{

		// box settings
		height: calc(100vh - 56px);
		overflow: hidden;
		padding: 14px 16px;

	}// .main

	// notification toast
	.toast{

		// position
		position: fixed;
		right: 16px;
		bottom: 16px;

		// box settings
		background: rgba(16, 24, 40, 0.90);
		padding: 10px 12px;
		border-radius: 12px;
		max-width: 360px;

		// text settings
		color: #fff;

	}// .toast

}// .admin-shell

</style>
