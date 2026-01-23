import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';

function slugify(s) {
	return String(s || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export default defineEventHandler(async (event) => {
	requireAdmin(event);
	await connectDb();

	const body = await readBody(event);

	const title = String(body?.title || 'Untitled').trim();
	let slug = String(body?.slug || '').trim();

	if (!slug) {
		slug = slugify(title) || `post-${Date.now()}`;
	}

	// Ensure unique slug
	let base = slug;
	let i = 2;
	while (await Post.exists({ slug })) {
		slug = `${base}-${i++}`;
	}

	const now = new Date();

	const post = await Post.create({
		title,
		slug,
		content: String(body?.content || ''),
		date: body?.date ? new Date(body.date) : now,
		tags: Array.isArray(body?.tags) ? body.tags : [],
		categories: Array.isArray(body?.categories) ? body.categories : [],
		flickrSetId: body?.flickrSetId ? String(body.flickrSetId) : null,
		featuredImage: body?.featuredImage ? String(body.featuredImage) : '',
		status: 'draft',
		updatedAt: now,
		publishedAt: null,
	});

	return post;
});
