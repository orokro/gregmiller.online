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
	 * Initialize the manager (Call once from Layout).
	 * 
	 * @param {HTMLCanvasElement} canvas - The canvas to render on.
	 */
	const initThree = (canvas) => {
		
		// 1. If we already have a manager, check if it's the same canvas
		if (threeManager.value) {
			
			// If it's the same canvas, we're already good
			if (threeManager.value.canvas === canvas) {
				isInitialized.value = true;
				return threeManager.value;
			}
			
			// If it's a different canvas (or null), we MUST destroy the old manager
			// because WebGL contexts cannot be transferred between canvases.
			console.log('useThree: Canvas changed, destroying old ThreeManager');
			threeManager.value.destroy();
			threeManager.value = null;
		}

		// 2. Create the new manager if a canvas is provided
		if (canvas) {
			console.log('useThree: Initializing ThreeManager with canvas');
			threeManager.value = new ThreeManager(canvas);
		} else {
			console.warn('useThree: initThree called with null canvas');
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
