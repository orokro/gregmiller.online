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
import ContainerCustom3D from '../components/ContainerCustom3D.vue';
import SideItems from '../components/SideItems.vue';

import Model from '../components/Custom3D/Model.vue';

// composables
import { useDeviceContext } from '../composables/useDeviceContext';
const { classObject } = useDeviceContext();

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

const sideModels = [

	// {
	// 	left: {
	// 		model: "keys_greg",
	// 		scale: 20,
	// 		position: { x: -70, y: -110, z: -103 },
	// 		rotation: { x: 90, y: 30, z: 0 }
	// 	},
	// 		right: {
	// 		model: "knife",
	// 		scale: 62.5,
	// 		position: { x: 100, y: -110, z: -103 },
	// 		rotation: { x: 90, y: -75, z: 0	}
	// 	}
	// },

	// latest post row
	{
		left: null,
		right: null,
	},

	// Code row
	{
		left: {
			model: 'coffee',
			scale: 12,
			position: { x: -80, y: 120, z: -70 },
			rotation: { x: 90, y: 45, z: 0 }

		},
		right: {
			model: 'keys_crtl_alt_del',
			scale: 20,
			position: { x: 100, y: -50, z: -90 },
			rotation: { x: 90, y: -45, z: 0 }
		}
	},

	// 3D Modeling row
	{
		left: {
			model: 'Primitives',
			scale: 10,
			position: { x: -50, y: 0, z: -100 },
			rotation: { x: 90, y: 45, z: 0 }
		},
		right: {
			model: 'BlenderLogo',
			scale: 30,
			position: { x: 140, y: 50, z: -100 },
			rotation: { x: 90, y: 0, z: 0 }
		}
	},

	// Art row
	{
		left: {
			model: 'PaintTube',
			scale: 25,
			position: { x: -50, y: 0, z: -100 },
			rotation: { x: 90, y: 30, z: 0 }
		},
		right: {
			model: 'PaintBrushes',
			scale: 30,
			position: { x: 60, y: -60, z: -90 },
			rotation: { x: 90, y: -15, z: 0 }
		}
	},

	// Other projects
	{
		left: null,
		right: null,
	},

	// Urbex
	{
		// left: {
		// 	model: 'Flashlight',
		// 	scale: 30,
		// 	position: { x: 0, y: 0, z: -22 },
		// 	rotation: { x: 0, y: 0, z: 45 }
		// },
		left: null,
		right: {
			model: 'GirafaKeychain',
			scale: 1,
			position: { x: 0, y: 0, z: 0 },
			rotation: { x: 90, y: 0, z: 0 }
		}
	},

	// graffiti
	{
		left: null,
		right: {
			model: 'Propeller',
			scale: 20,
			position: { x: 100, y: 0, z: -90 },
			rotation: { x: 90, y: -60, z: 0 }
		},
	},

	// Music
	{
		left: {
			model: 'iPod',
			scale: 30,
			position: { x: -90, y: 70, z: -110 },
			rotation: { x: 90, y: 10, z: 0 }
		},
		right: null,
	},

	// My Music
	// Other projects
	{
		left: null,
		right: {
			model: 'CasetteTape',
			scale: 20,
			position: { x: 120, y: 0, z: -90 },
			rotation: { x: 90, y: 45, z: 0 }
		}
	},

	// Tech reviews
	{
		left: {
			model: 'LTTDriver',
			scale: 25,
			position: { x: -100, y: 70, z: -70 },
			rotation: { x: 90, y: -175, z: 0 }
		},
		right: {
			model: 'RamSticks',
			scale: 20,
			position: { x: 300, y: -100, z: -97 },
			rotation: { x: 90, y: 80, z: 0 }
		}
	},


];

</script>
<template>

	<div align="center">
		<div class="header-3d-wrapper">
			<DynamicText3D text="gmiller" :scale="0.7" :x-offset="20" fallback-image="img/2D_headers/H_GMILLER.png"/>
		</div>
	</div>
	<br/><br/>

	<div class="static-page home-size" :class="classObject">

		<SideItems>
			<template #right>
				<Model model="knife" :scale="62.5" :position="{ x: 100, y: -110, z: -103 }" :rotation="{ x: 90, y: -75, z: 0 }" />
			</template>
			<template #left>
				<Model model="keys_greg" :scale="20" :position="{ x: -70, y: -110, z: -90 }" :rotation="{ x: 90, y: 30, z: 0 }" />
			</template>
		</SideItems>

		<Container3D>
			<div class="carousel-spacer">
				<Carousel :height-percentage="45" />
			</div>
		</Container3D>

		<Spacer3D/>



		<div
			v-for="cat, i in orderedCategories"
			:key="cat"
			class="container"
		>
			<SideItems>
				<template #right>
					<Model
						v-if="sideModels[i] && sideModels[i].right"
						:model="sideModels[i].right.model"
						:scale="sideModels[i].right.scale"
						:position="sideModels[i].right.position"
						:rotation="sideModels[i].right.rotation"
					/>
				</template>
				<template #left>
					<Model
						v-if="sideModels[i] && sideModels[i].left"
						:model="sideModels[i].left.model"
						:scale="sideModels[i].left.scale"
						:position="sideModels[i].left.position"
						:rotation="sideModels[i].left.rotation"
					/>
				</template>
			</SideItems>

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

:global(.no-3d) {
	.carousel-spacer {
		padding-top: 10px;
	}
}
</style>
