<!--
	3d_test.vue
	-----------
	A sandbox to verify the 1:1 pixel mapping of the ThreeManager.
-->
<script setup>

// imports
import Container3D from '~/components/Container3D.vue';
import ContainerCustom3D from '../components/ContainerCustom3D.vue';
import SpinningCube from '../components/Custom3D/SpinningCube.vue';
import BackgroundImage3D from '../components/BackgroundImage3D.vue';

</script>
<template>

	<div class="test-page">

		<section class="intro">
			<h1>3D Coordination Test</h1>
			<p>
				The red boxes below should match the DOM elements exactly.
				Try resizing the window or scrolling.
			</p>
		</section>

		<section class="test-section relative">
			<Container3D>
				<div class="box-content">
					<h2>Center Box</h2>
					<p>I should have a red wireframe around me.</p>
					<p>I should have a red wireframe around me.</p>
					<p>I should have a red wireframe around me.</p>
					<p>I should have a red wireframe around me.</p>
					<p>I should have a red wireframe around me.</p>
					<p>I should have a red wireframe around me.</p>

				</div>
			</Container3D>

			<BackgroundImage3D class="pencil_bg_img" src="/img/bg_doodles/pencil.png" width="380" height="440" />

		</section>

		<section class="test-section columns">

			<Container3D>
				<div class="box-content small">
					<h3>Left</h3>
				</div>
			</Container3D>

			<Container3D>
				<div class="box-content small">
					<h3>Right</h3>
				</div>
			</Container3D>

		</section>

		<ContainerCustom3D>
			<div class="box-content">
				Custom container
			</div>
		</ContainerCustom3D>

		<br/><br/><br/>
		<SpinningCube />

		<br/><br/><br/>
		<SpinningCube />

		<section class="spacer">
			<p>Scroll down...</p>
		</section>

		<section class="test-section">
			<Container3D>
				<div class="box-content wide">
					<h2>Bottom Anchor</h2>
					<p>If the parallax math is wrong, I will drift away from my wireframe.</p>
				</div>
			</Container3D>
		</section>

	</div>

</template>
<style scoped>

.relative {
	position: relative;
}

.pencil_bg_img {

	position: absolute;
	left: -150px;
	top: 150px;
}

.test-page {
	padding: 4rem 2rem;
	max-width: 800px;
	margin: 0 auto;
	font-family: sans-serif;
}

.intro {
	margin-bottom: 4rem;
	text-align: center;
}

.test-section {
	margin-bottom: 4rem;
	display: flex;
	justify-content: center;
	gap: 2rem;

}

.box-content {
	box-sizing: border-box;
	background: rgba(255, 255, 255, 0.5);
	mix-blend-mode: overlay;
	padding: 2rem;
	border-radius: 8px;
	/* box-shadow: 0 4px 10px rgba(0,0,0,0.1); */
	text-align: center;
	/* Ensure the div has size */
	min-width: 200px;
}

.box-content.small {
	min-height: 150px;
	display: flex;
	align-items: center;
	justify-content: center;
}

.box-content.wide {
	width: 100%;
}

.spacer {
	height: 800px; /* Force scroll */
	display: flex;
	align-items: center;
	justify-content: center;
	color: #ccc;
}

</style>
