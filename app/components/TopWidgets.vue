<!--
	TopWidgets.vue
	--------------

	This will hold the theme selector & the social media icons
-->
<script setup>

// vue
import { ref, computed } from 'vue';

// app imports
import { useHamburger } from '../composables/useHamburger';
import { useTheming } from '../composables/useTheming';
import { useDeviceContext } from '../composables/useDeviceContext';

// components
import SocialIcon from './SocialIcon.vue';
import IcoFacebook from './Social_Icons/IcoFacebook.vue';
import IcoFlickr from './Social_Icons/IcoFlickr.vue';
import IcoGithub from './Social_Icons/IcoGithub.vue';
import IcoInstagram from './Social_Icons/IcoInstagram.vue';
import IcoLinkedIn from './Social_Icons/IcoLinkedIn.vue';
import IcoX from './Social_Icons/IcoX.vue';
import IcoYouTube from './Social_Icons/IcoYouTube.vue';

// composables
const { isOpen } = useHamburger();
const { currentTheme, themes, setTheme } = useTheming();
const { has3DCapability } = useDeviceContext();

const currentThemeName = computed({
	get() {
		return currentTheme.value ? currentTheme.value.name : '';
	},
	set(value) {
		setTheme(value);
	}
});
</script>
<template>

	<div
		class="top-widgets"
		:class="{
			'is-open': isOpen,
			'no-3d': !has3DCapability
		}"
	>

		<!-- horizontal box holds the theme selector & curve style element -->
		<div class="theme-selector">

			<!-- curve style element -->
			<div class="curve-style-tl"></div>

			<!-- sub container for widget -->
			<div class="theme-widget">

				<!-- the actual selector / label -->
				<label for="theme-select" class="visually-hidden">Select Theme:</label>
				<br/>
				<select
					name="theme"
					id="theme-select"
					v-model="currentThemeName"
				>
					<option
						v-for="theme in themes"
						:key="theme.name"
						:value="theme.name"
					>
						{{ theme.name }}
					</option>
				</select>

			</div>

		</div>

		<!-- vertical box holds the social media icons -->
		<div class="social-icons">

			<!-- curve style elements -->
			<div class="curve-style-tl"></div>
			<div class="curve-style-br"></div>

			<!-- box with icons -->
			<div class="icon-list">

				<SocialIcon title="GitHub" url="https://github.com/orokro" :icon="IcoGithub" />
				<SocialIcon title="LinkedIn" url="https://www.linkedin.com/in/greg-miller-91207558/" :icon="IcoLinkedIn" />
				<SocialIcon title="X" url="https://x.com/RlySrsBiz" :icon="IcoX" />
				<SocialIcon title="Flickr" url="https://www.flickr.com/photos/101073308@N06/" :icon="IcoFlickr" />
				<SocialIcon title="Instagram" url="https://www.instagram.com/hypurban" :icon="IcoInstagram" />
				<SocialIcon title="YouTube" url="https://www.youtube.com/@orokro_stuff/videos" :icon="IcoYouTube" />
				<SocialIcon title="Facebook" url="https://www.facebook.com/StuffGregBuilds" :icon="IcoFacebook" />
			</div>

		</div>

	</div>

</template>
<style lang="scss" scoped>

	// main widget wrapper
	.top-widgets {

		// no pointer events / text select
		pointer-events: none;
		user-select: none;

		// fixed on top right, above the canvas and below the sidebar
		position: fixed;
		top: 0px;
		right: 0px;
		z-index: 45;

		// box settings
		width: 155px;
		height: 400px;
		transform: translate(100%, 0%);

		// animate in/out
		transition: transform 0.3s ease;
		&.is-open {
			transform: translate(0%, 0%);
		}
		@media (min-width: 900px) {
			transform: translate(0%, 0%);
		}

		&.no-3d {
			transform: translate(100%, -60px);

			&.is-open {
				transform: translate(0%, -60px);
			}
			@media (min-width: 900px) {
				transform: translate(0%, -60px);
			}

			.social-icons {
				padding-top: 10px;
			}
		}

		// theme selector box
		.theme-selector {

			// allow pointer events for the widgets inside
			pointer-events: initial;

			// fixed on top
			position: absolute;
			top: 0px;
			right: 0px;

			// box settings
			height: 60px;
			width: 120px;
			background: var(--color-primary);

			// round bottom-left corner
			border-radius: 0px 0px 0px 15px;

			// the element  with the teal curve
			.curve-style-tl {

				// fixed to the left of the main row
				position: absolute;
				left: -36px;
				width: 40px;
				height: 40px;

				// teal curve
				background-color: var(--color-primary);
				mask-size: cover;
				mask-image: url(data:image/png;base64,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);

			}// .curve-style-tl

			// box positioned above the curve, with the actual content
			.theme-widget {

				// position above the curve
				position: absolute;
				inset: 0px 3px 0px 5px;

				// text settings
				color: white;
				font-size: 1.2em;
				font-weight: bolder;
				letter-spacing: 2px;

				// move label down a bit
				label {

					position: relative;
					left: 6px;
					top: 2px;

				}// label

				// the actual select box
				select {

					// move it up a bit
					position: relative;
					top: 1px;

					// box styling
					width: 100%;
					height: 30px;
					padding: 0.1rem 0.25rem;

					// text styling
					color: var(--color-secondary);

					// border: 4px solid white;
					border: 1px solid var(--color-primary);
					border-radius: 10px;
					box-sizing: border-box;
					background: var(--color-bg-accent-2);
					box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);

				}// select

			}// .theme-widget

		}// .theme-selector

		// vertical stack of social media icons
		.social-icons {

			// allow pointer events for the widgets inside
			pointer-events: initial;

			// fixed on top
			position: absolute;
			top: 58px;
			right: 0px;

			// box settings
			width: 50px;
			background: var(--color-primary);

			// round bottom-left corner
			border-radius: 0px 0px 0px 15px;

			// the elements with the teal curves
			.curve-style-tl,
			.curve-style-br {

				// fixed to the left of the main row
				position: absolute;
				top: -2px;
				left: -37px;
				width: 40px;
				height: 40px;

				// teal curve
				background-color: var(--color-primary);
				mask-size: cover;
				mask-image: url(data:image/png;base64,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);

			}// .curve-style-tl, .curve-style-br

			// just the bottom curve, positioned at the bottom of the box
			.curve-style-br {

				// reset top and left, and position at the bottom
				top: initial;
				left: initial;

				// position at the bottom right
				bottom: -28px;
				right: 2px;

				// smaller size looks better
				width: 30px;
				height: 30px;

			}// .curve-style-br

			// container of social icons
			.icon-list {

				// box settings
				background: #EFF4F7;
				border-radius: 10px;
				overflow: clip;

				// add spacing
				margin: 0px 5px 5px 5px;

			}// .icon list

		}// .social-icons

	}// theme selector box

</style>
