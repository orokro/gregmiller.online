import fs from 'node:fs/promises';
import path from 'node:path';
import { requireAdmin } from '../../../utils/requireAdmin.js';
import { getAssetsRoot, resolveSafe } from '../../../utils/assetsRoot.js';

export default defineEventHandler(async (event) => {
	requireAdmin(event);

	const root = getAssetsRoot();
	const body = await readBody(event);

	const from = String(body?.from || '').trim();
	const toName = String(body?.toName || '').trim();

	if (!from || !toName) {
		throw createError({ statusCode: 400, statusMessage: 'Missing from/toName' });
	}

	const absFrom = resolveSafe(root, from);
	const parentRel = from.split('/').slice(0, -1).join('/');
	const absParent = resolveSafe(root, parentRel);
	const absTo = path.join(absParent, toName);

	await fs.rename(absFrom, absTo);

	return { ok: true };
});
