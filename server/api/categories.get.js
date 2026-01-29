/*
	categories.get.js
	-----------------

	API endpoint to get all distinct categories from the posts collection.

	Returns:
	- categories (array) - sorted array of unique category strings
*/

// imports
import { Post } from '../models/Post';
import { connectDb } from '../utils/db';


/**
 * Handle category list requests
 */
export default defineEventHandler(async (event) => {

    await connectDb();

    // distinct categories
    const categories = await Post.distinct('categories', {
		$or: [
			{ status: 'published' },
			{ status: { $exists: false } },
			{ status: null },
		]
	});

    // Filter out nulls/empty and sort
    return categories.filter(c => c).sort();

});
