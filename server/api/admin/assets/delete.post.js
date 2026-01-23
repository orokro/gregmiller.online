import fs from 'node:fs/promises';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe } from '../../../utils/assetsRoot.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);

	const root = getAssetsRoot();
	const body = await readBody(event);

	const target = String(body?.path || '').trim();
	if (!target) {
		throw createError({ statusCode: 400, statusMessage: 'Missing path' });
	}

	const abs = resolveSafe(root, target);

	// rm works for both file & dir with recursive+force
	await fs.rm(abs, { recursive: true, force: true });

	return { ok: true };
});
