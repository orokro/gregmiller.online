<!--
	about-me.vue
	------------

	The About Me page for Greg Miller.
-->
<script setup>

// components
import AboutMeContent from '~/components/AboutMeContent.vue';

// Use SEO metadata
useSeoMeta({
	title: 'About Greg Miller - Software Engineer & Digital Artist',
	description: 'Bio and skills of Greg Miller, a multi-disciplinary software engineer specializing in 3D pipelines, full-stack development, and digital art.',
});

</script>

<template>
	<AboutMeContent />
</template>
