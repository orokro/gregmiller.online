/*
	poc/src/Hud.js
	--------------

	Small debug panel for testing the engine on real devices.
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
			<div class="poc-hud-head"><span>3D</span><span class="poc-hud-summary"></span><span class="poc-hud-toggle">–</span></div>
			<div class="poc-hud-body">
				<div class="poc-hud-stats"></div>
				<div>
					<label><input type="checkbox" data-opt="parallax"> parallax</label>
					<label><input type="checkbox" data-opt="paperDepth"> paper depth</label>
				</div>
				<div>
					eye <select data-opt="cameraZ">
						<option value="600">600 (strong)</option>
						<option value="1000">1000 (live site)</option>
						<option value="1600">1600</option>
						<option value="2500">2500 (subtle)</option>
					</select>
					fps cap <select data-opt="liveFpsCap">
						<option value="0">none</option>
						<option value="60">60</option>
						<option value="30">30</option>
						<option value="20">20</option>
					</select>
				</div>
				<div>
					<label><input type="checkbox" data-opt="transmission"> glass refraction</label>
					<label><input type="checkbox" data-opt="halfRes"> half-res refraction</label>
				</div>
				<div>
					<label><input type="checkbox" data-opt="rim"> rim lights</label>
					<label><input type="checkbox" data-opt="mouseLight"> mouse light</label>
				</div>
				<div>
					<label><input type="checkbox" data-opt="showBorders"> borders</label>
					<label><input type="checkbox" data-opt="underlay"> underlay</label>
					<label><input type="checkbox" data-opt="hideSharp"> underlay only</label>
				</div>
				<div>
					DPR <select data-opt="dprCap">
						<option value="1">1</option>
						<option value="1.5">1.5</option>
						<option value="2">2</option>
						<option value="3">3</option>
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

		// keep the fps readout honest when nothing is happening
		setInterval(() => this.paint(true), 500);
	}


	/**
	 * Wires up checkboxes/selects to engine + theme options.
	 */
	_bindControls() {

		const e = this.engine;
		const t = this.theme;
		const q = (sel) => this.el.querySelector(sel);
		const on = (sel, fn) => q(sel).addEventListener('change', (ev) => fn(ev.target));

		// initial states
		q('[data-opt="parallax"]').checked = e.opts.parallax;
		q('[data-opt="paperDepth"]').checked = t.paperDepth;
		q('[data-opt="cameraZ"]').value = String(e.opts.cameraZ);
		q('[data-opt="liveFpsCap"]').value = String(e.opts.liveFpsCap);
		q('[data-opt="transmission"]').checked = t.transmissionEnabled;
		q('[data-opt="halfRes"]').checked = e.opts.halfResRefraction;
		q('[data-opt="rim"]').checked = t.rimLightsEnabled;
		q('[data-opt="mouseLight"]').checked = e.opts.mouseLight;
		q('[data-opt="showBorders"]').checked = e.opts.showBorders;
		q('[data-opt="underlay"]').checked = e.opts.underlay;
		q('[data-opt="dprCap"]').value = String(e.opts.dprCap);

		on('[data-opt="parallax"]', (el) => e.setParallax(el.checked));
		on('[data-opt="paperDepth"]', (el) => { t.paperDepth = el.checked; e.invalidateAll(); });
		on('[data-opt="cameraZ"]', (el) => { e.opts.cameraZ = Number(el.value); e.invalidateAll(); });
		on('[data-opt="liveFpsCap"]', (el) => { e.opts.liveFpsCap = Number(el.value); });
		on('[data-opt="transmission"]', (el) => { t.setTransmission(el.checked); e.invalidateAll(); });
		on('[data-opt="halfRes"]', (el) => e.setHalfResRefraction(el.checked));
		on('[data-opt="rim"]', (el) => { t.rimLightsEnabled = el.checked; e.invalidateAll(); });
		on('[data-opt="mouseLight"]', (el) => {
			e.opts.mouseLight = el.checked;
			t.enableMouseLight(el.checked);
			e.invalidateAll();
		});
		on('[data-opt="showBorders"]', (el) => {
			e.opts.showBorders = el.checked;
			e.layer.classList.toggle('show-borders', el.checked);
		});
		on('[data-opt="underlay"]', (el) => {
			e.opts.underlay = el.checked;
			e.underlayDirty = true;
			e.kick();
		});

		// shows what a flick that outruns the sharp render looks like
		on('[data-opt="hideSharp"]', (el) => {
			e.layer.querySelectorAll('.poc-tile, .poc-live').forEach((c) => { c.style.opacity = el.checked ? '0' : ''; });
		});

		on('[data-opt="dprCap"]', (el) => { e.opts.dprCap = Number(el.value); e.rebuildTiles(); });

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

		// live fps decays to 0 when idle
		const recent = e._liveTimes.filter((t) => now - t < 1000).length;

		this.summaryEl.textContent = e.opts.parallax
			? `${recent} fps · ${s.avgLiveMs.toFixed(0)}ms · outrun ${s.outrunFrames}`
			: `${s.avgTileMs.toFixed(0)}ms/tile · outrun ${s.outrunFrames}`;

		const ready = [...e.tiles.values()].filter((t) => t.hasContent).length;

		this.statsEl.textContent = [
			`doc ${e.docW}×${e.docH}  dpr ${e.dpr}`,
			e.opts.parallax
				? `strip ${e.wpx}×${e.livePx} px   live renders ${s.liveRenders}`
				: `tile ${e.wpx}×${e.tilePx} px   tiles ${ready}/${e.tiles.size}  renders ${s.tileRenders}`,
			`live  ${recent} fps  cpu ms last ${s.lastLiveMs.toFixed(1)} avg ${s.avgLiveMs.toFixed(1)} max ${s.maxLiveMs.toFixed(1)}`,
			`tile  cpu ms last ${s.lastTileMs.toFixed(1)} avg ${s.avgTileMs.toFixed(1)} max ${s.maxTileMs.toFixed(1)}`,
			`underlay ${s.underlayMs.toFixed(1)} ms  outrun ${s.outrunFrames}  reflows ${s.reflows}`,
			`(cpu ms excludes GPU time on Safari)`,
		].join('\n');
	}

}
