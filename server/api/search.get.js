/*
	search.get.js
	-------------
	Real server-side search endpoint using MongoDB text search.

	Query params:
	- q: string (required)
	- limit: number (optional, default 20)
	- category: string (optional)
*/

// imports
import { Post } from '../models/Post';
import { connectDb } from '../utils/db';

export default defineEventHandler(async (event) => {

	await connectDb();

	const query = getQuery(event);

	const q = String(query.q || '').trim();
	const limit = Math.min(parseInt(query.limit || '20', 10) || 20, 50);

	// nothing to search
	if (!q)
		return [];

	const filter = {
		$text: { $search: q },
	};

	// optional category filter, same style as posts.get.js :contentReference[oaicite:3]{index=3}
	if (query.category) {
		filter.categories = query.category;
	}

	// textScore sorting + include only useful fields
	const results = await Post.find(filter, {
		score: { $meta: 'textScore' },
	})
		.sort({ score: { $meta: 'textScore' }, date: -1 })
		.limit(limit);

	return results;
});
