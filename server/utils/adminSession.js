import crypto from 'node:crypto';

export function signAdminToken(secret) {

	const ts = Date.now().toString();
	const sig = crypto.createHmac('sha256', secret).update(ts).digest('hex');
	return `${ts}.${sig}`;
}

export function verifyAdminToken(token, secret, maxAgeMs) {

	if (!token)
		return false;

	const parts = token.split('.');
	if (parts.length !== 2)
		return false;

	const [tsStr, sig] = parts;
	const ts = Number(tsStr);
	if (!Number.isFinite(ts))
		return false;

	if ((Date.now() - ts) > maxAgeMs)
		return false;

	const expected = crypto.createHmac('sha256', secret).update(tsStr).digest('hex');

	// timing-safe compare
	const a = Buffer.from(sig);
	const b = Buffer.from(expected);
	if (a.length !== b.length)
		return false;

	return crypto.timingSafeEqual(a, b);
}
