/*
	use3DLettering.js
	-----------------

	Composable for loading, measuring, and assembling 3D letter models into a text group.
*/

// imports
import * as THREE from 'three';

// Module-level cache (Singleton)
// Persists across all instances of components using this composable
const geometryCache = new Map();
const measurementCache = new Map();

export function use3DLettering() {

	/**
	 * Loads specific letters, measures them, and returns geometry data.
	 * @param {Object} manager - The threeManager instance
	 * @param {String} text - The string to load models for
	 */
	async function loadAndMeasureLetters(manager, text) {
		const uniqueChars = [...new Set(text.split('').filter(c => c.trim() !== ''))];

		// 1. Identify missing chars
		const missingChars = uniqueChars.filter(char => !geometryCache.has(char));

		// 2. Load missing assets
		if (missingChars.length > 0) {
			const paths = missingChars.map(char => `/models/text/${char.toUpperCase()}.glb`);

			// Load all in parallel
			const results = await manager.assetsReady(paths);

			// Process results
			results.forEach((gltfScene, index) => {
				const char = missingChars[index];

				if (!gltfScene) {
					console.error(`Failed to load model for character: ${char}`);
					return;
				}

				// Extract mesh (Assumes single root mesh structure like GMILLER.glb)
				// We clone the geometry so we don't mutate the original cached GLTF resource
				const mesh = gltfScene.children[0].clone();

				// Measure
				// Ensure rotation/scale is neutralized for measurement if necessary,
				// but usually we measure the raw local geometry.
				const box = new THREE.Box3().setFromObject(mesh);
				const width = box.max.x - box.min.x;

				// Cache the clean mesh and its measurement
				geometryCache.set(char, mesh);
				measurementCache.set(char, width);
			});
		}

		return {
			getMesh: (char) => geometryCache.get(char)?.clone(),
			getWidth: (char) => measurementCache.get(char) || 0
		};
	}


	/**
	 * Assembles a group of letters centered at (0,0,0)
	 */
	function assembleTextGroup(text, letterData, material) {
		const group = new THREE.Group();
		const spacing = 0.15; // Adjustable kerning value
		const spaceWidth = spacing * 2; // A space is approx 5x the kerning distance

		let currentX = 0;
		const letterObjects = [];

		// 1. Create meshes and calculate positions
		for (const char of text) {
			if (char === ' ') {
				currentX += spaceWidth;
				continue;
			}

			const mesh = letterData.getMesh(char);
			if (mesh) {
				const width = letterData.getWidth(char);

				// Apply shared material
				mesh.material = material;
				mesh.castShadow = true;
				mesh.receiveShadow = true;

				// Position locally
				mesh.position.x = currentX + (width / 2); // Center pivot adjustment if needed

				group.add(mesh);
				letterObjects.push(mesh);

				currentX += width + spacing;
			}
		}

		// 2. Center the whole group
		const totalWidth = currentX;
		const xOffset = -totalWidth / 2;

		group.children.forEach(child => {
			child.position.x += xOffset;
		});

		return group;
	}


	return {
		loadAndMeasureLetters,
		assembleTextGroup
	};
}
