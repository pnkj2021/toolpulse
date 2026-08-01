import {
	decodeBase64,
	downloadBlob,
	encodeFile,
	encodeText,
	formatFileSize,
} from '../utils/base64';
import { extensionForMimeType } from '../utils/fileTypes';
import type { DecodedBase64Result } from '../utils/base64';

type Mode = 'text' | 'file';

const elements = {
	tabs: [...document.querySelectorAll<HTMLButtonElement>('[data-base64-tab]')],
	panels: [...document.querySelectorAll<HTMLElement>('[data-base64-panel]')],
	status: document.querySelector<HTMLElement>('#base64-status'),
	textInput: document.querySelector<HTMLTextAreaElement>('#text-input'),
	textOutput: document.querySelector<HTMLTextAreaElement>('#text-output'),
	encodeText: document.querySelector<HTMLButtonElement>('#encode-text'),
	decodeText: document.querySelector<HTMLButtonElement>('#decode-text'),
	swapText: document.querySelector<HTMLButtonElement>('#swap-text'),
	clearText: document.querySelector<HTMLButtonElement>('#clear-text'),
	copyText: document.querySelector<HTMLButtonElement>('#copy-text'),
	downloadText: document.querySelector<HTMLButtonElement>('#download-decoded-text'),
	textResult: document.querySelector<HTMLElement>('#text-result'),
	textType: document.querySelector<HTMLElement>('#decoded-text-type'),
	binaryResult: document.querySelector<HTMLElement>('#binary-result'),
	binaryMime: document.querySelector<HTMLElement>('#binary-mime'),
	binarySize: document.querySelector<HTMLElement>('#binary-size'),
	binaryExtension: document.querySelector<HTMLElement>('#binary-extension'),
	downloadBinary: document.querySelector<HTMLButtonElement>('#download-decoded-binary'),
	imagePreview: document.querySelector<HTMLElement>('#decoded-image-preview'),
	decodedImage: document.querySelector<HTMLImageElement>('#decoded-image'),
	fileInput: document.querySelector<HTMLInputElement>('#file-input'),
	dropZone: document.querySelector<HTMLElement>('[data-drop-zone]'),
	fileName: document.querySelector<HTMLElement>('#file-name'),
	fileSize: document.querySelector<HTMLElement>('#file-size'),
	fileType: document.querySelector<HTMLElement>('#file-type'),
	fileDetails: document.querySelector<HTMLElement>('#file-details'),
	fileBase64: document.querySelector<HTMLTextAreaElement>('#file-base64'),
	encodeSelectedFile: document.querySelector<HTMLButtonElement>('#encode-file'),
	restoreFile: document.querySelector<HTMLButtonElement>('#restore-file'),
	copyFile: document.querySelector<HTMLButtonElement>('#copy-file'),
	downloadBase64: document.querySelector<HTMLButtonElement>('#download-base64'),
	downloadRestored: document.querySelector<HTMLButtonElement>('#download-restored'),
	clearFile: document.querySelector<HTMLButtonElement>('#clear-file'),
};

let selectedFile: File | null = null;
let restoredFile: { bytes: Uint8Array; mimeType: string; name: string } | null = null;
let decodedResult: DecodedBase64Result | null = null;
let imagePreviewUrl: string | null = null;

function clearImagePreview(): void {
	if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
	imagePreviewUrl = null;
	if (elements.decodedImage) elements.decodedImage.removeAttribute('src');
	elements.imagePreview?.classList.add('hidden');
}

function resetDecodedResult(): void {
	clearImagePreview();
	decodedResult = null;
	elements.binaryResult?.classList.add('hidden');
	elements.textResult?.classList.remove('hidden');
	elements.textType?.classList.add('hidden');
	if (elements.downloadText) elements.downloadText.disabled = true;
	if (elements.downloadBinary) elements.downloadBinary.disabled = true;
}

function showDecodedResult(result: DecodedBase64Result): void {
	clearImagePreview();
	decodedResult = result;
	if (result.kind === 'text') {
		elements.binaryResult?.classList.add('hidden');
		elements.textResult?.classList.remove('hidden');
		if (elements.textOutput) elements.textOutput.value = result.text;
		if (elements.textType) {
			elements.textType.textContent = `Detected type: ${result.mimeType}`;
			elements.textType.classList.remove('hidden');
		}
		if (elements.downloadText) elements.downloadText.disabled = false;
		if (result.mimeType.startsWith('image/')) {
			imagePreviewUrl = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: result.mimeType }));
			if (elements.decodedImage) elements.decodedImage.src = imagePreviewUrl;
			elements.imagePreview?.classList.remove('hidden');
		}
		setStatus('success', 'Base64 decoded successfully as text.');
	} else {
		if (elements.textOutput) elements.textOutput.value = '';
		elements.textResult?.classList.add('hidden');
		elements.binaryResult?.classList.remove('hidden');
		if (elements.binaryMime) elements.binaryMime.textContent = result.mimeType;
		if (elements.binarySize) elements.binarySize.textContent = formatFileSize(result.bytes.length);
		if (elements.binaryExtension) elements.binaryExtension.textContent = `.${extensionForMimeType(result.mimeType)}`;
		if (elements.downloadBinary) {
			elements.downloadBinary.disabled = false;
			elements.downloadBinary.textContent = `Download ${extensionForMimeType(result.mimeType).toUpperCase()}`;
		}
		if (result.mimeType.startsWith('image/')) {
			imagePreviewUrl = URL.createObjectURL(new Blob([Uint8Array.from(result.bytes).buffer], { type: result.mimeType }));
			if (elements.decodedImage) elements.decodedImage.src = imagePreviewUrl;
			elements.imagePreview?.classList.remove('hidden');
		}
		setStatus('success', 'Binary content decoded successfully.');
	}
	updateTextActions();
}

function setStatus(type: 'success' | 'error' | 'neutral', message: string): void {
	if (!elements.status) return;
	elements.status.textContent = message;
	elements.status.className = 'mb-4 rounded-xl border px-4 py-3 text-sm';
	if (type === 'success') elements.status.classList.add('border-emerald-200', 'bg-emerald-50', 'text-emerald-800', 'dark:border-emerald-900', 'dark:bg-emerald-950', 'dark:text-emerald-200');
	else if (type === 'error') elements.status.classList.add('border-red-200', 'bg-red-50', 'text-red-800', 'dark:border-red-900', 'dark:bg-red-950', 'dark:text-red-200');
	else elements.status.classList.add('border-blue-100', 'bg-blue-50', 'text-blue-800', 'dark:border-blue-900', 'dark:bg-blue-950', 'dark:text-blue-200');
}

function setMode(mode: Mode): void {
	elements.tabs.forEach((tab) => {
		const selected = tab.dataset.base64Tab === mode;
		tab.setAttribute('aria-selected', String(selected));
		tab.classList.toggle('base64-tab-active', selected);
	});
	elements.panels.forEach((panel) => {
		panel.hidden = panel.dataset.base64Panel !== mode;
	});
}

function updateTextActions(): void {
	const hasInput = Boolean(elements.textInput?.value);
	const hasOutput = Boolean(elements.textOutput?.value);
	if (elements.encodeText) elements.encodeText.disabled = !hasInput;
	if (elements.decodeText) elements.decodeText.disabled = !hasInput;
	if (elements.swapText) elements.swapText.disabled = !hasOutput;
	if (elements.copyText) elements.copyText.disabled = !hasOutput;
}

function updateFileActions(): void {
	const hasBase64 = Boolean(elements.fileBase64?.value.trim());
	if (elements.encodeSelectedFile) elements.encodeSelectedFile.disabled = !selectedFile;
	if (elements.copyFile) elements.copyFile.disabled = !hasBase64;
	if (elements.downloadBase64) elements.downloadBase64.disabled = !hasBase64;
	if (elements.restoreFile) elements.restoreFile.disabled = !hasBase64;
	if (elements.downloadRestored) elements.downloadRestored.disabled = !restoredFile;
}

function showFile(file: File): void {
	selectedFile = file;
	restoredFile = null;
	if (elements.fileName) elements.fileName.textContent = file.name;
	if (elements.fileSize) elements.fileSize.textContent = formatFileSize(file.size);
	if (elements.fileType) elements.fileType.textContent = file.type || 'Unknown';
	elements.fileDetails?.classList.remove('hidden');
	updateFileActions();
	setStatus('neutral', `${file.name} is ready to encode.`);
}

async function copyValue(value: string, button: HTMLButtonElement | null): Promise<void> {
	if (!value || !button) return;
	try {
		await navigator.clipboard.writeText(value);
	} catch {
		const targetId = button.dataset.copyTarget;
		const target = targetId ? document.querySelector<HTMLTextAreaElement>(`#${targetId}`) : null;
		target?.select();
		document.execCommand('copy');
	}
	const label = button.querySelector<HTMLElement>('[data-button-label]');
	const original = label?.textContent ?? 'Copy';
	if (label) label.textContent = 'Copied!';
	setStatus('success', 'Copied to the clipboard.');
	window.setTimeout(() => {
		if (label) label.textContent = original;
	}, 1500);
}

elements.tabs.forEach((tab) => tab.addEventListener('click', () => setMode(tab.dataset.base64Tab as Mode)));

elements.textInput?.addEventListener('input', updateTextActions);
elements.encodeText?.addEventListener('click', () => {
	try {
		resetDecodedResult();
		if (elements.textOutput) elements.textOutput.value = encodeText(elements.textInput?.value ?? '');
		if (elements.downloadText) elements.downloadText.disabled = false;
		updateTextActions();
		setStatus('success', 'Text encoded successfully.');
	} catch (error) {
		setStatus('error', error instanceof Error ? error.message : 'Unable to encode text.');
	}
});
elements.decodeText?.addEventListener('click', () => {
	try {
		showDecodedResult(decodeBase64(elements.textInput?.value ?? ''));
	} catch (error) {
		resetDecodedResult();
		if (elements.textOutput) elements.textOutput.value = '';
		updateTextActions();
		setStatus('error', error instanceof Error ? error.message : 'Invalid Base64 string.');
	}
});
elements.swapText?.addEventListener('click', () => {
	if (!elements.textInput || !elements.textOutput) return;
	resetDecodedResult();
	[elements.textInput.value, elements.textOutput.value] = [elements.textOutput.value, elements.textInput.value];
	updateTextActions();
	elements.textInput.focus();
	setStatus('neutral', 'Input and output swapped.');
});
elements.clearText?.addEventListener('click', () => {
	if (elements.textInput) elements.textInput.value = '';
	if (elements.textOutput) elements.textOutput.value = '';
	resetDecodedResult();
	updateTextActions();
	elements.textInput?.focus();
	setStatus('neutral', 'Text fields cleared.');
});
elements.copyText?.addEventListener('click', () => copyValue(elements.textOutput?.value ?? '', elements.copyText));
elements.downloadText?.addEventListener('click', () => {
	if (decodedResult?.kind === 'text') {
		downloadBlob(decodedResult.bytes, decodedResult.mimeType, decodedResult.filename);
	} else if (elements.textOutput?.value) {
		downloadBlob(elements.textOutput.value, 'text/plain;charset=utf-8', 'base64-output.txt');
	}
});
elements.downloadBinary?.addEventListener('click', () => {
	if (decodedResult?.kind === 'binary') {
		downloadBlob(decodedResult.bytes, decodedResult.mimeType, decodedResult.filename);
	}
});

elements.fileInput?.addEventListener('change', () => {
	const file = elements.fileInput?.files?.[0];
	if (file) showFile(file);
});
['dragenter', 'dragover'].forEach((eventName) => elements.dropZone?.addEventListener(eventName, (event) => {
	event.preventDefault();
	elements.dropZone?.classList.add('border-blue-500', 'bg-blue-50');
}));
['dragleave', 'drop'].forEach((eventName) => elements.dropZone?.addEventListener(eventName, (event) => {
	event.preventDefault();
	elements.dropZone?.classList.remove('border-blue-500', 'bg-blue-50');
}));
elements.dropZone?.addEventListener('drop', (event) => {
	const file = event.dataTransfer?.files?.[0];
	if (file) showFile(file);
});

elements.encodeSelectedFile?.addEventListener('click', async () => {
	if (!selectedFile) {
		setStatus('error', 'Choose a file first.');
		return;
	}
	try {
		const encoded = await encodeFile(selectedFile);
		if (elements.fileBase64) elements.fileBase64.value = encoded;
		restoredFile = null;
		updateFileActions();
		setStatus('success', `${selectedFile.name} converted to Base64.`);
	} catch {
		setStatus('error', 'Unable to read this file.');
	}
});
elements.fileBase64?.addEventListener('input', () => {
	restoredFile = null;
	updateFileActions();
});
elements.restoreFile?.addEventListener('click', () => {
	try {
		const decoded = decodeBase64(elements.fileBase64?.value ?? '');
		restoredFile = {
			bytes: decoded.bytes,
			mimeType: decoded.isDataUrl ? decoded.mimeType : (selectedFile?.type || decoded.mimeType),
			name: selectedFile?.name || 'restored-file',
		};
		updateFileActions();
		setStatus('success', `File restored (${formatFileSize(decoded.bytes.length)}).`);
	} catch (error) {
		restoredFile = null;
		updateFileActions();
		setStatus('error', error instanceof Error ? error.message : 'Unable to decode file.');
	}
});
elements.copyFile?.addEventListener('click', () => copyValue(elements.fileBase64?.value ?? '', elements.copyFile));
elements.downloadBase64?.addEventListener('click', () => {
	const value = elements.fileBase64?.value ?? '';
	if (value) downloadBlob(value, 'text/plain;charset=utf-8', `${selectedFile?.name || 'ybs-file'}.base64.txt`);
});
elements.downloadRestored?.addEventListener('click', () => {
	if (restoredFile) downloadBlob(restoredFile.bytes, restoredFile.mimeType, restoredFile.name);
});
elements.clearFile?.addEventListener('click', () => {
	selectedFile = null;
	restoredFile = null;
	if (elements.fileInput) elements.fileInput.value = '';
	if (elements.fileBase64) elements.fileBase64.value = '';
	elements.fileDetails?.classList.add('hidden');
	updateFileActions();
	setStatus('neutral', 'File workspace cleared.');
});

setMode('text');
updateTextActions();
updateFileActions();
setStatus('neutral', 'Choose text or file mode to begin.');

window.addEventListener('beforeunload', clearImagePreview);
