<!--
	art.vue
	-------

	The Art page.
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

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="Art" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_ART.png" />
		</div>
	</div>

	<div class="static-page">

		<SideItems>
			<template #left>
				<Model model="PaintTube" :scale="30" :position="{ x: -130, y: 0, z: -100 }" :rotation="{ x: 90, y: 30, z: 0 }" />
				<br/>
				<Model model="PaintBrushes" :scale="40" :position="{ x: -170, y: -500, z: -100 }" :rotation="{ x: 90, y: -10, z: 0 }" />
			</template>
			<template #right>
				<Model model="Pencil" :scale="30" :position="{ x: 70, y: -110, z: -100 }" :rotation="{ x: 90, y: -100, z: 0 }" />
				<br/>
				<Model model="POSCA" :scale="30" :position="{ x: 130, y: -110, z: -100 }" :rotation="{ x: 0, y: 0, z: -20 }" />
				<br/>
				<br/>
				<br/>
				<Model model="PaintBottles" :scale="30" :position="{ x: 180, y: -700, z: -100 }" :rotation="{ x: 90, y: 0, z: 0 }" />
			</template>
		</SideItems>

		<Container3D>
			<h1><span>Art</span></h1>
			<div class="white-box text">
				I've always enjoyed creativity of all kinds. I consider coding a creative hobby just as much as traditional art.
				<br/><br/>
				I studied both art and computer science in college, and continue to develop both skill sets to this day.
				<br/><br/>
				While I have less experience doing Art professionally, the skills have helped me in my engineering career constantly - being able to make assets without relying on others, and having a good eye for design and aesthetics has been a huge help in my work. Many of the works I've generated ended up in the final products I've worked on, and I enjoy being able to contribute in that way.
				<br/><br/>
				Because I've always had a focus in 3D, I got interested in 3D printing as soon as I could afford my first machine. Many projects below are either digital art, or 3D printed sculptures and objects. Though, there's some traditional art in there as well.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Art Projects" category="Art" />

	</div>
</template>
<style lang="scss" scoped>

</style>
