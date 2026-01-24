/*
	admin/logout.post.js
	--------------------

	API endpoint to log out the admin user by clearing the session cookie.
*/

// imports
import { deleteCookie } from 'h3';

export default defineEventHandler(async (event) => {

	deleteCookie(event, 'gm_admin', { path: '/' });
	return { ok: true };
});
