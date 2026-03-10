/*
	useTheming.js
	-------------

	Provides access to the current theme and theming utilities.
*/

// vue
import { computed, nextTick, ref, shallowRef } from 'vue';

// app imports
import { useThree } from './useThree';

// theme imports
import { DebugTheme } from '../themes/DebugTheme';
import { GlassThemeOld } from '../themes/GlassThemeOld';
import { GlassTheme } from '../themes/GlassTheme';
import { KoiPondTheme } from '../themes/KoiPondTheme';
import { GardenTheme } from '../themes/GardenTheme';

// our current theme
const currentTheme = shallowRef(null);

// get object with default theme colors
function getThemeColorsDefaults() {
	return {
		primaryColor: '#00ABAE',
		secondaryColor: '#7561AA',
		accentColor: '#b0ec6bff',
		bgAccent1: '#E1EEF5',
		bgAccent2: '#EFF4F7',
		textColor: '#3a414bff',
		hoverColor: '#FFFFFF',
		scrollColor:  '#FFFFFF',
		fallbackBg: '#E1EEF5',
	}
}

// get object with defaults for current theme
function getThemeDefaults() {
	return {
		contentFrameShadow: 'inset 0px 0px 20px 5px rgba(0, 0, 0, 1.25)',
		contentHeaderTextColor: themeColors.value.primaryColor,
		contentHeaderBGColor: 'rgba(255, 255, 255, 0.8)',
		contentBoxBGColor: 'rgba(255, 255, 255, 0.8)',
		contentBoxBGBlur: '0px',
		tagBoxColor: themeColors.value.secondaryColor,
		tagBoxHoverColor: themeColors.value.primaryColor,
		tagTextColor: themeColors.value.hoverColor,
		tagTextHoverColor: themeColors.value.hoverColor,
	};
}

// create a reactive theme object
const themeColors = ref(getThemeColorsDefaults());

// other CSS vars not specifically colors
const themeStyles = ref(getThemeDefaults());



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
		--fallback-bg: ${themeColors.value.fallbackBg};
		--content-frame-shadow: ${themeStyles.value.contentFrameShadow};
		--content-header-text-color: ${themeStyles.value.contentHeaderTextColor};
		--content-header-bg-color: ${themeStyles.value.contentHeaderBGColor};
		--content-box-bg-color: ${themeStyles.value.contentBoxBGColor};
		--content-box-bg-blur: ${themeStyles.value.contentBoxBGBlur};
		--tag-box-color: ${themeStyles.value.tagBoxColor};
		--tag-box-hover-color: ${themeStyles.value.tagBoxHoverColor};
		--tag-text-color: ${themeStyles.value.tagTextColor};
		--tag-text-hover-color: ${themeStyles.value.tagTextHoverColor};
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

	// make sure CSS vars are updated
	const themeColors = { ...getThemeColorsDefaults(), ...currentTheme.value.themeClass.themeColors };
	setThemeColors(themeColors);

	// mix in defaults if theme doesn't provide all styles
	const themeSettings = {...getThemeDefaults(), ...currentTheme.value.themeClass.themeStyles};
	setThemeStyles(themeSettings);

	// tell ThreeManager to switch themes (calls init/unload on themes as needed)
	const { getThree } = useThree();
	getThree().then(threeManager => {
		if (threeManager) {
			threeManager.setTheme(currentTheme.value.themeClass);
			nextTick(() => {
				threeManager.requestRender();
			});
		}
	});
};


/**
 * Set theme properties by passing an object with any of the following
 * @param {Object} newTheme - object containing theme properties
 */
const setThemeColors = (newTheme) => {
	themeColors.value = { ...themeColors.value, ...newTheme };
};


/**
 * Set additional theme styles (non-color CSS vars)
 *
 * @param {Object} newStyles - object containing theme style properties
 */
const setThemeStyles = (newStyles) => {
	themeStyles.value = { ...themeStyles.value, ...newStyles };
}


// add our initial themes
addTheme('Debug Theme', DebugTheme);
addTheme('Glass Theme', GlassTheme);
addTheme('Koi Pond Theme', KoiPondTheme);
addTheme('Garden Theme', GardenTheme);
addTheme('Glass Theme Old', GlassThemeOld);


// save our initial theme
const defaultTheme = themes.value.find(t => t.name === 'Glass Theme') || themes.value[1];
if (defaultTheme) {
	setTheme(defaultTheme.name);
}

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
