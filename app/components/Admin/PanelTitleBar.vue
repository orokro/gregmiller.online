<!--
	PanelTitleBar.vue
	-----------------

	Title bar for admin panel sections
-->
<script setup>


</script>
<template>

	<div class="panel-title-bar">
		<h1><slot /></h1>
	</div>

</template>
<style lang="scss" scoped>

$primary: #00ABAE;
$secondary: #7561AA;
$bg: #f6f8fb;
$text: #101828;
$border: rgba(16, 24, 40, 0.12);
$shadow: 0 10px 26px rgba(16, 24, 40, 0.08);


// main outer-wrapper
.panel-title-bar {

	// box settings
	background: linear-gradient(
		to bottom,
		$primary,
		darken($primary, 8%)
	);
	padding: 2px 24px;

	h1{
		margin: 0;

		// text styles
		color: white;
		font-size: 1rem;
		font-weight: bold;

	}// h1

}// .panel-title-bar

</style>
