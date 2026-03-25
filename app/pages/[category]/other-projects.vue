<!--
	other-projects.vue
	---------------

	The Other Projects page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import CategoryGrid from '../../app/components/CategoryGrid.vue';
import DynamicText3D from '../../components/Custom3D/DynamicText3D.vue';
import SideItems from '../../components/SideItems.vue';
import Model from '../../components/Custom3D/Model.vue';

</script>
<template>

	<SideItems>
			<template #left>
				<Model model="Propeller" :scale="30" :position="{ x: -100, y: -80, z: -103 }" :rotation="{ x: 90, y: 75, z: 0 }" />
				<br/>
				<!-- <Model model="keys_f5" :scale="20" :position="{ x: -170, y: -500, z: -103 }" :rotation="{ x: 90, y: -10, z: 0 }" /> -->
				<br/>
				<br/>
				<br/>
				<br/>
				<br/>
				<br/>
				<Model model="Arduino" :scale="25" :position="{ x: -70, y: -500, z: -103 }" :rotation="{ x: 90, y: -10, z: 0 }" />
			</template>
			<template #right>
				<Model model="3DKey" :scale="25" :position="{ x: 170, y: -110, z: -103 }" :rotation="{ x: 90, y: 15, z: 0 }" />
				<br/>
				<Model model="Breadboard" :scale="25" :position="{ x: 100, y: -270, z: -103 }" :rotation="{ x: 90, y: -85, z: 0 }" />
				<br/>

				<br/>
				<br/>
				<br/>
				<!-- <Model model="PaintBottles" :scale="30" :position="{ x: 180, y: -700, z: -100 }" :rotation="{ x: 90, y: 0, z: 0 }" /> -->
			</template>

		</SideItems>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Other Junk" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_OTHERJUNK.png" />
		</div>
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Other Cool Junk</span></h1>
			<div class="white-box text">

				What can I say? I like making things.
				<br/><br/>
				Here's some awesome stuff that doesn't fit in another category.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Other Projects" category="Other Projects" />
	</div>
</template>
<style lang="scss" scoped>

</style>
