/*
	admin/carousel/index.get.js
	---------------------------

	API endpoint to fetch all carousel slides for administration.
*/

// imports
import { CarouselSlide } from '../../../models/CarouselSlide.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';


/**
 * Handle fetch all carousel slides requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	// find all slides and sort by order
	const slides = await CarouselSlide.find().sort({ order: 1 });

	return slides;
});
