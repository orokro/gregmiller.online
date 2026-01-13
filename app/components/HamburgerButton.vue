<!--
	HamburgerButton.vue
	-------------------

	The button to show when the screen is too narrow or on mobile
	to open the sidebar.
-->
<script setup>

// composables
import { useHamburger } from '../composables/useHamburger';
const { toggle } = useHamburger();

</script>
<template>

	<!-- Mobile hamburger (hidden on desktop via CSS) -->
	<button
		class="hamburger"
		type="button"
		aria-label="Open menu"
	>
		<!-- white button circle w/ hamburger lines -->
		<div class="button-inner" @click="toggle">
			<span class="bar"></span>
			<span class="bar"></span>
			<span class="bar"></span>
		</div>

	</button>

</template>
<style lang="scss" scoped>

	/* HAMBURGER
	---------
	Visible only on mobile.
	*/
	.hamburger {

		// fixed on bottom right, so it has easy access to the thumb on mobile devices
		position: fixed;
		bottom: 1px;
		right: 1px;
		z-index: 9001;

		// box styling
		width: 62px;
		height: 62px;
		background: #00ABAE;
		border-radius: 30px 0px 0px 0px;
		border: 4px solid #00ABAE;

		// animate in from bottom right corneer
		transform-origin: bottom right;
		transform: scale(1);
		transition: transform 0.3s ease;

		// the white circle with the hamburger lines
		.button-inner {

			// look clickable
			cursor: pointer;

			// fixed on top-left of th button
			position: absolute;
			top: 3px;
			left: 3px;

			// fixed size whitish circle
			width: 44px;
			height: 44px;
			border-radius: 100px;
			background: rgba(255, 255, 255, 0.92);

			// layout for the bars
			display: flex;
			flex-direction: column;
			justify-content: center;
			align-items: center;
			gap: 5px;

			// the bars themselves
			.bar {
				display: block;
				width: 18px;
				height: 3px;
				background: #00ABAE;
			}// .bar

			// light up on hover
			&:hover {
				background: white;
			}

		}// .button-inner

		@media (min-width: 900px) {
			transform: scale(0);
		}

	}// ..hamburger

</style>
