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

let cube = null;
let cubeGeo = null;
let cubeMat = null;

const props = defineProps({

	// name is optional, but if provided allows this instance to be targeted by name from the theme's build/update functions if desired
	name: {
		type: String,
		default: null,
	},
});

async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	// Run theme default (if any)
	defaultBuild();

	if (!rebuildCustom)
		return;

	// Add cube to the CENTER empty by default
	const center = customRoot.empties.center;

	cubeGeo = new THREE.BoxGeometry(60, 60, 60);
	cubeMat = new THREE.MeshNormalMaterial();
	cube = new THREE.Mesh(cubeGeo, cubeMat);
	cube.name = 'spinning_cube';

	// Centered automatically because center empty is at (0,0,0)
	cube.position.set(0, 0, 0);

	center.add(cube);

	threeManager.requestRender();
}

function update(defaultUpdate, customRoot, threeManager) {

	defaultUpdate();

	const center = customRoot.empties.center;

	if (!cube)
		cube = center.getObjectByName('spinning_cube');

	if (cube) {
		cube.rotation.y += 0.12;
		cube.rotation.x += 0.06;
	}

	threeManager.requestRender();
}

function destroy(customRoot, threeManager) {

	const center = customRoot.empties.center;

	const obj = center.getObjectByName('spinning_cube');
	if (obj)
		center.remove(obj);

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

function tick(root, LockManager, time){
	if (!cube)
		cube = center.getObjectByName('spinning_cube');

	if (cube) {
		cube.rotation.y += 0.12;
		cube.rotation.x += 0.06;
	}
}

</script>
<template>

	<ContainerCustom3D
		class="spinning-cube-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
		:tickFn="tick"
		:name="name"
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

		// for debug
		// border: 1px solid red;

	}// .spinning-cube-container

</style>
