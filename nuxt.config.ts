// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: true },

	// THIS IS CRITICAL for the app/ folder structure
	future: {
		compatibilityVersion: 4,
	},
});
