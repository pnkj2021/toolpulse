import { BoardHistory, boardToScreen, calculateDrawingBounds, clampZoom, createPenStroke, createShape, createText, findObjectAt, moveObject, objectBounds, screenToBoard, type BoardTool, type DrawingObject, type Point, type Viewport } from '../utils/drawingBoard';

const canvas = document.querySelector<HTMLCanvasElement>('#drawing-canvas')!;
const workspace = document.querySelector<HTMLElement>('#board-workspace')!;
const emptyHint = document.querySelector<HTMLElement>('#board-empty');
const status = document.querySelector<HTMLElement>('#board-status');
if (!canvas || !workspace) throw new Error('Drawing board could not initialize.');
const context = canvas.getContext('2d')!;
if (!context) throw new Error('Canvas is not supported by this browser.');

let objects: DrawingObject[] = [];
let selectedId: string | null = null;
let activeTool: BoardTool = 'pen';
let color = '#111827'; let strokeWidth = 4;
let viewport: Viewport = { x: 40, y: 40, zoom: 1 };
let workingObject: DrawingObject | null = null; let pointerStart: Point | null = null; let lastPoint: Point | null = null;
let movingOriginal: DrawingObject | null = null; let panning = false; let spacePressed = false; let dirty = false;
const history = new BoardHistory(75);

const toolButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-tool]')];
const get = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector);
const announce = (message: string) => { if (status) status.textContent = message; };
const updateControls = () => {
	get<HTMLButtonElement>('#undo-board')!.disabled = !history.canUndo; get<HTMLButtonElement>('#redo-board')!.disabled = !history.canRedo;
	get<HTMLButtonElement>('#delete-object')!.disabled = !selectedId; get<HTMLButtonElement>('#export-board')!.disabled = !objects.length;
	get<HTMLButtonElement>('#clear-board')!.disabled = !objects.length; if (emptyHint) emptyHint.hidden = objects.length > 0;
	get<HTMLElement>('#zoom-level')!.textContent = `${Math.round(viewport.zoom * 100)}%`;
};

function setTool(tool: BoardTool) {
	activeTool = tool; workingObject = null; movingOriginal = null;
	toolButtons.forEach((button) => { const active = button.dataset.tool === tool; button.classList.toggle('tool-active', active); button.setAttribute('aria-pressed', String(active)); });
	canvas.dataset.tool = tool; announce(`${tool[0]!.toUpperCase()}${tool.slice(1)} tool selected.`); render();
}

function drawObject(ctx: CanvasRenderingContext2D, object: DrawingObject) {
	ctx.strokeStyle = object.color; ctx.fillStyle = object.color; ctx.lineWidth = object.strokeWidth; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
	if (object.type === 'text') { ctx.font = `${object.fontSize}px system-ui, sans-serif`; ctx.textBaseline = 'alphabetic'; ctx.fillText(object.text, object.position.x, object.position.y); return; }
	ctx.beginPath();
	if (object.type === 'pen') { const first = object.points[0]; if (!first) return; ctx.moveTo(first.x, first.y); for (const point of object.points.slice(1)) ctx.lineTo(point.x, point.y); ctx.stroke(); return; }
	if (object.type === 'line' || object.type === 'arrow') {
		ctx.moveTo(object.start.x, object.start.y); ctx.lineTo(object.end.x, object.end.y); ctx.stroke();
		if (object.type === 'arrow') { const angle = Math.atan2(object.end.y - object.start.y, object.end.x - object.start.x); const size = Math.max(10, object.strokeWidth * 4); ctx.beginPath(); ctx.moveTo(object.end.x, object.end.y); ctx.lineTo(object.end.x - size * Math.cos(angle - Math.PI / 6), object.end.y - size * Math.sin(angle - Math.PI / 6)); ctx.moveTo(object.end.x, object.end.y); ctx.lineTo(object.end.x - size * Math.cos(angle + Math.PI / 6), object.end.y - size * Math.sin(angle + Math.PI / 6)); ctx.stroke(); }
		return;
	}
	const x = Math.min(object.start.x, object.end.x); const y = Math.min(object.start.y, object.end.y); const width = Math.abs(object.end.x - object.start.x); const height = Math.abs(object.end.y - object.start.y);
	if (object.type === 'rectangle') ctx.strokeRect(x, y, width, height); else ctx.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2), ctx.stroke();
}

function drawScene(ctx: CanvasRenderingContext2D, list: DrawingObject[], transform: Viewport, selection = true) {
	ctx.save(); ctx.translate(transform.x, transform.y); ctx.scale(transform.zoom, transform.zoom);
	for (const object of list) drawObject(ctx, object); if (workingObject) drawObject(ctx, workingObject);
	if (selection && selectedId) { const object = list.find((item) => item.id === selectedId); if (object) { const bounds = objectBounds(object); ctx.save(); ctx.strokeStyle = '#2563eb'; ctx.lineWidth = 1.5 / transform.zoom; ctx.setLineDash([6 / transform.zoom, 4 / transform.zoom]); ctx.strokeRect(bounds.x - 6, bounds.y - 6, bounds.width + 12, bounds.height + 12); ctx.restore(); } }
	ctx.restore();
}

function resize() { const rect = workspace.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio)); canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`; render(); }
function render() { const ratio = window.devicePixelRatio || 1; context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, canvas.width / ratio, canvas.height / ratio); drawScene(context, objects, viewport); updateControls(); }
new ResizeObserver(resize).observe(workspace);

function eventPoint(event: PointerEvent): Point { const rect = canvas.getBoundingClientRect(); return screenToBoard({ x: event.clientX - rect.left, y: event.clientY - rect.top }, viewport); }
function commit(next: DrawingObject[], message: string) { objects = next; history.commit(objects); dirty = true; announce(message); render(); }

function openTextEditor(point: Point) {
	document.querySelector<HTMLInputElement>('.board-text-editor')?.focus();
	if (document.querySelector('.board-text-editor')) return;
	const screen = boardToScreen(point, viewport); const editor = document.createElement('input');
	editor.type = 'text'; editor.className = 'board-text-editor'; editor.placeholder = 'Type text…'; editor.setAttribute('aria-label', 'Text to place on drawing board');
	editor.style.left = `${screen.x}px`; editor.style.top = `${screen.y}px`; editor.style.color = color; editor.style.fontSize = `${Math.max(16, 24 * viewport.zoom)}px`;
	workspace.append(editor); editor.focus(); let finished = false;
	const finish = (place: boolean) => { if (finished) return; finished = true; const value = editor.value.trim(); editor.remove(); if (place && value) commit([...objects, createText(point, value, color)], 'Text added.'); else { announce('Text placement cancelled.'); render(); } };
	editor.addEventListener('keydown', (event) => { event.stopPropagation(); if (event.key === 'Enter') { event.preventDefault(); finish(true); } else if (event.key === 'Escape') { event.preventDefault(); finish(false); } });
	editor.addEventListener('blur', () => finish(true));
}

canvas.addEventListener('pointerdown', (event) => {
	const point = eventPoint(event);
	if (activeTool === 'text') { event.preventDefault(); openTextEditor(point); return; }
	canvas.setPointerCapture(event.pointerId); pointerStart = point; lastPoint = point;
	if (spacePressed || event.button === 1 || activeTool === 'pan') { panning = true; canvas.classList.add('is-panning'); return; }
	if (activeTool === 'select') { const hit = findObjectAt(objects, point); selectedId = hit?.id ?? null; movingOriginal = hit ? structuredClone(hit) : null; render(); return; }
	if (activeTool === 'eraser') { const hit = findObjectAt(objects, point,); if (hit) commit(objects.filter((object) => object.id !== hit.id), 'Object erased.'); return; }
	if (activeTool === 'pen') workingObject = createPenStroke([point], color, strokeWidth);
	else if (['line', 'arrow', 'rectangle', 'ellipse'].includes(activeTool)) workingObject = createShape(activeTool as 'line' | 'arrow' | 'rectangle' | 'ellipse', point, point, color, strokeWidth);
});

canvas.addEventListener('pointermove', (event) => {
	if (!pointerStart || !lastPoint) return; const point = eventPoint(event);
	if (panning) { viewport.x += (point.x - lastPoint.x) * viewport.zoom; viewport.y += (point.y - lastPoint.y) * viewport.zoom; lastPoint = eventPoint(event); render(); return; }
	if (activeTool === 'select' && movingOriginal && selectedId) { const dx = point.x - pointerStart.x; const dy = point.y - pointerStart.y; objects = objects.map((object) => object.id === selectedId ? moveObject(movingOriginal!, dx, dy) : object); render(); return; }
	if (activeTool === 'eraser') { const hit = findObjectAt(objects, point); if (hit) commit(objects.filter((object) => object.id !== hit.id), 'Object erased.'); return; }
	if (workingObject?.type === 'pen') { if (Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y) >= 1.5 / viewport.zoom) workingObject.points.push(point); }
	else if (workingObject && workingObject.type !== 'text') workingObject.end = point;
	lastPoint = point; render();
});

function endPointer() {
	if (panning) { panning = false; canvas.classList.remove('is-panning'); }
	else if (movingOriginal && selectedId) { const current = objects.find((object) => object.id === selectedId); if (current && JSON.stringify(current) !== JSON.stringify(movingOriginal)) commit(objects, 'Object moved.'); }
	else if (workingObject) { const object = workingObject; workingObject = null; if (object.type !== 'pen' || object.points.length > 1) commit([...objects, object], 'Object added.'); }
	pointerStart = null; lastPoint = null; movingOriginal = null; render();
}
canvas.addEventListener('pointerup', endPointer); canvas.addEventListener('pointercancel', endPointer);

toolButtons.forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool as BoardTool)));
get<HTMLInputElement>('#board-color')?.addEventListener('input', (event) => { color = (event.target as HTMLInputElement).value; });
document.querySelectorAll<HTMLButtonElement>('[data-color]').forEach((button) => button.addEventListener('click', () => { color = button.dataset.color!; const picker = get<HTMLInputElement>('#board-color'); if (picker) picker.value = color; }));
get<HTMLSelectElement>('#stroke-size')?.addEventListener('change', (event) => { strokeWidth = Number((event.target as HTMLSelectElement).value); });

function restore(snapshot: DrawingObject[] | null, message: string) { if (!snapshot) return; objects = snapshot; selectedId = null; dirty = true; announce(message); render(); }
get<HTMLButtonElement>('#undo-board')?.addEventListener('click', () => restore(history.undo(), 'Undone.'));
get<HTMLButtonElement>('#redo-board')?.addEventListener('click', () => restore(history.redo(), 'Redone.'));
get<HTMLButtonElement>('#delete-object')?.addEventListener('click', () => { if (selectedId) { const id = selectedId; selectedId = null; commit(objects.filter((object) => object.id !== id), 'Selected object deleted.'); } });
get<HTMLButtonElement>('#confirm-clear')?.addEventListener('click', () => { commit([], 'Board cleared. Undo is available.'); get<HTMLDialogElement>('#clear-dialog')?.close(); });
get<HTMLButtonElement>('#clear-board')?.addEventListener('click', () => get<HTMLDialogElement>('#clear-dialog')?.showModal());
get<HTMLButtonElement>('#cancel-clear')?.addEventListener('click', () => get<HTMLDialogElement>('#clear-dialog')?.close());

function zoomBy(factor: number, center?: Point) { const old = viewport.zoom; const next = clampZoom(old * factor); const anchor = center ?? { x: canvas.clientWidth / 2, y: canvas.clientHeight / 2 }; viewport.x = anchor.x - ((anchor.x - viewport.x) / old) * next; viewport.y = anchor.y - ((anchor.y - viewport.y) / old) * next; viewport.zoom = next; render(); }
get<HTMLButtonElement>('#zoom-in')?.addEventListener('click', () => zoomBy(1.25)); get<HTMLButtonElement>('#zoom-out')?.addEventListener('click', () => zoomBy(.8));
get<HTMLButtonElement>('#reset-view')?.addEventListener('click', () => { viewport = { x: 40, y: 40, zoom: 1 }; render(); });
canvas.addEventListener('wheel', (event) => { if (!event.ctrlKey && !event.metaKey) return; event.preventDefault(); const rect = canvas.getBoundingClientRect(); zoomBy(event.deltaY < 0 ? 1.1 : .9, { x: event.clientX - rect.left, y: event.clientY - rect.top }); }, { passive: false });

get<HTMLButtonElement>('#export-board')?.addEventListener('click', () => {
	const bounds = calculateDrawingBounds(objects); if (!bounds) return; const scale = Math.min(2, 4096 / Math.max(bounds.width, bounds.height));
	const output = document.createElement('canvas'); output.width = Math.ceil(bounds.width * scale); output.height = Math.ceil(bounds.height * scale); const ctx = output.getContext('2d'); if (!ctx) return;
	ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, output.width, output.height); drawScene(ctx, objects, { x: -bounds.x * scale, y: -bounds.y * scale, zoom: scale }, false);
	output.toBlob((blob) => { if (!blob) return; const now = new Date(); const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`; const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `ybs-drawing-${stamp}.png`; link.click(); URL.revokeObjectURL(link.href); dirty = false; announce('PNG exported locally.'); }, 'image/png');
});

get<HTMLButtonElement>('#fullscreen-board')?.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await get<HTMLElement>('#drawing-shell')?.requestFullscreen(); } catch { announce('Fullscreen permission was not granted.'); } });
document.addEventListener('fullscreenchange', () => { const button = get<HTMLButtonElement>('#fullscreen-board'); if (button) button.textContent = document.fullscreenElement ? 'Exit fullscreen' : 'Fullscreen'; });

const shortcutTools: Record<string, BoardTool> = { v: 'select', p: 'pen', e: 'eraser', l: 'line', r: 'rectangle', t: 'text' };
document.addEventListener('keydown', (event) => { const target = event.target as HTMLElement; if (target.matches('input, textarea, select') || target.isContentEditable) return; const key = event.key.toLowerCase(); if (key === ' ') { spacePressed = true; return; } if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); restore(event.shiftKey ? history.redo() : history.undo(), event.shiftKey ? 'Redone.' : 'Undone.'); return; } if (key === 'delete' || key === 'backspace') { if (selectedId) { event.preventDefault(); const id = selectedId; selectedId = null; commit(objects.filter((object) => object.id !== id), 'Selected object deleted.'); } return; } if (key === 'escape') { workingObject = null; selectedId = null; render(); return; } if (key === '+' || key === '=') zoomBy(1.25); else if (key === '-') zoomBy(.8); else if (shortcutTools[key]) setTool(shortcutTools[key]); });
document.addEventListener('keyup', (event) => { if (event.key === ' ') spacePressed = false; });
window.addEventListener('beforeunload', (event) => { if (dirty && objects.length) event.preventDefault(); });
setTool('pen'); resize();
