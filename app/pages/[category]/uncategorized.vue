<!--
	uncategorized.vue
	-----------------

	The Uncategorized page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import CategoryGrid from '../../app/components/CategoryGrid.vue';
import DynamicText3D from '../../app/components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Other" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_OTHER.png" />
		</div>
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Other</span></h1>
			<div class="white-box text">
				Here's some uncategorized stuff that doesn't fit in another category.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Uncategorized" category="Uncategorized" />

		<Spacer3D/>

		<CategoryGrid title="Geocaching" category="Geocaching" />

	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
