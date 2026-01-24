<!--
	login.vue
	---------

	Admin login page
-->
<script setup>

definePageMeta({
	layout: 'admin',
	middleware: ['admin'],
});

// refs
const password = ref('');
const err = ref('');
const isSubmitting = ref(false);

/**
 * Handle the login form submission
 */
async function login() {

	err.value = '';
	isSubmitting.value = true;

	try {
		await $fetch('/api/admin/login', {
			method: 'POST',
			body: {
				password: password.value,
			},
		});

		password.value = '';
		await navigateTo('/gm-admin');

	} catch (e) {
		err.value = 'Login failed';

	} finally {
		isSubmitting.value = false;
	}
}

</script>
<template>

	<div class="card">

		<h1>Admin Login</h1>

		<form @submit.prevent="login">
			<label>
				<span>Password</span>
				<input
					v-model="password"
					type="password"
					autocomplete="current-password"
					placeholder="Admin password"
				/>
			</label>

			<button type="submit" :disabled="isSubmitting">
				{{ isSubmitting ? 'Logging in…' : 'Login' }}
			</button>

			<p v-if="err" class="err">{{ err }}</p>
		</form>

	</div>

</template>
<style lang="scss" scoped>

// main card
.card{

	// box settings
	background: rgba(255,255,255,0.06);
	border: 1px solid rgba(255,255,255,0.10);
	border-radius: 14px;
	padding: 18px;

	h1{
		margin: 0 0 14px 0;
		font-size: 18px;
	}

	label {

		span{
			display: block;
			margin-bottom: 6px;
			opacity: 0.9;

		}// span

	}// label

	input{

		// box settings
		width: 100%;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid rgba(255,255,255,0.16);
		background: rgba(0,0,0,0.25);
		outline: none;

		// text settings
		color: rgba(255,255,255,0.92);

	}// input

	// submit button
	button{

		// box settings
		margin-top: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 0;
		background: rgba(255,255,255,0.16);

		// text settings
		color: rgba(255,255,255,0.92);

		// look so clickable
		cursor: pointer;

		&:disabled{
			opacity: 0.6;
			cursor: default;

		}// &:disabled

	}// button

	// error message
	.err{

		margin-top: 12px;
		opacity: 0.9;
	}// .err

}// .card

</style>
