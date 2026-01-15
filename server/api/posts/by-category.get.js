/*
	by-category.get.js
	------------------
	Fetch *all* posts that contain a given category string.
	Intended for category pages that render large thumbnail grids.
*/

import { Post } from '../../models/Post';
import { connectDb } from '../../utils/db';

function makeExcerpt(html, maxLen = 180) {
	if (!html) return '';
	return html
		.replace(/<[^>]*>/g, '')	// strip tags
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, maxLen) + '…';
}

export default defineEventHandler(async (event) => {

	await connectDb();

	const query = getQuery(event);

	// required
	const category = (query.category || '').toString().trim();
	if (!category) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing required query param: category',
		});
	}

	// optional hard cap (avoid accidental nukes)
	// You said you don’t want pagination, so this just protects you from “infinite” responses.
	const MAX_POSTS = 5000;

	// optional override: /api/posts/by-category?category=Foo&limit=1234
	let limit = MAX_POSTS;
	if (query.limit !== undefined) {
		const parsed = parseInt(query.limit.toString(), 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			limit = Math.min(parsed, MAX_POSTS);
		}
	}

	// keep payload light for thumbnail grids
	const projection = {
		title: 1,
		slug: 1,
		date: 1,
		legacyId: 1,
		categories: 1,
		tags: 1,
		content: 1,
		featuredImage: 1,

		// include common “thumbnail-ish” fields if they exist in your documents
		thumbnail: 1,
		thumb: 1,
		coverImage: 1,
		heroImage: 1,
		flickrSetId: 1,
	};

	const posts = await Post.find({ categories: category }, projection)
		.sort({ date: -1 })
		.limit(limit)
		.lean();

	for (const p of posts) {
		p.excerpt = makeExcerpt(p.content);
		delete p.content;
	}

	return {
		category,
		count: posts.length,
		posts,
	};
});
