/*
	by-tag.get.js
	-------------
	Fetch *all* posts that contain a given tag string.
	Intended for tag pages that render large thumbnail grids.
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
	const tag = (query.tag || '').toString().trim();
	if (!tag) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Missing required query param: tag',
		});
	}

	const MAX_POSTS = 5000;

	let limit = MAX_POSTS;
	if (query.limit !== undefined) {
		const parsed = parseInt(query.limit.toString(), 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			limit = Math.min(parsed, MAX_POSTS);
		}
	}

	const projection = {
		title: 1,
		slug: 1,
		date: 1,
		legacyId: 1,
		categories: 1,
		tags: 1,
		content: 1,
		featuredImage: 1,
	};

	const posts = await Post.find({ tags: tag }, projection)
		.sort({ date: -1 })
		.limit(limit)
		.lean();

	for (const p of posts) {
		p.excerpt = makeExcerpt(p.content);
		delete p.content;
	}

	return {
		tag,
		count: posts.length,
		posts,
	};
});
