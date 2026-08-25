export type Point = { x: number; y: number };
export type BoardTool = 'select' | 'pen' | 'eraser' | 'line' | 'arrow' | 'rectangle' | 'ellipse' | 'text' | 'pan';
type BaseObject = { id: string; color: string; strokeWidth: number };
export type PenStroke = BaseObject & { type: 'pen'; points: Point[] };
export type LinearShape = BaseObject & { type: 'line' | 'arrow' | 'rectangle' | 'ellipse'; start: Point; end: Point };
export type TextShape = BaseObject & { type: 'text'; position: Point; text: string; fontSize: number };
export type DrawingObject = PenStroke | LinearShape | TextShape;
export type BoardState = { objects: DrawingObject[]; selectedId: string | null; activeTool: BoardTool };
export type Viewport = { x: number; y: number; zoom: number };
export type Bounds = { x: number; y: number; width: number; height: number };

let nextId = 1;
const base = (color: string, strokeWidth: number) => ({ id: `drawing-${nextId++}`, color, strokeWidth });
export const createPenStroke = (points: Point[], color = '#111827', strokeWidth = 4): PenStroke => ({ ...base(color, strokeWidth), type: 'pen', points: points.map((point) => ({ ...point })) });
export const createShape = (type: LinearShape['type'], start: Point, end: Point, color = '#111827', strokeWidth = 4): LinearShape => ({ ...base(color, strokeWidth), type, start: { ...start }, end: { ...end } });
export const createText = (position: Point, text: string, color = '#111827', fontSize = 24): TextShape => ({ ...base(color, 1), type: 'text', position: { ...position }, text, fontSize });

export function cloneObjects(objects: DrawingObject[]): DrawingObject[] { return structuredClone(objects); }
export function emptyBoard(): BoardState { return { objects: [], selectedId: null, activeTool: 'pen' }; }
export function setActiveTool(state: BoardState, activeTool: BoardTool): BoardState { return { ...state, activeTool }; }
export function deleteSelected(state: BoardState): BoardState { return state.selectedId ? { ...state, objects: state.objects.filter((object) => object.id !== state.selectedId), selectedId: null } : state; }
export function clearBoard(state: BoardState): BoardState { return { ...state, objects: [], selectedId: null }; }

export function moveObject(object: DrawingObject, dx: number, dy: number): DrawingObject {
	if (object.type === 'pen') return { ...object, points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
	if (object.type === 'text') return { ...object, position: { x: object.position.x + dx, y: object.position.y + dy } };
	return { ...object, start: { x: object.start.x + dx, y: object.start.y + dy }, end: { x: object.end.x + dx, y: object.end.y + dy } };
}

const distanceToSegment = (point: Point, a: Point, b: Point) => {
	const dx = b.x - a.x; const dy = b.y - a.y; const lengthSquared = dx * dx + dy * dy;
	if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y);
	const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
	return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
};

export function objectBounds(object: DrawingObject): Bounds {
	if (object.type === 'pen') {
		const xs = object.points.map((p) => p.x); const ys = object.points.map((p) => p.y); const pad = object.strokeWidth / 2;
		return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, width: Math.max(...xs) - Math.min(...xs) + pad * 2, height: Math.max(...ys) - Math.min(...ys) + pad * 2 };
	}
	if (object.type === 'text') return { x: object.position.x, y: object.position.y - object.fontSize, width: Math.max(object.fontSize * .6, object.text.length * object.fontSize * .6), height: object.fontSize * 1.25 };
	const x = Math.min(object.start.x, object.end.x); const y = Math.min(object.start.y, object.end.y);
	return { x, y, width: Math.abs(object.end.x - object.start.x), height: Math.abs(object.end.y - object.start.y) };
}

export function hitTestObject(object: DrawingObject, point: Point, tolerance = 8): boolean {
	if (object.type === 'pen') return object.points.some((p, index) => index > 0 && distanceToSegment(point, object.points[index - 1]!, p) <= tolerance + object.strokeWidth / 2);
	if (object.type === 'line' || object.type === 'arrow') return distanceToSegment(point, object.start, object.end) <= tolerance + object.strokeWidth / 2;
	const bounds = objectBounds(object);
	if (object.type === 'text') return point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.width + tolerance && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.height + tolerance;
	if (object.type === 'rectangle') {
		const inside = point.x >= bounds.x - tolerance && point.x <= bounds.x + bounds.width + tolerance && point.y >= bounds.y - tolerance && point.y <= bounds.y + bounds.height + tolerance;
		const awayFromEdge = point.x > bounds.x + tolerance && point.x < bounds.x + bounds.width - tolerance && point.y > bounds.y + tolerance && point.y < bounds.y + bounds.height - tolerance;
		return inside && !awayFromEdge;
	}
	if (bounds.width === 0 || bounds.height === 0) return false;
	const cx = bounds.x + bounds.width / 2; const cy = bounds.y + bounds.height / 2; const rx = bounds.width / 2; const ry = bounds.height / 2;
	const normalized = Math.sqrt(((point.x - cx) / rx) ** 2 + ((point.y - cy) / ry) ** 2);
	return Math.abs(normalized - 1) <= tolerance / Math.max(1, Math.min(rx, ry));
}

export function findObjectAt(objects: DrawingObject[], point: Point): DrawingObject | undefined { return [...objects].reverse().find((object) => hitTestObject(object, point)); }
export function clampZoom(zoom: number): number { return Math.max(.25, Math.min(4, zoom)); }
export const screenToBoard = (point: Point, viewport: Viewport): Point => ({ x: (point.x - viewport.x) / viewport.zoom, y: (point.y - viewport.y) / viewport.zoom });
export const boardToScreen = (point: Point, viewport: Viewport): Point => ({ x: point.x * viewport.zoom + viewport.x, y: point.y * viewport.zoom + viewport.y });

export function calculateDrawingBounds(objects: DrawingObject[], padding = 24): Bounds | null {
	if (!objects.length) return null;
	const bounds = objects.map(objectBounds); const left = Math.min(...bounds.map((b) => b.x)); const top = Math.min(...bounds.map((b) => b.y));
	const right = Math.max(...bounds.map((b) => b.x + b.width)); const bottom = Math.max(...bounds.map((b) => b.y + b.height));
	return { x: left - padding, y: top - padding, width: Math.max(1, right - left + padding * 2), height: Math.max(1, bottom - top + padding * 2) };
}

export class BoardHistory {
	private snapshots: DrawingObject[][] = [[]]; private index = 0; private readonly limit: number;
	constructor(limit = 75) { this.limit = limit; }
	commit(objects: DrawingObject[]) { this.snapshots = this.snapshots.slice(0, this.index + 1); this.snapshots.push(cloneObjects(objects)); if (this.snapshots.length > this.limit + 1) this.snapshots.shift(); this.index = this.snapshots.length - 1; }
	undo(): DrawingObject[] | null { if (!this.canUndo) return null; return cloneObjects(this.snapshots[--this.index]!); }
	redo(): DrawingObject[] | null { if (!this.canRedo) return null; return cloneObjects(this.snapshots[++this.index]!); }
	get canUndo() { return this.index > 0; } get canRedo() { return this.index < this.snapshots.length - 1; } get length() { return this.snapshots.length - 1; }
}
