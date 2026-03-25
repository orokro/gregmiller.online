<!--
	urban-ex.vue
	------------

	The Urban Ex page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategoryGrid from '../components/CategoryGrid.vue';
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';
import SideItems from '../components/SideItems.vue';
import Model from '../components/Custom3D/Model.vue';

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Urbex" :scale="0.7" :x-offset="10" fallback-image="img/2D_headers/H_URBEX.png" />
		</div>
	</div>

	<div class="static-page">

		<SideItems>
			<template #left>
				<Model model="Flashlight" :scale="30" :position="{ x: -70, y: -500, z: -22 }" :rotation="{ x: 0, y: 0, z: 15 }" />
				<br/>
			</template>
			<template #right>
				<!-- <Model model="Pencil" :scale="30" :position="{ x: 70, y: -110, z: -100 }" :rotation="{ x: 90, y: -100, z: 0 }" /> -->
				<br/>
				<Model model="Propeller" :scale="30" :position="{ x: 100, y: -80, z: -103 }" :rotation="{ x: 90, y: 75, z: 0 }" />
				<br/>
				<br/>
				<br/>
				<Model model="GirafaKeychain" :scale="40" :position="{ x: 50, y: -90, z: -100 }" :rotation="{ x: 0, y: 0, z: 0 }" />

			</template>
		</SideItems>

		<Container3D>
			<h1><span>Urban Ex</span></h1>
			<div class="white-box text">

				<i>Via <a href="https://en.wikipedia.org/wiki/Urban_exploration" target="_blank">wikipedia</a>: "Urban exploration is the exploration of man-made structures, usually abandoned ruins or not usually seen components of the man-made environment."</i>
				<br/><br/>
				For many years I made it a point to check out and document as many abandoned/off-limit places as possible. It's been quite a hobby, ranging from abandoned hospitals and prisons, to underground tunnels, storm drains, black mold, and rat infested houses in the middle of the woods.
				<br/><br/>
				When I shoot photos, I'm not usually trying to be artistic. Most of these simply tell the story one frame at a time. I shoot as many photos as I can to capture feeling of exploring each step of the way. Of course, sometimes I like to frame a pretty shot as well.
				<br/><br/>
				Below you'll find many of the abandoned, or seldom seen urban areas I've visited.

			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Urban Ex Posts" category="Urban Ex" />

	</div>
</template>
<style lang="scss" scoped>

</style>
