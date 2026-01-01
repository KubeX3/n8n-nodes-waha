// @ts-nocheck
// @ts-ignore
import SwaggerParser from "@apidevtools/swagger-parser";
import * as path from "path";
import * as fs from 'fs';

// Store the parsed document here after initialization
let parsedApiDoc: any = null;
const OPENAPI_URL = "https://waha.devlike.pro/swagger/openapi.json";
const FILE_PATH = path.resolve("./nodes-prebuild/openapi.json");

// Generic wrapper type. 
// Use this to cast your return value: const x: OpenApiData<string> = ...
type OpenApiData<T = any> = T;

// Webhook event interface
interface WebhookEvent {
  name: string;
  value: string;
}

/**
 * Loads and dereferences the OpenAPI document.
 * Downloads the file first if it does not exist locally.
 * MUST be called before extracting data.
 */
async function loadOpenApiDoc(): Promise<void> {
  try {
    // Check if file exists, download if missing
    if (!fs.existsSync(FILE_PATH)) {
      console.log(`⬇️ File not found at ${FILE_PATH}`);
      console.log(`⬇️ Downloading from ${OPENAPI_URL}...`);
      
      const response = await fetch(OPENAPI_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to download file: ${response.statusText}`);
      }

      const fileContent = await response.text();

      // Ensure the directory exists before writing!
      const directory = path.dirname(FILE_PATH);
      if (!fs.existsSync(directory)) {
        console.log(`📁 Creating directory: ${directory}`);
        fs.mkdirSync(directory, { recursive: true });
      }

      fs.writeFileSync(FILE_PATH, fileContent);
      console.log("✅ OpenAPI document downloaded and saved successfully.");
    }

    // Use .dereference() to load and resolve refs
    parsedApiDoc = await SwaggerParser.dereference(FILE_PATH);
    console.log("✅ OpenAPI Document loaded and dereferenced successfully.");

  } catch (err) {
    console.error("❌ Failed to load/parse OpenAPI document:", err);
    throw err;
  }
}

/**
 * Extracts data based on a dot-notation path.
 * @param dataPath - e.g. "info.title" or "paths./users.get"
 * @returns The data cast to type T
 * @throws Error if data does not exist or document is not loaded
 */
function getOpenApiData<T = any>(dataPath: string): OpenApiData<T> {
  if (!parsedApiDoc) {
    throw new Error("OpenAPI document not loaded. Call 'loadOpenApiDoc()' first.");
  }

  if (!dataPath) {
    throw new Error("Data path cannot be empty.");
  }

  const keys = dataPath.split('.');
  let current = parsedApiDoc;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];

    // Strict check: Ensure key exists in the current object
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      const failedPath = keys.slice(0, i + 1).join('.');
      throw new Error(`❌ Data extraction failed. Path '${failedPath}' does not exist in the schema.`);
    }
  }

  return current as T;
}

/**
 * Saves any provided data to a file.
 * Automatically creates the directory if it doesn't exist.
 * @param pathToSave - The folder path (e.g., "./dist")
 * @param saveFileName - The file name (e.g., "output.json")
 * @param data - The data to save (Objects/Arrays are automatically stringified)
 */
function saveDataToFile(
  pathToSave: string, 
  saveFileName: string, data: any
): void {
    // Resolve the full directory path
    const fullDirPath = path.resolve(pathToSave);

    // Ensure the directory exists (create it recursively if needed)
    if (!fs.existsSync(fullDirPath)) {
      fs.mkdirSync(fullDirPath, { recursive: true });
    }

    // Construct the full file path
    const fullFilePath = path.join(fullDirPath, saveFileName);

    // Format the content: JSON stringify objects, otherwise convert to string
    const content = typeof data === 'object' 
      ? JSON.stringify(data, null, 2) 
      : String(data);

    // Write to file
    fs.writeFileSync(fullFilePath, content, 'utf-8');
    console.log(`✅ Data saved to: ${fullFilePath}`);
}

// Extracts webhook names and status using the getOpenApiData helper
function extractWebhookEvents(
  forTrigger: boolean,
  deprecatedStatus: boolean = false, 
  getAll: boolean = false,
  withFormat: boolean = true,
): WebhookEvent[] {
  // Static options
  const staticOptionsForTrigger = [
    { name: 'Any / All Events', value: '*', deprecated: false },
    { name: 'Self', value: 'self', deprecated: false },
    { name: 'Message Waiting', value: 'message_waiting', deprecated: false }
  ];
  const staticOptionsForBody = [
    { name: 'Message Waiting', value: 'message.waiting', deprecated: false }
  ];
  const webhooks = getOpenApiData<any>("webhooks");

  // Transform the object keys into the array format
  const results = Object.entries(webhooks).map(([eventName, details]: [string, any]) => { 
    // "group.v2.participants" -> ["group", "v2", "participants"] -> "Group V2 Participants"
    const readableName = eventName
      .split('.')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1)) 
      .join(' ');

    // Replace ALL dots with underscores
    // "group.v2.participants" -> "group_v2_participants"
    const valueWithUnderscores = withFormat ? eventName.replace(/\./g, '_') : eventName;
    
    return {
      name: readableName,
      value: valueWithUnderscores ?? eventName,
      deprecated: details.post?.deprecated ?? false
    };
  });

  // First determine the base list (Filtered vs All)
  // If getAll is true, ignore deprecatedStatus. 
  // If getAll is false, keep only items that match the deprecatedStatus.
  let filteredList = getAll 
    ? results 
    : results.filter(w => w.deprecated === deprecatedStatus);

  // Prepend static options if needed
  filteredList = forTrigger 
  ? [...staticOptionsForTrigger, ...filteredList] 
  : [...staticOptionsForBody, ...filteredList];
  
  return filteredList.map(({ name, value }) => ({ name, value }));
}

// Get info
function getInfo() {
  const info = getOpenApiData("info");
  return {
    version: info.version,
  }
}

// --------------------------------------------------------------------------------------
(async () => {
  try {
    // Initialize first
    await loadOpenApiDoc();

    // Get webhook events & save
    const webhookEventsForTrigger: WebhookEvent[] = extractWebhookEvents(true);
    saveDataToFile('./nodes/KubeX3WAHA/waha-trigger', 'webhook-events.json', webhookEventsForTrigger);

    // Get info
    const info = getInfo();
    saveDataToFile('./nodes/KubeX3WAHA', `info.json`, info);

  } catch (error: any) {
    console.error(`Runtime Error: ${error.message}`);
  }
})();