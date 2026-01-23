import { requireAdmin } from '../utils/requireAdmin.js';

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
