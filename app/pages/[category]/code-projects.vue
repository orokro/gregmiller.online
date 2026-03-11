<!--
	code-projects.vue
	-------

	The Code Projects page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import CategoryGrid from '../../app/components/CategoryGrid.vue';
import DynamicText3D from '../../components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Code" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_CODE.png" />
		</div>
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Code Projects</span></h1>
			<div class="white-box text">
				In the summer of 2000 I accidentally learned to program my Atari 800XL. All through out highschool and college I was fascinated by making cool programs. I started off in Visual Basic 6 for Windows 98, and soon moved onto writing C games for my TI-89 graphing calculator which led to OpenGL graphics in C++.
				<br/><br/>
				After a short break I came back hard with web programming, enjoying both the front-end and back-end. Starting with LAMP stack before moving to NodeJS, and then eventually full-stack JavaScript with Vue, Nuxt, and ElectronJS.
				<br/><br/>
				But I love exploring different kinds of engineering, so I've worked with Arduino and microcontrollers, as well as game engines like Unity and Unreal Engine. I also dabbled in making 100% scratch-written ROMs for classic game consoles like the GameBoy, and Sega Genesis.
				<br/><br/>
				Below are some of the code projects I've worked on, both professionally and personally. Some are extremely old, going back decades, so don't expect the older ones to be a reflection of my current skill level. I just wanted to share the history of my coding journey, and show some of the fun projects I've worked on over the years.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid category="Code Projects" title="Code Projects" />

		<Spacer3D/>

		<Container3D>
			<h1><span>Websites</span></h1>
			<div class="white-box text">
				Many many years ago, I made some free-lance websites for friends and family. I also made a few websites for fun, just to experiment with web design and development.
				<br/><br/>
				Below you can see some of them, but be warned - these are positively ANCIENT, and are not a reflection of my current web development skills. I just wanted to share some of the fun projects I've worked on over the years, and show how far I've come.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid category="Websites" title="Websites" />

	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
