import { getCookie } from 'h3';
import { verifyAdminToken } from '../../utils/adminSession.js';

export default defineEventHandler((event) => {
	const { adminCookieSecret } = useRuntimeConfig();
	const token = getCookie(event, 'gm_admin');

	const ok = verifyAdminToken(token, adminCookieSecret, 1000 * 60 * 60 * 24 * 7);

	return { authenticated: ok };
});
