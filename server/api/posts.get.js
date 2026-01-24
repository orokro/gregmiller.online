/*
	posts.get.js
	------------

	This API route handles GET requests to fetch a list of blog posts.
	It connects to the MongoDB database using the Mongoose model defined in Post.ts and retrieves the latest 10 posts, sorted by date in descending order.
	The response includes only the fields necessary for displaying a list of posts (title, slug, date, flickrSetId, and a snippet of content).

	Parameters:
	- category (string, optional) - if provided, filters posts to only those in the specified category

	Returns:
	- posts (array) - array of post objects with necessary fields
*/

// imports
import { Post } from '../models/Post';
import { connectDb } from '../utils/db';

// define the API route handler
export default defineEventHandler(async (event) => {

    // console.log('API: /api/posts called');
	await connectDb();

	const query = getQuery(event);
	const filter = {};

	if (query.category) {
		filter.categories = query.category;
	}

    // console.log('API: Fetching posts with filter:', filter);

    // Fetch the latest 10 posts, sorted by date descending
    const posts = await Post.find(filter)
        .sort({ date: -1 })
        .limit(10);

    // console.log(`API: Found ${posts.length} posts`);

	return posts;
});
