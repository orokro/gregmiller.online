/*
	subdomain.js
	------------

	Server middleware to handle the about.gregmiller.online subdomain.
	Redirects to the main domain to prevent broken links and asset issues.
*/

export default defineEventHandler((event) => {
	const host = getRequestHeader(event, 'host');
	
	if (host === 'about.gregmiller.online') {
		const url = getRequestURL(event);
		
		let targetUrl = 'https://gregmiller.online';

		// If the user is hitting the root of the subdomain, redirect to the about-me page
		if (url.pathname === '/') {
			targetUrl += '/about-me';
		} else {
			// For any other path, redirect to the same path on the main domain
			targetUrl += url.pathname + url.search;
		}

		// Perform the redirect
		return sendRedirect(event, targetUrl, 302);
	}
});
