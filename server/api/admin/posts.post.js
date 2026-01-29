/*
	admin/posts.post.js
	-------------------

	API endpoint to create a new blog post.

	Post params are:
	- title (string)
	- slug (string, optional)
	- content (string)
	- date (ISO string, optional)
	- tags (array of strings, optional)
	- categories (array of strings, optional)
	- flickrSetId (string, optional)
	- featuredImage (string, optional)
*/

// imports
import { Post } from '../../models/Post.js';
import { connectDb } from '../../utils/db.js';
import { requireAdmin } from '../../utils/requireAdmin.js';
import { normalizePostData, renderPostDataToHtml } from '../../utils/renderPostData.js';


/**
 * Slugify a string
 *
 * @param {string} s - string to slugify
 * @returns {string} - slugified string
 */
function slugify(s) {
	return String(s || '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}


/**
 * Handle create post requests
 */
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

	const normalized = normalizePostData(body?.postData);

	const content = normalized
		? await renderPostDataToHtml(normalized)
		: String(body?.content || '');

	const post = await Post.create({
		title,
		slug,
		content,
		postData: normalized || null,
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
