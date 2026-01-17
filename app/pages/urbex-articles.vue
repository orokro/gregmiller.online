<!--
	urbex-articles.vue
	------------------

	The Urban Ex page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategoryGrid from '../components/CategoryGrid.vue';

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
		<DynamicText3D text="UE Articles" :scale="0.7" :x-offset="20" />
	</div>

	<div class="static-page">

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

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
