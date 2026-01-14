/*
	useSearch.js
	------------
	Composable for managing site search.

	- searchQuery (ref): bound to the search input
	- searchResults (shallowRef): array of matched posts from the API
	- searchActive (ref boolean): true when query is not ''
	- resultsFound (ref boolean): true when searchResults is not empty
*/

import { ref, shallowRef, watch } from 'vue';

// shared state (singleton)
const searchQuery = ref('');
const searchResults = shallowRef([]);
const searchActive = ref(false);
const resultsFound = ref(false);

// internal
let debounceTimer = null;
let activeRequestId = 0;

function normalizeQuery(q) {
	return String(q || '').trim();
}

async function runSearch(q) {

	const requestId = ++activeRequestId;

	const query = normalizeQuery(q);

	searchActive.value = query !== '';

	// clear on empty
	if (!query) {
		searchResults.value = [];
		resultsFound.value = false;
		return;
	}

	try {

		const results = await $fetch('/api/search', {
			query: {
				q: query,
				limit: 25,
			},
		});

		// ignore stale responses
		if (requestId !== activeRequestId) return;

		const arr = Array.isArray(results) ? results : [];

		searchResults.value = arr;
		resultsFound.value = arr.length > 0;

	} catch (e) {

		if (requestId !== activeRequestId) return;

		console.error('Search failed:', e);
		searchResults.value = [];
		resultsFound.value = false;
	}
}

// debounce query changes
watch(searchQuery, (q) => {

	if (debounceTimer) {
		clearTimeout(debounceTimer);
		debounceTimer = null;
	}

	debounceTimer = setTimeout(() => {
		runSearch(q);
	}, 200);

}, { immediate: true });

export function useSearch() {
	return {
		searchQuery,
		searchResults,
		searchActive,
		resultsFound,
	};
}
