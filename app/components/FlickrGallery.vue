<!--
	FlickrGallery.vue
	--------------------
	A Vue component that displays a gallery of Flickr images with a modal viewer.
-->
<script setup>

// vue
import { ref, computed, nextTick, onBeforeUnmount, watch } from 'vue';

// define props
const props = defineProps({
	setId: {
		type: String,
		required: true,
	},
});

// get Flickr photos from our API
const { data, pending, error } = await useFetch(() => `/api/flickr/photoset/${props.setId}`);

const photos = computed(() => data.value?.photos || []);

// modal state
const isOpen = ref(false);
const activeIndex = ref(0);

const photoEl = ref(null);
const photoWrapEl = ref(null);
const thumbStripEl = ref(null);

const zoom = ref(1);
const panX = ref(0);
const panY = ref(0);

const isPanning = ref(false);
const panStart = ref({ x: 0, y: 0, panX: 0, panY: 0, pointerId: null });

const active = computed(() => photos.value[activeIndex.value] || null);
const activeSrc = computed(() => active.value?.large || active.value?.src || active.value?.thumb || '');

const bgStyle = computed(() => {
	const src = activeSrc.value;
	if (!src) return {};
	return {
		backgroundImage: `url("${src}")`,
	};
});

const stageStyle = computed(() => {
	return {
		transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
	};
});

function lockBodyScroll(locked) {
	if (typeof document === 'undefined') return;
	if (locked) {
		document.documentElement.classList.add('no-scroll');
		document.body.classList.add('no-scroll');
	} else {
		document.documentElement.classList.remove('no-scroll');
		document.body.classList.remove('no-scroll');
	}
}

function open(idx) {
	activeIndex.value = idx;
	isOpen.value = true;
	nextTick(() => {
		lockBodyScroll(true);
		resetView();
		focusModal();
		scrollThumbIntoView();
	});
}

function close() {
	isOpen.value = false;
	lockBodyScroll(false);
}

function setActive(idx) {
	activeIndex.value = idx;
	resetView();
	scrollThumbIntoView();
}

function prev() {
	if (!photos.value.length) return;
	activeIndex.value = (activeIndex.value - 1 + photos.value.length) % photos.value.length;
	resetView();
	scrollThumbIntoView();
}

function next() {
	if (!photos.value.length) return;
	activeIndex.value = (activeIndex.value + 1) % photos.value.length;
	resetView();
	scrollThumbIntoView();
}

function resetView() {
	zoom.value = 1;
	panX.value = 0;
	panY.value = 0;
}

function clampPan() {
	// Soft clamp so you can’t fling it infinitely off-screen.
	// It’s not perfect “contain within bounds” math, but it feels good in practice.
	const wrap = photoWrapEl.value;
	if (!wrap) return;

	const max = Math.max(60, Math.min(wrap.clientWidth, wrap.clientHeight) * 0.6);
	panX.value = Math.max(-max, Math.min(max, panX.value));
	panY.value = Math.max(-max, Math.min(max, panY.value));
}

function onWheel(e) {

	if (!isOpen.value) return;

	// Trackpads can scroll the page; stop that while modal is open.
	// e.preventDefault?.();

	// Zoom around cursor.
	const delta = -e.deltaY;
	const factor = delta > 0 ? 1.08 : 0.92;

	const newZoom = Math.max(1, Math.min(6, zoom.value * factor));

	// If not changing, bail.
	if (newZoom === zoom.value) return;

	zoom.value = newZoom;

	// When zoomed in, allow some pan; when zoomed out to fit, snap pan.
	if (zoom.value === 1) {
		panX.value = 0;
		panY.value = 0;
	} else {
		clampPan();
	}
}

function onPointerDown(e) {
	if (!isOpen.value) return;
	if (zoom.value <= 1) return;

	// Left click / primary touch only
	if (e.button !== undefined && e.button !== 0) return;

	isPanning.value = true;
	panStart.value = {
		x: e.clientX,
		y: e.clientY,
		panX: panX.value,
		panY: panY.value,
		pointerId: e.pointerId,
	};

	try {
		e.currentTarget.setPointerCapture(e.pointerId);
	} catch {
		// ignore
	}
}

function onPointerMove(e) {

	if (!isOpen.value) return;
	if (!isPanning.value) return;
	if (panStart.value.pointerId !== e.pointerId) return;

	const dx = e.clientX - panStart.value.x;
	const dy = e.clientY - panStart.value.y;

	panX.value = panStart.value.panX + dx;
	panY.value = panStart.value.panY + dy;

	clampPan();
}

function onPointerUp(e) {

	if (panStart.value.pointerId !== null && e.pointerId !== panStart.value.pointerId) return;
	isPanning.value = false;
	panStart.value.pointerId = null;
}

function onPhotoLoad() {

	// Ensure we start clean for each image, especially on slow connections.
	resetView();
}

function scrollThumbIntoView() {
	const strip = thumbStripEl.value;
	if (!strip) return;

	const btn = strip.querySelectorAll('.strip-thumb')[activeIndex.value];
	if (!btn) return;

	const btnRect = btn.getBoundingClientRect();
	const stripRect = strip.getBoundingClientRect();

	if (btnRect.left < stripRect.left) {
		strip.scrollLeft -= (stripRect.left - btnRect.left) + 12;
	} else if (btnRect.right > stripRect.right) {
		strip.scrollLeft += (btnRect.right - stripRect.right) + 12;
	}
}

function onThumbStripWheel(e) {

	// Horizontal scroll convenience for mouse wheel
	const strip = thumbStripEl.value;
	if (!strip) return;

	if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
		strip.scrollLeft += e.deltaY;
	}
}

function focusModal() {
	// Put focus somewhere reasonable so keyboard shortcuts work immediately.
	const wrap = photoWrapEl.value;
	if (wrap) wrap.focus?.();
}

function onKeyDown(e) {
	if (!isOpen.value) return;

	// Don’t allow the page behind to scroll
	if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End' || e.key === ' ') {
		e.preventDefault();
	}

	if (e.key === 'Escape') {
		e.preventDefault();
		close();
		return;
	}

	if (e.key === 'ArrowLeft') {
		prev();
		return;
	}

	if (e.key === 'ArrowRight') {
		next();
		return;
	}

	if (e.key === 'Home') {
		// You asked specifically: Home resets zoom-to-fit rather than scrolling browser.
		resetView();
		return;
	}

	if (e.key === 'End') {
		// Optional: End = zoom in a bit
		zoom.value = Math.min(6, zoom.value * 1.2);
		return;
	}
}

watch(isOpen, (v) => {
	if (typeof window === 'undefined') return;

	if (v) {
		window.addEventListener('keydown', onKeyDown, { passive: false });
	} else {
		window.removeEventListener('keydown', onKeyDown, { passive: false });
	}
});

onBeforeUnmount(() => {
	if (typeof window !== 'undefined') {
		window.removeEventListener('keydown', onKeyDown, { passive: false });
	}
	lockBodyScroll(false);
});

</script>
<template>

	<div class="flickr-gallery">

		<div v-if="pending" class="status">Loading images…</div>
		<div v-else-if="error" class="status error">Couldn’t load images.</div>
		<div v-else-if="!photos.length" class="status">No images found in this gallery.</div>

		<div v-else class="grid">
			<button
				v-for="(p, idx) in photos"
				:key="p.id"
				class="thumb"
				type="button"
				@click="open(idx)"
				:aria-label="p.title ? `Open image: ${p.title}` : 'Open image'"
			>
				<img :src="p.thumb" :alt="p.title || 'Photo'" loading="lazy" />
			</button>
		</div>

		<Teleport to="body">

			<div v-if="isOpen" class="modal" role="dialog" aria-modal="true" @click.self="close">
				<div class="modal-bg" :style="bgStyle"></div>

				<div class="modal-inner">
					<div class="topbar">
						<div class="title">
							<span v-if="active?.title">{{ active.title }}</span>
						</div>

						<div class="actions">
							<button
								v-if="zoom>1"
								class="icon"
								type="button"
								@click="resetView"
								title="Reset (Home)">🔍</button>

							<button class="icon" type="button" @click="close" title="Close (Esc)">✕</button>
						</div>
					</div>

					<div
						ref="photoWrapEl"
						class="photo-wrap"
						@wheel.passive="onWheel"
						@pointerdown="onPointerDown"
						@pointermove="onPointerMove"
						@pointerup="onPointerUp"
						@pointercancel="onPointerUp"
						@dblclick="resetView"
					>
						<div class="photo-stage" :style="stageStyle">
							<img
								ref="photoEl"
								class="photo"
								:src="activeSrc"
								:alt="active?.title || 'Photo'"
								@load="onPhotoLoad"
								draggable="false"
							/>
						</div>

						<button class="nav prev" type="button" @click="prev" aria-label="Previous photo">‹</button>
						<button class="nav next" type="button" @click="next" aria-label="Next photo">›</button>
					</div>

					<div ref="thumbStripEl" class="thumb-strip" @wheel.passive="onThumbStripWheel">
						<button
							v-for="(p, idx) in photos"
							:key="p.id"
							class="strip-thumb"
							:class="{ active: idx === activeIndex }"
							type="button"
							@click="setActive(idx)"
							:aria-label="p.title ? `Select image: ${p.title}` : 'Select image'"
						>
							<img :src="p.thumb" :alt="p.title || 'Thumbnail'" loading="lazy" />
						</button>
					</div>
				</div>
			</div>

		</Teleport>
	</div>

</template>
<style scoped>
	.flickr-gallery{
		width: 100%;
	}

	.status{
		opacity: 0.85;
	}

	.status.error{
		opacity: 0.9;
	}

	.grid{
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
		gap: 12px;
	}

	.thumb{
		border: 3px solid white;
		background: #eee;
		padding: 0;
		cursor: pointer;
		border-radius: 4px;
		overflow: hidden;
		box-shadow: 0 2px 8px rgba(0,0,0,0.1);
		transition: transform 0.3s, box-shadow 0.3s;
		aspect-ratio: 4 / 3;

		&:hover {
			transform: scale(1.05);
			box-shadow: 0 4px 15px rgba(0,0,0,0.15);
			z-index: 10;
		}
	}

	.thumb img{
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.modal{
		background: black;
		position: fixed;
		inset: 0;
		z-index: 10000;
		display: grid;
		place-items: center;

		scrollbar-width: auto;
		scrollbar-color: #EFEFEF #000000;

		/* Chrome, Edge, and Safari */
		&::-webkit-scrollbar {
			width: 16px;
		}

		&::-webkit-scrollbar-track {
		background: #000000;
		}

		&::-webkit-scrollbar-thumb {
			background-color: #000000;
			border-radius: 10px;
			border: 3px solid #000000;
		}
	}

	.modal-bg{
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		filter: blur(22px);
		opacity: 0.75;
		transform: scale(1.06);
	}

	.modal::before{
		content: "";
		position: absolute;
		inset: 0;
		background: rgba(0,0,0,0.75);
	}

	.modal-inner{
		position: relative;
		width: min(1200px, 100vw);
		height: 100vh;
		display: grid;
		grid-template-rows: auto 1fr auto;
		padding: 12px;
		box-sizing: border-box;
	}

	.topbar{
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 8px 6px;
		color: rgba(255,255,255,0.92);
	}

	.title{
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 70vw;
		font-size: 14px;
	}

	.actions{
		display: flex;
		gap: 8px;
	}

	.icon{
		border: 0;
		background: rgba(255,255,255,0.12);
		color: white;
		border-radius: 10px;
		padding: 8px 10px;
		cursor: pointer;
	}

	.photo-wrap{
		position: relative;
		border-radius: 14px;
		overflow: hidden;
		background: rgba(255,255,255,0.06);
		outline: none;
		display: grid;
		place-items: center;
		touch-action: none;
	}

	.photo-stage{
		will-change: transform;
		transform-origin: center center;
	}

	.photo{
		max-width: 92vw;
		max-height: 68vh;
		user-select: none;
		-webkit-user-drag: none;
		border-radius: 12px;
		box-shadow: 0 16px 50px rgba(0,0,0,0.35);
	}

	.nav{
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		border: 0;
		background: rgba(0,0,0,0.35);
		color: rgba(255,255,255,0.95);
		width: 44px;
		height: 44px;
		border-radius: 999px;
		cursor: pointer;
		font-size: 28px;
		display: grid;
		place-items: center;
	}

	.nav.prev{
		left: 10px;
	}

	.nav.next{
		right: 10px;
	}

	.thumb-strip{
		margin-top: 10px;
		padding: 8px 4px;
		display: flex;
		gap: 8px;
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		background: rgba(0,0,0,0.18);
		border-radius: 12px;
	}

	.strip-thumb{
		border: 2px solid transparent;
		padding: 0;
		background: transparent;
		border-radius: 10px;
		overflow: hidden;
		flex: 0 0 auto;
		cursor: pointer;
	}

	.strip-thumb.active{
		border-color: rgba(255,255,255,0.9);
	}

	.strip-thumb img{
		display: block;
		width: 70px;
		height: 70px;
		object-fit: cover;
	}

	/* Mobile tweaks */
	@media (max-width: 600px){
		.photo{
			max-width: 94vw;
			max-height: 62vh;
		}
		.strip-thumb img{
			width: 60px;
			height: 60px;
		}
		.nav{
			width: 42px;
			height: 42px;
		}
	}
</style>
<style>
	/* Global scroll lock (not scoped) */
	html.no-scroll,
	body.no-scroll{
		overflow: hidden !important;
		touch-action: none;
	}
</style>
