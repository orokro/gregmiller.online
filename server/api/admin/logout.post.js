import { deleteCookie } from 'h3';

export default defineEventHandler(async (event) => {

	deleteCookie(event, 'gm_admin', { path: '/' });
	return { ok: true };
});
