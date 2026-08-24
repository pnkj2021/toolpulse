export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD', 'TRACE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
type Dict = Record<string, unknown>;

export interface ApiDetection { isApiSpec: boolean; type?: 'openapi' | 'swagger'; version?: string; complete?: boolean }
export interface ApiParameter { name: string; location: string; required: boolean; description?: string; type?: string; example?: unknown; schema?: unknown }
export interface ApiRequestBody { required: boolean; mediaTypes: Array<{ mediaType: string; schema?: unknown }>; description?: string }
export interface ApiResponse { status: string; description?: string; mediaTypes: string[] }
export interface ApiEndpoint { id: string; method: HttpMethod; path: string; summary?: string; description?: string; operationId?: string; tags: string[]; parameters: ApiParameter[]; requestBody?: ApiRequestBody; responses: ApiResponse[]; security: string[]; serverUrl?: string }
export interface ApiSchema { name: string; description?: string; type?: string; required: string[]; properties: Array<{ name: string; type?: string; required: boolean; description?: string }> }
export interface ApiSecurityScheme { name: string; label: string; detail?: string }
export interface NormalizedApi { detection: ApiDetection; title?: string; description?: string; apiVersion?: string; specVersion: string; servers: Array<{ url: string; description?: string }>; endpoints: ApiEndpoint[]; schemas: ApiSchema[]; securitySchemes: ApiSecurityScheme[]; tagDescriptions: Record<string, string>; pathCount: number }

const object = (value: unknown): Dict | undefined => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Dict : undefined;
const text = (value: unknown): string | undefined => typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;

export function detectApiSpecification(document: unknown): ApiDetection {
	const root = object(document);
	if (!root) return { isApiSpec: false };
	const openapi = text(root.openapi);
	if (openapi && /^3\.(?:0|1)(?:\.|$)/u.test(openapi)) return { isApiSpec: true, type: 'openapi', version: openapi, complete: Boolean(object(root.info) && object(root.paths)) };
	const swagger = text(root.swagger);
	if (swagger === '2.0') return { isApiSpec: true, type: 'swagger', version: swagger, complete: Boolean(object(root.info) && object(root.paths)) };
	return { isApiSpec: false };
}

export function resolveLocalRef(root: unknown, ref: string, maxDepth = 12, visited = new Set<string>()): unknown {
	if (!ref.startsWith('#/')) return { externalReference: ref };
	if (visited.has(ref) || visited.size >= maxDepth) return { circularReference: ref };
	visited.add(ref);
	let value: unknown = root;
	for (const part of ref.slice(2).split('/').map((item) => item.replace(/~1/g, '/').replace(/~0/g, '~'))) value = object(value)?.[part];
	const resolved = object(value);
	if (resolved && typeof resolved.$ref === 'string') return resolveLocalRef(root, resolved.$ref, maxDepth, visited);
	return value;
}

function schemaType(schema: unknown, root: unknown): string | undefined {
	const value = object(schema);
	if (!value) return undefined;
	if (typeof value.$ref === 'string') {
		if (!value.$ref.startsWith('#/')) return `External reference: ${value.$ref}`;
		const resolved = resolveLocalRef(root, value.$ref);
		const name = value.$ref.split('/').at(-1);
		return name || text(object(resolved)?.type) || 'reference';
	}
	if (value.type === 'array') return `array of ${schemaType(value.items, root) ?? 'items'}`;
	return text(value.type) ?? (value.oneOf ? 'oneOf' : value.allOf ? 'allOf' : value.anyOf ? 'anyOf' : undefined);
}

function normalizeParameter(raw: unknown, root: unknown): ApiParameter | undefined {
	let value = object(raw);
	if (!value) return undefined;
	if (typeof value.$ref === 'string') value = object(resolveLocalRef(root, value.$ref)) ?? value;
	const name = text(value.name); const location = text(value.in);
	if (!name || !location) return undefined;
	const schema = value.schema ?? (value.type ? value : undefined);
	return { name, location, required: value.required === true || location === 'path', description: text(value.description), type: schemaType(schema, root), example: value.example ?? object(schema)?.example ?? object(schema)?.default, schema };
}

function mergedParameters(pathItem: Dict, operation: Dict, root: unknown): ApiParameter[] {
	const merged = new Map<string, ApiParameter>();
	for (const raw of [...(Array.isArray(pathItem.parameters) ? pathItem.parameters : []), ...(Array.isArray(operation.parameters) ? operation.parameters : [])]) {
		const parameter = normalizeParameter(raw, root);
		if (parameter) merged.set(`${parameter.location}:${parameter.name}`, parameter);
	}
	return [...merged.values()];
}

function requestBody(operation: Dict, root: unknown, swagger: boolean): ApiRequestBody | undefined {
	if (swagger) {
		const parameters = Array.isArray(operation.parameters) ? operation.parameters.map((item) => object(item)).filter(Boolean) as Dict[] : [];
		const body = parameters.find((item) => item.in === 'body');
		const forms = parameters.filter((item) => item.in === 'formData');
		if (body) return { required: body.required === true, description: text(body.description), mediaTypes: [{ mediaType: 'application/json', schema: body.schema }] };
		if (forms.length) return { required: forms.some((item) => item.required === true), mediaTypes: [{ mediaType: 'multipart/form-data', schema: { type: 'object', properties: Object.fromEntries(forms.map((item) => [String(item.name), { type: item.type }])) } }] };
		return undefined;
	}
	let body = object(operation.requestBody);
	if (body && typeof body.$ref === 'string') body = object(resolveLocalRef(root, body.$ref)) ?? body;
	if (!body) return undefined;
	const content = object(body.content) ?? {};
	return { required: body.required === true, description: text(body.description), mediaTypes: Object.entries(content).map(([mediaType, value]) => ({ mediaType, schema: object(value)?.schema })) };
}

function responses(operation: Dict): ApiResponse[] {
	return Object.entries(object(operation.responses) ?? {}).map(([status, raw]) => {
		const value = object(raw) ?? {};
		return { status, description: text(value.description), mediaTypes: Object.keys(object(value.content) ?? {}) };
	});
}

function servers(root: Dict, swagger: boolean): Array<{ url: string; description?: string }> {
	if (!swagger) return (Array.isArray(root.servers) ? root.servers : []).map((raw) => object(raw)).filter((item): item is Dict => Boolean(item && text(item.url))).map((item) => ({ url: text(item.url)!, description: text(item.description) }));
	const host = text(root.host); const basePath = text(root.basePath) ?? '';
	if (!host) return basePath ? [{ url: basePath }] : [];
	const schemes = Array.isArray(root.schemes) && root.schemes.length ? root.schemes.map(String) : ['https'];
	return schemes.map((scheme) => ({ url: `${scheme}://${host}${basePath}` }));
}

export function normalizeApiSpecification(document: unknown): NormalizedApi | undefined {
	const detection = detectApiSpecification(document); const root = object(document);
	if (!detection.isApiSpec || !root) return undefined;
	const swagger = detection.type === 'swagger'; const info = object(root.info) ?? {}; const paths = object(root.paths) ?? {};
	const endpointList: ApiEndpoint[] = [];
	for (const [path, rawPath] of Object.entries(paths)) {
		const pathItem = object(rawPath); if (!pathItem) continue;
		for (const method of HTTP_METHODS) {
			const operation = object(pathItem[method.toLowerCase()]); if (!operation) continue;
			const tags = Array.isArray(operation.tags) ? operation.tags.map(String) : [];
			const parameters = mergedParameters(pathItem, operation, root);
			endpointList.push({ id: `${method}:${path}`, method, path, summary: text(operation.summary), description: text(operation.description), operationId: text(operation.operationId), tags: tags.length ? tags : ['Other'], parameters, requestBody: requestBody(operation, root, swagger), responses: responses(operation), security: (Array.isArray(operation.security) ? operation.security : Array.isArray(root.security) ? root.security : []).flatMap((item) => Object.keys(object(item) ?? {})), serverUrl: servers(root, swagger)[0]?.url });
		}
	}
	const rawSchemas = object(swagger ? root.definitions : object(root.components)?.schemas) ?? {};
	const schemas: ApiSchema[] = Object.entries(rawSchemas).map(([name, raw]) => {
		let value = object(raw) ?? {}; if (typeof value.$ref === 'string') value = object(resolveLocalRef(root, value.$ref)) ?? value;
		const required = Array.isArray(value.required) ? value.required.map(String) : [];
		return { name, description: text(value.description), type: schemaType(value, root), required, properties: Object.entries(object(value.properties) ?? {}).map(([propertyName, property]) => ({ name: propertyName, type: schemaType(property, root), required: required.includes(propertyName), description: text(object(property)?.description) })) };
	});
	const rawSecurity = object(swagger ? root.securityDefinitions : object(root.components)?.securitySchemes) ?? {};
	const securitySchemes = Object.entries(rawSecurity).map(([name, raw]) => { const value = object(raw) ?? {}; const type = text(value.type) ?? 'Security'; let label = type; let detail: string | undefined; if (type === 'http') { label = `${text(value.scheme)?.toUpperCase() ?? 'HTTP'}${value.bearerFormat ? ` ${value.bearerFormat}` : ''}`; } else if (type === 'apiKey') { label = 'API Key'; detail = `${text(value.in) ?? ''}${value.name ? ` • ${value.name}` : ''}`; } else if (type === 'oauth2') label = 'OAuth 2.0'; return { name, label, detail }; });
	const tagDescriptions = Object.fromEntries((Array.isArray(root.tags) ? root.tags : []).map((raw) => object(raw)).filter((tag): tag is Dict => Boolean(tag && text(tag.name))).map((tag) => [text(tag.name)!, text(tag.description) ?? '']));
	return { detection, title: text(info.title), description: text(info.description), apiVersion: text(info.version), specVersion: detection.version!, servers: servers(root, swagger), endpoints: endpointList, schemas, securitySchemes, tagDescriptions, pathCount: Object.keys(paths).length };
}

export function filterEndpoints(endpoints: ApiEndpoint[], query = '', method: HttpMethod | 'ALL' = 'ALL'): ApiEndpoint[] {
	const needle = query.trim().toLocaleLowerCase();
	return endpoints.filter((endpoint) => (method === 'ALL' || endpoint.method === method) && (!needle || [endpoint.path, endpoint.method, endpoint.summary, endpoint.operationId, ...endpoint.tags].some((value) => value?.toLocaleLowerCase().includes(needle))));
}
