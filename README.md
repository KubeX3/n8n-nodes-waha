# n8n-nodes-waha

This is an n8n community node. It lets you use [WAHA (WhatsApp HTTP API)](https://waha.devlike.pro/) in your n8n workflows.

<p align="center">
  <img src="https://github.com/KubeX3/n8n-nodes-waha/blob/main/README-imgs/WAHA%2Bn8n.png?raw=true" width='300'/>
</p>

**WAHA** (WhatsApp HTTP API) is a robust solution that provides a REST API for WhatsApp, allowing you to send and receive messages, manage sessions, and handle media programmatically.

- [Github Repository](https://github.com/KubeX3/n8n-nodes-waha)

- [NPM Registry](https://www.npmjs.com/package/@kubex3/n8n-nodes-waha)

---

[Installation](#installation)  
[Operations](#operations)  
[Credentials](#credentials)  
[Compatibility](#compatibility)  
[Resources](#resources)  
[Version history](#version-history)
[Screenshots](#screenshots)

## Installation

Go to your `n8n Settings` => `Community nodes` and install:
```txt
@kubex3/n8n-nodes-waha
```

## Operations

### Triggers (Webhook)
This node acts as a webhook receiver for your WAHA instance. It allows you to listen for real-time events from WhatsApp.

**Key Features:**
* **Event Filtering:** Select specific events to listen for (e.g., `message`, `session.status`, etc.).
* **Custom Webhook Path:** Define a custom URL path for your webhook endpoint.
* **Response Customization:** Configure how the node responds to the webhook request (Response Mode).
* **Data Ping:** Supports data ping events for connection testing.

### Advanced Options
The node includes robust security and filtering options:
* **Include Self-Messages:** Capture messages sent by your own account. This is perfect for testing your workflows easily without needing a second device or another whatsapp account.
* **Header Authentication:** Enable header-based authentication to secure your webhook.
* **Ignore Bots:** Automatically filter out bot traffic.
* **Allowed Origins (CORS):** Restrict which origins are allowed to access the webhook.
* **Domains Whitelist:** specific domains allowed to interact with the webhook.
* **IP(s) Whitelist:** Restrict access to specific IP addresses for enhanced security.

> **Note:** This release is currently focused on the **Trigger/Webhook** functionality. Standard Action nodes (sending messages) are in development and will be released in a future update.

## Credentials

**Webhook Security (Optional)**
If you have enabled "Header Authentication" in the node options, you will need to configure the matching credentials or headers within your WAHA instance configuration to ensure requests are authorized.

## Compatibility

* **n8n version:** Tested on n8n `v1.0.0` and above.
* **WAHA version:** Compatible with the latest stable release of WAHA (Core/Plus).

## Resources

* [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)
* [WAHA Official Documentation](https://waha.devlike.pro)
* [WAHA GitHub Repository](https://github.com/devlikeapro/waha)

## Version history

* **0.1.0** - Initial release featuring the Webhook Trigger node with advanced security (CORS, IP Whitelist) and custom routing options.

## Screenshots
![alt text](https://github.com/KubeX3/n8n-nodes-waha/blob/main/README-imgs/trigger-ss-1.png?raw=true)
![alt text](https://github.com/KubeX3/n8n-nodes-waha/blob/main/README-imgs/trigger-ss-2.png?raw=true)
![alt text](https://github.com/KubeX3/n8n-nodes-waha/blob/main/README-imgs/trigger-ss-3.png?raw=true)
![alt text](https://github.com/KubeX3/n8n-nodes-waha/blob/main/README-imgs/trigger-credential-ss.png?raw=true)
