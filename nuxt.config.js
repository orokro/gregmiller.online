// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: '2025-07-15',
	devtools: { enabled: false },

	app: {
		head: {
			meta: [
				// This forces the status bar/browser UI to be your brand color
				{ name: 'theme-color', content: '#00ABAE' },
			]
		}
	},

	routeRules: {
		'/gm-admin/**': { ssr: false },
		'/img/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
		'/assets/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
		'/models/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
		'/textures/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
		'/env/**': { headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
	},

	nitro: {
		bodySizeLimit: '100mb'
	},

	runtimeConfig: {
		message: '',
		flickrApiKey: '',
		flickrName: '',
		adminPassword: '',
		adminCookieSecret: '',
		uploadRoot: '',
	},

	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					api: 'modern-compiler'
				}
			}
		},
		define: {
			// Enables detailed hydration mismatch warnings in the console
			__VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'true'
		}
	}
});
