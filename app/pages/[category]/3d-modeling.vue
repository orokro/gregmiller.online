<!--
	3d-modeling.vue
	---------------

	The 3D Modeling page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import CategoryGrid from '../../app/components/CategoryGrid.vue';

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1><span>3D Modeling</span></h1>
			<div class="white-box text">

				Like many children of the era, when Toy Story was released it blew my young mind - and sparked an interest in 3d modeling. Shortly after that, the next generation of video games eased into 3D accelerated graphics. I got started on a cheap-o software called Design-It! 3-D, and was soon introduced me to me to the world of <a href="https://www.blender.org/">Blender</a>. Over the past decade, I've literally grown up with Blender.
				<br/><br/>
				I previously worked as a professional full-time 3D artist at Google, but have used my 3D-modeling skills in almost every job I've had, making assets for games, or tools to work with 3D data.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="3D Modeling Projects" category="3D Modeling" />

	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;

}// .white-box

</style>
