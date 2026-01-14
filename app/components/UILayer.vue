<!--
	UILayer.vue
	-----------

	This component will compartmentalize the main UI components:
	- AppSidebar
	- HamburgerButton
	- TopWidgets (theme toggle, etc)
	- ContentFrame
-->
<script setup>

// components
import AppSidebar from './AppSidebar.vue';
import ContentFrame from './ContentFrame.vue';
import HamburgerButton from './HamburgerButton.vue';
import TopWidgets from './TopWidgets.vue';

</script>
<template>

	<ContentFrame />
	<HamburgerButton />
	<AppSidebar />
	<TopWidgets />

</template>
<style lang="scss" scoped>

</style>
