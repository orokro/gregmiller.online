<!--
	ContainerCustom3D.vue
	--------------------

	A 3D-enabled container that behaves like <Container3D>, but allows per-instance custom ThreeJS logic.

	How it works:
	- Registers with ThreeManager as type 'customBox'
	- Themes may optionally implement:
		- buildCustomBox(manager, data)
		- updateCustomBox(manager, data, rect)
	- This component may optionally provide per-instance overrides via props:
		:buildFn, :updateFn, :clean
		If buildFn/updateFn are provided, ThreeManager will call them and pass:
		(defaultBuild/defaultUpdate, customRoot, threeManager)
		where defaultBuild/defaultUpdate run the theme's default CustomBox styling (or no-op if theme doesn't implement it).
-->
<script setup>

// Imports
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useThree } from '~/composables/useThree';
import { useDeviceContext } from '~/composables/useDeviceContext';

// Props
const props = defineProps({

	// Optional custom build function for this instance. If not provided, will use theme default if available.
	buildFn: {
		type: Function,
		default: null
	},

	// Optional custom update function for this instance. If not provided, will use theme default if available.
	updateFn: {
		type: Function,
		default: null
	},

	// Optional custom cleanup function for this instance. If not provided, will use theme default if available.
	clean: {
		type: Function,
		default: null
	},

	// Optional tick function for this instance, called every frame. If not provided, will use theme default if available.
	tickFn: {
		type: Function,
		default: null
	},

	// Optional, name
	name: {
		type: String,
		default: null,
	},

});

// State
const el = ref(null);
const isFallback = ref(true); // Default to true while loading
const is3DReady = ref(false);
const registeredId = ref(null);

// Composable
const { getThree, threeManager } = useThree();
const { has3DCapability } = useDeviceContext();

defineExpose({
	is3DReady,
	isFallback
});

// Helper to register the element
async function register() {

	// 1. Wait for ThreeManager to boot
	const mgr = await getThree();
	
	// If it already exists and we're already registered with it, skip
	if (mgr && registeredId.value && registeredId.value.startsWith('mgr-' + mgr.id)) {
		return;
	}

	// 2. Unregister if we have an old ID
	if (registeredId.value && mgr) {
		// mgr.unregister(registeredId.value);
		// registeredId.value = null;
	}

	// 3. Register
	if (mgr && mgr.isOk && el.value) {

		const options = {
			buildFn: props.buildFn,
			updateFn: props.updateFn,
			cleanFn: props.clean,
			tickFn: (root, tm, time) => {
				// Poll the ready state from the manager data
				if (registeredId.value) {
					const data = tm.registeredElements.get(registeredId.value);
					if (data && data.ready !== is3DReady.value) {
						is3DReady.value = data.ready;
						if (is3DReady.value) {
							isFallback.value = false;
						}
					}
				}
				// Call user tick if provided
				if (props.tickFn) props.tickFn(root, tm, time);
			},
		};
		if(props.name)
			options.name = props.name;

		const result = mgr.register(el.value, 'customBox', options);

		if (result) {
			registeredId.value = result.id;
		}

	} else {
		// Manager loaded but reported error (e.g. WebGL disabled)
		isFallback.value = true;
	}
}


onMounted(() => {

	// 1. Immediate Fail check
	if (!window.WebGLRenderingContext || !has3DCapability.value) {
		isFallback.value = true;
	}

	watch(has3DCapability, (val) => {
		if (!val || !window.WebGLRenderingContext) {
			isFallback.value = true;
		} else if (val && !registeredId.value) {
			register();
		}
	}, { immediate: true });

	// 2. Watch for ThreeManager changes (handles late init and layout remounts)
	watch(threeManager, (mgr) => {
		if (mgr) {
			register();
		} else {
			// Manager lost
			is3DReady.value = false;
			isFallback.value = true;
			registeredId.value = null;
		}
	}, { immediate: true });

});

// If user swaps build/update hooks at runtime, update the registered element options
watch(() => props.buildFn, (fn) => {
	if (!registeredId.value || !threeManager.value) return;
	const data = threeManager.value.registeredElements.get(registeredId.value);
	if (!data) return;
	data.options.buildFn = fn;
	threeManager.value.buildRegisteredElement(data);
	threeManager.value.updateElementPosition(registeredId.value);
	threeManager.value.requestRender();
});

watch(() => props.updateFn, (fn) => {
	if (!registeredId.value || !threeManager.value) return;
	const data = threeManager.value.registeredElements.get(registeredId.value);
	if (!data) return;
	data.options.updateFn = fn;
	threeManager.value.updateElementPosition(registeredId.value);
	threeManager.value.requestRender();
});

watch(() => props.clean, (fn) => {
	if (!registeredId.value || !threeManager.value) return;
	const data = threeManager.value.registeredElements.get(registeredId.value);
	if (!data) return;
	data.options.cleanFn = fn;
});

watch(() => props.tickFn, (fn) => {
	if (!registeredId.value || !threeManager.value) return;
	const data = threeManager.value.registeredElements.get(registeredId.value);
	if (!data) return;
	data.options.tickFn = fn;
});

onUnmounted(() => {

	// Clean up 3D resources
	if (registeredId.value && threeManager.value) {
		threeManager.value.unregister(registeredId.value);
	}
});

</script>
<template>

	<div ref="el" class="container-custom-3d" :class="{ 'no-3d': isFallback }">

		<!-- special wrapper to reset stacking context for our corners-->
		<div class="measure-wrapper">

			<!-- we will measure these corners viewport space to get 3d coordinates -->
			<div class="corner top-left"></div>
			<div class="corner top-right"></div>
			<div class="corner bottom-left"></div>
			<div class="corner bottom-right"></div>

			<!-- optional children -->
			<div class="content">
				<slot />
			</div>
		</div>

	</div>

</template>
<style lang="scss" scoped>

.container-custom-3d {

	position: relative;
	display: block;
	max-width: 100%;
	min-width: 0;
	box-sizing: border-box;

	&.no-3d {
		// background: #f0f0f0;
		// border: 1px solid #ddd;
	}

	.content {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}

	/* MEASUREMENT SYSTEM
	   ------------------
	   Internal markers to get exact corner coordinates, bypassing potential
	   box-sizing/border quirks of the parent container.
	*/
	.measure-wrapper {

		width: 100%;
		height: 100%;
		min-width: 0;
		box-sizing: border-box;

		// reset stacking context for corners, so they are always behind content but above the canvas
		position: relative;

		.corner {
			position: absolute;
			width: 1px;
			height: 1px;
			background: transparent; /* Invisible but measurable */
			pointer-events: none;
			opacity: 0;
			z-index: -1;

			&.top-left {
				top: 0;
				left: 0;
			}

			&.top-right {
				top: 0;
				right: -1px; /* Pushes the 1px box outside, so its Left edge is exactly at container Right */
			}

			&.bottom-left {
				bottom: -1px; /* Pushes the 1px box outside, so its Top edge is exactly at container Bottom */
				left: 0;
			}

			&.bottom-right {
				bottom: -1px;
				right: -1px;
			}

		}// .corner

	}// .measure-wrapper

}// .container-custom-3d

</style>
