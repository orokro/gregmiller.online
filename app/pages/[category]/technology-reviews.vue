<!--
	technology-reviews.vue
	----------------------

	The Technology Reviews page.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../../components/Container3D.vue';
import Spacer3D from '../../components/Spacer3D.vue';
import CategoryGrid from '../../app/components/CategoryGrid.vue';
import DynamicText3D from '../../components/Custom3D/DynamicText3D.vue';

</script>
<template>

	<div align="center">
		<DynamicText3D text="Tech" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_TECH.png" />
	</div>

	<div class="static-page">

		<Container3D>
			<h1><span>Technology Reviews</span></h1>
			<div class="white-box text">

				While I don't update this too frequently, I have written many reviews of technology products over the years, including software, hardware, and gadgets. I enjoy sharing my thoughts and experiences with technology, and hope that my reviews can help others make informed decisions about the products they use.
				<br/><br/>
				Perhaps you'll find something useful, or appreciate a snapshot of what was once cutting edge technology. Either way, I hope you enjoy reading my reviews as much as I enjoyed writing them.
			</div>
		</Container3D>

		<Spacer3D/>

		<CategoryGrid title="Technology Reviews" category="Technology Reviews" />
	</div>
</template>
<style lang="scss" scoped>

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
