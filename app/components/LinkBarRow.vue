<!--
	LinkBarRow.vue
	--------------

	A row in the side column for a link
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

// Emits
const emits = defineEmits(['close']);

function close() {
	emits('close');
}


</script>
<template>

	<NuxtLink :to="url" @click="close">

		<div class="link-row">

			<!-- animated bg pattern -->
			<div class="bg-pattern"></div>

			<!-- our custom SVG Icon component -->
			<div class="icon">
				<component :is="icon" v-if="icon" />
			</div>

			<!-- the actual text for the link -->
			<div class="text">
				{{ title }}
			</div>

		</div>

	</NuxtLink>

</template>
<style lang="scss" scoped>

	// main outer wrapper for the link row
	.link-row {

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
			left: 0.75rem;
			top: 50%;
			transform: translateY(-50%);

			// box settings
			width: 35px;
			height: 35px;
			margin-right: 10px;
			display: flex;
			align-items: center;

			// make icon white by default
			&:deep {
				path, circle, rect, polygon {

					transition: fill 0.3s ease;
					fill: var(--color-secondary);
				}
			}

		}// .icon

		// the text for the link
		.text {

			// border: 1px solid red;

			// right of the icon, with some padding
			position: absolute;
			inset: 0px 0px 0px 60px;

			// spacing
			padding-top: 6px;

			// font settings
			font-size: 26px;
			font-weight: bold;
			color: var(--color-primary);
			letter-spacing: 1px;

			// animate color on hover
			transition: color 0.3s ease;

		}// .text

		// hover effect to show the bg pattern and change icon color
		&:hover {

			background: var(--color-secondary);

			.bg-pattern {
				opacity: 0.9;
				background-position-x: 140px;
			}

			.icon:deep {
				path, circle, rect, polygon {
					fill: var(--color-hover);
				}
			}

			.text {
				color: var(--color-hover);
				font-weight: bolder;
			}

		}// &:hover

	}// .link-row

</style>
