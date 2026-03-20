<!--
	index.vue
	---------

	This is the main page of the site
-->
<script setup>

// imports
const { data, error } = await useFetch('/api/posts');

// components
import DynamicText3D from '../components/Custom3D/DynamicText3D.vue';
import Container3D from '../components/Container3D.vue';
import Spacer3D from '../components/Spacer3D.vue';
import CategorySampler from '../components/CategorySampler.vue';
import Carousel from '../components/Carousel.vue';

// Fetch the homepage content, which is a set of posts grouped by category. We send a list of categories we want to show, and the backend returns an object where each key is a category and the value is an array of posts in that category.
const { data: homeContent } = await useFetch('/api/posts/homepage', {
    method: 'POST',
    body: {
		count: 5,
        categories: [
            "Urban Ex",
            "Graffiti Yards",
            "3D Modeling",
            "Art",
            "Other Projects",
            "Code Projects",
            "Favorite Musicians",
            "My Music",
            "Technology Reviews"
        ]
    }
});

// rename "any" category to "Latest Posts" for the homepage sampler
homeContent.value["Posts"] = homeContent.value.any;

// our list of categories in the order we want to display them. Any category not in this list will be ignored, and any category in the list that doesn't exist in the data will simply show an empty section.
const orderedCategories = [
	"Posts",
	"Code Projects",
	"3D Modeling",
	"Art",
	"Other Projects",
	"Urban Ex",
	"Graffiti Yards",
	"Favorite Musicians",
	"My Music",
	"Technology Reviews"
];

// map of category links to use for the "See All" link in each sampler. If a category isn't in this map, it defaults to "/category/[slugified-category-name]"
const categoryLinks = {
	"Posts": "",
	"Urban Ex": "urban-ex",
	"Graffiti Yards": "graffiti-yards",
	"3D Modeling": "category/3d-modeling",
	"Art": "category/art",
	"Other Projects": "category/other-projects",
	"Code Projects": "category/code-projects",
	"Favorite Musicians": "music",
	"My Music": "my-beats",
	"Technology Reviews": "category/technology-reviews",
};

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="gmiller" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_GMILLER.png"/>
		</div>
	</div>
	<br/><br/>

	<div class="static-page home-size">

		<Container3D>
			<Carousel :height-percentage="45" />
		</Container3D>

		<Spacer3D/>

		<div
			v-for="cat in orderedCategories"
			:key="cat"
			class="container"
		>
			<Container3D>

				<h1><span>Latest {{ cat }}</span></h1>
				<div class="white-box">
					<CategorySampler
						:category="cat"
						:category-link="categoryLinks[cat]"
						:posts="homeContent[cat]"
						:disable-see-all="cat === 'Posts'"
					/>
				</div>

			</Container3D>

			<Spacer3D/>

		</div>

	</div>

</template>
<style lang="scss" scoped>

.home-size {
	max-width: clamp(22rem, 92vw, 73rem);
}

</style>
