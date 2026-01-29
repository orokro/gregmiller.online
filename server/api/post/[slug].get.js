/*
	post/[slug].get.js
	------------------

	This API route handles GET requests for individual blog posts based on their slug.

	Params:
	- slug (string): The slug of the blog post to retrieve.

	Returns:
	- The blog post object if found, otherwise a 404 error.
*/

// imports
import { Post } from '../../models/Post';
import { isAdmin } from '../../utils/isAdmin';


/**
 * Handle get post by slug requests
 */
export default defineEventHandler(async (event) => {

	await connectDb();

	const slug = getRouterParam(event, 'slug');

	const post = await Post.findOne({ slug });

	if (!post) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Post not found',
		});
	}

	// Draft protection: if not published, only allow admin
	if (post.status !== 'published') {
		const admin = isAdmin(event);
		if (!admin) {
			// Pretend it doesn't exist
			throw createError({
				statusCode: 404,
				statusMessage: 'Post not found',
			});
		}
	}

	return post;
});
