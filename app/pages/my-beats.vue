<!--
	my-beats.vue
	------------

	Shows some music I've made over the years. It's mostly pretty bad, but I thought it would be fun to share it anyway. Maybe one day I'll make some new stuff that isn't as cringe, who knows!
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategoryGrid from '../components/CategoryGrid.vue';
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="My Beats" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_MYBEATS.png" />
		</div>
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>My Beats</span></h1>
			<div class="white-box text">

				Many years ago I dabbled in making music. I never took it super seriously, but I had fun experimenting with programs like Fruity Loops, Reason, and others.
				<br/><br/>
				I even started writing my own DAW specifically to make music the way I like. Perhaps one day I'll finish it and release it, but for now it's just a fun project that I work on when I have some free time.
				<br/><br/>
				Below are some things I made that are postively cringe, but I thought it would be fun to share them anyway. Maybe one day I'll make some new stuff that isn't as cringe, who knows!
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid category="My Music" title="My Beats"/>
	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
