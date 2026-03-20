<!--
	Carousel.vue
	------------

	Frontend component for showing the hero image carousel.
	Fetches slides from the public API and handles auto-playing.
-->
<script setup>

// vue
import { ref, onMounted, onBeforeUnmount } from 'vue';

// props
const props = defineProps({
	// height as a percentage of width (e.g. 40 for 40%)
	heightPercentage: {
		type: Number,
		default: 40,
	},
});

// slides state
const slides = ref([]);
const currentIndex = ref(0);
const timer = ref(null);


/**
 * Fetch slides from the server
 */
async function fetchSlides() {
	try {
		const res = await $fetch('/api/carousel');
		slides.value = Array.isArray(res) ? res : [];
		
		if (slides.value.length > 0) {
			startTimer();
		}
	} catch (e) {
		console.error('Failed to load carousel slides', e);
	}
}


/**
 * Advance to the next slide
 */
function nextSlide() {
	if (slides.value.length <= 1) return;
	
	currentIndex.value = (currentIndex.value + 1) % slides.value.length;
	startTimer();
}


/**
 * Start/Reset the auto-play timer based on current slide duration
 */
function startTimer() {
	if (timer.value) clearTimeout(timer.value);
	
	const currentSlide = slides.value[currentIndex.value];
	const duration = currentSlide?.duration || 2000;
	
	timer.value = setTimeout(nextSlide, duration);
}


onMounted(() => {
	fetchSlides();
});

onBeforeUnmount(() => {
	if (timer.value) clearTimeout(timer.value);
});

</script>
<template>

	<div 
		class="hero-carousel" 
		:style="{ paddingBottom: heightPercentage + '%' }"
	>
		<div v-if="slides.length > 0" class="carousel-inner">
			
			<TransitionGroup name="fade">
				<div 
					v-for="(slide, index) in slides" 
					:key="slide._id"
					v-show="index === currentIndex"
					class="slide"
				>
					<NuxtLink :is="slide.link ? 'NuxtLink' : 'div'" :to="slide.link" class="slide-link">
						<video 
							v-if="slide.imageUrl.toLowerCase().endsWith('.mp4')"
							:src="'/' + slide.imageUrl" 
							autoplay 
							loop 
							muted 
							playsinline 
							class="slide-img"
							style="pointer-events: none;"
						></video>
						<img 
							v-else
							:src="'/' + slide.imageUrl" 
							alt="Hero Slide" 
							class="slide-img" 
						/>
					</NuxtLink>
				</div>
			</TransitionGroup>

			<!-- Indicators -->
			<div class="indicators" v-if="slides.length > 1">
				<button 
					v-for="(slide, index) in slides" 
					:key="'ind-' + slide._id"
					class="indicator"
					:class="{ active: index === currentIndex }"
					@click="currentIndex = index; startTimer();"
				></button>
			</div>

		</div>

		<div v-else class="carousel-placeholder">
			<!-- Loading or empty state -->
		</div>
	</div>

</template>
<style scoped lang="scss">

.hero-carousel {
	position: relative;
	width: 100%;
	overflow: hidden;
	background: #eee;
	border-radius: 8px;
	box-shadow: 0 4px 20px rgba(0,0,0,0.1);

	.carousel-inner {
		position: absolute;
		inset: 0;
	}

	.slide {
		position: absolute;
		inset: 0;
		
		.slide-link {
			display: block;
			width: 100%;
			height: 100%;
		}

		.slide-img {
			width: 100%;
			height: 100%;
			object-fit: cover;
		}
	}

	.indicators {
		position: absolute;
		bottom: 16px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		gap: 8px;
		z-index: 10;

		.indicator {
			width: 10px;
			height: 10px;
			border-radius: 50%;
			background: rgba(255, 255, 255, 0.5);
			border: none;
			padding: 0;
			cursor: pointer;
			transition: all 0.3s;

			&.active {
				background: #fff;
				transform: scale(1.2);
				box-shadow: 0 0 10px rgba(0,0,0,0.3);
			}
		}
	}

	.carousel-placeholder {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f0f0f0;
	}
}

// Fade transition
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.8s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
