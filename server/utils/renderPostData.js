/*
	renderPostData.js
	-----------------
	Server-side renderer:
	ProseMirror JSON (Tiptap-compatible) -> HTML string

	Used by admin save endpoints so public pages can SSR with v-html.
*/

function isProseMirrorDoc(doc) {
	return !!(doc && typeof doc === 'object' && doc.type === 'doc' && Array.isArray(doc.content));
}

function unwrapExt(mod) {

	if (!mod) return null;

	if (mod.default) return mod.default;

	if (typeof mod.configure === 'function') return mod;

	if (typeof mod === 'object') {
		for (const k of Object.keys(mod)) {
			const v = mod[k];
			if (v && typeof v.configure === 'function')
				return v;
		}
	}

	return null;
}

function coercePostData(postData) {

	if (!postData) return null;

	// Already an object
	if (typeof postData === 'object') {
		return isProseMirrorDoc(postData) ? postData : null;
	}

	// JSON string (allow this to be stored too)
	if (typeof postData === 'string') {
		const raw = postData.trim();
		if (!raw.startsWith('{') && !raw.startsWith('[')) return null;

		try {
			const parsed = JSON.parse(raw);
			return isProseMirrorDoc(parsed) ? parsed : null;
		} catch (e) {
			return null;
		}
	}

	return null;
}

let _cached = null;

async function getRenderer() {

	if (_cached) return _cached;

	const [
		HtmlMod,
		CoreMod,
		StarterKitMod,
		LinkMod,
		ImageMod,
		UnderlineMod,
		SuperscriptMod,
		TextAlignMod,
		TableMod,
		TableRowMod,
		TableCellMod,
		TableHeaderMod,
	] = await Promise.all([
		import('@tiptap/html'),
		import('@tiptap/core'),
		import('@tiptap/starter-kit'),
		import('@tiptap/extension-link'),
		import('@tiptap/extension-image'),
		import('@tiptap/extension-underline'),
		import('@tiptap/extension-superscript'),
		import('@tiptap/extension-text-align'),
		import('@tiptap/extension-table'),
		import('@tiptap/extension-table-row'),
		import('@tiptap/extension-table-cell'),
		import('@tiptap/extension-table-header'),
	]);

	const generateHTML = HtmlMod.generateHTML;

	const Node = CoreMod?.Node || CoreMod?.default?.Node;
	if (!Node) {
		throw new Error('renderPostData: Failed to load @tiptap/core Node');
	}

	const StarterKit = unwrapExt(StarterKitMod);
	const Link = unwrapExt(LinkMod);
	const Image = unwrapExt(ImageMod);
	const Underline = unwrapExt(UnderlineMod);
	const Superscript = unwrapExt(SuperscriptMod);
	const TextAlign = unwrapExt(TextAlignMod);
	const Table = unwrapExt(TableMod);
	const TableRow = unwrapExt(TableRowMod);
	const TableCell = unwrapExt(TableCellMod);
	const TableHeader = unwrapExt(TableHeaderMod);

	// Custom iframe node (matches your JSON tests + legacy embeds conceptually)
	const Iframe = Node.create({

		name: 'iframe',
		group: 'block',
		atom: true,

		addAttributes() {
			return {
				src: { default: null },
				width: { default: null },
				height: { default: null },
				allow: { default: null },
				allowFullscreen: { default: null },
				frameborder: { default: null },
				scrolling: { default: null },
			};
		},

		parseHTML() {
			return [ { tag: 'iframe' } ];
		},

		renderHTML({ HTMLAttributes }) {

			const attrs = { ...HTMLAttributes };

			// Normalize allowFullscreen -> allowfullscreen
			if (attrs.allowFullscreen) {
				delete attrs.allowFullscreen;
				attrs.allowfullscreen = 'allowfullscreen';
			} else {
				delete attrs.allowFullscreen;
			}

			if (!attrs.src) {
				return [ 'div', { 'data-iframe-missing': '1' }, 'Missing iframe src' ];
			}

			return [ 'iframe', attrs ];
		},
	});

	const extensions = [];

	if (StarterKit) extensions.push(StarterKit);
	if (Underline) extensions.push(Underline);
	if (Superscript) extensions.push(Superscript);

	if (Link && typeof Link.configure === 'function') {
		extensions.push(Link.configure({
			openOnClick: false, // render-only; viewer handles clicks normally
			autolink: false,
			linkOnPaste: true,
			HTMLAttributes: {
				rel: 'noopener noreferrer',
			},
		}));
	}

	if (Image) extensions.push(Image);

	if (TextAlign && typeof TextAlign.configure === 'function') {
		extensions.push(TextAlign.configure({
			types: [ 'heading', 'paragraph' ],
		}));
	}

	if (Table && typeof Table.configure === 'function') {
		extensions.push(Table.configure({ resizable: false }));
		if (TableRow) extensions.push(TableRow);
		if (TableHeader) extensions.push(TableHeader);
		if (TableCell) extensions.push(TableCell);
	}

	extensions.push(Iframe);

	_cached = { generateHTML, extensions };
	return _cached;
}

export async function renderPostDataToHtml(postData) {

	const doc = coercePostData(postData);
	if (!doc) return '';

	const { generateHTML, extensions } = await getRenderer();
	return generateHTML(doc, extensions);
}

export function normalizePostData(postData) {
	return coercePostData(postData);
}
