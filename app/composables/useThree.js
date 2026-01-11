/*
	useThree.js
	-----------

	Composable to provide the singleton ThreeManager instance to the app.
	Uses a Promise pattern so components can strictly await the manager's existence.
*/

// imports
import { ThreeManager } from '~/utils/ThreeManager';

// Module-level Singleton State
let threeManager = null;
let resolveInit = null;

// This promise will sit pending until initThree is called
const initPromise = new Promise((resolve) => {
	resolveInit = resolve;
});

export const useThree = () => {

	/**
	 * Initialize the manager (Call once from App.vue).
	 * Resolves the global promise, unblocking any waiting components.
	 * * @param {HTMLCanvasElement} canvas - The canvas to render on.
	 */
	const initThree = (canvas) => {
		if (!threeManager && canvas) {
			threeManager = new ThreeManager(canvas);
			resolveInit(threeManager); // 🚀 BLAST OFF
		}
		return threeManager;
	};


	/**
	 * Get the active instance as a Promise.
	 * * @returns {Promise<ThreeManager>}
	 */
	const getThree = () => {

		// If already initialized (e.g. navigating to new page later), resolve immediately
		if (threeManager) {
			return Promise.resolve(threeManager);
		}

		// Otherwise wait for App.vue to finish init
		return initPromise;
	};


	return {
		initThree,
		getThree
	};
};
