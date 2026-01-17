/*
	homepage.post.js
	----------------

	Get the homepage post lists for the "Any" category and each of the requested categories.
*/

import { Post } from '../../models/Post';

export default defineEventHandler(async (event) => {

	// 1. Read the category list from the request body
	const body = await readBody(event);
	const requestedCategories = Array.isArray(body.categories) ? body.categories : [];
	const count = Number.isInteger(body.count) && body.count > 0 ? body.count : 5; // Default to 5 posts per category

	// 2. Define the projection (fields to return)
	// We strictly limit this to minimize payload size for speed.
	const projection = {
		title: 1,
		slug: 1,
		featuredImage: 1,
		date: 1,
		// We deliberately exclude 'content', 'excerpt', 'tags', etc.
	};

	// 3. Build the $facet object dynamically
	// This creates a separate pipeline for "any" and each requested category
	const facetPipelines = {

		// "Any": The top 5 most recent posts regardless of category
		any: [
			{ $sort: { date: -1 } },
			{ $limit: count+1 },
			{ $project: projection }
		]
	};

	// Add a pipeline for each requested category string
	requestedCategories.forEach((category) => {

		// Using the category name as the key for the result
		facetPipelines[category] = [
			{ $match: { categories: category } }, // Filter by category
			{ $sort: { date: -1 } },              // Sort newest first
			{ $limit: count },                        // Take top posts as per count
			{ $project: projection }              // Select only needed fields
		];
	});

	// 4. Execute the Aggregation
	// results will be an array containing a single object with keys matching the facet names
	const [results] = await Post.aggregate([
		{ $facet: facetPipelines }
	]);

	// 5. Return the result object directly
	// Shape: { "any": [...], "Urban Ex": [...], "Art": [...] }
	return results;
});
