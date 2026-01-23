export default async (to) => {
	if (!to.path.startsWith('/gm-admin')) return;

	let session;
	try {
		session = await $fetch('/api/admin/session', {
			credentials: 'include',
		});
	} catch {
		session = { authenticated: false };
	}

	const isLoggedIn = !!session?.authenticated;
	const isLoginRoute = to.path === '/gm-admin/login';

	if (!isLoggedIn && !isLoginRoute) {
		return '/gm-admin/login';
	}

	if (isLoggedIn && isLoginRoute) {
		return '/gm-admin';
	}
};
