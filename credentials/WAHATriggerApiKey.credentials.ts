import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class WAHATriggerApiKey implements ICredentialType {
	name = 'wahaTriggerApiKey';
	displayName = 'WAHA Trigger API Key';
	documentationUrl = 'https://waha.devlike.pro/docs/integrations/n8n';
	icon = { light: 'file:../icons/waha.svg', dark: 'file:../icons/waha.svg' } as const;
	properties: INodeProperties[] = [
		{
			displayName: 'Header Name',
			name: 'headerName',
			type: 'string',
			default: 'Authorization',
			description: 'The name of the header to check for authentication (e.g. "Authorization" or "X-Api-Key")',
		},
		{
			displayName: 'API Key / Secret',
			name: 'apiKey',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			description: 'The value that must match the header in the incoming request',
		},
	];
}