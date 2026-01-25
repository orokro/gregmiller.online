/*
	server/utils/isAdmin.js
	-----------------------

	Utility function to check if an incoming request has a valid admin session without throwing an error.
	Returns true if admin, false otherwise.
*/

// imports
import { getCookie } from 'h3';
import { verifyAdminToken } from './adminSession.js';

export function isAdmin(event) {

	const { adminCookieSecret } = useRuntimeConfig();
	if (!adminCookieSecret) {
		console.warn('Missing runtimeConfig.adminCookieSecret');
		return false;
	}

	const token = getCookie(event, 'gm_admin');
	// 7 days max age, matching requireAdmin
	return verifyAdminToken(token, adminCookieSecret, 1000 * 60 * 60 * 24 * 7);
}
