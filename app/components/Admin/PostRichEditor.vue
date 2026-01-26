<script setup>

import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';

const props = defineProps({

	// ProseMirror JSON doc (canonical)
	modelValue: {
		type: Object,
		required: false,
		default: null,
	},

	// Legacy HTML (for posts that haven't been upgraded yet)
	legacyHtml: {
		type: String,
		required: false,
		default: '',
	},
});

const emit = defineEmits([
	'update:modelValue',
]);

const editor = ref(null);
const EditorContent = shallowRef(null);

let emitTimer = null;

// Prevent feedback loop:
// - editor updates -> emit JSON -> parent updates modelValue -> watcher runs -> setContent() -> caret jump
let isApplyingExternalContent = false;
let lastAppliedJson = '';

function stableStringify(obj) {
	try {
		return JSON.stringify(obj);
	} catch (e) {
		return '';
	}
}

function scheduleEmitJson() {

	if (!editor.value)
		return;

	if (isApplyingExternalContent)
		return;

	if (emitTimer)
		clearTimeout(emitTimer);

	emitTimer = setTimeout(() => {
		const json = editor.value.getJSON();
		lastAppliedJson = stableStringify(json);
		emit('update:modelValue', json);
	}, 80);
}

function applyDoc(doc) {

	if (!editor.value || !doc)
		return;

	isApplyingExternalContent = true;

	editor.value.commands.setContent(doc, false);

	lastAppliedJson = stableStringify(editor.value.getJSON());

	isApplyingExternalContent = false;
}

function applyHtml(html) {

	if (!editor.value || !html)
		return;

	isApplyingExternalContent = true;

	editor.value.commands.setContent(html, false);

	const json = editor.value.getJSON();
	lastAppliedJson = stableStringify(json);

	// Immediately upgrade legacy posts by emitting JSON once
	emit('update:modelValue', json);

	isApplyingExternalContent = false;
}

const headingLevel = computed(() => {
	if (!editor.value) return 'p';
	if (editor.value.isActive('heading', { level: 2 })) return 'h2';
	if (editor.value.isActive('heading', { level: 3 })) return 'h3';
	return 'p';
});

function setHeading(level) {

	if (!editor.value) return;

	const chain = editor.value.chain().focus();

	if (level === 'p') chain.setParagraph().run();
	if (level === 'h2') chain.toggleHeading({ level: 2 }).run();
	if (level === 'h3') chain.toggleHeading({ level: 3 }).run();
}

function setLink() {

	if (!editor.value) return;

	const prev = editor.value.getAttributes('link')?.href || '';
	const href = window.prompt('Link URL:', prev);

	if (href === null)
		return;

	if (href.trim() === '') {
		editor.value.chain().focus().extendMarkRange('link').unsetLink().run();
		return;
	}

	editor.value.chain().focus().extendMarkRange('link').setLink({
		href: href.trim(),
		target: '_blank',
	}).run();
}

function setAlign(align) {

	if (!editor.value) return;

	// TextAlign extension provides setTextAlign
	editor.value.chain().focus().setTextAlign(align).run();
}

function clearAlign() {

	if (!editor.value) return;

	editor.value.chain().focus().unsetTextAlign().run();
}

function normalizeYouTubeEmbed(url) {

	if (!url) return '';

	const u = url.trim();

	// Already an embed URL
	const embedMatch = u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/);
	if (embedMatch) {
		return `https://www.youtube.com/embed/${embedMatch[1]}`;
	}

	// youtu.be/<id>
	const shortMatch = u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
	if (shortMatch) {
		return `https://www.youtube.com/embed/${shortMatch[1]}`;
	}

	// youtube.com/watch?v=<id>
	const watchMatch = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/);
	if (watchMatch) {
		return `https://www.youtube.com/embed/${watchMatch[1]}`;
	}

	return '';
}

function insertYouTube() {

	if (!editor.value) return;

	const url = window.prompt('YouTube URL (watch/youtu.be/embed):');
	if (!url) return;

	const src = normalizeYouTubeEmbed(url);

	if (!src) {
		window.alert('Could not parse YouTube URL.');
		return;
	}

	editor.value.chain().focus().insertContent({
		type: 'iframe',
		attrs: {
			src,
			width: 560,
			height: 315,
			allowFullscreen: true,
			allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
		},
	}).run();
}

function insertTable() {
	if (!editor.value) return;
	editor.value.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
}

function addColBefore() { editor.value?.chain().focus().addColumnBefore().run(); }
function addColAfter() { editor.value?.chain().focus().addColumnAfter().run(); }
function delCol() { editor.value?.chain().focus().deleteColumn().run(); }
function addRowBefore() { editor.value?.chain().focus().addRowBefore().run(); }
function addRowAfter() { editor.value?.chain().focus().addRowAfter().run(); }
function delRow() { editor.value?.chain().focus().deleteRow().run(); }
function delTable() { editor.value?.chain().focus().deleteTable().run(); }



function insertImage() {

	if (!editor.value) return;

	const src = window.prompt('Image URL:');
	if (!src || !src.trim())
		return;

	editor.value.chain().focus().setImage({
		src: src.trim(),
		alt: '',
	}).run();
}

onMounted(async () => {

	const [
		VueMod,
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
		import('@tiptap/vue-3'),
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

	EditorContent.value = VueMod.EditorContent;

	const Node = CoreMod?.Node || CoreMod?.default?.Node;
	if (!Node) {
		throw new Error('PostRichEditor: Failed to load @tiptap/core Node');
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

	// Prevent duplicate names: StarterKit can include link/underline depending on version.
	if (StarterKit && typeof StarterKit.configure === 'function') {
		extensions.push(StarterKit.configure({
			link: false,
			underline: false,
		}));
	} else if (StarterKit) {
		extensions.push(StarterKit);
	}

	if (Underline) extensions.push(Underline);
	if (Superscript) extensions.push(Superscript);

	if (Link && typeof Link.configure === 'function') {
		extensions.push(Link.configure({
			openOnClick: false,
			autolink: true,
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
		extensions.push(Table.configure({ resizable: true }));
		if (TableRow) extensions.push(TableRow);
		if (TableHeader) extensions.push(TableHeader);
		if (TableCell) extensions.push(TableCell);
	}

	extensions.push(Iframe);

	editor.value = new VueMod.Editor({
		extensions,
		content: { type: 'doc', content: [ { type: 'paragraph' } ] },
		editable: true,
		onUpdate: scheduleEmitJson,
	});

	editor.value.setEditable(true);

	// Initial load:
	// - Prefer modelValue (postData)
	// - Else legacy HTML -> parse into doc and emit (upgrade)
	if (props.modelValue && props.modelValue.type === 'doc') {
		applyDoc(props.modelValue);
	} else if (props.legacyHtml && props.legacyHtml.trim()) {
		applyHtml(props.legacyHtml);
	} else {
		lastAppliedJson = stableStringify(editor.value.getJSON());
		emit('update:modelValue', editor.value.getJSON());
	}

});

// Watch for external changes (switching posts).
// IMPORTANT: do NOT deep-watch and do NOT setContent() for same doc, or caret jumps.
watch(() => props.modelValue, (next) => {

	if (!editor.value) return;
	if (!next || next.type !== 'doc') return;

	const nextStr = stableStringify(next);

	if (nextStr && nextStr !== lastAppliedJson) {
		applyDoc(next);
	}

});

onBeforeUnmount(() => {

	if (emitTimer)
		clearTimeout(emitTimer);

	if (editor.value) {
		editor.value.destroy();
		editor.value = null;
	}
});

</script>

<template>

	<ClientOnly>
		<div class="tiptap-wrap" v-if="editor">

			<div class="toolbar">

				<select class="heading" :value="headingLevel" @change="setHeading($event.target.value)">
					<option value="p">Paragraph</option>
					<option value="h2">H2</option>
					<option value="h3">H3</option>
				</select>

				<button class="btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()">B</button>
				<button class="btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()">I</button>
				<button class="btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()">U</button>
				<button class="btn" :class="{ active: editor.isActive('strike') }" @click="editor.chain().focus().toggleStrike().run()">S</button>
				<button class="btn" :class="{ active: editor.isActive('superscript') }" @click="editor.chain().focus().toggleSuperscript().run()">Sup</button>

				<span class="sep"></span>

				<button class="btn" :class="{ active: editor.isActive({ textAlign: 'left' }) }" @click="setAlign('left')">⟸</button>
				<button class="btn" :class="{ active: editor.isActive({ textAlign: 'center' }) }" @click="setAlign('center')">≡</button>
				<button class="btn" :class="{ active: editor.isActive({ textAlign: 'right' }) }" @click="setAlign('right')">⟹</button>
				<button class="btn" @click="clearAlign()">Align ✕</button>

				<span class="sep"></span>

				<button class="btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()">• List</button>
				<button class="btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()">1. List</button>
				<button class="btn" :class="{ active: editor.isActive('blockquote') }" @click="editor.chain().focus().toggleBlockquote().run()">Quote</button>

				<span class="sep"></span>

				<button class="btn" :class="{ active: editor.isActive('link') }" @click="setLink()">Link</button>
				<button class="btn" @click="insertImage()">Image</button>
				<button class="btn" @click="insertYouTube()">YouTube</button>

				<span class="sep"></span>

				<button class="btn" @click="editor.chain().focus().setHorizontalRule().run()">HR</button>

				<span class="sep"></span>

				<button class="btn" @click="insertTable()">Table</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="addRowBefore()">+Row↑</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="addRowAfter()">+Row↓</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="delRow()">-Row</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="addColBefore()">+Col←</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="addColAfter()">+Col→</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="delCol()">-Col</button>
				<button class="btn" :disabled="!editor.isActive('table')" @click="delTable()">DelTbl</button>

				<span class="sep"></span>

				<button class="btn" :disabled="!editor.can().undo()" @click="editor.chain().focus().undo().run()">Undo</button>
				<button class="btn" :disabled="!editor.can().redo()" @click="editor.chain().focus().redo().run()">Redo</button>

			</div>


			<component
				:is="EditorContent"
				v-if="EditorContent"
				:editor="editor"
				class="tiptap-body"
			/>

		</div>

		<template #fallback>
			<div class="tiptap-body">
				Loading editor…
			</div>
		</template>
	</ClientOnly>

</template>

<style lang="scss" scoped>

	.tiptap-wrap{
		background: transparent;
	}

	.toolbar{

		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		align-items: center;

		padding: 6px 0 10px 0;

		.heading{
			padding: 4px 6px;
		}

		.btn{
			padding: 4px 8px;
			border: 1px solid rgba(0,0,0,0.15);
			background: rgba(255,255,255,0.75);
			border-radius: 6px;
			cursor: pointer;

			&.active{
				border-color: rgba(0,0,0,0.35);
				background: rgba(255,255,255,1);
			}

			&:disabled{
				opacity: 0.4;
				cursor: default;
			}
		}

		.sep{
			width: 1px;
			height: 18px;
			background: rgba(0,0,0,0.15);
			margin: 0 4px;
		}

	}// .toolbar

	.tiptap-body {

		background: white;

		:deep(.ProseMirror){

			height: 100%;
			max-height: 100%;
			padding: 0.75rem 0.75rem;

			border: 1px solid rgba(0,0,0,0.15);
			border-radius: 6px;

			outline: none;
			cursor: text;

		}// .ProseMirror

		:deep(.ProseMirror:focus){
			border-color: rgba(0,0,0,0.35);
		}

		:deep(p){
			margin: 0.75rem 0;
		}

		:deep(img){
			max-width: 100%;
			height: auto;
			display: block;
			margin: 1rem auto;
		}

		:deep(blockquote){
			margin: 1rem 0;
			padding: 0.75rem 1rem;
			border-left: 4px solid rgba(0,0,0,0.15);
			background: rgba(0,0,0,0.03);
		}

		:deep(iframe){
			max-width: 100%;
			display: block;
			margin: 1rem auto;
			border: 0;
		}

	}// .tiptap-body

</style>
