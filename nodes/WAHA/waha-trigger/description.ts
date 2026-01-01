import type { 
	INodeProperties, 
	INodeTypeDescription, 
	IWebhookDescription,
} from 'n8n-workflow';
import { getResponseCode, getResponseData } from './utils';

export const defaultWAHATriggerDescription: IWebhookDescription = {
	name: 'default',
    httpMethod: 'POST',
	isFullPath: true,
	responseCode: `={{(${getResponseCode})($parameter)}}`,
	responseMode: '={{$parameter["responseMode"]}}',
	responseData: `={{(${getResponseData})($parameter)}}`,
	responseBinaryPropertyName: '={{$parameter["responseBinaryPropertyName"]}}',
	responseContentType: '={{$parameter["options"]["responseContentType"]}}',
	responsePropertyName: '={{$parameter["options"]["responsePropertyName"]}}',
	responseHeaders: '={{$parameter["options"]["responseHeaders"]}}',
    path: '={{$parameter["path"]}}',
};

export const credentialsProperty = (
    propertyName = 'authentication'
): INodeTypeDescription['credentials'] => [
	{
		name: 'WAHATriggerApiKey',
		required: true,
		displayOptions: {
			show: {
				[propertyName]: ['headerAuth'],
			},
		},
	},
];

export const authenticationProperty = (propertyName = 'authentication'): INodeProperties => ({
    displayName: 'Authentication',
    name: propertyName,
    type: 'options',
    options: [
        {
            name: 'Header Auth',
            value: 'headerAuth',
        },
        {
            name: 'None',
            value: 'none',
        },
    ],
    default: 'none',
    description: 'The way to authenticate',
});

const responseModeOptions = [
	{
		name: 'Immediately',
		value: 'onReceived',
		description: 'As soon as this node executes',
	},
	{
		name: 'When Last Node Finishes',
		value: 'lastNode',
		description: 'Returns data of the last-executed node',
	},
];

export const responseModeProperty: INodeProperties = {
	displayName: 'Respond',
	name: 'responseMode',
	type: 'options',
	options: responseModeOptions,
	default: 'onReceived',
	description: 'When and how to respond to the webhook',
	displayOptions: {
		show: {
			'@version': [1],
		},
	},
};

export const optionsProperty: INodeProperties = {
	displayName: 'Options',
	name: 'options',
	type: 'collection',
	placeholder: 'Add option',
	default: {},
	options: [
		{
			displayName: 'Ignore Bots',
			name: 'ignoreBots',
			type: 'boolean',
			default: false,
			description: 'Whether to ignore requests from bots like link previewers and web crawlers',
		},
		{
			displayName: 'IP(s) Whitelist',
			name: 'ipWhitelist',
			type: 'string',
			placeholder: 'e.g. 127.0.0.1, 192.168.1.10',
			default: '',
			description: 'Comma-separated list of allowed IP addresses. Leave empty to allow all IPs.',
		},
		{
			displayName: 'Domains Whitelist',
			name: 'domainWhitelist',
			type: 'string',
			placeholder: 'e.g. www.example.com, example.com',
			default: '',
			description: 'Comma-separated list of allowed Domains. Leave empty to allow all Domains.',
		},
	],
};

export const responseCodeSelector: INodeProperties = {
	displayName: 'Response Code',
	name: 'responseCode',
	type: 'options',
	options: [
		{ name: '200', value: 200, description: 'OK - Request has succeeded' },
		{ name: '201', value: 201, description: 'Created - Request has been fulfilled' },
		{ name: '204', value: 204, description: 'No Content - Request processed, no content returned' },
		{
			name: '301',
			value: 301,
			description: 'Moved Permanently - Requested resource moved permanently',
		},
		{ name: '302', value: 302, description: 'Found - Requested resource moved temporarily' },
		{ name: '304', value: 304, description: 'Not Modified - Resource has not been modified' },
		{ name: '400', value: 400, description: 'Bad Request - Request could not be understood' },
		{ name: '401', value: 401, description: 'Unauthorized - Request requires user authentication' },
		{
			name: '403',
			value: 403,
			description: 'Forbidden - Server understood, but refuses to fulfill',
		},
		{ name: '404', value: 404, description: 'Not Found - Server has not found a match' },
		{
			name: 'Custom Code',
			value: 'customCode',
			description: 'Write any HTTP code',
		},
	],
	default: 200,
	description: 'The HTTP response code to return',
};

export const responseCodeOption: INodeProperties = {
	displayName: 'Response Code',
	name: 'responseCode',
	placeholder: 'Add Response Code',
	type: 'fixedCollection',
	default: {
		values: {
			responseCode: 200,
		},
	},
	options: [
		{
			name: 'values',
			displayName: 'Values',
			values: [
				responseCodeSelector,
				{
					displayName: 'Code',
					name: 'customCode',
					type: 'number',
					default: 200,
					placeholder: 'e.g. 400',
					typeOptions: {
						minValue: 100,
					},
					displayOptions: {
						show: {
							responseCode: ['customCode'],
						},
					},
				},
			],
		},
	],
	displayOptions: {
		hide: {
			'/responseMode': ['responseNode'],
		},
	},
};
