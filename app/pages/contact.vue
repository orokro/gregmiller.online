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
		<DynamicText3D text="Contact" :scale="0.70" :x-offset="20" />
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Contact</span></h1>
			<div class="white-box">

				<!-- note: I copied and pasted this from my 2010 site, lol, still uses tables.
					welp, they do work in 2026, so yolo -->
				<table class="contactDetails" width="100%" border="0" cellspacing="0" cellpadding="5">
					<tr>
						<td height="24" align="right" valign="top"><strong>Call:</strong></td>
						<td valign="top" class="contactTD">(4ዐ𝟪) 𝟪ᒿ੧-ዐl𝟪б</td>
					</tr>
					<tr>
						<td height="22" align="right" valign="top"><strong>Email:</strong></td>
						<td valign="top" class="contactTD">hypurban86@gmail.com</td>
					</tr>
					<tr>
						<td align="right" valign="top"><strong>Secondary Email:</strong></td>
						<td valign="top" class="contactTD">gmills4reals@gmail.com</td>
					</tr>
					<tr>
						<td align="right" valign="top"><strong>Chat:</strong></td>
						<td valign="top" class="contactTD">Feel free to try the live chat widget<br/>in the bottom right corner of the page.</td>
					</tr>
				</table>

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

h1 {
	padding-top: 15px;
	margin-bottom: 15px;

	color: var(--color-secondary);
	span {
		display: inline-block;
		padding: 0em 1em;
		background: rgba(255, 255, 255, 0.8);
		border-radius: 40px;

		// inset border
		// box-shadow: inset 0 0 0 1px #ddd;
	}// span

}// h1

h3 {
	margin-bottom: 2rem;
	color: var(--color-secondary);

}// h3


</style>
