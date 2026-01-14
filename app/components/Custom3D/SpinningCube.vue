<!--
	SpinningCube.vue
	----------------

	Example implementation of <ContainerCustom3D>:

	- Calls defaultBuild() / defaultUpdate() so the active theme can still stylize the CustomContainer box.
	- Adds an extra cube that spins when update() is called.
-->
<script setup>

import * as THREE from 'three';
import ContainerCustom3D from '../ContainerCustom3D.vue';

// Keep references so we can update/clean correctly
let cube = null;
let cubeGeo = null;
let cubeMat = null;

function build(defaultBuild, customRoot, threeManager) {

	// Run the theme's default CustomContainer styling (if any)
	defaultBuild();

	// Add our custom spinning cube
	cubeGeo = new THREE.BoxGeometry(60, 60, 60);
	cubeMat = new THREE.MeshNormalMaterial();
	cube = new THREE.Mesh(cubeGeo, cubeMat);
	cube.name = 'spinning_cube';

	// Sit it slightly behind the box face
	cube.position.z = 0;
	console.log('customRoot:', customRoot);
	customRoot.add(cube);

	// Make sure it renders
	threeManager.requestRender();
}

function update(defaultUpdate, customRoot, threeManager) {

	// Keep the default custom-box geometry in sync too
	defaultUpdate();

	// Spin our cube
	if (!cube) {
		cube = customRoot.getObjectByName('spinning_cube');
	}

	if (cube) {
		cube.rotation.y += 0.12;
		cube.rotation.x += 0.06;
	}

	threeManager.requestRender();
}

function destroy(customRoot, threeManager) {

	// Remove + dispose custom resources
	const obj = customRoot.getObjectByName('spinning_cube');
	if (obj) {
		customRoot.remove(obj);
	}

	if (cubeGeo) {
		cubeGeo.dispose();
		cubeGeo = null;
	}

	if (cubeMat) {
		cubeMat.dispose();
		cubeMat = null;
	}

	cube = null;

	threeManager.requestRender();
}

</script>
<template>

	<ContainerCustom3D
		class="spinning-cube-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
	>
		<slot />
	</ContainerCustom3D>

</template>
<style lang="scss" scoped>

	// we can still style the main container box from here, and it will be applied to the 3D version too since we're calling defaultBuild() in our build function
	.spinning-cube-container {

		// make it a bit bigger than the default so our cube fits better
		width: 320px;
		height: 320px;

		border: 1px solid red;

	}// .spinning-cube-container

</style>
