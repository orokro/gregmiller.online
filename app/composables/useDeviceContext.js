// app/composables/useDeviceContext.js
import { computed, onMounted, onUnmounted } from 'vue';

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

// Shared result of the WebGL capability check to avoid repeated context creation
let cachedHas3D = null;

const probeWebGL = () => {
	if (!process.client)
		return false;

	// Return the cached result if we've already probed
	if (cachedHas3D !== null)
		return cachedHas3D;

	try {
		if (!window.WebGLRenderingContext) {
			cachedHas3D = false;
			return false;
		}

		const canvas = document.createElement('canvas');

		// Try WebGL2 first, then WebGL1
		const gl2 = canvas.getContext('webgl2', { antialias: false, alpha: true });
		if (gl2) {
			// Explicitly lose the context if the extension is available (best practice)
			const ext = gl2.getExtension('WEBGL_lose_context');
			if (ext) ext.loseContext();
			cachedHas3D = true;
			return true;
		}

		const gl = canvas.getContext('webgl', { antialias: false, alpha: true })
			|| canvas.getContext('experimental-webgl', { antialias: false, alpha: true });

		const hasGL = Boolean(gl);
		if (gl) {
			const ext = gl.getExtension('WEBGL_lose_context');
			if (ext) ext.loseContext();
		}

		cachedHas3D = hasGL;
		return hasGL;
	} catch (e) {
		cachedHas3D = false;
		return false;
	}
};

export const useDeviceContext = () => {

	// SETTINGS
	const no3DOnMobile = true; // Set to true to disable 3D on mobile by default

	// "Real" detection
	const detectedIsMobile = useState('devicectx_detectedIsMobile', () => false);
	const detectedHas3D = useState('devicectx_detectedHas3D', () => false);

	// Forced overrides (null = no override)
	const forcedIsMobile = useState('devicectx_forcedIsMobile', () => null);
	const forcedHas3D = useState('devicectx_forcedHas3D', () => null);
	const windowWidth = useState('devicectx_windowWidth', () => process.client ? window.innerWidth : 1200);

	const refresh = () => {
		detectedIsMobile.value = detectMobile();
		detectedHas3D.value = probeWebGL();
        if (process.client) {
            windowWidth.value = window.innerWidth;
        }

		// URL Override check (?3d=true or #3d=false etc)
		if (process.client) {
			
			const params = new URLSearchParams(window.location.search);
			const hash = window.location.hash;
			
			const check = (val) => {
				if (val === 'true' || val === '1') return true;
				if (val === 'false' || val === '0') return false;
				return null;
			};

			// 1. Check Query / Hash
			let override = check(params.get('3d'));
			if (override === null && hash.includes('3d=')) {
				const hashParams = new URLSearchParams(hash.substring(1));
				override = check(hashParams.get('3d'));
			}

			// 2. Persist to SessionStorage if found
			if (override !== null) {
				sessionStorage.setItem('gm_forcedHas3D', String(override));
			}

			// 3. Read from SessionStorage if override is still null
			if (override === null) {
				const stored = sessionStorage.getItem('gm_forcedHas3D');
				if (stored !== null) {
					override = check(stored);
				}
			}

			if (override !== null) {
				forcedHas3D.value = override;
			}
		}
	};

	onMounted(() => {
		refresh();
		if (process.client) {
			window.addEventListener('resize', refresh, { passive: true });
		}
	});

	onUnmounted(() => {
		if (process.client) {
			window.removeEventListener('resize', refresh);
		}
	});

	const isMobile = computed(() => {
		if (forcedIsMobile.value === true) return true;
		if (forcedIsMobile.value === false) return false;
		return detectedIsMobile.value;
	});

	const has3DCapability = computed(() => {
		// 1. Check manual overrides (URL or Debug Console)
		if (forcedHas3D.value === true) return true;
		if (forcedHas3D.value === false) return false;
		
		// 2. Apply Mobile Default Policy
		if (no3DOnMobile && isMobile.value) {
			return false;
		}

		// 3. Fallback to hardware detection
		return detectedHas3D.value;
	});

	const classObject = computed(() => ({
		'is-mobile': isMobile.value,
		'is-desktop': !isMobile.value,
		'is-3d': has3DCapability.value,
		'no-3d': !has3DCapability.value,
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
		windowWidth,

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
