/*
	post/[slug].get.js
	------------------

	This API route handles GET requests for individual blog posts based on their slug.

*/
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
