/*
	admin/posts/check-slug.get.js
	---------------------------

	API endpoint to check if a slug is available for a post.
	Query params:
	- slug (string): The slug to check.
	- exclude (string, optional): ID of a post to exclude from the check (e.g. the current post being edited).
*/

import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const query = getQuery(event);
	const slug = String(query.slug || '').trim();
	const exclude = String(query.exclude || '').trim();

	if (!slug) {
		return { available: false, error: 'Slug is required' };
	}

	const filter = { slug };
	if (exclude && exclude !== 'undefined') {
		filter._id = { $ne: exclude };
	}

	const exists = await Post.exists(filter);

	return {
		available: !exists,
		slug,
	};
});
