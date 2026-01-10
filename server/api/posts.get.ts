/*
	posts.get.ts
	------------

	This API route handles GET requests to fetch a list of blog posts.
	It connects to the MongoDB database using the Mongoose model defined in Post.ts and retrieves the latest 10 posts, sorted by date in descending order.
	The response includes only the fields necessary for displaying a list of posts (title, slug, date, flickrSetId, and a snippet of content).
*/

// imports
import { Post } from '../models/Post';

// define the API route handler
export default defineEventHandler(async (event) => {

	const posts = await Post.find()
		.sort({ date: -1 })
		.limit(10)
		.select('title slug date flickrSetId featuredImage tags categories');

	return posts;
});
