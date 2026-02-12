<!-- app/components/DebugConsole.vue -->
<script setup>

import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { useDeviceContext } from '~/composables/useDeviceContext';
import { useDebugging } from '~/composables/useDebugging';
import { useThree } from '~/composables/useThree';

const { isMobile, has3DCapability, detectedIsMobile, detectedHas3D, forcedIsMobile, forcedHas3D, setMobileOverride, set3DOverride, refresh } = useDeviceContext();
const { getThree } = useThree();
const { debugVars, logEntries, log, clearLog, setDebugVar } = useDebugging();

const isOpen = ref(false);
const inputEl = ref(null);
const inputValue = ref('');

const history = ref([]);
const historyIndex = ref(-1);

const logWrapEl = ref(null);

const parseToken = (t) => {
	if (typeof t !== 'string')
		return t;

	const s = t.trim();

	// boolean
	if (/^(true|false)$/i.test(s))
		return s.toLowerCase() === 'true';

	// null
	if (/^(null)$/i.test(s))
		return null;

	// number (parseFloat)
	const n = parseFloat(s);
	if (!Number.isNaN(n) && String(n) !== 'NaN') {
		// Ensure token is actually numeric-like (avoid "123abc" becoming 123)
		if (/^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i.test(s))
			return n;
	}

	return s;
};

const focusInput = async () => {
	await nextTick();
	if (inputEl.value)
		inputEl.value.focus();
};

const scrollLogToBottom = async () => {
	await nextTick();
	if (!logWrapEl.value)
		return;
	logWrapEl.value.scrollTop = logWrapEl.value.scrollHeight;
};

watch(isOpen, async (open) => {
	if (open) {
		await focusInput();
		await scrollLogToBottom();
	}
});

watch(logEntries, async () => {
	if (isOpen.value)
		await scrollLogToBottom();
}, { deep: true });

const describeMobileStatus = () => {
	const real = detectedIsMobile.value ? 'mobile device' : 'non-mobile device';
	const forced = forcedIsMobile.value === null ? 'no override' : `forced=${forcedIsMobile.value}`;
	const effective = isMobile.value ? 'mobile enabled' : 'desktop enabled';
	return `Mobile: ${effective} (${real}, ${forced}).`;
};

const describe3DStatus = () => {
	const real = detectedHas3D.value ? '3D capable' : '3D NOT capable';
	const forced = forcedHas3D.value === null ? 'no override' : `forced=${forcedHas3D.value}`;
	const effective = has3DCapability.value ? '3D enabled' : '3D disabled';
	return `3D: ${effective} (${real}, ${forced}).`;
};

const findKeyInsensitive = (obj, wantedKey) => {
	if (!obj || !wantedKey)
		return null;

	const want = String(wantedKey).toLowerCase();
	for (const k of Object.keys(obj)) {
		if (String(k).toLowerCase() === want)
			return k;
	}

	return null;
};

const commands = computed(() => ({

	mobile: (...args) => {
		if (args.length < 1) {
			log(describeMobileStatus());
			return;
		}

		const v = args[0];
		if (v !== true && v !== false) {
			log(`mobile expects true/false. Example: mobile true`);
			log(describeMobileStatus());
			return;
		}

		const before = isMobile.value;
		setMobileOverride(v);
		const after = isMobile.value;

		if (before === after) {
			log(`Mobile override set to ${v}, but effective mode did not change.`);
		} else {
			log(`Mobile effective mode changed: ${before ? 'mobile' : 'desktop'} -> ${after ? 'mobile' : 'desktop'}.`);
		}

		log(describeMobileStatus());
	},

	'3don': (...args) => {
		if (args.length < 1) {
			log(describe3DStatus());
			return;
		}

		const v = args[0];
		if (v !== true && v !== false) {
			log(`3don expects true/false. Example: 3don true`);
			log(describe3DStatus());
			return;
		}

		const before = has3DCapability.value;
		set3DOverride(v);
		const after = has3DCapability.value;

		if (before === after) {
			log(`3D override set to ${v}, but effective mode did not change.`);
		} else {
			log(`3D effective mode changed: ${before ? 'on' : 'off'} -> ${after ? 'on' : 'off'}.`);
		}

		log(describe3DStatus());
	},

	mouselight: async (...args) => {
		const manager = await getThree();
		if (!manager) {
			log("ThreeManager not available.");
			return;
		}

		// If no args, toggle
		if (args.length < 1) {
			const newState = !manager.mouseLightEnabled;
			manager.enableMouseLight(newState);
			log(`Mouse light toggled ${newState ? 'ON' : 'OFF'}.`);
			return;
		}

		const v = args[0];
		if (v !== true && v !== false) {
			log(`mouselight expects true/false (or nothing to toggle). Example: mouselight true`);
			log(`Current status: ${manager.mouseLightEnabled ? 'ON' : 'OFF'}`);
			return;
		}

		manager.enableMouseLight(v);
		log(`Mouse light set to ${v ? 'ON' : 'OFF'}.`);
	},

	bg: async (...args) => {
		const manager = await getThree();
		if (!manager) {
			log("ThreeManager not available.");
			return;
		}

		const data = manager.getRegisteredElementByName('app-cover-bg');
		if (!data || !data.empties || !data.empties.center) {
			log("Background element 'app-cover-bg' not found or not ready.");
			return;
		}

		// Find the plane mesh
		let plane = null;
		data.empties.center.traverse(child => {
			if (child.isMesh && child.name.includes('plane')) plane = child;
		});
		if (!plane) {
			// Fallback: any mesh in center
			data.empties.center.traverse(child => {
				if (child.isMesh) plane = child;
			});
		}

		if (!plane) {
			log("Background plane mesh not found.");
			return;
		}

		// Handle parameters
		if (args.length > 0 && (args[0] === true || args[0] === false)) {
			plane.visible = args[0];
			log(`Background plane visibility set to ${args[0]}.`);
		} else {
			plane.visible = !plane.visible;
			log(`Background plane visibility toggled ${plane.visible ? 'ON' : 'OFF'}.`);
		}
		
		manager.requestRender();
	},

	snapshot: async () => {
		const manager = await getThree();
		if (!manager || !manager.renderer || !manager.canvas) {
			log("ThreeManager or Renderer not available.");
			return;
		}

		try {
			// FORCE RENDER to ensure the drawing buffer is fresh for capture
			// (Otherwise the canvas might be blank or old depending on preserveDrawingBuffer setting)
			manager.renderer.render(manager.scene, manager.camera);
			
			const dataUrl = manager.canvas.toDataURL('image/png');
			
			const newWindow = window.open();
			if (newWindow) {
				newWindow.document.write(`<img src="${dataUrl}" alt="3D Snapshot" style="max-width:100%; height:auto;" />`);
				newWindow.document.title = "3D Scene Snapshot";
				log("Snapshot opened in new tab.");
			} else {
				log("Failed to open new tab. Check your popup blocker.");
			}
		} catch (e) {
			log(`Snapshot error: ${String(e)}`);
		}
	},

	cls: () => {
		clearLog();
	},

	clear: () => {
		clearLog();
	},

	status: () => {
		refresh();
		log(describeMobileStatus());
		log(describe3DStatus());

		const keys = Object.keys(debugVars.value || {});
		log(`Debug vars: ${keys.length ? keys.join(', ') : '(none)'}`);
	},

	commands: () => {
		const cmdKeys = Object.keys(commands.value);
		const varKeys = Object.keys(debugVars.value || {});
		log(`Available commands: ${cmdKeys.join(', ')}`);
		if (varKeys.length > 0) {
			log(`Available debug vars: ${varKeys.join(', ')}`);
		}
	},

}));

const runCommand = (rawLine) => {
	const line = (rawLine || '').trim();
	if (!line)
		return;

	// Add to history
	history.value.unshift(line);
	historyIndex.value = -1;

	// Always log the entered command
	log(`> ${line}`);

	// Command matching: tokenize on spaces
	const tokens = line.split(/\s+/).filter(Boolean);
	let head = (tokens[0] || '').toLowerCase();

	// 1) Match command functions
	const cmdMap = commands.value;
	if (head && cmdMap[head]) {
		const rawArgs = tokens.slice(1);
		const parsedArgs = rawArgs.map(parseToken);
		try {
			cmdMap[head].apply(null, parsedArgs);
		} catch (e) {
			log(`Command error: ${String(e)}`);
		}
		return;
	}

	// 2) No command match -> try debug vars (split on first space rule)
	const vars = debugVars.value || {};

	// head is already lowercased for command lookup; for vars we resolve case-insensitively
	const realKey = findKeyInsensitive(vars, tokens[0] || '');

	if (realKey){

		// Rejoin tail exactly as you described
		const tail = tokens.slice(1).join(' ').trim();

		// Parse tail as boolean/number/null if possible; otherwise keep string
		const parsed = tail === '' ? true : parseToken(tail);

		const before = vars[realKey].value;
		const result = setDebugVar(realKey, parsed);

		if (result.ok) {
			log(`Set debug var "${realKey}" = ${String(parsed)} (was ${String(result.before)}).`);
		} else {
			log(`Failed to set debug var "${realKey}".`);
		}

		return;
	}

	log(`Unknown command/var: "${head}". Try: status`);
};

const onKeyDown = (e) => {

	// Toggle console with backquote key (`)
	// Works regardless of shift (i.e. ~ key with shift still produces code 'Backquote')
	if (e.code === 'Backquote') {
		e.preventDefault();
		isOpen.value = !isOpen.value;
		if (isOpen.value) {
			log('Debug console opened. Type "status" for info.');
			focusInput();
		}
		return;
	}

	if (!isOpen.value)
		return;

	// Input history navigation while console is open
	if (e.key === 'ArrowUp') {
		// only if focus is in the input
		if (document.activeElement !== inputEl.value)
			return;

		e.preventDefault();

		if (history.value.length === 0)
			return;

		const nextIndex = Math.min(historyIndex.value + 1, history.value.length - 1);
		historyIndex.value = nextIndex;
		inputValue.value = history.value[nextIndex] || '';
		return;
	}

	if (e.key === 'ArrowDown') {
		if (document.activeElement !== inputEl.value)
			return;

		e.preventDefault();

		if (history.value.length === 0)
			return;

		const nextIndex = historyIndex.value - 1;
		historyIndex.value = nextIndex;

		if (nextIndex < 0) {
			inputValue.value = '';
		} else {
			inputValue.value = history.value[nextIndex] || '';
		}

		return;
	}
};

const onSubmit = () => {
	const line = inputValue.value;
	inputValue.value = '';
	runCommand(line);
};

onMounted(() => {
	window.addEventListener('keydown', onKeyDown);
});

onUnmounted(() => {
	window.removeEventListener('keydown', onKeyDown);
});

</script>
<template>

	<div class="debug-console" :class="{ 'is-open': isOpen }">
		<div class="console-inner">

			<div ref="logWrapEl" class="log">
				<div v-for="entry in logEntries" :key="entry.id" class="log-row">
					{{ entry.text }}
				</div>
			</div>

			<form class="cmd" @submit.prevent="onSubmit">
				<span class="prompt">&gt;</span>
				<input
					ref="inputEl"
					v-model="inputValue"
					class="cmd-input"
					type="text"
					autocomplete="off"
					autocapitalize="off"
					spellcheck="false"
					placeholder="type a command... (try: status)"
				/>
			</form>

		</div>
	</div>

</template>
<style scoped lang="scss">

	.debug-console {

		position: fixed;
		left: 0;
		right: 0;
		top: 0;
		z-index: 9999;

		transform: translateY(-110%);
		transition: transform 220ms ease;

		pointer-events: none;

		&.is-open {
			transform: translateY(0%);
			pointer-events: auto;
		}

		.console-inner {

			margin: 0;
			padding: 10px 12px;

			background: rgba(0, 0, 0, 0.65);
			backdrop-filter: blur(6px);

			border-bottom: 1px solid rgba(255, 255, 255, 0.15);

			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
			color: rgba(255, 255, 255, 0.92);

			max-height: min(52vh, 520px);
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.log {

			flex: 1;
			min-height: 120px;

			overflow-y: auto;
			overflow-x: hidden;

			padding: 6px 6px;

			background: rgba(0, 0, 0, 0.25);
			border: 1px solid rgba(255, 255, 255, 0.08);
			border-radius: 8px;

			.log-row {
				font-size: 12px;
				line-height: 1.35;
				white-space: pre-wrap;
				word-break: break-word;
				padding: 2px 0;
			}

			scrollbar-width: auto;
			scrollbar-color: #FFFFFF rgba(0, 0, 0, 0.25);

			/* Chrome, Edge, and Safari */
			&::-webkit-scrollbar {
				width: 16px;
			}

			&::-webkit-scrollbar-track {
			background: var(--color-primary);
			}

			&::-webkit-scrollbar-thumb {
				background-color: var(--color-primary);
				border-radius: 10px;
				border: 3px solid var(--color-primary);
			}
				}

		.cmd {

			display: flex;
			align-items: center;
			gap: 8px;

			padding: 8px 10px;

			background: rgba(0, 0, 0, 0.30);
			border: 1px solid rgba(255, 255, 255, 0.10);
			border-radius: 8px;

			.prompt {
				opacity: 0.85;
				font-size: 13px;
			}

			.cmd-input {

				flex: 1;
				min-width: 0;

				background: transparent;
				border: none;
				outline: none;

				color: rgba(255, 255, 255, 0.95);
				font-size: 13px;

				&::placeholder {
					color: rgba(255, 255, 255, 0.45);
				}
			}
		}
	}
</style>
