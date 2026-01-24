/*
	admin/login.post.js
	-------------------

	API endpoint to log in the admin user by setting a session cookie.

	Post params are:
	- password (string)
*/

// imports
import { readBody, setCookie, createError } from 'h3';
import { signAdminToken } from '../../utils/adminSession.js';

export default defineEventHandler(async (event) => {

	const { adminPassword, adminCookieSecret } = useRuntimeConfig();
	if (!adminPassword || !adminCookieSecret)
		throw createError({ statusCode: 500, statusMessage: 'Missing admin runtimeConfig' });

	const body = await readBody(event);
	const password = body?.password || '';

	if (password !== adminPassword)
		throw createError({ statusCode: 401, statusMessage: 'Invalid password' });

	const token = signAdminToken(adminCookieSecret);

	setCookie(event, 'gm_admin', token, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 7 days
	});

	return { ok: true };
});
