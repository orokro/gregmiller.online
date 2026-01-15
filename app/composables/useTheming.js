/*
	useTheming.js
	-------------

	Provides access to the current theme and theming utilities.
*/

// vue
import { computed, ref, shallowRef } from 'vue';

// app imports
import { useThree } from './useThree';

// theme imports
import { DebugTheme } from '../themes/DebugTheme';
import { GlassThemeOld } from '../themes/GlassThemeOld';
import { GlassTheme } from '../themes/GlassTheme';

// our current theme
const currentTheme = shallowRef(null);

// define our theme default colors
const primaryColor = '#00ABAE';
const secondaryColor = '#7561AA';
const accentColor = '#b0ec6bff';
const bgAccent1 = '#E1EEF5';
const bgAccent2 = '#EFF4F7';
const textColor = '#3a414bff';
const hoverColor = '#FFFFFF';
const scrollColor =  '#FFFFFF';

// create a reactive theme object
const themeColors = ref({
	primaryColor,
	secondaryColor,
	accentColor,
	bgAccent1,
	bgAccent2,
	textColor,
	hoverColor,
	scrollColor
});

// make computed CSS vars string based on theme
const themeCSSVars = computed(() => {
	return `
		--color-primary: ${themeColors.value.primaryColor};
		--color-secondary: ${themeColors.value.secondaryColor};
		--color-accent: ${themeColors.value.accentColor};
		--color-bg-accent-1: ${themeColors.value.bgAccent1};
		--color-bg-accent-2: ${themeColors.value.bgAccent2};
		--color-text: ${themeColors.value.textColor};
		--color-hover: ${themeColors.value.hoverColor};
		--color-scroll: ${themeColors.value.scrollColor};
	`;
});

// global list of themes available
const themes = shallowRef([]);


/**
 * Adds a theme to the global list of themes.
 *
 * @param {String} name - name to show in UI
 * @param {Constructor} themeClass - class for theme
 */
const addTheme = (name, themeClass) => {

	// Check if theme with the same name already exists
	if (themes.value.some(t => t.name === name)) {
		console.warn(`Theme with name "${name}" already exists. Skipping.`);
		return;
	}

	// add to global list
	themes.value = [...themes.value, { name, themeClass }];
}


/**
 * Changes the site's global theme
 *
 * @param {String|Constructor} theme - theme name or constructor name
 */
const setTheme = (theme) => {

	// if it's a string, find by name otherwise, find by class
	const themeEntry = themes.value.find(t => t.name === theme || t.themeClass.name === theme);

	if (!themeEntry) {
		console.error(`Theme "${theme}" not found.`);
		return;
	}

	// save current theme
	currentTheme.value = themeEntry;

	// update our colors from the theme's default colors (if it has any)
	setThemeColors(currentTheme.value.themeClass.themeColors || {});

	// tell ThreeManager to switch themes (calls init/unload on themes as needed)
	const { getThree } = useThree();
	getThree().then(threeManager => {
		threeManager.setTheme(currentTheme.value.themeClass);
	});
};


/**
 * Set theme properties by passing an object with any of the following
 * @param {Object} newTheme - object containing theme properties
 */
const setThemeColors = (newTheme) => {
	themeColors.value = { ...themeColors.value, ...newTheme };
};


// add our initial themes
addTheme('Debug Theme', DebugTheme);
addTheme('Glass Theme', GlassTheme);
addTheme('Glass Theme Old', GlassThemeOld);


// save our initial theme
currentTheme.value = themes.value[1];

/**
 * Exports theme data and utilities for use in components.
 *
 * @returns exports
 */
export function useTheming() {

	return {
		// theme data
		currentTheme,
		themes,
		themeColors,
		themeCSSVars,

		// theme utilities
		addTheme,
		setTheme,
		setThemeColors
	};
}
