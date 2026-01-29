/*
	admin/posts/[id].delete.js
	--------------------------

	API endpoint to delete a specific blog post by ID.

	param: id (string) - the ID of the blog post to delete
*/

// imports
import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';


/**
 * Handle delete post requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const id = getRouterParam(event, 'id');
	const post = await Post.findByIdAndDelete(id);

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return { ok: true };
});
