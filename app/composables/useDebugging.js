// app/composables/useDebugging.js
import { ref } from 'vue';

const formatArgs = (args) => {
	return args.map((a) => {
		if (typeof a === 'string') return a;
		try {
			return JSON.stringify(a);
		} catch (e) {
			return String(a);
		}
	}).join(' ');
};

export const useDebugging = () => {

	// Debug variables container (extend over time)
	const debugVars = useState('debug_vars', () => ({
		debugMode: ref(false),
	}));

	// Console log entries
	const logEntries = useState('debug_console_log', () => []);

	const log = (...args) => {
		logEntries.value.push({
			id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
			ts: Date.now(),
			text: formatArgs(args),
		});
	};

	const setDebugVar = (key, value) => {
		const vars = debugVars.value;
		if (!vars)
			return { ok: false, before: undefined };

		if (!Object.prototype.hasOwnProperty.call(vars, key))
			return { ok: false, before: undefined };

		// Read "before" safely
		const entry = vars[key];
		const before = isRef(entry) ? entry.value : entry;

		// Write safely
		if (isRef(entry)) {
			entry.value = value;
		} else {
			vars[key] = value;
		}

		return { ok: true, before };
	};

	// Optional helper to register more refs later
	const registerDebugVar = (key, r) => {
		if (!key || !r)
			return;

		const vars = debugVars.value;
		if (!Object.prototype.hasOwnProperty.call(vars, key)) {
			vars[key] = r;
		}
	};

	const clearLog = () => {
		logEntries.value = [];
	};

	return {
		debugVars,
		logEntries,
		log,
		setDebugVar,
		registerDebugVar,
		clearLog,
	};
};
