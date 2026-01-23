import { getCookie, createError } from 'h3';
import { verifyAdminToken } from './adminSession.js';

export function requireAdmin(event) {
	const { adminCookieSecret } = useRuntimeConfig();
	if (!adminCookieSecret) {
		throw createError({ statusCode: 500, statusMessage: 'Missing runtimeConfig.adminCookieSecret' });
	}

	const token = getCookie(event, 'gm_admin');
	const ok = verifyAdminToken(token, adminCookieSecret, 1000 * 60 * 60 * 24 * 7);

	if (!ok) {
		throw createError({ statusCode: 401, statusMessage: 'Admin auth required' });
	}
}
