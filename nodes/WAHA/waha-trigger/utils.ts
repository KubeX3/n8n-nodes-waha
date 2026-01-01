import { 
	ICredentialDataDecryptedObject, 
	IDataObject, 
	IWebhookFunctions,
} from "n8n-workflow";
import { WebhookAuthorizationError } from './error';

export type WebhookParameters = {
	httpMethod: string | string[];
	responseMode: string;
	responseData: string;
	responseCode?: number; //typeVersion <= 1.1
	options?: {
		responseData?: string;
		responseCode?: {
			values?: {
				responseCode: number;
				customCode?: number;
			};
		};
		noResponseBody?: boolean;
	};
};

export const getResponseCode = (parameters: WebhookParameters) => {
	if (parameters.responseCode) {
		return parameters.responseCode;
	}
	const responseCodeOptions = parameters.options;
	if (responseCodeOptions?.responseCode?.values) {
		const { responseCode, customCode } = responseCodeOptions.responseCode.values;

		if (customCode) {
			return customCode;
		}

		return responseCode;
	}
	return 200;
};

export const getResponseData = (parameters: WebhookParameters) => {
	const { responseData, responseMode, options } = parameters;
	if (responseData) return responseData;

	if (responseMode === 'onReceived') {
		const data = options?.responseData;
		if (data) return data;
	}

	if (options?.noResponseBody) return 'noData';

	return undefined;
};

// Domains whitelisting
export const isDomainWhitelisted = (
	whitelist: string | string[] | undefined,
	domains: string[],
	domain?: string,
) => {
	if (whitelist === undefined || whitelist === '') {
		return true;
	}

	if (!Array.isArray(whitelist)) {
		whitelist = whitelist.split(',').map((entry) => entry.trim());
	}

	for (const address of whitelist) {
		if (domain?.includes(address)) {
			return true;
		}

		if (domains.some((entry) => entry.includes(address))) {
			return true;
		}
	}

	return false;
};

// Ip whitelisting
export const isIpWhitelisted = (
	whitelist: string | string[] | undefined,
	ips: string[],
	ip?: string,
) => {
	if (whitelist === undefined || whitelist === '') {
		return true;
	}

	if (!Array.isArray(whitelist)) {
		whitelist = whitelist.split(',').map((entry) => entry.trim());
	}

	for (const address of whitelist) {
		if (ip?.includes(address)) {
			return true;
		}

		if (ips.some((entry) => entry.includes(address))) {
			return true;
		}
	}

	return false;
};

// Authentication
export async function validateWahaWebhookAuth(
	ctx: IWebhookFunctions,
	authPropertyName: string,
): Promise<void> {
	const authentication = ctx.getNodeParameter(authPropertyName) as string;

	// If node is configured as "none", skip validation
	if (authentication === 'none') return;

	// Read all incoming headers from request
	const headers = ctx.getHeaderData();

	// --- HEADER AUTH ---------------------------------------------------------
	if (authentication === 'headerAuth') {
		let credentials: ICredentialDataDecryptedObject | undefined;

		try {
			// WAHA custom API key credential type
			credentials = await ctx.getCredentials<ICredentialDataDecryptedObject>('WAHATriggerApiKey');
		} catch {
			throw new WebhookAuthorizationError(
				500,
				'Failed to load WAHA authentication credentials.',
			);
		}

		// Validate credential structure
		if (!credentials?.headerName || !credentials?.apiKey) {
			throw new WebhookAuthorizationError(
				500,
				'WAHA authentication data is missing or invalid.',
			);
		}

		const headerName = (credentials.headerName as string).toLowerCase();
		const expectedValue = credentials.apiKey as string;

		// Make sure header exists
		if (!Object.prototype.hasOwnProperty.call(headers, headerName)) {
			throw new WebhookAuthorizationError(403, 'Missing authentication header.');
		}

		// Compare values
		if ((headers as IDataObject)[headerName] !== expectedValue) {
			throw new WebhookAuthorizationError(403, 'Invalid authentication header value.');
		}
	}
}
