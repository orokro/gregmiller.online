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
		<!-- curve style elements -->
		<div class="curve-style-tr"></div>
		<div class="curve-style-bl"></div>

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
		background: var(--color-primary);
		border-radius: 30px 0px 0px 0px;
		border: 4px solid var(--color-primary);

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
				background: var(--color-primary);
			}// .bar

			// light up on hover
			&:hover {
				background: white;
			}

		}// .button-inner

		@media (min-width: 900px) {
			transform: scale(0);
		}

		// the elements with the teal curves
		.curve-style-tr,
		.curve-style-bl {

			// fixed to the left of the main row
			position: absolute;
			top: -38px;
			right: -4px;
			width: 40px;
			height: 40px;

			// teal curve
			background-color: var(--color-primary);
			mask-size: cover;
			mask-image: url(data:image/png;base64,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);

		}// .curve-style-tl, .curve-style-br

		// just the bottom curve, positioned at the bottom of the box
		.curve-style-bl {

			// reset top and left, and position at the bottom
			top: initial;
			right: initial;

			// position at the bottom right
			bottom: -3px;
			left: -33px;

			// smaller size looks better
			width: 30px;
			height: 30px;

		}// .curve-style-br

	}// .hamburger

</style>
