
import { WAHATrigger } from './WAHATrigger.node';
import {
	IWebhookFunctions,
} from 'n8n-workflow';
import { isbot } from 'isbot';
import {
	isDomainWhitelisted,
	isIpWhitelisted,
	validateWahaWebhookAuth,
} from './waha-trigger/utils';
import { WebhookAuthorizationError } from './waha-trigger/error';

// Mocking dependencies
jest.mock('isbot');
jest.mock('./waha-trigger/utils');
jest.mock('./waha-trigger/webhook-events.json', () => ({
	default: [
		{ name: 'Message', value: 'message' },
		{ name: 'Session Status', value: 'session.status' },
	],
}), { virtual: true });

describe('WAHATrigger', () => {
	let wahaTrigger: WAHATrigger;
	let mockWebhookFunctions: Partial<IWebhookFunctions>;
	let mockReq: any;
	let mockRes: any;

	beforeEach(() => {
		wahaTrigger = new WAHATrigger();

		mockReq = {
			headers: {},
			ips: [],
			ip: '127.0.0.1',
		};

		mockRes = {
			writeHead: jest.fn(),
			end: jest.fn(),
		};

		mockWebhookFunctions = {
			getRequestObject: jest.fn().mockReturnValue(mockReq),
			getResponseObject: jest.fn().mockReturnValue(mockRes),
			getBodyData: jest.fn().mockReturnValue({}),
			getNodeParameter: jest.fn(),
			helpers: {
				returnJsonArray: jest.fn((data) => data as any),
			} as any,
		};

		// Reset mocks
		(isbot as unknown as jest.Mock).mockReturnValue(false);
		(isDomainWhitelisted as jest.Mock).mockReturnValue(true);
		(isIpWhitelisted as jest.Mock).mockReturnValue(true);
		(validateWahaWebhookAuth as jest.Mock).mockResolvedValue(undefined);
	});

	describe('webhook', () => {
		it('should return 403 if domain is not whitelisted', async () => {
			(isDomainWhitelisted as jest.Mock).mockReturnValue(false);
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return { domainWhitelist: 'example.com' };
				if (param === 'events') return ['*'];
				return {};
			});

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(mockRes.writeHead).toHaveBeenCalledWith(403);
			expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('Domain is not whitelisted'));
			expect(result).toEqual({ noWebhookResponse: true });
		});

		it('should return 403 if IP is not whitelisted', async () => {
			(isIpWhitelisted as jest.Mock).mockReturnValue(false);
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return { ipWhitelist: '1.2.3.4' };
				if (param === 'events') return ['*'];
				return {};
			});

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(mockRes.writeHead).toHaveBeenCalledWith(403);
			expect(mockRes.end).toHaveBeenCalledWith(expect.stringContaining('IP is not whitelisted'));
			expect(result).toEqual({ noWebhookResponse: true });
		});

		it('should return 403 if it is a bot and ignoreBots is true', async () => {
			(isbot as unknown as jest.Mock).mockReturnValue(true);
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return { ignoreBots: true };
				if (param === 'events') return ['*'];
				return {};
			});
			mockReq.headers['user-agent'] = 'Googlebot';

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(mockRes.writeHead).toHaveBeenCalledWith(403, { 'WWW-Authenticate': 'Basic realm="Webhook"' });
			expect(mockRes.end).toHaveBeenCalledWith('Authorization data is wrong!');
			expect(result).toEqual({ noWebhookResponse: true });
		});

		it('should validate authentication', async () => {
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['*'];
				return {};
			});

			await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(validateWahaWebhookAuth).toHaveBeenCalledWith(mockWebhookFunctions, 'authentication');
		});

		it('should return 403 on authentication failure', async () => {
			(validateWahaWebhookAuth as jest.Mock).mockRejectedValue(new WebhookAuthorizationError(403, 'Auth Failed'));
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['*'];
				return {};
			});

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(mockRes.writeHead).toHaveBeenCalledWith(403, expect.anything());
			expect(mockRes.end).toHaveBeenCalledWith('Auth Failed');
			expect(result).toEqual({ noWebhookResponse: true });
		});

		it('should return noWebhookResponse if no event in body', async () => {
			(mockWebhookFunctions.getBodyData as jest.Mock).mockReturnValue({});
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['*'];
				return {};
			});

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(result).toEqual({ noWebhookResponse: true });
		});

		it('should filter events correctly (exact match)', async () => {
			(mockWebhookFunctions.getBodyData as jest.Mock).mockReturnValue({ event: 'message' });
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['message', 'session.status'];
				return {};
			});
			(mockWebhookFunctions.helpers!.returnJsonArray as jest.Mock).mockReturnValue([{ json: { event: 'message' } }]);

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(result.workflowData).toBeDefined();
			expect(result.workflowData![0]).toHaveLength(1);
			expect(result.workflowData![1]).toHaveLength(0);
		});

		it('should handle dot replacement in event matching', async () => {
			(mockWebhookFunctions.getBodyData as jest.Mock).mockReturnValue({ event: 'session.status' });
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['message', 'session_status'];
				return {};
			});
			(mockWebhookFunctions.helpers!.returnJsonArray as jest.Mock).mockReturnValue([{ json: { event: 'session.status' } }]);

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(result.workflowData).toBeDefined();
			expect(result.workflowData![0]).toHaveLength(0);
			expect(result.workflowData![1]).toHaveLength(1);
		});

		it('should return Any Event (*) if selected', async () => {
			(mockWebhookFunctions.getBodyData as jest.Mock).mockReturnValue({ event: 'message' });
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['*'];
				return {};
			});
			(mockWebhookFunctions.helpers!.returnJsonArray as jest.Mock).mockReturnValue([{ json: { event: 'message' } }]);

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(result.workflowData).toBeDefined();
			expect(result.workflowData![0]).toHaveLength(1);
		});

		it('should ignore event if not selected', async () => {
			(mockWebhookFunctions.getBodyData as jest.Mock).mockReturnValue({ event: 'other_event' });
			(mockWebhookFunctions.getNodeParameter as jest.Mock).mockImplementation((param) => {
				if (param === 'options') return {};
				if (param === 'events') return ['message'];
				return {};
			});

			const result = await wahaTrigger.webhook.call(mockWebhookFunctions as IWebhookFunctions);

			expect(result).toEqual({ noWebhookResponse: true });
		});
	});
});
