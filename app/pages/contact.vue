<!--
	contact.vue
	-----------

	The contact page.
-->
<script setup>

// vue
import { ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import SocialIcon from '../components/SocialIcon.vue';
import IcoFacebook from '../components/Social_Icons/IcoFacebook.vue';
import IcoFlickr from '../components/Social_Icons/IcoFlickr.vue';
import IcoGithub from '../components/Social_Icons/IcoGithub.vue';
import IcoInstagram from '../components/Social_Icons/IcoInstagram.vue';
import IcoLinkedIn from '../components/Social_Icons/IcoLinkedIn.vue';
import IcoX from '../components/Social_Icons/IcoX.vue';
import IcoYouTube from '../components/Social_Icons/IcoYouTube.vue';
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';

// our tawk.to script
const src = 'https://embed.tawk.to/696897a9726a11197a5f8a3a/1jf090s2n'


const config = useRuntimeConfig()

if (process.server) {
	console.log('SSR ENV TEST:', config.message, config.flickrApiKey);
}

/**
 * Dynamically injects the Tawk.to script into the page if it hasn't been loaded already.
 * This allows us to load the live chat widget only on the contact page, rather than site-wide.
 */
function ensureTawkLoaded() {

	if (document.querySelector(`script[src="${src}"]`))
		return;

	window.Tawk_API = window.Tawk_API || {};
	window.Tawk_LoadStart = new Date();

	const s1 = document.createElement('script')
	s1.async = true;
	s1.src = src;
	s1.charset = 'UTF-8';
	s1.setAttribute('crossorigin', '*');

	document.head.appendChild(s1);
}


/**
 * Shows the Tawk widget if it's loaded, otherwise does nothing.
 */
function showTawk() {
	if (window.Tawk_API?.showWidget)
		window.Tawk_API.showWidget();
}


/**
 * Hides the Tawk widget if it's loaded, otherwise does nothing.
 */
function hideTawk() {
	if (window.Tawk_API?.hideWidget)
		window.Tawk_API.hideWidget();
}

let searchTimer = null;
const styleBlockId = 'dynamic-widget-mover-style';

const findAndStyleWidget = () => {

	// Set to true to enable detailed logs
	const showLogs = false;

    // Debug: Announce we are searching
    if(showLogs)
		console.log('🔍 Searching for .widget-visible...');

    const widget = document.querySelector('.widget-visible');

    // 1. If not found, queue retry
    if (!widget) {
        // Stop recursion if it takes too long (optional safety) or just keep going
        searchTimer = setTimeout(findAndStyleWidget, 500);
        return;
    }

    if(showLogs)
		console.log('✅ Widget found:', widget);

    // 2. Ensure ID exists
    if (!widget.id) {
        widget.id = 'moved-widget-fallback-id';
        if(showLogs)
			console.log('⚠️ Widget had no ID, assigned:', widget.id);
    }

    // 3. Check for existing style block
    if (document.getElementById(styleBlockId)) {
        if(showLogs)
			console.log('ℹ️ Style block already exists. Skipping injection.');
        return;
    }

    // 4. Create and inject
    try {
        const style = document.createElement('style');
        style.id = styleBlockId;
        style.type = 'text/css'; // Explicit type sometimes helps older parsers

        const cssRule = `

			#${widget.id} {
				transform: translate(11px, -50px) !important;
				transition: transform 0.3s ease-out !important;
			}

            @media (min-width: 900px) {

                #${widget.id} {
                    transform: translate(0px, 0px) !important;
                }
            }
        `;

        style.textContent = cssRule;

        // Try Head first, fallback to Body
        if (document.head) {
            document.head.appendChild(style);
            if(showLogs)
				console.log('🎉 Style injected into HEAD:', cssRule);
        } else {
            document.body.appendChild(style);
            if(showLogs)
				console.log('🎉 Style injected into BODY (Head missing?):', cssRule);
        }

    } catch (err) {
       	if(showLogs)
			console.error('❌ Error injecting style:', err);
    }
};


// make sure the widget is loaded and shown when this page is visited
onMounted(() => {

	ensureTawkLoaded();

	findAndStyleWidget();

	// If it's already loaded, show immediately
	showTawk();

	// If it isn't loaded yet, show when it finishes loading
	window.Tawk_API = window.Tawk_API || {};
	window.Tawk_API.onLoad = () => {
		showTawk();
	};
});


onUnmounted(() => {
	if (searchTimer) {
		clearTimeout(searchTimer);
	}
});


// hide widget when user navigates away from (SPA) page
onBeforeUnmount(() => {
	hideTawk();
});

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Contact" :scale="0.70" :x-offset="20" fallback-image="img/2D_headers/H_CONTACT.png" />
		</div>
	</div>

	<div class="static-page smaller">

		<Container3D>
			<h1><span>Contact</span></h1>
			<div class="white-box">

				<!-- Modern Grid Layout -->
				<div class="contact-grid">

					<div class="label">Call:</div>
					<div class="value">(4ዐ𝟪) 𝟪ᒿ੧-ዐl𝟪б</div>

					<div class="label">Email:</div>
					<div class="value">hypurban86@gmail.com</div>

					<div class="label">Secondary Email:</div>
					<div class="value">gmills4reals@gmail.com</div>

					<div class="label">Chat:</div>
					<div class="value">Feel free to try the live chat widget<br/>in the bottom right corner of the page.</div>

				</div>

			</div>

		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1><span>Social</span></h1>
			<div class="white-box">
				<h3>I don't use social media much, but I have 'em:</h3>

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
		</Container3D>

		<Spacer3D/>

		<Container3D style="min-width: 330px;">

			<h1><span>Message Me</span></h1>
			<div class="white-box">
				<h3>Fill out the Google Form below, I usually reply same day, unless I'm asleep:</h3>
				<iframe
					src="https://docs.google.com/forms/d/e/1FAIpQLScl5Lx-XE2I5RhySzULXCHk0zCcYd-vaLzFBsFDcyW_urrJDQ/viewform?embedded=true"
					width="100%"
					height="900"
					frameborder="0"
					marginheight="0"
					marginwidth="0"
					style="margin-top:10px; position: relative; left: -5px;">
						Loading...
				</iframe>
			</div>
		</Container3D>

	</div>

</template>
<style lang="scss" scoped>

// Responsive Contact Grid
.contact-grid {

	// box settings
	width: 100%;

	// layout
	display: grid;
	grid-template-columns: max-content 1fr;
	gap: 1rem 2rem;
	align-items: baseline;

	// text settings
	text-align: left;
	color: var(--color-text);

	// labels for items in grid
	.label {
		font-weight: bold;
		text-align: right;
	}

	// content
	.value {
		text-align: left;

		// Prevent overflow
		word-break: break-word;

		// Allow flex/grid item to shrink below content size
		min-width: 0;
	}

	// Stack columns on small screens
	@media (max-width: 550px) {
		grid-template-columns: 1fr;
		gap: 0.5rem;

		.label {
			text-align: left;
			margin-top: 1rem;

			// Remove top margin for the first item
			&:first-child {
				margin-top: 0;
			}
		}

		.value {
			margin-bottom: 0.5rem;
		}

	}// @media (max-width: 550px)
}// .contact-grid

// list of social media icons
.icon-list {

	// flex row
	display: flex;
	flex-wrap: wrap;
	gap: 20px;
	justify-content: center;

	&:deep {

		// since I'm re-using the SocialIcon component,
		// I'll just adjust a couple of the inner styles manually here
		.icon-row {
			width: 75px;
			height: 75px;

			.icon {
				left: 9px;
				width: 80px;
				height: 80px;
			}
		}// :deep .icon-row

	}// :deep .icon-row

}// .icon-list

</style>
