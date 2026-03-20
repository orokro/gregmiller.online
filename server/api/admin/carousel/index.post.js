/*
	admin/carousel/index.post.js
	----------------------------

	API endpoint to save/update the entire list of carousel slides.
	This handles creating, updating, and reordering slides in bulk.
*/

// imports
import { CarouselSlide } from '../../../models/CarouselSlide.js';
import { connectDb } from '../../../utils/db.js';
import { requireAdmin } from '../../../utils/requireAdmin.js';


/**
 * Handle save all carousel slides requests
 */
export default defineEventHandler(async (event) => {

	requireAdmin(event);
	await connectDb();

	const body = await readBody(event);
	const slidesData = Array.isArray(body?.slides) ? body.slides : [];

	// get the IDs of the current slides being sent
	const slideIds = slidesData
		.map(s => s._id)
		.filter(Boolean);

	// remove any slides that are not in the new list
	await CarouselSlide.deleteMany({ _id: { $nin: slideIds } });

	// update or create slides from the new list
	const now = new Date();
	const results = [];

	for (let i = 0; i < slidesData.length; i++) {

		const data = slidesData[i];
		const update = {
			imageUrl: String(data.imageUrl || ''),
			link: String(data.link || ''),
			duration: Number(data.duration) || 2000,
			order: i,
			updatedAt: now,
		};

		let slide;
		if (data._id) {
			slide = await CarouselSlide.findByIdAndUpdate(data._id, update, { new: true });
		} else {
			slide = await CarouselSlide.create(update);
		}

		if (slide) {
			results.push(slide);
		}
	}

	return results;
});
