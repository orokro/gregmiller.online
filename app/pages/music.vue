<!--
	music.vue
	---------

	Shows a list of my favorite musicians.
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
			<DynamicText3D text="Music" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_MUSIC.png" />
		</div>
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Music</span></h1>
			<div class="white-box text">

				While I work I often listen to music.
				<br/><br/>
				Below are some of my favorite artists!
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid category="Favorite Musicians" title="Artists"/>
	</div>
</template>
<style lang="scss" scoped>

</style>
