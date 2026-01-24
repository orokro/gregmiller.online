/*
	admin/posts/[id].get.js
	-----------------------

	API endpoint to retrieve a specific blog post by ID for admin purposes.

	param: id (string) - the ID of the blog post to retrieve
*/

// imports
import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);
	await connectDb();

	const id = getRouterParam(event, 'id');
	const post = await Post.findById(id);

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return post;
});
