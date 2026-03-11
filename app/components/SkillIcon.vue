<!--
	SkillIcon.vue
	----------------------------

	Single icon rendered from a sprite-sheet (image map)
-->
<script setup>

// vue
import { computed } from "vue";

// Props
const props = defineProps({

	// source for CSS sprite sheet / image map
	src: {
		type: String,
		required: true,
	},

	// the x-position in the sprite sheet (in pixels)
	imageX: {
		type: [Number, String],
		default: 0,
	},

	// the y-position in the sprite sheet (in pixels)
	imageY: {
		type: [Number, String],
		default: 0,
	},

	// the size of the source tile in the sprite sheet (in pixels)
	sourceSize: {
		type: [Number, String],
		required: true,
	},

	// the rendered size of the component (in pixels)
	size: {
		type: [Number, String],
		default: 24,
	},

	// optional URL to link to when clicked
	link: {
		type: String,
		default: "",
	},

	// optional text for the popup that appears on hover
	text: {
		type: String,
		default: "",
	},

	// optional title for the popup (also used as alt text for accessibility)
	title: {
		type: String,
		default: "",
	},
});


/**
 * Computed to determine if we have any popup content to show. This controls whether the popup element is rendered at all.
 */
const hasPopup = computed(() => {
	return Boolean((props.text && String(props.text).trim()) || (props.title && String(props.title).trim()));
});


/**
 * Computed style object for the icon sprite. This sets the background image and positions it according to the props.
 */
const iconStyle = computed(() => {
	const s = Number(props.sourceSize) || 32;
	const x = Number(props.imageX) || 0;
	const y = Number(props.imageY) || 0;

	return {
		backgroundImage: `url("${props.src}")`,
		backgroundRepeat: "no-repeat",
		backgroundPosition: `-${x}px -${y}px`,
		backgroundSize: "auto",
		width: `${s}px`,
		height: `${s}px`,
	};
});

</script>
<template>

	<!-- main wrapper -->
	<div 
		class="skill-icon" 
		:style="{ 
			'--size': `${Number(size)}px`,
			'--source-size': Number(sourceSize)
		}"
	>

		<!-- if link enabled, generate the icon wrapped in an anchor -->
		<a
			v-if="link && String(link).trim().length"
			class="anchor"
			:href="link"
			target="_blank"
			rel="noopener noreferrer"
			:title="title"
		>
			<span class="sprite" :style="iconStyle" aria-hidden="true"></span>
		</a>

		<!-- if no link, generate the icon wrapped in a div -->
		<div
			v-else
			class="anchor"
			:title="title"
			role="img"
			:aria-label="title"
		>
			<span class="sprite" :style="iconStyle" aria-hidden="true"></span>
		</div>

		<!-- popup for bonus hover text -->
		<div v-if="hasPopup" class="popup" role="tooltip" aria-hidden="true">
			<div class="popup-title" v-if="title && String(title).trim().length">{{ title }}</div>
			<div class="popup-text" v-if="text && String(text).trim().length">{{ text }}</div>
		</div>
	</div>

</template>
<style lang="scss" scoped>

	// main component outer wrapper, sets size and stacking context for the popup
	.skill-icon {

		// keep popup visible (not clipped) and allow it to sit above others
		position: relative;
		display: inline-block;
		width: var(--size);
		height: var(--size);
		z-index: 0;

		// link style if present
		.anchor {
			display: block;
			width: 100%;
			height: 100%;
			text-decoration: none;
			transform: translateY(0) scale(1);
			transition:
				transform 120ms ease,
				filter 120ms ease;
			will-change: transform;

		}// .anchor

		// container used to show the correct portion of the sprite sheet, and to scale it up if needed
		.sprite {

			// scale the sprite-tile (sourceSize) to component size
			display: block;
			background-color: transparent;
			image-rendering: auto;

			// We scale the native-size sprite (defined in iconStyle computed) to match the container --size.
			transform: scale(calc(var(--size) / 1px / var(--source-size)));
			transform-origin: top left;

		}// .sprite

		&:hover {
			z-index: 10; // bring hovered icon above others to prevent popup clipping

			.anchor {
				transform: translateY(-3px) scale(1.08);
				filter: drop-shadow(0 6px 10px rgba(0, 0, 0, 0.25));
			}// .anchor

			.popup {
				opacity: 1;
				transform: translateX(-50%) translateY(0);
				transition-delay: 400ms;
			}// .popup

		}// &:hover

		// Popup: appears under the icon, delayed so quick mouse fly-overs don’t spam
		.popup {
			position: absolute;
			left: 50%;
			top: calc(100% + 10px);
			transform: translateX(-50%) translateY(-4px);

            // Responsive sizing:
            // near full screen on mobile, caps at reasonable mins/maxes on desktop
			width: 86vw;
			min-width: 0;
			max-width: 380px;

            @media (min-width: 600px) {
                width: auto;
                min-width: 340px;
                max-width: 640px;
            }

			z-index: 200;

			padding: 10px 12px;
			border-radius: 12px;

			background: rgba(20, 20, 24, 0.95);
			color: rgba(255, 255, 255, 0.92);
			box-shadow: 0 10px 24px rgba(0, 0, 0, 0.35);

			opacity: 0;
			pointer-events: none;

			transition:
				opacity 140ms ease,
				transform 140ms ease;
			transition-delay: 0ms;

			z-index: 50;

			// small arrow pointing to the icon, made with a pseudo element and clip-path
			&:before {
				content: "";
				position: absolute;
				left: 50%;
				top: -6px;
				transform: translateX(-50%);
				width: 12px;
				height: 12px;
				background: rgba(20, 20, 24, 0.95);
				clip-path: polygon(50% 0%, 0% 100%, 100% 100%);

			}// &:before

			// title of the popup, shown in bold above the text
			.popup-title {
				font-size: 13px;
				font-weight: 700;
				line-height: 1.1;
				margin-bottom: 6px;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;

			}// .popup-title

			// body of the popup, shown below the title in normal weight
			.popup-text {
				font-size: 12px;
				line-height: 1.35;
				opacity: 0.95;

			}// .popup-text

		}// popup

	}// .skill-icon

	// Accessibility: if user prefers reduced motion, remove the delays/animations
	@media (prefers-reduced-motion: reduce) {
		.anchor {
			transition: none;
		}
		.popup {
			transition: none;
			transition-delay: 0ms;
		}
	}

</style>
