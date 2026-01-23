import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';

const ALLOWED_FIELDS = new Set([
	'title',
	'slug',
	'content',
	'date',
	'tags',
	'categories',
	'flickrSetId',
	'featuredImage',
	'status',
]);

export default defineEventHandler(async (event) => {
	requireAdmin(event);
	await connectDb();

	const id = getRouterParam(event, 'id');
	const body = await readBody(event);

	const update = {};
	for (const k of Object.keys(body || {})) {
		if (ALLOWED_FIELDS.has(k)) {
			update[k] = body[k];
		}
	}

	if (update.date) {
		update.date = new Date(update.date);
	}

	if (update.flickrSetId === '') {
		update.flickrSetId = null;
	}

	update.updatedAt = new Date();

	const post = await Post.findByIdAndUpdate(id, update, { new: true });

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return post;
});
