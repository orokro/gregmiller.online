/*
	carousel.get.js
	---------------

	Public API endpoint to fetch all carousel slides.
*/

// imports
import { CarouselSlide } from '../models/CarouselSlide.js';
import { connectDb } from '../utils/db.js';


/**
 * Handle fetch carousel slides requests
 */
export default defineEventHandler(async (event) => {

	await connectDb();

	// find all slides and sort by order
	const slides = await CarouselSlide.find().sort({ order: 1 });

	return slides;
});
