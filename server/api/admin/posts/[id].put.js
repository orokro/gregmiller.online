/*
	admin/posts/[id].put.js
	-----------------------

	API endpoint to update an existing blog post by ID.

	Put params are any of:
	- title (string)
	- slug (string)
	- content (string)
	- postData (object | string JSON)
	- date (ISO string)
	- tags (array of strings)
	- categories (array of strings)
	- flickrSetId (string, or empty string to clear)
	- featuredImage (string)
	- status (string: 'draft' or 'published')
*/

// imports
import { getRouterParam, createError } from 'h3';
import { Post } from '../../../models/Post.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { normalizePostData, renderPostDataToHtml } from '../../../utils/renderPostData.js';

// Allowed fields to update
const ALLOWED_FIELDS = new Set([
	'title',
	'slug',
	'content',
	'postData',
	'date',
	'tags',
	'categories',
	'flickrSetId',
	'featuredImage',
	'status',
]);


/**
 * Handle update post requests
 */
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

	// If postData is provided, it becomes the source of truth.
	// Generate SSR-friendly HTML into `content` on save.
	if ('postData' in update) {

		const normalized = normalizePostData(update.postData);

		if (!normalized) {
			update.postData = null;
			// Do NOT auto-clear content; allow legacy content to remain
			// (If you want clearing behavior, we can add a flag later)
		} else {
			update.postData = normalized;
			update.content = await renderPostDataToHtml(normalized);
		}
	}

	update.updatedAt = new Date();

	const post = await Post.findByIdAndUpdate(id, update, { new: true });

	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	return post;
});
