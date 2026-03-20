/*
	admin/[id]/publish.post.js
	--------------------------

	API endpoint to publish a specific blog post by ID, changing its status to 'published'.

	params:
		- id (string) - the ID of the blog post to publish
*/

// imports
import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';


/**
 * Handle publish post requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const id = getRouterParam(event, 'id');
	const now = new Date();

	// First, find the post to see its current date and publishedAt
	const existingPost = await Post.findById(id);
	if (!existingPost) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	const update = {
		status: 'published',
		updatedAt: now,
	};

	// Only set date if it's missing (latch logic)
	if (!existingPost.date) {
		update.date = now;
	}

	// Only set publishedAt if it's missing
	if (!existingPost.publishedAt) {
		update.publishedAt = now;
	}

	const post = await Post.findByIdAndUpdate(id, update, { new: true });

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return post;
});
