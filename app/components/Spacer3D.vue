<!--
	Spacer3D.vue
	------------

	Some themes might want extra space between content areas.

	While we'll support custom CSS to affect margins and padding,
	this element can be a simple horizontal spacer that can grow or shrink
	as theme dictates, without needing to worry about how that will affect the 3D canvas.

-->
<script setup>

</script>
<template>

	<div class="spacer-3d"></div>

</template>
<style lang="scss" scoped>

	// a simple horizontal spacer that can grow or shrink as needed
	.spacer-3d {
		width: 100%;
		height: 30px;

		// animate when theme changes
		transition: height 0.3s ease;

	}// .spacer-3d

</style>
