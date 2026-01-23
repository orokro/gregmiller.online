import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);
	await connectDb();

	const categories = await Post.distinct('categories');
	return categories.filter(c => c).sort();
});
