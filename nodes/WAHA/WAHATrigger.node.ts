import {
	IWebhookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookResponseData,
	INodeParameters,
	INodeProperties,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
} from 'n8n-workflow';
import { isbot } from 'isbot';
import { 
	authenticationProperty,
	credentialsProperty,
	defaultWAHATriggerDescription,
	optionsProperty,
	responseCodeOption,
	responseModeProperty
} from './waha-trigger/description';
import { 
	isDomainWhitelisted, 
	isIpWhitelisted, 
	validateWahaWebhookAuth 
} from './waha-trigger/utils';
import { WebhookAuthorizationError } from './waha-trigger/error';
// @ts-ignore
import info from './info.json';

interface WAHAResponseBody {
    event?: string;
    payload?: {
        fromMe?: boolean;
        // Allow other properties inside payload
        [key: string]: any;
    };
    // Allow other properties in the root body
    [key: string]: any;
}

interface WebhookEvent {
  name: string;
  value: string;
}

const AUTH_PROPERTY_NAME = 'authentication';

const configuredOutputs = (parameters: INodeParameters) => {
	const events = parameters.events as string[];

	if (!events || events.length === 0) {
		return [
			{ type: 'main', displayName: 'No Events' },
		];
	}

	// If * is selected — single output
	if (events.includes('*')) {
		return [
			{ type: 'main', displayName: 'Any Event' }
		];
	}

	// Otherwise one output per event
	return events.map((e) => ({
		type: 'main',
		displayName: e
			.split("_")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(" "),
	}));
};

export class WAHATrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'WAHA Trigger',
		name: 'WAHATrigger',
		icon: 'file:../../icons/waha.svg',
		group: ['trigger'],
		version: 1,
		description: 'Starts the workflow when WAHA sends an event',
		defaults: {
			name: 'WAHA Trigger',
		},
		inputs: [],
		outputs: `={{(${configuredOutputs})($parameter)}}`,
		supportsCORS: true,
		credentials: credentialsProperty(AUTH_PROPERTY_NAME),
		// ---------------------------------------------------------
		// Define the Webhook configuration
		// ---------------------------------------------------------
		webhooks: [defaultWAHATriggerDescription],
		properties: [
			// ---------------------------------------------------------
			// WAHA Trigger settings.
			// ---------------------------------------------------------
			{
				displayName: `Built on API version <b>${info.version}</b>`,
				name: 'generalNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName:
					`Remember to configure WAHA instance (session or server) to send events to <b>Webhook URL</b> link above☝️.<br><br>
					Check <a href="https://waha.devlike.pro/docs/integrations/n8n/#waha-trigger" target="_blank"><b>Docs</b></a> to see how to configure the webhook URL in your WAHA instance.`,
				name: 'setupNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Webhook Path',
				name: 'path',
				type: 'string',
				// default: `waha-${this.random_uuid}`,
				default: `change-this-path`,
				typeOptions: {
					evaluated: true,
				},
				placeholder: 'webhook path',
				required: true,
				description: "The HTTP path WAHA will POST events to. Dynamic values may be used (e.g. :ID). n8n will use the path exactly as written.",
			},
			authenticationProperty(AUTH_PROPERTY_NAME),
			responseModeProperty,

			// ---------------------------------------------------------
			// Event Filters (same as Switch).
			// ---------------------------------------------------------
			{
				displayName: 'Events to Listen',
				name: 'events',
				type: 'multiOptions',
				default: ['*'],
				required: true,
				description: 'Select which WAHA events will trigger this workflow',
				typeOptions: {
                    loadOptionsMethod: 'loadWebhookEvents',
                },
			},

			// ---------------------------------------------------------
			// Options for Bots, IP whitelisting etc.
			// ---------------------------------------------------------
			{
				...optionsProperty,
				options: [...(optionsProperty.options as INodeProperties[]), responseCodeOption].sort(
					(a, b) => {
						const nameA = a.displayName.toUpperCase();
						const nameB = b.displayName.toUpperCase();
						if (nameA < nameB) return -1;
						if (nameA > nameB) return 1;
						return 0;
					},
				),
			},
		],
	};

	methods = {
		loadOptions: {
			async loadWebhookEvents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				// Import returns a Module: { default: [Array], ... }
				const tagsModule = await import('./waha-trigger/webhook-events.json'); 
				
				// Access the .default property to get array
				const tagsArray: Array<WebhookEvent> = tagsModule.default;

				// Safety check to ensure it is actually an array
				if (!Array.isArray(tagsArray)) {
					throw new Error('tags.json is not an array!');
				}
				
				return tagsArray;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		// ---------------------------------------------------------------
		// Standard Setup
		// ---------------------------------------------------------------
		// Get the Request
		const req = this.getRequestObject();
		const res = this.getResponseObject();
		const bodyData = this.getBodyData() as unknown as WAHAResponseBody;

		// Get User Settings
		const events = this.getNodeParameter('events', []) as string[];
		const options = this.getNodeParameter('options', {}) as {
			ignoreBots: boolean;
			ipWhitelist?: string;
			domainWhitelist?: string;
		};

		// Domains whitelisting
		const host = req.headers['host'] as string | undefined;
		const origin = req.headers['origin'] as string | undefined;

		// Combine headers to an array for safety
		const domainsToCheck = [host, origin].filter(Boolean) as string[];

		if (!isDomainWhitelisted(options.domainWhitelist, domainsToCheck, host)) {
			res.writeHead(403);
			res.end('Domain is not whitelisted to access the webhook!');
			return { noWebhookResponse: true };
		}

		// IP whitelisting
		if (!isIpWhitelisted(options.ipWhitelist, req.ips, req.ip)) {
			res.writeHead(403);
			res.end('IP is not whitelisted to access the webhook!');
			return { noWebhookResponse: true };
		}

		try {
			// Bot checking
			if (options.ignoreBots && isbot(req.headers['user-agent']))
				throw new WebhookAuthorizationError(403);
			// Auth validation
			await validateWahaWebhookAuth(this, AUTH_PROPERTY_NAME);

		} catch (error) {
			if (error instanceof WebhookAuthorizationError) {
				res.writeHead(error.responseCode, { 'WWW-Authenticate': 'Basic realm="Webhook"' });
				res.end(error.message);
				return { noWebhookResponse: true };
			}
			throw error;
		}

		// ---------------------------------------------------------------
		// Filtering Logic
		// ---------------------------------------------------------------
		// Parse WAHA Event from Body and self inputs
		const incomingEvent = bodyData.event as string;

		// Filtering Logic
		if (!incomingEvent) {
			return { noWebhookResponse: true };
		}

		const FormattedIncomingEvent = incomingEvent.replace(/\./g, '_');
		const selfEvent = bodyData?.payload?.fromMe ?? false;

		// ---------------------------------------------------------------
		// Prepare Output
		// ---------------------------------------------------------------
		// Check if user selected '*' or event matches
		if (events.includes('*') || events.includes(FormattedIncomingEvent)) {

			const useAny = events.includes('*');

			// If "*" exists → one output, else use event list
			const outputList = useAny ? ['*'] : events;

			// Match the correct index
			const outputIndex = useAny ? 0 : selfEvent ? events.indexOf('self') : events.indexOf(FormattedIncomingEvent);

			// Correctly typed outputs array
			const outputs: INodeExecutionData[][] = Array(outputList.length)
				.fill(0)
				.map(() => []);

			// Push item into matching output slot
			outputs[outputIndex] = this.helpers.returnJsonArray({
				...bodyData,
			});

			// ---------------------------------------------------------------
			// RETURN WITH CORRECT RESPONSE MODE
			// ---------------------------------------------------------------
			return { workflowData: outputs };
		}

		// Event did not match selection - Ignore
		return {
			noWebhookResponse: true,
		};
	}
}