<!--
	resume.vue
	----------

	The resume page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import Resume from '../components/Resume.vue';
import SkillIcon from '../components/SkillIcon.vue';
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<DynamicText3D text="Resume" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_RESUME.png" />
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Resume</span></h1>
			<a href="/assets/Resume.Greg.Miller.pdf" target="_blank">
				<div class="dl-pdf" align="center">
					<div class="icon"></div>
					PDF
				</div>
			</a>
			<Resume />
		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1><span>Engineering Skills</span></h1>
			<div class="white-box">

				<h3>Hover over an icon to learn about my experience!</h3>
				<div class="flex-grid">

					<!-- dev icons -->
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="0"
						source-size="128"
						size="24"
						link="https://vuejs.org/"
						text="I Love, love, love VueJS. I used it extensively at Nike, and all my personal WebDev projects are built with VueJS. I have a lot of experience with it, and it's my go-to framework for WebDev."
						title="VUE"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="0"
						source-size="128"
						size="24"
						link="https://nuxt.com/"
						text="I love VueJS, so Nuxt is a natural extension of that. This site, gregmiller.only / gmiller.net are built in Nuxt."
						title="Nuxt"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="256"
						image-y="0"
						source-size="128"
						size="24"
						link="https://www.electronjs.org/"
						text="VueJS + Electron is my goto combo for desktop apps. I have used it in a professional capacity at Nike, and have built several personal projects with it as well. I have a lot of experience with it, and really enjoy it."
						title="ElectronJS"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="384"
						image-y="0"
						source-size="128"
						size="24"
						link="https://threejs.org/"
						text="I love ThreeJS, and have been using it professionally at AT&amp;T and Nike, and personally for a long time. I have a lot of experience with it, and really enjoy it."
						title="ThreeJS"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="512"
						image-y="0"
						source-size="128"
						size="24"
						link="https://nodejs.org/en"
						text="I have used NodeJS for all of my professional WebDev work since 2016, prior to that I used LAMP stack."
						title="NodeJS"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="640"
						image-y="0"
						source-size="128"
						size="24"
						link="https://en.wikipedia.org/wiki/JavaScript"
						text="While I enjoy C#, I haven't done much with TypeScript, that said I enjoy the vanilla JavaScript experience."
						title="JavaScript"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="128"
						source-size="128"
						size="24"
						link="https://en.wikipedia.org/wiki/HTML"
						text="Ah yes, HTML5, Macromedia Flash is almost fully replaced now ;)"
						title="HTML_5"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="128"
						source-size="128"
						size="24"
						link="https://en.wikipedia.org/wiki/CSS"
						text="CSS Only getting better &amp; Better. Prefer SASS syntax, but now that it's supported natively in new browsers, I'm happy to use it as well."
						title="CSS_3"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="256"
						image-y="128"
						source-size="128"
						size="24"
						link="https://react.dev/"
						text="My second choice after Vue, I have used React in a professional capacity at AT&amp;T (With Next.js), and to a lesser extent at Nike, but I prefer VueJS and Nuxt for WebDev work."
						title="React"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="384"
						image-y="128"
						source-size="128"
						size="24"
						link="https://www.mongodb.com/"
						text="My first Document database, which is now my go-to for WebDev work. I have used it in a professional capacity at AT&amp;T and Nike, as well as for personal projects, and I really enjoy it."
						title="MongoDB"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="512"
						image-y="128"
						source-size="128"
						size="24"
						link="https://www.json.org/json-en.html"
						text="Lol, I guess this is a tech Icon I should include."
						title="JSON"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="640"
						image-y="128"
						source-size="128"
						size="24"
						link="https://unity.com/"
						text="I love working in Unity, and made several games and VR experiences professionally, including at YouVisit, Unified Field, and AT&amp;T. However, I am out of practise and unfamiliar with some of the newer DOTS/ECS stuff, but I can hop back in and reactivate those neurons when needed."
						title="Unity"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="256"
						source-size="128"
						size="24"
						link="https://dotnet.microsoft.com/en-us/languages/csharp"
						text="My favorite typed language, and pairs perfectly with Unity. Some .NET experience as well, but I prefer to use C# in Unity, and NodeJS for WebDev work. One day I wish to learn GODOT with C#, but for now I have a lot of experience with C# in Unity, and I really enjoy it."
						title="CSharp"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="256"
						source-size="128"
						size="24"
						link="https://en.wikipedia.org/wiki/C_(programming_language)"
						text="From time to time I enjoy programming roms for retro consoles in C. Not rom-hacks, but scratch written roms for GameBoy/Color, GameGear, Master System, Sega Genesis, and others. Working on learning SNES development when I find time."
						title="C"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="256"
						image-y="256"
						source-size="128"
						size="24"
						link="https://en.wikipedia.org/wiki/C%2B%2B"
						text="While not my favorite langauge, I am looking forward to getting better at Unreal someday, and will probably prefer C++ oover blueprints, so I want to get more experience with it."
						title="Cpp"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="384"
						image-y="256"
						source-size="128"
						size="24"
						link="https://expressjs.com/"
						text="I have used expressJS in a professional capacity at AT&amp;T, and have built several personal projects with it as well."
						title="ExpressJS"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="512"
						image-y="256"
						source-size="128"
						size="24"
						link="https://sass-lang.com/"
						text="While now mostly deprecated due to modern / native CSS support, I have a lot of experience with SASS and still prefer it for larger projects, but I'm happy to use native CSS for smaller projects as well."
						title="SASS"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="640"
						image-y="256"
						source-size="128"
						size="24"
						link="https://www.python.org/"
						text="While not my go-to langauge in any context, I enjoy using it inside Blender, and for quick scripts over a shell script."
						title="Python"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="384"
						source-size="128"
						size="24"
						link="https://www.php.net/"
						text="I started my WebDev career with a LAMP stack, and have used PHP in a professional capacity at YouVisit, but I prefer NodeJS for WebDev work, and haven't used PHP in a while, but I can hop back in and reactivate those neurons when needed."
						title="PHP"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="384"
						source-size="128"
						size="24"
						link="https://www.mysql.com/"
						text="While I appreciate relational databases, I prefer the flexibility of a document database like MongoDB for WebDev work, but I have used MySQL in a professional capacity at YouVisit, and I can hop back in and reactivate those neurons when needed."
						title="MySQL"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="256"
						image-y="384"
						source-size="128"
						size="24"
						link="https://jquery.com/"
						text="I STILL think jQuery has a better API/syntax than vanilla JavaScript, and can happily use jQuery, but the reality is that it's pretty dated and useless for modern WebDev work, so I haven't used it in a while, but I can hop back in and reactivate those neurons when needed."
						title="jQuery"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="384"
						image-y="384"
						source-size="128"
						size="24"
						link="https://www.arduino.cc/"
						text="I made a custom Aruino based arcade controller professionally for Unified Field, and is currently controlling an experience at the New York Aquarium. I also have done some really fun personal projects with Arduino, and I really enjoy working with it, but I haven't done much with it in a while, so I can hop back in and reactivate those neurons when needed."
						title="Arduino"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="512"
						image-y="384"
						source-size="128"
						size="24"
						link="https://httpd.apache.org/"
						text="While I need too hop on and learn Nginx or others, I am hosting all my personal sites on a Linode running Apache, with both LAMP and proxy setup ups for NodeJS apps."
						title="Apache"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="640"
						image-y="384"
						source-size="128"
						size="24"
						link="https://www.java.com/en/"
						text="I used to really like the Promise of Java, and while I've done very mimal professional work with it, these days I prefer C# or just JavaScript for most of my programming work, but I can hop back in and reactivate those neurons when needed."
						title="Java"
					/>

				</div>
			</div>
		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1><span>Art & Design Skills</span></h1>
			<div class="white-box">

				<h3>Hover over an icon to learn about my experience!</h3>
				<div class="flex-grid">

					<!-- design icons -->
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="512"
						source-size="128"
						size="24"
						link="https://www.blender.org/"
						text="Been using Blender since 2000. Regularly use it, and used it in a professional capacity at Google, YouVisit, Unified Field, AT&amp;T, and Nike."
						title="Blender"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="512"
						source-size="128"
						size="24"
						link="https://www.adobe.com/products/photoshop.html"
						text="Been using Photoshop since 2000, used in a professional capacity at every Job I've had since then, including Google, YouVisit, Unified Field, AT&amp;T, and Nike."
						title="Photoshop"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="256"
						image-y="512"
						source-size="128"
						size="24"
						link="https://www.adobe.com/products/illustrator.html"
						text="Have only casually used Illustrator in a professional setting, but do have a lot of personal experience."
						title="Illustrator"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="384"
						image-y="512"
						source-size="128"
						size="24"
						link="https://www.adobe.com/products/premiere.html"
						text="Have used Premeire in a semi professional capacity, making intro videos or tutorial help videos, at YouVisit and Nike."
						title="Premeire"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="512"
						image-y="512"
						source-size="128"
						size="24"
						link="https://www.blackmagicdesign.com/products/davinciresolve"
						text="Recently switched away from Premeire to Resolve, really enjoying it and building lots of experience with it."
						title="Resolve"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="640"
						image-y="512"
						source-size="128"
						size="24"
						link="https://procreate.com/"
						text="I have only used Procreate on my iPad Pro for personal projects, but I have a lot of experience with it and really enjoy it."
						title="Procreate"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="0"
						image-y="640"
						source-size="128"
						size="24"
						link="https://www.autodesk.com/products/maya/overview"
						text="I used MAYA Proofessionally at Google, but I am rusty with it - though I can always hop back in and reactivate those neurons when needed."
						title="MAYA"
					/>
					<SkillIcon
						src="img/skills_icons.png"
						image-x="128"
						image-y="640"
						source-size="128"
						size="24"
						link="https://www.maxon.net/en/zbrush"
						text="I used ZBrush professionally at Google, but I am rusty with it - though I can always hop back in and reactivate those neurons when needed."
						title="ZBrush"
					/>

				</div>
			</div>
		</Container3D>

	</div>

</template>
<style lang="scss" scoped>

	.dl-pdf {

		// position
		position: absolute;
		top: 0px;
		right: 10px;

		// text styles
		font-size: 12px;

		// look clickable
		cursor: pointer;

		// box styles
		background: rgba(255, 255, 255, 0.8);
		border-radius: 10px;
		padding: 10px 10px 10px 10px;

		.icon {
			// border: 1px solid red;
			width: 24px;
			height: 24px;
			background: url('/img/dl.png') no-repeat;
			background-size: cover;

			opacity: 0.7;
			margin-bottom: 2px;
		}
	}

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

</style>
