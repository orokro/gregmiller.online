/*
	db.ts
	-----

	Here we define a Nitro plugin that connects to MongoDB using Mongoose.
	This plugin runs when the server starts, ensuring that we have a database connection ready for our API routes.
*/

// imports
import mongoose from 'mongoose';

// define the plugin
export default defineNitroPlugin(async (_nitroApp) => {

	const config = useRuntimeConfig();

	// In production, this will come from environment variables.
	// For now, it uses your tunnel.
	const MONGO_URI = 'mongodb://127.0.0.1:27017/gmiller_next';

	try {
		await mongoose.connect(MONGO_URI);
		console.log('✅ Connected to MongoDB');
	} catch (e) {
		console.error('❌ MongoDB Connection Error:', e);
	}
});
