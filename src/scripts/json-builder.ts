type NodeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array';

interface BaseNode {
	id: string;
	type: NodeType;
}

interface PrimitiveNode extends BaseNode {
	type: 'string' | 'number' | 'boolean' | 'null';
	value: string | boolean | null;
}

interface ObjectEntry {
	id: string;
	key: string;
	node: BuilderNode;
}

interface ObjectNode extends BaseNode {
	type: 'object';
	entries: ObjectEntry[];
}

interface ArrayNode extends BaseNode {
	type: 'array';
	items: BuilderNode[];
}

type BuilderNode = PrimitiveNode | ObjectNode | ArrayNode;

const MAX_DEPTH = 20;
const typeOptions: NodeType[] = ['string', 'number', 'boolean', 'null', 'object', 'array'];
let nextId = 0;
let root: ObjectNode | ArrayNode = createNode('object') as ObjectNode;
let compactPreview = false;
let lastJson = '';

const builder = document.querySelector<HTMLElement>('#builder-root');
const preview = document.querySelector<HTMLTextAreaElement>('#json-preview');
const status = document.querySelector<HTMLElement>('#builder-status');
const rootType = document.querySelector<HTMLSelectElement>('#root-type');
const indentSelect = document.querySelector<HTMLSelectElement>('#builder-indent');
const addRootButton = document.querySelector<HTMLButtonElement>('#add-root');
const copyButton = document.querySelector<HTMLButtonElement>('#copy-json');
const downloadButton = document.querySelector<HTMLButtonElement>('#download-json');
const clearButton = document.querySelector<HTMLButtonElement>('#clear-builder');
const sampleButton = document.querySelector<HTMLButtonElement>('#load-builder-sample');
const importButton = document.querySelector<HTMLButtonElement>('#open-import');
const formatButton = document.querySelector<HTMLButtonElement>('#format-preview');
const minifyButton = document.querySelector<HTMLButtonElement>('#minify-preview');
const importDialog = document.querySelector<HTMLDialogElement>('#import-dialog');
const importText = document.querySelector<HTMLTextAreaElement>('#import-json');
const confirmImportButton = document.querySelector<HTMLButtonElement>('#confirm-import');
const cancelImportButton = document.querySelector<HTMLButtonElement>('#cancel-import');
const importError = document.querySelector<HTMLElement>('#import-error');

const statElements = {
	properties: document.querySelector<HTMLElement>('#builder-properties'),
	items: document.querySelector<HTMLElement>('#builder-items'),
	objects: document.querySelector<HTMLElement>('#builder-objects'),
	arrays: document.querySelector<HTMLElement>('#builder-arrays'),
	depth: document.querySelector<HTMLElement>('#builder-depth'),
	characters: document.querySelector<HTMLElement>('#builder-characters'),
};

function id(): string {
	nextId += 1;
	return `node-${nextId}`;
}

function createNode(type: NodeType): BuilderNode {
	if (type === 'object') return { id: id(), type, entries: [] };
	if (type === 'array') return { id: id(), type, items: [] };
	if (type === 'boolean') return { id: id(), type, value: true };
	if (type === 'null') return { id: id(), type, value: null };
	return { id: id(), type, value: '' };
}

function cloneNode(node: BuilderNode): BuilderNode {
	if (node.type === 'object') {
		return {
			id: id(),
			type: 'object',
			entries: node.entries.map((entry) => ({ id: id(), key: entry.key, node: cloneNode(entry.node) })),
		};
	}
	if (node.type === 'array') return { id: id(), type: 'array', items: node.items.map(cloneNode) };
	return { ...node, id: id() };
}

function nodeFromValue(value: unknown, depth = 1): BuilderNode {
	if (depth > MAX_DEPTH) throw new Error(`Imported JSON exceeds the supported nesting limit of ${MAX_DEPTH} levels.`);
	if (value === null) return createNode('null');
	if (Array.isArray(value)) {
		const node = createNode('array') as ArrayNode;
		node.items = value.map((item) => nodeFromValue(item, depth + 1));
		return node;
	}
	if (typeof value === 'object') {
		const node = createNode('object') as ObjectNode;
		node.entries = Object.entries(value).map(([key, child]) => ({ id: id(), key, node: nodeFromValue(child, depth + 1) }));
		return node;
	}
	if (typeof value === 'boolean') return { id: id(), type: 'boolean', value };
	if (typeof value === 'number') return { id: id(), type: 'number', value: String(value) };
	if (typeof value === 'string') return { id: id(), type: 'string', value };
	throw new Error('The imported data contains an unsupported value.');
}

function valueFromNode(node: BuilderNode, path = 'root'): unknown {
	if (node.type === 'string' || node.type === 'boolean' || node.type === 'null') return node.value;
	if (node.type === 'number') {
		const raw = String(node.value).trim();
		if (!raw) throw new Error(`Enter a number at ${path}; an empty number is not converted to zero.`);
		const value = Number(raw);
		if (!Number.isFinite(value)) throw new Error(`Enter a valid finite number at ${path}.`);
		return value;
	}
	if (node.type === 'array') return node.items.map((item, index) => valueFromNode(item, `${path}[${index}]`));

	const result: Record<string, unknown> = {};
	const keys = new Set<string>();
	for (const entry of node.entries) {
		const key = entry.key.trim();
		if (!key) throw new Error(`Enter a key for every property in ${path}.`);
		if (keys.has(key)) throw new Error(`Duplicate key "${key}" found in ${path}. Rename or remove one property.`);
		keys.add(key);
		result[key] = valueFromNode(entry.node, `${path}.${key}`);
	}
	return result;
}

function findNode(targetId: string, current: BuilderNode = root): BuilderNode | null {
	if (current.id === targetId) return current;
	if (current.type === 'object') {
		for (const entry of current.entries) {
			const found = findNode(targetId, entry.node);
			if (found) return found;
		}
	}
	if (current.type === 'array') {
		for (const item of current.items) {
			const found = findNode(targetId, item);
			if (found) return found;
		}
	}
	return null;
}

function findParent(targetId: string, current: BuilderNode = root): ObjectNode | ArrayNode | null {
	if (current.type === 'object') {
		if (current.entries.some((entry) => entry.node.id === targetId)) return current;
		for (const entry of current.entries) {
			const found = findParent(targetId, entry.node);
			if (found) return found;
		}
	}
	if (current.type === 'array') {
		if (current.items.some((item) => item.id === targetId)) return current;
		for (const item of current.items) {
			const found = findParent(targetId, item);
			if (found) return found;
		}
	}
	return null;
}

function replaceNode(targetId: string, replacement: BuilderNode): void {
	const parent = findParent(targetId);
	if (!parent) return;
	if (parent.type === 'object') {
		const entry = parent.entries.find((item) => item.node.id === targetId);
		if (entry) entry.node = replacement;
	} else {
		const index = parent.items.findIndex((item) => item.id === targetId);
		if (index >= 0) parent.items[index] = replacement;
	}
}

function hasData(): boolean {
	return root.type === 'object' ? root.entries.length > 0 : root.items.length > 0;
}

function indentation(): number | string {
	return indentSelect?.value === 'tab' ? '\t' : Number(indentSelect?.value ?? 2);
}

function setStatus(kind: 'success' | 'error' | 'neutral', message: string): void {
	if (!status) return;
	status.textContent = message;
	status.className = 'rounded-xl border px-4 py-3 text-sm';
	if (kind === 'success') status.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-800');
	else if (kind === 'error') status.classList.add('border-red-200', 'bg-red-50', 'text-red-800');
	else status.classList.add('border-blue-100', 'bg-blue-50', 'text-blue-800');
}

function calculateStats(node: BuilderNode) {
	const totals = { properties: 0, items: 0, objects: 0, arrays: 0, depth: 0 };
	function visit(current: BuilderNode, depth: number): void {
		totals.depth = Math.max(totals.depth, depth);
		if (current.type === 'object') {
			totals.objects++;
			totals.properties += current.entries.length;
			current.entries.forEach((entry) => visit(entry.node, depth + 1));
		} else if (current.type === 'array') {
			totals.arrays++;
			totals.items += current.items.length;
			current.items.forEach((item) => visit(item, depth + 1));
		}
	}
	visit(node, 1);
	return totals;
}

function updatePreview(showSuccess = false): void {
	const totals = calculateStats(root);
	if (statElements.properties) statElements.properties.textContent = totals.properties.toLocaleString();
	if (statElements.items) statElements.items.textContent = totals.items.toLocaleString();
	if (statElements.objects) statElements.objects.textContent = totals.objects.toLocaleString();
	if (statElements.arrays) statElements.arrays.textContent = totals.arrays.toLocaleString();
	if (statElements.depth) statElements.depth.textContent = totals.depth.toLocaleString();

	try {
		const value = valueFromNode(root);
		lastJson = compactPreview ? JSON.stringify(value) : JSON.stringify(value, null, indentation());
		if (preview) preview.value = lastJson;
		if (statElements.characters) statElements.characters.textContent = lastJson.length.toLocaleString();
		if (copyButton) copyButton.disabled = false;
		if (downloadButton) downloadButton.disabled = false;
		if (showSuccess) setStatus('success', 'The builder contains valid JSON.');
	} catch (error) {
		lastJson = '';
		if (preview) preview.value = '';
		if (statElements.characters) statElements.characters.textContent = '0';
		if (copyButton) copyButton.disabled = true;
		if (downloadButton) downloadButton.disabled = true;
		setStatus('error', error instanceof Error ? error.message : 'The builder contains invalid data.');
	}
}

function button(label: string, action: string, nodeId: string, disabled = false, danger = false): HTMLButtonElement {
	const element = document.createElement('button');
	element.type = 'button';
	element.textContent = label;
	element.dataset.action = action;
	element.dataset.nodeId = nodeId;
	element.disabled = disabled;
	element.className = danger ? 'builder-action builder-danger' : 'builder-action';
	element.setAttribute('aria-label', label);
	return element;
}

function renderValueControl(node: BuilderNode): HTMLElement {
	const wrapper = document.createElement('div');
	wrapper.className = 'builder-value';
	if (node.type === 'null') {
		const value = document.createElement('span');
		value.className = 'builder-null';
		value.textContent = 'null';
		wrapper.append(value);
		return wrapper;
	}
	if (node.type === 'boolean') {
		const select = document.createElement('select');
		select.className = 'builder-input';
		select.dataset.valueId = node.id;
		select.setAttribute('aria-label', 'Boolean value');
		select.innerHTML = '<option value="true">true</option><option value="false">false</option>';
		select.value = node.value ? 'true' : 'false';
		wrapper.append(select);
		return wrapper;
	}
	if (node.type === 'string' || node.type === 'number') {
		const input = document.createElement('input');
		input.className = 'builder-input';
		input.type = node.type === 'number' ? 'number' : 'text';
		if (node.type === 'number') input.step = 'any';
		input.value = String(node.value);
		input.placeholder = node.type === 'number' ? 'Enter a number' : 'Enter a value';
		input.dataset.valueId = node.id;
		input.setAttribute('aria-label', `${node.type} value`);
		wrapper.append(input);
		return wrapper;
	}
	wrapper.append(renderContainer(node));
	return wrapper;
}

function renderRow(node: BuilderNode, index: number, parent: ObjectNode | ArrayNode, entry?: ObjectEntry): HTMLElement {
	const row = document.createElement('div');
	row.className = 'builder-row';
	row.dataset.node = node.id;

	const header = document.createElement('div');
	header.className = 'builder-row-header';
	if (entry) {
		const key = document.createElement('input');
		key.className = 'builder-key';
		key.value = entry.key;
		key.placeholder = 'Property key';
		key.dataset.entryId = entry.id;
		key.setAttribute('aria-label', `Property ${index + 1} key`);
		header.append(key);
	} else {
		const number = document.createElement('span');
		number.className = 'builder-index';
		number.textContent = `Item ${index + 1}`;
		header.append(number);
	}

	const select = document.createElement('select');
	select.className = 'builder-type';
	select.dataset.typeId = node.id;
	select.setAttribute('aria-label', `${entry ? 'Property' : 'Item'} ${index + 1} type`);
	typeOptions.forEach((type) => select.add(new Option(type[0].toUpperCase() + type.slice(1), type)));
	select.value = node.type;
	header.append(select);

	const actions = document.createElement('div');
	actions.className = 'builder-row-actions';
	actions.append(
		button('↑', 'up', node.id, index === 0),
		button('↓', 'down', node.id, index === (parent.type === 'object' ? parent.entries.length : parent.items.length) - 1),
		button('Duplicate', 'duplicate', node.id),
		button('Delete', 'delete', node.id, false, true),
	);
	header.append(actions);
	row.append(header, renderValueControl(node));
	return row;
}

function renderContainer(node: ObjectNode | ArrayNode): HTMLElement {
	const container = document.createElement('div');
	container.className = 'builder-container';
	const heading = document.createElement('div');
	heading.className = 'builder-container-heading';
	const label = document.createElement('span');
	label.textContent = node === root ? `Root ${node.type}` : `Nested ${node.type}`;
	const add = button(node.type === 'object' ? '+ Add property' : '+ Add item', 'add', node.id);
	heading.append(label, add);
	container.append(heading);

	const children = document.createElement('div');
	children.className = 'builder-children';
	if (node.type === 'object') {
		node.entries.forEach((entry, index) => children.append(renderRow(entry.node, index, node, entry)));
		if (!node.entries.length) children.innerHTML = '<p class="builder-empty">No properties yet.</p>';
	} else {
		node.items.forEach((item, index) => children.append(renderRow(item, index, node)));
		if (!node.items.length) children.innerHTML = '<p class="builder-empty">No items yet.</p>';
	}
	container.append(children);
	return container;
}

function render(): void {
	if (!builder) return;
	builder.replaceChildren(renderContainer(root));
	if (rootType) rootType.value = root.type;
	if (addRootButton) addRootButton.textContent = root.type === 'object' ? 'Add property' : 'Add item';
	updatePreview();
}

function addChild(container: ObjectNode | ArrayNode): void {
	if (calculateStats(root).depth >= MAX_DEPTH && container !== root) {
		setStatus('error', `Nesting is limited to ${MAX_DEPTH} levels to protect browser performance.`);
		return;
	}
	if (container.type === 'object') container.entries.push({ id: id(), key: '', node: createNode('string') });
	else container.items.push(createNode('string'));
	render();
}

builder?.addEventListener('input', (event) => {
	const target = event.target as HTMLInputElement;
	if (target.dataset.entryId) {
		const findEntry = (node: BuilderNode): ObjectEntry | null => {
			if (node.type === 'object') {
				for (const entry of node.entries) {
					if (entry.id === target.dataset.entryId) return entry;
					const found = findEntry(entry.node);
					if (found) return found;
				}
			}
			if (node.type === 'array') {
				for (const child of node.items) {
					const found = findEntry(child);
					if (found) return found;
				}
			}
			return null;
		};
		const entry = findEntry(root);
		if (entry) entry.key = target.value;
	}
	if (target.dataset.valueId) {
		const node = findNode(target.dataset.valueId);
		if (node?.type === 'string' || node?.type === 'number') node.value = target.value;
	}
	updatePreview();
});

builder?.addEventListener('change', (event) => {
	const target = event.target as HTMLSelectElement;
	if (target.dataset.typeId) {
		const oldNode = findNode(target.dataset.typeId);
		if (!oldNode) return;
		replaceNode(oldNode.id, createNode(target.value as NodeType));
		render();
	}
	if (target.dataset.valueId) {
		const node = findNode(target.dataset.valueId);
		if (node?.type === 'boolean') node.value = target.value === 'true';
		updatePreview();
	}
});

builder?.addEventListener('click', (event) => {
	const target = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-action]');
	if (!target) return;
	const nodeId = target.dataset.nodeId ?? '';
	const action = target.dataset.action;
	const node = findNode(nodeId);
	if (action === 'add' && node && (node.type === 'object' || node.type === 'array')) {
		addChild(node);
		return;
	}
	const parent = findParent(nodeId);
	if (!node || !parent) return;
	const list = parent.type === 'object' ? parent.entries : parent.items;
	const index = parent.type === 'object'
		? parent.entries.findIndex((entry) => entry.node.id === nodeId)
		: parent.items.findIndex((item) => item.id === nodeId);
	if (index < 0) return;
	if (action === 'delete') list.splice(index, 1);
	if (action === 'duplicate') {
		if (parent.type === 'object') {
			const source = parent.entries[index];
			parent.entries.splice(index + 1, 0, { id: id(), key: `${source.key}Copy`, node: cloneNode(source.node) });
		} else parent.items.splice(index + 1, 0, cloneNode(parent.items[index]));
	}
	if (action === 'up' && index > 0) [list[index - 1], list[index]] = [list[index], list[index - 1]];
	if (action === 'down' && index < list.length - 1) [list[index], list[index + 1]] = [list[index + 1], list[index]];
	render();
});

rootType?.addEventListener('change', () => {
	const requested = rootType.value as 'object' | 'array';
	if (requested === root.type) return;
	if (hasData() && !window.confirm('Changing the root type will delete the current builder data. Continue?')) {
		rootType.value = root.type;
		return;
	}
	root = createNode(requested) as ObjectNode | ArrayNode;
	render();
	setStatus('neutral', `Root changed to ${requested}.`);
});

addRootButton?.addEventListener('click', () => addChild(root));
indentSelect?.addEventListener('change', () => {
	compactPreview = false;
	updatePreview();
});
formatButton?.addEventListener('click', () => {
	compactPreview = false;
	updatePreview(true);
});
minifyButton?.addEventListener('click', () => {
	compactPreview = true;
	updatePreview(true);
});
clearButton?.addEventListener('click', () => {
	if (hasData() && !window.confirm('Clear all builder data?')) return;
	root = createNode(root.type) as ObjectNode | ArrayNode;
	render();
	setStatus('neutral', 'Builder cleared.');
});

sampleButton?.addEventListener('click', () => {
	const sample = {
		name: 'ToolPulse',
		category: 'Developer Tools',
		active: true,
		tools: [
			{ name: 'JSON Formatter', status: 'available' },
			{ name: 'JSON Builder', status: 'available' },
		],
	};
	root = nodeFromValue(sample) as ObjectNode;
	compactPreview = false;
	render();
	setStatus('success', 'Sample JSON loaded.');
});

copyButton?.addEventListener('click', async () => {
	if (!lastJson) return;
	try {
		await navigator.clipboard.writeText(lastJson);
	} catch {
		preview?.select();
		document.execCommand('copy');
	}
	setStatus('success', 'JSON copied to the clipboard.');
});

downloadButton?.addEventListener('click', () => {
	if (!lastJson) return;
	const url = URL.createObjectURL(new Blob([lastJson], { type: 'application/json' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = 'toolpulse-data.json';
	document.body.append(link);
	link.click();
	link.remove();
	window.setTimeout(() => URL.revokeObjectURL(url), 0);
	setStatus('success', 'JSON download created.');
});

importButton?.addEventListener('click', () => {
	if (importError) importError.textContent = '';
	importDialog?.showModal();
	importText?.focus();
});
cancelImportButton?.addEventListener('click', () => importDialog?.close());
confirmImportButton?.addEventListener('click', () => {
	if (!importText) return;
	try {
		const parsed: unknown = JSON.parse(importText.value);
		if (parsed === null || (typeof parsed !== 'object')) throw new Error('The root must be a JSON object or array.');
		const imported = nodeFromValue(parsed);
		if (imported.type !== 'object' && imported.type !== 'array') throw new Error('The root must be a JSON object or array.');
		root = imported;
		compactPreview = false;
		render();
		importDialog?.close();
		importText.value = '';
		setStatus('success', 'JSON imported successfully.');
	} catch (error) {
		if (importError) importError.textContent = error instanceof Error ? error.message : 'Unable to import this JSON.';
	}
});

render();
setStatus('neutral', 'Add a property to start building JSON.');
