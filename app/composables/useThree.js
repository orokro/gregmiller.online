/*
	useThree.js
	-----------

	Composable to provide the singleton ThreeManager instance to the app.
	Uses a reactive pattern so components can strictly await the manager's existence.
*/

// imports
import { ThreeManager } from '~/utils/ThreeManager';
import { shallowRef, ref, watch } from 'vue';

// Module-level Singleton State
// These persist across the entire app lifecycle in the browser
const threeManager = shallowRef(null);
const isInitialized = ref(false);

export const useThree = () => {

	/**
	 * Initialize or tear down the manager (called from the default layout).
	 *
	 * The manager now creates its own in-document layer + canvas, so instead of a canvas
	 * this takes the render options (or null to shut 3D down).
	 *
	 * @param {Object|null} options - ThreeManager options (parallax, dprCap, ...) or null for no 3D
	 * @returns {ThreeManager|null}
	 */
	const initThree = (options) => {

		// 1. Shut down: destroy any existing manager
		if (!options) {

			if (threeManager.value) {
				console.log('useThree: 3D disabled, destroying ThreeManager');
				threeManager.value.destroy();
				threeManager.value = null;
			}

		// 2. Start up (once): reuse the running manager if there is one
		} else if (!threeManager.value) {

			console.log('useThree: Initializing ThreeManager', options);
			const mgr = new ThreeManager(options);

			// WebGL failed to start: behave like "no 3D"
			if (!mgr.isOk) {
				mgr.destroy();
				threeManager.value = null;
			} else {
				threeManager.value = mgr;
			}
		}

		// Mark as initialized so getThree() can resolve
		isInitialized.value = true;

		return threeManager.value;
	};


	/**
	 * Get the active instance as a Promise.
	 * 
	 * This is the preferred way for components to get the manager as it 
	 * handles the initial startup delay.
	 * 
	 * @returns {Promise<ThreeManager>}
	 */
	const getThree = async () => {

		// 1. If already initialized and we have a manager, return it immediately
		if (threeManager.value) {
			return threeManager.value;
		}

		// 2. If we've already tried to initialize and got null, return null
		if (isInitialized.value) {
			return threeManager.value;
		}

		// 3. Otherwise wait for the initialization signal
		return new Promise((resolve) => {
			const unwatch = watch(isInitialized, (val) => {
				if (val) {
					unwatch();
					resolve(threeManager.value);
				}
			});
		});
	};


	return {
		initThree,
		getThree,
		threeManager, // Exposed as a reactive ref
		isInitialized // Exposed for status checking
	};
};
