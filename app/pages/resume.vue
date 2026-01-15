<!--
	resume.vue
	----------

	The resume page. This is a placeholder while I migrate content from the old site.
-->
<script setup>

// vue
import { ref } from 'vue';

// components
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import Resume from '../components/Resume.vue';

</script>
<template>

	<div class="static-page">

		<Container3D>
			<h1>Resume</h1>
			<Resume />
		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1>Engineering Skills</h1>
		</Container3D>

		<Spacer3D/>

		<Container3D>
			<h1>Art & Design Skills</h1>
		</Container3D>

	</div>

</template>
<style lang="scss" scoped>

.static-page {
	padding: 4rem;
	text-align: center;
	font-family: sans-serif;

	// for debug
	// border: 1px solid red;
}

</style>
