<!--
	contact.vue
	-----------

	The contact page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import Resume from '../components/Resume.vue';
import SkillIcon from '../components/SkillIcon.vue';
import SocialIcon from '../components/SocialIcon.vue';
import IcoFacebook from '../components/Social_Icons/IcoFacebook.vue';
import IcoFlickr from '../components/Social_Icons/IcoFlickr.vue';
import IcoGithub from '../components/Social_Icons/IcoGithub.vue';
import IcoInstagram from '../components/Social_Icons/IcoInstagram.vue';
import IcoLinkedIn from '../components/Social_Icons/IcoLinkedIn.vue';
import IcoX from '../components/Social_Icons/IcoX.vue';
import IcoYouTube from '../components/Social_Icons/IcoYouTube.vue';


// inject the Tawk.to live chat script when this page is mounted
onMounted(() => {
	const src = 'https://embed.tawk.to/696897a9726a11197a5f8a3a/1jf090s2n'

	// Prevent duplicates (HMR / navigation)
	if (document.querySelector(`script[src="${src}"]`)) return

	window.Tawk_API = window.Tawk_API || {}
	window.Tawk_LoadStart = new Date()

	const s1 = document.createElement('script')
	s1.async = true
	s1.src = src
	s1.charset = 'UTF-8'
	s1.setAttribute('crossorigin', '*')

	document.head.appendChild(s1)
});

</script>
<template>

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

		<Container3D>
			<h1><span>Message Me</span></h1>
			<div class="white-box">
				<h3>Fill out the Google Form below, I usually reply same day, unless I'm asleep:</h3>
				<iframe
					src="https://docs.google.com/forms/d/e/1FAIpQLScl5Lx-XE2I5RhySzULXCHk0zCcYd-vaLzFBsFDcyW_urrJDQ/viewform?embedded=true"
					width="626"
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

.static-page {

	padding: 4rem;
	text-align: center;
	font-family: sans-serif;

	// for debug
	// border: 1px solid red;


	.icon-list {

		// flex row
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		justify-content: center;

		&:deep {
			.icon-row {
				width: 75px;
				height: 75px;

				.icon {
					left: 9px;
					width: 80px;
					height: 80px;
				}
			}
		}
	}

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
		}
	}

	h3 {
		margin-bottom: 2rem;
		color: var(--color-secondary);
	}

	.white-box {
		background: rgba(255, 255, 255, 0.8);
		border-radius: 3px;
		padding: 2rem;
		box-shadow: 0 4px 12px rgba(0,0,0,0.1);

	}// .white-box

	.flex-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 30px;
		align-content: flex-start;
		overflow: visible;
	}

	.flex-grid > * {
		/* force consistent cell size */
		flex: 0 0 100px;   /* fixed column width */
		height: 100px;     /* fixed row height */
		display: grid;
		place-items: center;
	}

}// .static-page

</style>
