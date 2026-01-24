/*
	admin/posts.get.js
	------------------

	API endpoint to retrieve a list of blog posts for admin purposes.

	Query params are:
	- q (string, optional) - search query
	- limit (number, optional) - max number of posts to return (default 200, max 500)
	- skip (number, optional) - number of posts to skip (default 0)
*/

// imports
import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const q = String(getQuery(event).q || '').trim();
	const limit = Math.min(parseInt(getQuery(event).limit || '200', 10) || 200, 500);
	const skip = Math.max(parseInt(getQuery(event).skip || '0', 10) || 0, 0);

	const filter = {};
	if (q) {
		filter.$text = { $search: q };
	}

	const projection = {
		title: 1,
		slug: 1,
		date: 1,
		status: 1,
		updatedAt: 1,
		publishedAt: 1,
		featuredImage: 1,
	};

	const posts = await Post.find(filter, projection)
		.sort(q ? { score: { $meta: 'textScore' }, date: -1 } : { date: -1 })
		.skip(skip)
		.limit(limit)
		.lean();

	return posts;
});
