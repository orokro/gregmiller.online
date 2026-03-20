<!--
	AboutMeContent.vue
	------------------

	The content for the About Me section.
	Highlights multi-disciplinary skills in engineering, 3D/2D design, and physical art.
-->
<script setup>

// components
import Container3D from '~/components/Container3D.vue';
import Spacer3D from '~/components/Spacer3D.vue';
import DynamicText3D from '~/components/Custom3D/DynamicText3D.vue';

</script>

<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="about me" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_CONTACT.png"/>
		</div>
	</div>
	<br/><br/>

	<div class="static-page smaller">

		<Container3D>
			<h1><span>The Intersection of Code & Creativity</span></h1>
			
			<div class="white-box text">
				<p>
					I am a multi-disciplinary <strong>Software Engineer and Digital Artist</strong> with over 26 years of experience blending the worlds of code and creativity. My career has been defined by a passion for building immersive experiences, whether they live on a screen, in virtual reality, or in the physical world.
				</p>

				<div class="bio-section">
					<h3>Engineering & 3D Pipelines</h3>
					<p>
						As an engineer, I specialize in 3D pipelines and full-stack development. Most recently, I've worked with <strong>Nike</strong> to develop custom in-house 3D software using tools like <strong>Three.js, Vue 3, and Node.js</strong>. My background includes significant tenures at <strong>AT&T, Google, and YouVisit</strong>, where I tackled everything from 2D/3D game development in Unity to high-fidelity product modeling and R&D.
					</p>
				</div>

				<div class="bio-section">
					<h3>Beyond the Screen: Physical Art & Hardware</h3>
					<p>
						My creativity extends far beyond digital environments. I am deeply involved in the physical creation of art, bridging the gap between bits and atoms:
					</p>
					<ul>
						<li><strong>3D Printing & Prototyping:</strong> Bringing complex digital designs into the physical realm.</li>
						<li><strong>Electronics & Arduino:</strong> Integrating hardware with software for interactive physical projects and "smart" art.</li>
						<li><strong>Traditional Media:</strong> Painting and physical modeling that informs my digital perspective.</li>
						<li><strong>2D Design:</strong> Expert-level mastery of the Adobe Creative Suite, Procreate, and Aseprite for UI/UX and digital illustration.</li>
					</ul>
				</div>

				<div class="bio-section">
					<h3>Global Impact</h3>
					<p>
						My projects have garnered international attention, being featured on platforms like <strong>Fox News, Time Magazine, IGN, Gamespot, and The Verge</strong>. One of my most notable achievements is <strong>Jerry’s Place VR</strong>, an early Virtual Reality project that showcased the potential of immersive environments to a global audience.
					</p>
				</div>

				<p class="closing">
					Whether I'm writing C# for a cyber security game, optimizing a 3D asset pipeline, or soldering components for an Arduino-powered sculpture, I bring a unique perspective that combines technical rigor with a lifelong commitment to artistic excellence.
				</p>
			</div>
		</Container3D>

		<Spacer3D />

		<Container3D>
			<h1><span>Core Expertise</span></h1>
			<div class="white-box text">
				<div class="skills-grid">
					<div class="skill-cat">
						<h4>Engineering</h4>
						<p>NodeJS, Vue, React, R3F, Electron, C#, Unity, ThreeJS, Python, PHP, MySQL, MongoDB, Arduino, C++</p>
					</div>
					<div class="skill-cat">
						<h4>3D / 2D Media</h4>
						<p>Blender, Maya, ZBrush, Photoshop, Illustrator, Davinci Resolve, After Effects, Premiere, Procreate, Aseprite</p>
					</div>
				</div>
			</div>
		</Container3D>

	</div>

</template>

<style lang="scss" scoped>

.bio-section {
	margin: 2rem 0;

	h3 {
		color: var(--color-primary);
		font-family: "Alumni Sans", sans-serif;
		font-size: 1.8rem;
		margin-bottom: 0.5rem;
		border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.2);
		display: inline-block;
	}
}

ul {
	margin-left: 1.5rem;
	margin-top: 1rem;
	li {
		margin-bottom: 0.5rem;
		line-height: 1.4;
	}
}

.closing {
	font-style: italic;
	margin-top: 2rem;
	border-top: 1px solid rgba(0,0,0,0.05);
	padding-top: 1rem;
}

.skills-grid {
	display: grid;
	grid-template-columns: 1fr 1fr;
	gap: 2rem;

	@media (max-width: 600px) {
		grid-template-columns: 1fr;
	}

	h4 {
		color: var(--color-secondary);
		margin-bottom: 0.5rem;
		font-size: 1.2rem;
	}
}

.header-3d-wrapper {
	max-width: clamp(18rem, 92vw, 60rem);
}
</style>
