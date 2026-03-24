<!--
	SideItems.vue
	-------------
	A wrapper component for adding 3D decorations to the left and right of content.
	Respects the global showSideItems state.
-->
<script setup>
import { useTheming } from '../composables/useTheming';

const { showSideItems } = useTheming();
</script>

<template>
	<div v-if="showSideItems" class="side-item-placer">
		<div class="side-item-left">
			<slot name="left" />
		</div>
		<div class="side-item-right">
			<slot name="right" />
		</div>
	</div>
</template>

<style lang="scss" scoped>
.side-item-placer {
	position: relative;
	width: 100%;

	// border: 1px solid red;

	.side-item-left {
		// border: 1px solid red;
		position: absolute;
		right: 100%;
		top: 0;
		width: 250px;
		height: 500px;
		transform: translate(-30px, 0px);
		pointer-events: none;
	}

	.side-item-right {
		// border: 1px solid red;
		position: absolute;
		left: 100%;
		top: 0;
		width: 250px;
		height: 500px;
		transform: translate(30px, 0px);
		pointer-events: none;
	}
}
</style>
