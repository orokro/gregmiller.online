<!--
	graffiti-yards.vue
	------------------

	The Graffiti Yards page.
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
			<DynamicText3D text="Graffiti" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_GRAFFITI.png" />
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
				<Model model="Propeller" :scale="30" :position="{ x: 100, y: -80, z: -90 }" :rotation="{ x: 90, y: 75, z: 0 }" />
				<br/>
				<br/>
				<br/>
				<Model model="GirafaKeychain" :scale="40" :position="{ x: 50, y: -90, z: -100 }" :rotation="{ x: 0, y: 0, z: 0 }" />

			</template>
		</SideItems>

		<Container3D>
			<h1><span>Graffiti Yards</span></h1>
			<div class="white-box text">

				During my Urban Ex adventures, my friend and I developed an interest in the graffiti scene, after discovering many interesting artists at the locations we were visiting.
				<br/><br/>
				Eventually we started visiting spots where graffiti artists were known to paint. While some of these spots are fully urban-ex abandoned spots covered in graffiti, others are more like "graffiti yards" where artists go to paint and practice their craft. These yards are often hidden away in industrial areas, and can be quite large, with multiple walls and structures covered in graffiti.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Graffiti Yards Posts" category="Graffiti Yards" />

	</div>
</template>
<style lang="scss" scoped>

</style>
