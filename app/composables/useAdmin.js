/*
	useAdmin.js
	-----------

	Composables for admin-specific state and utilities.
*/

/**
 * Shared state for the active tab in the admin panel
 * @returns Ref<string>
 */
export const useAdminTab = () => useState('admin_active_tab', () => 'posts');
