<!--
	urbex-articles.vue
	------------------

	The Urban Ex page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategoryGrid from '../components/CategoryGrid.vue';
import SideItems from '../components/SideItems.vue';
import Model from '../components/Custom3D/Model.vue';

// get our urban-ex posts
const category = 'Urban Ex Articles';
const { data, pending, error } = await useFetch('/api/posts/by-category', {
	query: {
		category,
	},
});

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="UE Articles" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_URBEX.png" />
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
			<h1><span>Urbex Articles</span></h1>
			<div class="white-box text">

				Below are some articles I've written about my urban exploration adventures, including tips for exploring safely and responsibly, as well as stories from some of my most memorable explorations.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Urbex Articles" category="Urban Ex Articles" />

	</div>
</template>
<style lang="scss" scoped>

</style>
