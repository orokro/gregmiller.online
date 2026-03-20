/*
	subdomain.js
	------------

	Server middleware to handle the about.gregmiller.online subdomain.
*/

export default defineEventHandler((event) => {
	const host = getRequestHeader(event, 'host');
	
	if (host === 'about.gregmiller.online') {
		const url = getRequestURL(event);
		
		// If the user is hitting the root of the subdomain, serve the about-me page content
		if (url.pathname === '/') {
			// Internal rewrite to /about-me
			event.node.req.url = '/about-me';
		}
	}
});
