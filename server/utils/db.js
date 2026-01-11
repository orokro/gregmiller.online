/*
	db.js
	-----

	This utility file provides a function to connect to the MongoDB database using Mongoose.
	It checks if there's already an active connection before attempting to connect, ensuring efficient use of resources and preventing multiple connections.
*/

// imports
import mongoose from 'mongoose';

export async function connectDb() {
	if (mongoose.connection.readyState === 1 || mongoose.connection.readyState === 2) {
		return;
	}

	const MONGO_URI = 'mongodb://127.0.0.1:27017/gmiller_next';

	try {
		// We force TypeScript to accept this object as valid options
		await mongoose.connect(MONGO_URI, {
			serverSelectionTimeoutMS: 5000,
		});

		console.log('✅ (Re)Connected to MongoDB');
	} catch (e) {
		console.error('❌ MongoDB Connection Error:', e);
		throw createError({ statusCode: 503, statusMessage: 'Database Unavailable' });
	}
}
