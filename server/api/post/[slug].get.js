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

	return post;
});
