/*
	server/utils/adminSession.js
	----------------------------

	Utility functions to sign and verify admin session tokens.

	It works by creating a token that includes a timestamp and a HMAC-SHA256 signature.
	The token is structured as: "<timestamp>.<signature>"

	The signature is generated using a secret key and the timestamp.

	To verify the token, we check that:
	1. The token is well-formed.
	2. The timestamp is within the allowed max age.
	3. The signature matches the expected value for the given timestamp and secret.
*/

// imports
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
