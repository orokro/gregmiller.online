import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe } from '../../../utils/assetsRoot.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);

	const root = getAssetsRoot();
	const body = await readBody(event);

	const parent = String(body?.path || '').trim();
	const name = String(body?.name || '').trim();

	if (!name) {
		throw createError({ statusCode: 400, statusMessage: 'Missing name' });
	}

	const absParent = resolveSafe(root, parent);
	const abs = path.join(absParent, name);

	await fs.mkdir(abs, { recursive: true });

	return { ok: true };
});
