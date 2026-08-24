import assert from 'node:assert/strict';
import test from 'node:test';
import { detectApiSpecification, filterEndpoints, HTTP_METHODS, normalizeApiSpecification, resolveLocalRef } from '../src/utils/openapi.ts';

const base = (version: '3.0.3'|'3.1.0' = '3.0.3') => ({ openapi: version, info: { title: 'Users', version: '1.2.0' }, servers: [{ url: 'https://api.test', description: 'Production' }], paths: {} as Record<string, unknown>, components: { schemas: {}, securitySchemes: {} } });

test('detects OpenAPI 3.0, 3.1 and Swagger 2 but not ordinary paths', () => {
	assert.deepEqual(detectApiSpecification(base()).type, 'openapi');
	assert.equal(detectApiSpecification(base('3.1.0')).version, '3.1.0');
	assert.equal(detectApiSpecification({ swagger: '2.0', info: {}, paths: {} }).type, 'swagger');
	assert.equal(detectApiSpecification({ name: 'config' }).isApiSpec, false);
	assert.equal(detectApiSpecification({ paths: { cache: '/tmp' } }).isApiSpec, false);
});

test('extracts every supported method across multiple paths', () => {
	const doc = base();
	doc.paths['/all'] = Object.fromEntries(HTTP_METHODS.map((method) => [method.toLowerCase(), { responses: { 200: { description: 'ok' } } }]));
	doc.paths['/second'] = { get: { responses: {} }, post: { responses: {} } };
	const api = normalizeApiSpecification(doc)!;
	assert.equal(api.endpoints.length, 10);
	assert.deepEqual(new Set(api.endpoints.map((item) => item.method)), new Set(HTTP_METHODS));
	assert.equal(api.pathCount, 2);
});

test('normalizes metadata, servers, tags, responses and schemas', () => {
	const doc = base();
	doc.paths['/users/{id}'] = { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }, { name: 'q', in: 'query', schema: { type: 'string' } }], get: { tags: ['Users'], summary: 'Get user', operationId: 'getUser', parameters: [{ name: 'q', in: 'query', required: true, schema: { type: 'integer' } }, { name: 'X-Key', in: 'header', schema: { type: 'string' } }], responses: { 200: { description: 'ok' }, default: { description: 'error' } } } };
	doc.components.schemas = { User: { type: 'object', required: ['id'], properties: { id: { type: 'string' }, friend: { $ref: '#/components/schemas/User' } } } };
	const api = normalizeApiSpecification(doc)!; const endpoint = api.endpoints[0];
	assert.equal(api.title, 'Users'); assert.equal(api.apiVersion, '1.2.0'); assert.equal(api.specVersion, '3.0.3'); assert.equal(api.servers[0].url, 'https://api.test');
	assert.deepEqual(endpoint.parameters.map((p) => [p.name, p.location, p.required, p.type]), [['id','path',true,'string'],['q','query',true,'integer'],['X-Key','header',false,'string']]);
	assert.deepEqual(endpoint.responses.map((r) => r.status), ['200','default']); assert.deepEqual(api.schemas[0].required, ['id']); assert.equal(api.schemas[0].properties[1].type, 'User');
});

test('normalizes JSON and multipart OpenAPI request bodies', () => {
	const doc = base(); doc.paths['/upload'] = { post: { requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } }, 'multipart/form-data': { schema: { type: 'object' } } } }, responses: {} } };
	const body = normalizeApiSpecification(doc)!.endpoints[0].requestBody!;
	assert.equal(body.required, true); assert.deepEqual(body.mediaTypes.map((item) => item.mediaType), ['application/json','multipart/form-data']);
});

test('normalizes Swagger base URLs, definitions, body and form parameters', () => {
	const doc = { swagger: '2.0', info: { title: 'Legacy', version: '2' }, schemes: ['https','http'], host: 'legacy.test', basePath: '/v1', definitions: { Item: { type: 'object', required: ['id'], properties: { id: { type: 'integer' } } } }, securityDefinitions: { Key: { type: 'apiKey', in: 'header', name: 'X-Key' }, OAuth: { type: 'oauth2' } }, paths: { '/items': { post: { parameters: [{ name: 'body', in: 'body', required: true, schema: { $ref: '#/definitions/Item' } }], responses: {} } }, '/form': { post: { parameters: [{ name: 'file', in: 'formData', required: true, type: 'file' }], responses: {} } } } };
	const api = normalizeApiSpecification(doc)!;
	assert.deepEqual(api.servers.map((s) => s.url), ['https://legacy.test/v1','http://legacy.test/v1']); assert.equal(api.schemas[0].properties[0].required, true); assert.equal(api.endpoints[0].requestBody?.mediaTypes[0].mediaType, 'application/json'); assert.equal(api.endpoints[1].requestBody?.mediaTypes[0].mediaType, 'multipart/form-data'); assert.deepEqual(api.securitySchemes.map((s) => s.label), ['API Key','OAuth 2.0']);
});

test('local references resolve safely and external references remain inert', () => {
	const root = { components: { schemas: { A: { $ref: '#/components/schemas/B' }, B: { $ref: '#/components/schemas/A' } } } };
	assert.deepEqual(resolveLocalRef({ value: { type: 'string' } }, '#/value'), { type: 'string' });
	assert.deepEqual(resolveLocalRef(root, '#/components/schemas/A'), { circularReference: '#/components/schemas/A' });
	assert.deepEqual(resolveLocalRef(root, 'https://example.com/schema.yaml'), { externalReference: 'https://example.com/schema.yaml' });
});

test('searches path, method, summary, operationId and tag and combines filters', () => {
	const doc = base(); doc.paths = { '/users': { get: { summary: 'List people', operationId: 'listUsers', tags: ['Accounts'], responses: {} }, post: { summary: 'Create', tags: ['Accounts'], responses: {} } }, '/orders': { patch: { responses: {} } } };
	const endpoints = normalizeApiSpecification(doc)!.endpoints;
	for (const query of ['/users','GET','people','listUsers','Accounts']) assert.equal(filterEndpoints(endpoints, query).length >= 1, true);
	assert.equal(filterEndpoints(endpoints, 'users', 'POST').length, 1); assert.equal(filterEndpoints(endpoints, 'orders', 'GET').length, 0);
});

test('normalizes bearer, API key and OAuth security schemes', () => {
	const doc = base(); doc.components.securitySchemes = { Bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, Key: { type: 'apiKey', in: 'header', name: 'X-Key' }, OAuth: { type: 'oauth2' } };
	assert.deepEqual(normalizeApiSpecification(doc)!.securitySchemes.map((item) => item.label), ['BEARER JWT','API Key','OAuth 2.0']);
});

test('normalizes a large specification without expanding details', () => {
	const doc = base(); for (let index=0; index<100; index++) doc.paths[`/items/${index}`] = { get: { responses: {} }, post: { responses: {} } };
	const endpoints = normalizeApiSpecification(doc)!.endpoints; assert.equal(endpoints.length, 200); assert.equal(filterEndpoints(endpoints, '/items/99').length, 2);
});
