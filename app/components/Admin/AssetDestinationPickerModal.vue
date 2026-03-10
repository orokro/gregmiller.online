<!--
	AssetDestinationPickerModal.vue
	-------------------------------

	Folder picker modal for VueFinder, used in the custom "Move to…" context menu action in AssetBrowser.vue.
	This is a standalone component that can be used anywhere you need to pick a folder from the asset system.
-->
<script setup>

// vue
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';

// props
const props = defineProps({
	show: { type: Boolean, default: false },
	driver: { type: Object, required: true },

	// where to start browsing in the picker
	startPath: { type: String, default: 'local://' },

	// optional label for header
	title: { type: String, default: 'Pick destination folder' },
});

// emits
const emit = defineEmits([ 'close', 'picked' ]);

// refs
const pickerRef = ref(null);

// vuefinder state we track
const currentPath = ref(props.startPath);
const selectedFolder = ref(null);

const vueFinderId = `gm_asset_dest_picker_${Math.random().toString(36).slice(2)}`;

watch(() => props.startPath, (v) => {
	if (!props.show)
		return;
	currentPath.value = v || 'local://';
	selectedFolder.value = null;
});

// “confirm” destination: if user didn’t click a folder, use the current open folder.
const destination = computed(() => {
	if (selectedFolder.value?.path)
		return selectedFolder.value.path;
	return currentPath.value || 'local://';
});


function onBackdrop(e) {
	// click outside closes
	if (e.target?.classList?.contains('modal-backdrop'))
		emit('close');
}


function onConfirm() {
	emit('picked', destination.value);
	emit('close');
}


/**
 * VueFinder events are not super well documented, so we handle several common ones.
 * The important part is: keep currentPath updated, and set selectedFolder when a dir is selected.
 */
function onPathChanged(p) {
	if (typeof p === 'string' && p)
		currentPath.value = p;
}


// Heuristic: VueFinder selection typically gives an array of “items”
function onSelectionChanged(items) {
	const arr = Array.isArray(items) ? items : [];
	const first = arr[0];

	// only accept directories
	if (first && (first.type === 'dir' || first.mime === 'directory' || first.extension === '')) {
		selectedFolder.value = first;
	} else {
		selectedFolder.value = null;
	}
}

</script>
<template>

	<div v-if="show" class="modal-backdrop" @mousedown="onBackdrop">

		<!-- main modal wrapper -->
		<div class="modal">

			<div class="modal-header">
				<div class="modal-title">{{ title }}</div>

				<button class="modal-x" type="button" @click="$emit('close')">
					×
				</button>
			</div>

			<div class="modal-body">
				<div class="hint">
					Current: <b>{{ currentPath }}</b><br />
					Selected: <b>{{ selectedFolder?.path || '(none — will use current folder)' }}</b>
				</div>

				<!--
					VueFinder picker mode:
					- disable everything except navigation
					- allow selecting folders
				-->
				<ClientOnly>
					<vue-finder
						:id="vueFinderId"
						ref="pickerRef"
						class="vf-picker"
						:driver="driver"
						:features="{
							preview: false,
							rename: false,
							upload: false,
							delete: false,
							newfolder: false,
							download: false,
							move: false,
							copy: false,
							search: true,
							fullscreen: false,

							archive: false,
							unarchive: false,
							language: false,
							history: false,
							theme: false,
							pinned: false,
						}"

						:selectable="true"
						:multiSelect="false"

						@path-change="onPathChanged"
						@selection-change="onSelectionChanged"
					/>
				</ClientOnly>
			</div>

			<div class="modal-footer">
				<button class="btn secondary" type="button" @click="$emit('close')">
					Cancel
				</button>

				<button class="btn primary" type="button" @click="onConfirm">
					Move here
				</button>
			</div>
		</div>

	</div>

</template>
<style scoped lang="scss">

// main wrapper that fills the page and is the backdrop for the modal
.modal-backdrop{

	// postitioning and sizing
	position: fixed;
	inset: 0;
	z-index: 9999;

	// box settings
	background: rgba(0,0,0,.45);

	// layout
	display: flex;
	align-items: center;
	justify-content: center;


	// main modal box itself
	.modal{

		// sixing
		width: min(1100px, 92vw);
		height: min(720px, 86vh);

		// box settings
		background: white;
		border-radius: 10px;
		overflow: hidden;
		box-shadow: 0 12px 40px rgba(0,0,0,.25);

		// layout
		display: flex;
		flex-direction: column;

		// header for the modal
		.modal-header{

			// box settings
			padding: 10px 12px;
			border-bottom: 1px solid rgba(0,0,0,.12);

			// layout
			display: flex;
			align-items: center;
			justify-content: space-between;

			// title for the modal (in the header)
			.modal-title{
				font-weight: bold;
			}// .modal-title

			// close button for the header
			.modal-x{

				// box settings
				background: transparent;
				border: 0;
				padding: 4px 10px;

				// text styles
				font-size: 22px;
				line-height: 1;

				// appear clickable
				cursor: pointer;

			}// .modal-x

		}// .modal-header

		// main body of the modal where we'll host the vuefinder instance
		.modal-body{

			// box settings
			min-height: 0;
			padding: 10px 12px;

			// layout
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 8px;

			// useful details
			.hint{

				// text styles
				font-size: 12px;

				// make it a bit less prominent since it's just extra info
				opacity: .8;
			}// .hint

			// styles for our VueFinder instance in the modal
			.vf-picker{

				// box settings
				border: 1px solid rgba(0,0,0,.12);
				border-radius: 8px;
				overflow: hidden;

				// size
				min-height: 0;

				// layout
				flex: 1;

			}// .vf-picker

		}// .modal-body

	}// .modal

	// styles for the footer with the move/cancel buttons
	.modal-footer{

		// box settings
		padding: 10px 12px;
		border-top: 1px solid rgba(0,0,0,.12);

		// layout
		display: flex;
		justify-content: flex-end;
		gap: 10px;

		// move/cancel button styles along the bottom
		.btn{
			// box settings
			border: 0;
			border-radius: 999px;
			padding: 8px 14px;

			// appear clickable
			cursor: pointer;

		}// .btn

		// button colors
		.primary{ background: #00ABAE; color: white; }
		.secondary{ background: #eee; color: #333; }

	}// .modal-footer

}// .modal-backdrop

</style>
