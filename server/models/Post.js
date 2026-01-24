/*
	Post.js
	-------
	This file defines the Mongoose model for our blog posts.
*/

// imports
import mongoose from 'mongoose';

// Define the schema for a blog post
const schema = new mongoose.Schema({
	title: String,
	slug: String,
	content: String,
	date: Date,
	flickrSetId: String,
	legacyId: Number,
	tags: [String],
	categories: [String],
	featuredImage: String, // e.g., "/wp-content/uploads/2012/05/pic.jpg"
	nextGenGallery: [{
		caption: String
	}],
	status: { type: String, default: 'published' }, // 'draft' | 'published' | 'private'
	updatedAt: { type: Date, default: Date.now },
	publishedAt: { type: Date, default: null },
});

// Text index for real search
schema.index(
	{
		title: 'text',
		content: 'text',
		tags: 'text',
		categories: 'text',
	},
	{
		weights: {
			title: 10,
			tags: 5,
			categories: 3,
			content: 1,
		},
		name: 'PostTextIndex',
	}
);

// Prevent model overwrite in dev/hmr
export const Post = mongoose.models.Post || mongoose.model('Post', schema, 'posts');
