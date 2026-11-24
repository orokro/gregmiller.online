/*
	poc/src/Hud.js
	--------------

	Small debug panel for testing the tiled engine on real devices.
	Tap the header to collapse/expand. Hide entirely with ?hud=0.
*/


/**
 * Debug HUD.
 */
export class Hud {

	/**
	 * @param {TileEngine} engine - engine instance
	 * @param {GlassTheme} theme - theme instance
	 */
	constructor(engine, theme) {

		this.engine = engine;
		this.theme = theme;
		this._lastPaint = 0;

		this.el = document.createElement('div');
		this.el.id = 'poc-hud';
		this.el.innerHTML = `
			<div class="poc-hud-head"><span>3D tiles</span><span class="poc-hud-summary"></span><span class="poc-hud-toggle">–</span></div>
			<div class="poc-hud-body">
				<div class="poc-hud-stats"></div>
				<div>
					<label><input type="checkbox" data-opt="parallax"> parallax</label>
					<label><input type="checkbox" data-opt="paperDepth"> paper depth</label>
					eye <select data-opt="cameraZ">
						<option value="600">600 (strong)</option>
						<option value="1000">1000 (live site)</option>
						<option value="1600">1600</option>
						<option value="2500">2500 (subtle)</option>
					</select>
				</div>
				<div>
					<label><input type="checkbox" data-opt="showBorders"> tile borders</label>
					<label><input type="checkbox" data-opt="underlay"> underlay</label>
					<label><input type="checkbox" data-opt="hideTiles"> underlay only</label>
				</div>
				<div>
					<label><input type="checkbox" data-opt="transmission"> glass transmission</label>
					<label><input type="checkbox" data-opt="rim"> rim lights</label>
					<label><input type="checkbox" data-opt="mouseLight"> mouse light</label>
				</div>
				<div>
					DPR cap <select data-opt="dprCap">
						<option value="1">1</option>
						<option value="1.5">1.5</option>
						<option value="2">2</option>
						<option value="3">3</option>
					</select>
					tile <select data-opt="tileVh">
						<option value="0.5">0.5 vh</option>
						<option value="1">1 vh</option>
						<option value="1.5">1.5 vh</option>
					</select>
					<button data-act="reset">reset stats</button>
				</div>
			</div>
		`;
		document.body.appendChild(this.el);

		this.statsEl = this.el.querySelector('.poc-hud-stats');
		this.summaryEl = this.el.querySelector('.poc-hud-summary');

		// collapse (starts collapsed on phones so it doesn't cover the page)
		const setCollapsed = (on) => {
			this.el.classList.toggle('collapsed', on);
			this.el.querySelector('.poc-hud-toggle').textContent = on ? '+' : '–';
		};
		setCollapsed(window.innerWidth < 700);
		this.el.querySelector('.poc-hud-head').addEventListener('click', () => {
			setCollapsed(!this.el.classList.contains('collapsed'));
		});

		this._bindControls();
		engine.onStats = () => this.paint();
		this.paint(true);
	}


	/**
	 * Wires up checkboxes/selects to engine + theme options.
	 */
	_bindControls() {

		const e = this.engine;
		const t = this.theme;
		const q = (sel) => this.el.querySelector(sel);

		// initial states
		q('[data-opt="showBorders"]').checked = e.opts.showBorders;
		q('[data-opt="underlay"]').checked = e.opts.underlay;
		q('[data-opt="transmission"]').checked = t.transmissionEnabled;
		q('[data-opt="rim"]').checked = t.rimLightsEnabled;
		q('[data-opt="mouseLight"]').checked = e.opts.mouseLight;
		q('[data-opt="dprCap"]').value = String(e.opts.dprCap);
		q('[data-opt="tileVh"]').value = String(e.opts.tileVh);

		q('[data-opt="parallax"]').checked = e.opts.parallax;
		q('[data-opt="parallax"]').disabled = e.copyMode === 'bitmap';
		q('[data-opt="paperDepth"]').checked = t.paperDepth;
		q('[data-opt="cameraZ"]').value = String(e.opts.cameraZ);

		q('[data-opt="parallax"]').addEventListener('change', (ev) => {
			e.opts.parallax = ev.target.checked;
			e.invalidateAll();
		});

		q('[data-opt="paperDepth"]').addEventListener('change', (ev) => {
			t.paperDepth = ev.target.checked;
			e.invalidateAll();
		});

		q('[data-opt="cameraZ"]').addEventListener('change', (ev) => {
			e.opts.cameraZ = Number(ev.target.value);
			e.invalidateAll();
		});

		q('[data-opt="showBorders"]').addEventListener('change', (ev) => {
			e.opts.showBorders = ev.target.checked;
			e.layer.classList.toggle('show-borders', ev.target.checked);
		});

		q('[data-opt="underlay"]').addEventListener('change', (ev) => {
			e.opts.underlay = ev.target.checked;
			e.underlayDirty = true;
			e.kick();
		});

		// shows what a flick that outruns the tiles would look like
		q('[data-opt="hideTiles"]').addEventListener('change', (ev) => {
			e.layer.querySelectorAll('.poc-tile').forEach((c) => { c.style.opacity = ev.target.checked ? '0' : ''; });
		});

		q('[data-opt="transmission"]').addEventListener('change', (ev) => {
			t.setTransmission(ev.target.checked);
			e.invalidateAll();
		});

		q('[data-opt="rim"]').addEventListener('change', (ev) => {
			t.rimLightsEnabled = ev.target.checked;
			e.invalidateAll();
		});

		q('[data-opt="mouseLight"]').addEventListener('change', (ev) => {
			e.opts.mouseLight = ev.target.checked;
			t.enableMouseLight(ev.target.checked);
			e.invalidateAll();
		});

		q('[data-opt="dprCap"]').addEventListener('change', (ev) => {
			e.opts.dprCap = Number(ev.target.value);
			e.rebuildTiles();
		});

		q('[data-opt="tileVh"]').addEventListener('change', (ev) => {
			e.opts.tileVh = Number(ev.target.value);
			e.rebuildTiles();
		});

		q('[data-act="reset"]').addEventListener('click', () => {
			Object.assign(e.stats, {
				tileRenders: 0, maxTileMs: 0, avgTileMs: 0,
				liveRenders: 0, maxLiveMs: 0, avgLiveMs: 0,
				outrunFrames: 0,
			});
			this.paint(true);
		});
	}


	/**
	 * Repaints stats text (throttled).
	 *
	 * @param {boolean} force - skip throttling
	 */
	paint(force = false) {

		const now = performance.now();
		if (!force && now - this._lastPaint < 200)
			return;
		this._lastPaint = now;

		const e = this.engine;
		const s = e.stats;
		const ready = [...e.tiles.values()].filter((t) => t.hasContent).length;

		this.summaryEl.textContent = e.opts.parallax
			? `${s.avgLiveMs.toFixed(0)}ms/frame · outrun ${s.outrunFrames}`
			: `${s.avgTileMs.toFixed(0)}ms/tile · outrun ${s.outrunFrames}`;

		this.statsEl.textContent = [
			`doc ${e.docW}×${e.docH}  dpr ${e.dpr}`,
			`tile ${e.docW}×${e.tileH} css  (${Math.round(e.docW * e.dpr)}×${Math.round(e.tileH * e.dpr)} px)`,
			`tiles ${ready}/${e.tiles.size}  renders ${s.tileRenders}  reflows ${s.reflows}`,
			`tile ms  last ${s.lastTileMs.toFixed(1)}  avg ${s.avgTileMs.toFixed(1)}  max ${s.maxTileMs.toFixed(1)}`,
			`live ms  last ${s.lastLiveMs.toFixed(1)}  avg ${s.avgLiveMs.toFixed(1)}  max ${s.maxLiveMs.toFixed(1)}  (${s.liveRenders})`,
			`underlay ${s.underlayMs.toFixed(1)} ms   outrun frames ${s.outrunFrames}`,
			`gpu max rb ${e.maxRenderbuffer}  copy ${e.copyMode}`,
		].join('\n');
	}

}
