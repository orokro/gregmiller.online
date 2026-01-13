/*
	useSearch.js
	------------
	Composable for managing site search.

	- searchQuery (ref): bound to the search input
	- searchResults (shallowRef): array of matched results
	- searchActive (ref boolean): true when query is not ''
	- resultsFound (ref boolean): true when searchResults is not empty

	Implementation notes:
	- Debounced search to avoid spamming requests
	- Uses /api/posts as the data source and filters client-side
*/

// vue
import { ref, shallowRef, watch } from 'vue';

// shared state (singleton) like useHamburger.js
const searchQuery = ref('');
const searchResults = shallowRef([]);
const searchActive = ref(false);
const resultsFound = ref(false);

// internal
let debounceTimer = null;
let activeRequestId = 0;


/**
 * Normalizes the query string by trimming whitespace.
 *
 * @param {String} q - the raw query string
 * @return {String} the normalized query string
 */
function normalizeQuery(q) {
	return String(q || '').trim();
}


/**
 * Tokenizes the query string into an array of terms.
 *
 * @param {String} q - query
 * @returns {String} - cleaned / tokenized query
 */
function tokenize(q) {

	const cleaned = normalizeQuery(q).toLowerCase();
	if (!cleaned)
		return [];

	return cleaned.split(/\s+/g).filter(Boolean);
}


/**
 * Flattens a post object into a single string for searching.
 *
 * @param {object} post - the post object to stringify
 * @return {string} a flattened string of the post's searchable content
 */
function stringifyPost(post) {

	// defensively flatten likely searchable fields
	const parts = [
		post?.title,
		post?.slug,
		post?.content,
		Array.isArray(post?.tags) ? post.tags.join(' ') : post?.tags,
		Array.isArray(post?.categories) ? post.categories.join(' ') : post?.categories,
	];
	return parts
		.filter(Boolean)
		.map(v => String(v).toLowerCase())
		.join(' ');
}


/**
 * Performs the search query and updates results.
 *
 * @param {String} q - query string
 */
async function runSearch(q) {

	const requestId = ++activeRequestId;

	const query = normalizeQuery(q);

	// update booleans immediately
	searchActive.value = query !== '';

	// clear on empty
	if (!query) {
		searchResults.value = [];
		resultsFound.value = false;
		return;
	}

	try {

		// pull posts and filter locally
		const posts = await $fetch('/api/posts');

		// if a newer request started, ignore this result
		if (requestId !== activeRequestId) return;

		const terms = tokenize(query);

		// if somehow empty after trim/tokenize, treat as cleared
		if (!terms.length) {
			searchResults.value = [];
			resultsFound.value = false;
			return;
		}

		const filtered = (Array.isArray(posts) ? posts : []).filter((post) => {
			const haystack = stringifyPost(post);
			// require ALL terms to match somewhere
			return terms.every(t => haystack.includes(t));
		});

		searchResults.value = filtered;
		resultsFound.value = filtered.length > 0;

	} catch (e) {

		// if a newer request started, ignore this result
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
