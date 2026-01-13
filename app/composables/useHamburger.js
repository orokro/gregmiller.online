/*
	useHamburger.js
	---------------

	Composable for managing the state of the mobile hamburger menu.
*/

import { ref } from 'vue';

const isOpen = ref(false);

export function useHamburger() {

	function toggle() {
		isOpen.value = !isOpen.value;
	}

	function close() {
		isOpen.value = false;
	}

	return {
		isOpen,
		toggle,
		close
	};
}
