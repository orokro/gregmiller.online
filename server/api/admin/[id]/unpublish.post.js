/*
	admin/[id]/unpublish.post.js
	----------------------------

	API endpoint to unpublish a specific blog post by ID, changing its status to 'draft'.

	params:
		- id (string) - the ID of the blog post to unpublish

*/

// imports
import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';

export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const id = getRouterParam(event, 'id');
	const now = new Date();

	const post = await Post.findByIdAndUpdate(
		id,
		{ status: 'draft', updatedAt: now },
		{ new: true }
	);

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return post;
});
