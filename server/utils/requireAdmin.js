/*
	server/utils/requireAdmin.js
	----------------------------

	Utility function to verify that an incoming request has a valid admin session.
	If the session is invalid, it throws an error to prevent access to protected admin routes.
*/

// imports
import { getCookie, createError } from 'h3';
import { verifyAdminToken } from './adminSession.js';

export function requireAdmin(event) {

	const { adminCookieSecret } = useRuntimeConfig();
	if (!adminCookieSecret)
		throw createError({ statusCode: 500, statusMessage: 'Missing runtimeConfig.adminCookieSecret' });

	const token = getCookie(event, 'gm_admin');
	const ok = verifyAdminToken(token, adminCookieSecret, 1000 * 60 * 60 * 24 * 7);

	if (!ok)
		throw createError({ statusCode: 401, statusMessage: 'Admin auth required' });

}
