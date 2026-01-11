
import { Post } from '../models/Post';
import { connectDb } from '../utils/db';

export default defineEventHandler(async (event) => {
    await connectDb();
    // distinct categories
    const categories = await Post.distinct('categories');
    // Filter out nulls/empty and sort
    return categories.filter(c => c).sort();
});
