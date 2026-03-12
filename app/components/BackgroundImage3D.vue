<!--
	BackgroundImage3D.vue
	---------------------

	Registers a DOM-positioned “decal” image that renders in the background layer
	(just in front of the infinite background plane), synced to screen-space.
-->
<script setup>

// vue
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

// app
import { useThree } from '~/composables/useThree';
import { useDeviceContext } from '~/composables/useDeviceContext';

const props = defineProps({
	src: { type: String, required: true },
	width: { type: [Number, String], required: true },
	height: { type: [Number, String], required: true },

	// Optional tweak: default multiply-ish decal behavior
	mode: { type: String, default: 'multiply' }, // 'multiply' | 'overlay' | 'normal'
	opacity: { type: Number, default: 1.0 },
});

// state
const el = ref(null);
const registeredId = ref(null);
let isMounted = false;
let threeManagerInstance = null;

// composable
const { getThree, threeManager } = useThree();
const { has3DCapability } = useDeviceContext();

const toPx = (v) => {
	const n = Number(v);
	return Number.isFinite(n) ? `${n}px` : `${v}`;
};

const fallbackStyle = computed(() => {
	if (has3DCapability.value) return {};
	return {
		backgroundImage: `url(${props.src})`,
		backgroundSize: 'contain',
		backgroundPosition: 'center',
		backgroundRepeat: 'no-repeat',
		opacity: props.opacity,
		mixBlendMode: props.mode === 'normal' ? 'normal' : props.mode,
	};
});

// Helper to register the element
async function register() {

	// fail fast
	if (!window.WebGLRenderingContext)
		return;

	const mgr = await getThree();
	
	// Guard: Component was unmounted while waiting, or manager changed
	if (!isMounted || !el.value || mgr !== threeManager.value) {
		return;
	}

	// If it already exists and we're already registered with it, skip
	if (mgr && registeredId.value && threeManagerInstance === mgr) {
		return;
	}

	// 2. Unregister if we have an old ID in a DIFFERENT manager
	if (registeredId.value && threeManagerInstance && threeManagerInstance !== mgr) {
		threeManagerInstance.unregister(registeredId.value);
		registeredId.value = null;
	}

	if (!mgr || !mgr.isOk || !el.value)
		return;

	const result = mgr.register(el.value, 'backgroundImage3D', {
		src: props.src,
		width: Number(props.width),
		height: Number(props.height),
		mode: props.mode,
		opacity: props.opacity,
	});

	if (result) {
		registeredId.value = result.id;
		threeManagerInstance = mgr;
	}
}

onMounted(() => {
	isMounted = true;
	
	// Watch for capability changes
	watch(has3DCapability, (val) => {
		if (val && !registeredId.value) {
			register();
		}
	}, { immediate: true });

	// Watch for ThreeManager changes (handles late init and layout remounts)
	watch(threeManager, (mgr) => {
		if (mgr) {
			register();
		} else {
			// Manager lost
			registeredId.value = null;
			threeManagerInstance = null;
		}
	}, { immediate: true });
});

watch(() => props.src, (src) => {
	if (!registeredId.value || !threeManagerInstance) return;
	const data = threeManagerInstance.registeredElements.get(registeredId.value);
	if (!data) return;

	data.options.src = src;
	threeManagerInstance.buildRegisteredElement(data);
	threeManagerInstance.updateElementPosition(registeredId.value);
	threeManagerInstance.requestRender();
});

watch(() => props.mode, (mode) => {
	if (!registeredId.value || !threeManagerInstance) return;
	const data = threeManagerInstance.registeredElements.get(registeredId.value);
	if (!data) return;

	data.options.mode = mode;
	threeManagerInstance.buildRegisteredElement(data);
	threeManagerInstance.requestRender();
});

watch(() => props.opacity, (opacity) => {
	if (!registeredId.value || !threeManagerInstance) return;
	const data = threeManagerInstance.registeredElements.get(registeredId.value);
	if (!data) return;

	data.options.opacity = opacity;
	threeManagerInstance.buildRegisteredElement(data);
	threeManagerInstance.requestRender();
});

watch(() => [props.width, props.height], ([w, h]) => {
	if (!registeredId.value || !threeManagerInstance) return;
	const data = threeManagerInstance.registeredElements.get(registeredId.value);
	if (!data) return;

	data.options.width = Number(w);
	data.options.height = Number(h);

	threeManagerInstance.updateElementPosition(registeredId.value);
	threeManagerInstance.requestRender();
});

onUnmounted(() => {
	isMounted = false;
	if (registeredId.value && threeManagerInstance) {
		threeManagerInstance.unregister(registeredId.value);
		registeredId.value = null;
		threeManagerInstance = null;
	}
});

</script>
<template>

	<div
		ref="el"
		class="background-image-3d"
		:style="{
			width: toPx(width),
			height: toPx(height),
			...fallbackStyle
		}"
		aria-hidden="true"
	>
		<div class="measure-wrapper">
			<div class="corner top-left"></div>
			<div class="corner bottom-right"></div>
		</div>
	</div>

</template>
<style lang="scss" scoped>

	.background-image-3d {

		position: relative;
		display: block;

		// no interaction, just visual
		pointer-events: none;
		user-select: none;

		// hidden for now - in future, no-3d fallback will enable this
		// opacity: 0;

		// for debug
		// border: 1px solid red;

		// so we can measure corners for 3D positioning
		.measure-wrapper {

			position: relative;
			width: 100%;
			height: 100%;

			.corner.top-left {

				top: 0;
				left: 0;

			}// .corner.top-left

			.corner.bottom-right {

				bottom: -1px;
				right: -1px;

			}// .corner.bottom-right

		}// .measure-wrapper

	}// .background-image-3d

</style>
