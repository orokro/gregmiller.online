// app/composables/useDeviceContext.js
import { computed, onMounted } from 'vue';

const detectMobile = () => {
	if (!process.client)
		return false;

	// Prefer UA-CH when available
	const uaData = navigator.userAgentData;
	if (uaData && typeof uaData.mobile === 'boolean')
		return uaData.mobile;

	const ua = navigator.userAgent || '';

	// iPadOS sometimes reports as Mac; this catches "desktop UA iPad"
	const isIpadDesktopMode = (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

	// Classic UA heuristics
	const uaLooksMobile = /Mobi|Android|iPhone|iPad|iPod|IEMobile|BlackBerry|Opera Mini/i.test(ua);

	// Input characteristics
	const hasTouch = (navigator.maxTouchPoints || 0) > 0;
	const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

	// A conservative combined heuristic:
	// - UA says mobile OR iPad desktop-mode
	// - OR touch+coarse pointer (often phones/tablets)
	return Boolean(uaLooksMobile || isIpadDesktopMode || (hasTouch && coarsePointer));
};

const probeWebGL = () => {
	if (!process.client)
		return false;

	try {
		if (!window.WebGLRenderingContext)
			return false;

		const canvas = document.createElement('canvas');

		// Try WebGL2 first, then WebGL1
		const gl2 = canvas.getContext('webgl2', { antialias: false, alpha: true });
		if (gl2)
			return true;

		const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
			|| canvas.getContext('experimental-webgl', { antialias: false, alpha: true });

		return Boolean(gl);
	} catch (e) {
		return false;
	}
};

export const useDeviceContext = () => {

	// "Real" detection
	const detectedIsMobile = useState('devicectx_detectedIsMobile', () => false);
	const detectedHas3D = useState('devicectx_detectedHas3D', () => false);

	// Forced overrides (null = no override)
	const forcedIsMobile = useState('devicectx_forcedIsMobile', () => null);
	const forcedHas3D = useState('devicectx_forcedHas3D', () => null);

	const refresh = () => {
		detectedIsMobile.value = detectMobile();
		detectedHas3D.value = probeWebGL();
	};

	onMounted(() => {
		refresh();
	});

	const isMobile = computed(() => {
		if (forcedIsMobile.value === true) return true;
		if (forcedIsMobile.value === false) return false;
		return detectedIsMobile.value;
	});

	const has3DCapability = computed(() => {
		if (forcedHas3D.value === true) return true;
		if (forcedHas3D.value === false) return false;
		return detectedHas3D.value;
	});

	const classObject = computed(() => ({
		'is-mobile': isMobile.value,
		'is-3d': has3DCapability.value,
	}));

	const setMobileOverride = (v) => {
		// Accept true/false/null
		if (v === true || v === false || v === null) {
			forcedIsMobile.value = v;
		}
	};

	const set3DOverride = (v) => {
		if (v === true || v === false || v === null) {
			forcedHas3D.value = v;
		}
	};

	return {
		// effective
		isMobile,
		has3DCapability,

		// raw
		detectedIsMobile,
		detectedHas3D,
		forcedIsMobile,
		forcedHas3D,

		// helpers
		classObject,
		refresh,
		setMobileOverride,
		set3DOverride,
	};
};
