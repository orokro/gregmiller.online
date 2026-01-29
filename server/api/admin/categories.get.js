/*
	admin/categories.get.js
	-----------------------

	API endpoint to retrieve a list of all unique blog post categories for admin purposes.
*/

// imports
import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';


/**
 * Handle category list requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const categories = await Post.distinct('categories');
	return categories.filter(c => c).sort();
});
