<!--
	LinkBarRow.vue
	--------------

	A row in the side column for a link
-->
<script setup>

// vue
import { euclideanModulo } from 'three/src/math/MathUtils';
import { ref } from 'vue';

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
		background: #E1EEF5;
		position: relative;
		height: 43px;

		margin-bottom: 2px;

		// background pattern than fades in/out & animates a bit
		.bg-pattern {

			// fill our parent container
			position: absolute;
			inset: 0px 0px 0px 0px;

			// bg pattern
			background-image: url('/img/link_bg.png');

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
				path {

					transition: fill 0.3s ease;
					fill: #7561AA;
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
			color: #00ABAE;

			// animate color on hover
			transition: color 0.3s ease;

		}// .text

		// hover effect to show the bg pattern and change icon color
		&:hover {

			.bg-pattern {
				opacity: 1;
				background-position-x: 140px;
			}

			.icon:deep path {
				fill: white;
			}

			.text {
				color: white;
				font-weight: bolder;
			}

		}// &:hover

	}// .link-row

</style>
