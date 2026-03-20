<!--
	CarouselEditor.vue
	------------------

	Admin component for managing the hero carousel slides.
	Supports drag-and-drop from the AssetBrowser to add new slides.
	Supports drag-and-drop reordering within the list.
-->
<script setup>

// vue
import { ref, onMounted } from 'vue';

// components
import PanelTitleBar from './PanelTitleBar.vue';

// slides state
const slides = ref([]);
const loading = ref(false);
const saving = ref(false);
const err = ref('');
const ok = ref('');

// drag-and-drop sorting state
const dragIndex = ref(null);


/**
 * Fetch all slides from the server
 */
async function fetchSlides() {
	loading.value = true;
	err.value = '';
	try {
		const res = await $fetch('/api/admin/carousel', { credentials: 'include' });
		slides.value = Array.isArray(res) ? res : [];
	} catch (e) {
		err.value = 'Failed to load slides';
	} finally {
		loading.value = false;
	}
}


/**
 * Save all slides to the server
 */
async function saveSlides() {
	saving.value = true;
	err.value = '';
	ok.value = '';
	try {
		const res = await $fetch('/api/admin/carousel', {
			method: 'POST',
			body: { slides: slides.value },
			credentials: 'include',
		});
		slides.value = Array.isArray(res) ? res : [];
		ok.value = 'Carousel saved';
	} catch (e) {
		err.value = 'Failed to save carousel';
	} finally {
		saving.value = false;
	}
}


/**
 * Handle dropping an asset from the AssetBrowser
 *
 * @param {DragEvent} e - drop event
 */
function onDropAsset(e) {
	const assetUrl = e.dataTransfer.getData('application/x-gm-asset');
	if (assetUrl) {
		e.preventDefault();
		// Add a new slide to the end of the list
		slides.value.push({
			imageUrl: assetUrl,
			link: '',
			duration: 2000,
		});
	}
}


/**
 * Remove a slide from the list
 *
 * @param {number} index - index to remove
 */
function removeSlide(index) {
	if (confirm('Remove this slide?')) {
		slides.value.splice(index, 1);
	}
}


/**
 * Handle internal drag start for reordering
 *
 * @param {number} index - index of the item being dragged
 */
function onDragStart(index) {
	dragIndex.value = index;
}


/**
 * Handle internal drag over for reordering
 *
 * @param {number} index - index of the item being dragged over
 */
function onDragOver(e, index) {
	if (dragIndex.value === null || dragIndex.value === index) return;
	e.preventDefault();
	
	// Reorder the slides array
	const item = slides.value.splice(dragIndex.value, 1)[0];
	slides.value.splice(index, 0, item);
	dragIndex.value = index;
}


/**
 * Handle internal drag end
 */
function onDragEnd() {
	dragIndex.value = null;
}

onMounted(() => {
	fetchSlides();
});

</script>
<template>

	<div 
		class="carousel-editor"
		@dragover.prevent
		@drop="onDropAsset"
	>
		<PanelTitleBar>Hero Carousel Editor</PanelTitleBar>

		<div v-if="err" class="notice error">{{ err }}</div>
		<div v-if="ok" class="notice ok">{{ ok }}</div>

		<div class="editor-body">
			<div class="instructions">
				Drag images from the Asset Browser below to add new slides. Drag the handles (⠿) to reorder.
			</div>

			<div v-if="loading" class="status">Loading slides...</div>
			
			<div v-else class="slides-list">
				<div 
					v-for="(slide, index) in slides" 
					:key="slide._id || index"
					class="slide-row"
					:class="{ dragging: dragIndex === index }"
					draggable="true"
					@dragstart="onDragStart(index)"
					@dragover="onDragOver($event, index)"
					@dragend="onDragEnd"
				>
					<div class="drag-handle" title="Drag to reorder">⠿</div>
					
					<div class="slide-thumb">
						<img :src="'/' + slide.imageUrl" alt="Thumbnail" />
					</div>

					<div class="slide-fields">
						<div class="field-group">
							<label>Link URL</label>
							<input v-model="slide.link" type="text" placeholder="https://..." class="input" />
						</div>
						<div class="field-group duration">
							<label>Timer (ms)</label>
							<input v-model.number="slide.duration" type="number" step="500" min="500" class="input" />
						</div>
					</div>

					<button 
						class="btn-icon danger" 
						type="button" 
						@click="removeSlide(index)"
						title="Remove Slide"
					>
						✕
					</button>
				</div>

				<div v-if="!slides.length" class="empty-msg">
					No slides yet. Drag some images here!
				</div>
			</div>
		</div>

		<div class="editor-footer">
			<button class="btn primary" @click="saveSlides" :disabled="saving">
				{{ saving ? 'Saving...' : 'Save Carousel' }}
			</button>
		</div>

	</div>

</template>
<style scoped lang="scss">

$primary: #00ABAE;
$secondary: #7561AA;
$border: rgba(16, 24, 40, 0.12);
$text: #101828;

.carousel-editor {
	height: 100%;
	display: flex;
	flex-direction: column;
	background: #fff;
	padding-left: 3px;

	.editor-body {
		flex: 1;
		overflow-y: auto;
		padding: 16px;

		.instructions {
			font-size: 13px;
			color: rgba($text, 0.6);
			margin-bottom: 20px;
			padding: 10px;
			background: #f8f9fa;
			border-radius: 8px;
			border: 1px dashed $border;
		}

		.slides-list {
			display: flex;
			flex-direction: column;
			gap: 12px;

			.slide-row {
				display: flex;
				align-items: center;
				gap: 12px;
				padding: 8px 12px;
				background: #fff;
				border: 1px solid $border;
				border-radius: 8px;
				box-shadow: 0 2px 5px rgba(0,0,0,0.02);
				transition: transform 0.2s, box-shadow 0.2s;

				&:hover {
					border-color: rgba($primary, 0.4);
					box-shadow: 0 4px 10px rgba(0,0,0,0.05);
				}

				&.dragging {
					opacity: 0.5;
					background: #f8f9fa;
					border-style: dashed;
				}

				.drag-handle {
					cursor: grab;
					font-size: 20px;
					color: rgba($text, 0.3);
					padding: 0 4px;
					user-select: none;
					
					&:active {
						cursor: grabbing;
					}
				}

				.slide-thumb {
					width: 80px;
					height: 60px;
					border-radius: 6px;
					overflow: hidden;
					background: #eee;
					flex-shrink: 0;

					img {
						width: 100%;
						height: 100%;
						object-fit: cover;
					}
				}

				.slide-fields {
					flex: 1;
					display: flex;
					gap: 12px;

					.field-group {
						display: flex;
						flex-direction: column;
						gap: 4px;
						flex: 1;

						label {
							font-size: 11px;
							font-weight: 600;
							color: rgba($text, 0.5);
						}

						&.duration {
							flex: 0 0 100px;
						}
					}
				}
			}

			.empty-msg {
				text-align: center;
				padding: 40px;
				color: rgba($text, 0.4);
				font-style: italic;
			}
		}
	}

	.editor-footer {
		padding: 12px 16px;
		border-top: 1px solid $border;
		display: flex;
		justify-content: flex-end;
	}
}

.input {
	border: 1px solid $border;
	border-radius: 8px;
	padding: 6px 10px;
	font-size: 13px;
	width: 100%;

	&:focus {
		outline: none;
		border-color: $primary;
	}
}

.btn {
	padding: 8px 16px;
	border-radius: 10px;
	border: 1px solid rgba($primary, 0.4);
	background: #fff;
	cursor: pointer;
	font-size: 14px;

	&.primary {
		background: $primary;
		color: #fff;
		border: none;
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.btn-icon {
	background: transparent;
	border: none;
	padding: 8px;
	cursor: pointer;
	border-radius: 8px;
	opacity: 0.4;
	transition: opacity 0.2s, background 0.2s;

	&:hover {
		opacity: 1;
		background: rgba(0,0,0,0.05);
	}

	&.danger {
		color: #e54848;
		&:hover {
			background: rgba(#e54848, 0.1);
		}
	}
}

.notice {
	margin: 0 16px 16px;
	padding: 10px 14px;
	border-radius: 8px;
	font-size: 13px;

	&.error {
		background: #fee2e2;
		color: #991b1b;
		border: 1px solid #fecaca;
	}

	&.ok {
		background: #dcfce7;
		color: #166534;
		border: 1px solid #bbf7d0;
	}
}
</style>
