<!--
	SocialIcon.vue
	--------------

	One of the social media link icon buttons on the top right
-->
<script setup>

// Props
const props = defineProps({

	//  title text for the link
	title: String,

	// Component
	icon: {
		type: Object,
		default: null,
	},

	// url for the link
	url: String,
});

</script>
<template>

	<NuxtLink :to="url" target="_blank">

		<div
			class="icon-row"
			:title="title"
		>
			<!-- animated bg pattern -->
			<div class="bg-pattern"></div>

			<!-- our custom SVG Icon component -->
			<div class="icon">
				<component :is="icon" v-if="icon" />
			</div>

		</div>

	</NuxtLink>

</template>
<style lang="scss" scoped>

	// main outer wrapper for the link row
	.icon-row {

		// box settings
		background: var(--color-bg-accent-1);
		position: relative;
		height: 43px;

		// spacing
		margin-bottom: 2px;

		// animate background color
		transition: background 0.3s ease;

		// background pattern than fades in/out & animates a bit
		.bg-pattern {

			// fill our parent container
			position: absolute;
			inset: 0px 0px 0px 0px;

			// bg pattern mixed
			background-image: url('/img/link_bg_gray.png');
			mix-blend-mode: overlay;

			// animate opacity & position for a subtle moving effect
			transition: opacity 0.3s ease, background-position-x 0.3s ease;
			opacity: 0;
			background-position-x: 0px;

		}// .bg-pattern

		// our custom SVG
		.icon {

			// positioned absolutely to the left of the row, with some padding
			position: absolute;
			left: 2px;
			top: 50%;
			transform: translateY(-50%);

			// box settings
			width: 35px;
			height: 35px;
			margin-right: 10px;
			display: flex;
			align-items: center;

			// make icon white by default
			:deep(path), :deep(circle), :deep(rect), :deep(polygon) {
				transition: fill 0.3s ease;
				fill: var(--color-secondary);
			}

		}// .icon


		// hover effect to show the bg pattern and change icon color
		&:hover {

			background-color: var(--color-secondary);

			.bg-pattern {
				opacity: 0.9;
				background-position-x: 140px;
			}

			:deep(path), :deep(circle), :deep(rect), :deep(polygon) {
				fill: white;
			}

		}// &:hover

	}// .icon-row

</style>
