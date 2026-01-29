/*
	middleware/admin-api.js
	-----------------------

	Middleware to protect admin API routes by requiring a valid admin session.

	It works by checking the request URL. If the URL starts with /api/admin/ (except for /api/admin/login and /api/admin/session),
	it calls requireAdmin to verify the admin session cookie.

	If the session is invalid, requireAdmin will throw an error, preventing access to the admin API routes.
*/

// imports
import { requireAdmin } from '../utils/requireAdmin.js';


/**
 * Admin API middleware
 */
export default defineEventHandler((event) => {

	const url = event.node.req.url || '';

	if (!url.startsWith('/api/admin/')) {
		return;
	}

	// Allow login + session without cookie
	if (url.startsWith('/api/admin/login') || url.startsWith('/api/admin/session')) {
		return;
	}

	requireAdmin(event);
});
