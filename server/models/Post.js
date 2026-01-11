/*
	Post.js
	-------

	This file defines the Mongoose model for our blog posts. It specifies the schema for the "posts" collection in MongoDB, including fields like title, slug, content, date, flickrSetId, and legacyId.
*/

// imports
// If using nuxt-mongoose module, BUT standard mongoose is fine too:
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
	}]
});

export const Post = mongoose.model('Post', schema, 'posts');
