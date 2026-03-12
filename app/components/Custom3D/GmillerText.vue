<!--
	GmillerText.vue
	---------------

	Example implementation of <ContainerCustom3D>:

	NOTE: this isn't actually used anywhere on the site,
	it's just a demo of how to use ContainerCustom3D with a custom GLB model and material.

	- Calls defaultBuild() / defaultUpdate() so the active theme can still stylize the CustomContainer box.
	- Adds an extra cube that spins when update() is called.
-->
<script setup>

import * as THREE from 'three';
import ContainerCustom3D from '../ContainerCustom3D.vue';

// One shared glass material (stable).
// We'll "donate" maps from the GLB material(s) onto this once we load.
let glassMaterial = null;

const el = ref(null);

async function loadModel(manager) {

	const [gltfScene] = await manager.assetsReady(['/models/text/GMILLER.glb']);

	if (!gltfScene) {
		console.error("GlassTheme: Failed to load model.");
		return null;
	}

	return gltfScene;
}

let model = null;

async function build(defaultBuild, customRoot, threeManager, rebuildCustom) {

	// Run theme default (if any)
	// defaultBuild();

	// console.clear();
	// console.log("Building GmillerText...", { rebuildCustom });

	// if rebuild custom is false, gtfo early
	if (!rebuildCustom) {
		return;
	}

	model = await loadModel(threeManager);

	// If the component was unmounted during loading, stop here
	if (!model || !customRoot.group.parent) {
		return;
	}

	glassMaterial = new THREE.MeshPhysicalMaterial({
		// color: 0xffffff,
		color: 0x99AAFF,
		transmission: 1.0,
		transparent: true,
		opacity: 1.0,

		ior: 1.45,
		thickness: 0.6,

		roughness: 0.05,
		metalness: 0.0,

		clearcoat: 1.0,
		clearcoatRoughness: 0.02,

		envMapIntensity: 2.5,

		// attenuationColor: new THREE.Color(0xe6ffff),
		// attenuationColor: new THREE.Color(0x99AAFF),
		attenuationDistance: 0.8,

		side: THREE.DoubleSide
	});

	model = model.children[0]; // Assume the GLB has a single root mesh
	model.position.set(0, 30, 0);
	model.scale.set(200, 200, 200);
	model.rotation.x = 90 * (Math.PI / 180);
	model.material = glassMaterial;

	model.castShadow = true;
	model.receiveShadow = true;

	threeManager.setShadows(model, true);

	// Add cube to the CENTER empty by default
	const center = customRoot.empties.center;
	center.add(model);

	threeManager.requestRender();
}


function update(defaultUpdate, customRoot, threeManager) {

	if(!el.value) return;


	// measure el width in pixels by getting client rect of the container element
	const rect =  el.value?.$el.getBoundingClientRect();
	const width = rect.width;

	const scale = 200 * (width / 800);
	if (model) {
		model.scale.set(scale, scale, scale);
		model.position.set(0, 30, (1 - scale/200) * -90);
	}

}


function destroy(customRoot, threeManager) {

	const center = customRoot.empties.center;

	const obj = center.getObjectByName('spinning_cube');
	if (model)
		center.remove(model);

	if (glassMaterial) {
		glassMaterial.dispose();
		glassMaterial = null;
	}

	model = null;

	threeManager.requestRender();
}

function tick(root, LockManager, time){

}

</script>
<template>

	<ContainerCustom3D
		ref="el"
		class="text-container"
		:buildFn="build"
		:updateFn="update"
		:clean="destroy"
		:tickFn="tick"
	/>

</template>
<style lang="scss" scoped>

	// we can still style the main container box from here, and it will be applied to the 3D version too since we're calling defaultBuild() in our build function
	.text-container {

		// make it a bit bigger than the default so our cube fits better
		// width: 650px;
		height: 250px;

		// transform: scale(0.5);
		// for debug
		// border: 1px solid red;

	}// .text-container

</style>
