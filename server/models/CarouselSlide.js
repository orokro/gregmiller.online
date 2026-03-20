/*
	CarouselSlide.js
	----------------
	This file defines the Mongoose model for our hero carousel slides.
*/

// imports
import mongoose from 'mongoose';

// Define the schema for a carousel slide
const schema = new mongoose.Schema({
	imageUrl: { type: String, required: true },
	link: String,
	duration: { type: Number, default: 2000 },
	order: { type: Number, default: 0 },
	updatedAt: { type: Date, default: Date.now },
});

// Prevent model overwrite in dev/hmr
export const CarouselSlide = mongoose.models.CarouselSlide || mongoose.model('CarouselSlide', schema, 'carousel_slides');
