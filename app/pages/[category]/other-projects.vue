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

</script>
<template>

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

.white-box {

	padding: 2rem 1rem;;

}// .white-box

</style>
