# Custom Tools for ADK

Supported in ADK: Python v0.1.0 | Typescript v0.2.0 | Go v0.1.0 | Java v0.1.0

In an ADK agent workflow, Tools are programming functions with structured input and output that can be called by an ADK Agent to perform actions. ADK Tools function similarly to how you use a [Function Call](https://ai.google.dev/gemini-api/docs/function-calling) with Gemini or other generative AI models. You can perform various actions and programming functions with an ADK Tool, such as:

- Querying databases
- Making API requests: getting weather data, booking systems
- Searching the web
- Executing code snippets
- Retrieving information from documents (RAG)
- Interacting with other software or services

Before building your own Tools for ADK, check out the **ADK Tools list** for pre-built tools you can use with ADK Agents.

---

## What is a Tool?

In the context of ADK, a Tool represents a specific capability provided to an AI agent, enabling it to perform actions and interact with the world beyond its core text generation and reasoning abilities. What distinguishes capable agents from basic language models is often their effective use of tools.

Technically, a tool is typically a modular code component—**like a Python, Java, or TypeScript function**, a class method, or even another specialized agent—designed to execute a distinct, predefined task. These tasks often involve interacting with external systems or data.

### Key Characteristics

**Action-Oriented:** Tools perform specific actions for an agent, such as searching for information, calling an API, or performing calculations.

**Extends Agent capabilities:** They empower agents to access real-time information, affect external systems, and overcome the knowledge limitations inherent in their training data.

**Execute predefined logic:** Crucially, tools execute specific, developer-defined logic. They do not possess their own independent reasoning capabilities like the agent's core Large Language Model (LLM). The LLM reasons about which tool to use, when, and with what inputs, but the tool itself just executes its designated function.

---

## How Agents Use Tools

Agents leverage tools dynamically through mechanisms often involving function calling. The process generally follows these steps:

1. **Reasoning:** The agent's LLM analyzes its system instruction, conversation history, and user request.
2. **Selection:** Based on the analysis, the LLM decides on which tool, if any, to execute, based on the tools available to the agent and the docstrings that describes each tool.
3. **Invocation:** The LLM generates the required arguments (inputs) for the selected tool and triggers its execution.
4. **Observation:** The agent receives the output (result) returned by the tool.
5. **Finalization:** The agent incorporates the tool's output into its ongoing reasoning process to formulate the next response, decide the subsequent step, or determine if the goal has been achieved.

Think of the tools as a specialized toolkit that the agent's intelligent core (the LLM) can access and utilize as needed to accomplish complex tasks.

---

## Tool Types in ADK

ADK offers flexibility by supporting several types of tools:

1. **Function Tools:** Tools created by you, tailored to your specific application's needs.
   - **Functions/Methods:** Define standard synchronous functions or methods in your code.
   - **Agents-as-Tools:** Use another, potentially specialized, agent as a tool for a parent agent.
   - **Long Running Function Tools:** Support for tools that perform asynchronous operations or take significant time to complete.
2. **Built-in Tools:** Ready-to-use tools provided by the framework for common tasks. Examples: Google Search, Code Execution, Retrieval-Augmented Generation (RAG).
3. **Third-Party Tools:** Integrate tools seamlessly from popular external libraries.

---

## Referencing Tools in Agent Instructions

Within an agent's instructions, you can directly reference a tool by using its **function name.** If the tool's **function name** and **docstring** are sufficiently descriptive, your instructions can primarily focus on **when the LLM should utilize the tool**.

It is **crucial to clearly instruct the agent on how to handle different return values** that a tool might produce. ADK supports the sequential use of tools, where the output of one tool can serve as the input for another.

### Example

```typescript
import { LlmAgent, FunctionTool, InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk';
import { z } from "zod";
import { Content, createUserContent } from "@google/genai";

/**
 * Retrieves the current weather report for a specified city.
 */
function getWeatherReport(params: { city: string }): Record<string, any> {
    if (params.city.toLowerCase().includes("london")) {
        return {
            "status": "success",
            "report": "The current weather in London is cloudy with a " +
                "temperature of 18 degrees Celsius and a chance of rain.",
        };
    }
    if (params.city.toLowerCase().includes("paris")) {
        return {
            "status": "success",
            "report": "The weather in Paris is sunny with a temperature of 25 " +
                "degrees Celsius.",
        };
    }
    return {
        "status": "error",
        "error_message": `Weather information for '${params.city}' is not available.`,
    };
}

/**
 * Analyzes the sentiment of a given text.
 */
function analyzeSentiment(params: { text: string }): Record<string, any> {
    if (params.text.includes("cloudy") || params.text.includes("rain")) {
        return { "status": "success", "sentiment": "negative" };
    }
    if (params.text.includes("sunny")) {
        return { "status": "success", "sentiment": "positive" };
    }
    return { "status": "success", "sentiment": "neutral" };
}

const weatherTool = new FunctionTool({
    name: "get_weather_report",
    description: "Retrieves the current weather report for a specified city.",
    parameters: z.object({
        city: z.string().describe("The city to get the weather for."),
    }),
    execute: getWeatherReport,
});

const sentimentTool = new FunctionTool({
    name: "analyze_sentiment",
    description: "Analyzes the sentiment of a given text.",
    parameters: z.object({
        text: z.string().describe("The text to analyze the sentiment of."),
    }),
    execute: analyzeSentiment,
});

const instruction = `
    You are a helpful assistant that first checks the weather and then analyzes
    its sentiment.

    Follow these steps:
    1. Use the 'get_weather_report' tool to get the weather for the requested city.
    2. If the 'get_weather_report' tool returns an error, inform the user and stop.
    3. If the weather report is available, use the 'analyze_sentiment' tool to
       determine the sentiment of the weather report.
    4. Finally, provide a summary to the user, including the weather report and its sentiment.
    `;

const agent = new LlmAgent({
    name: "weather_sentiment_agent",
    instruction: instruction,
    tools: [weatherTool, sentimentTool],
    model: "gemini-2.5-flash"
});

async function main() {
    const runner = new InMemoryRunner({ agent: agent, appName: "weather_sentiment_app" });

    await runner.sessionService.createSession({
        appName: "weather_sentiment_app",
        userId: "user1",
        sessionId: "session1"
    });

    const newMessage: Content = createUserContent("What is the weather in London?");

    for await (const event of runner.runAsync({
        userId: "user1",
        sessionId: "session1",
        newMessage: newMessage,
    })) {
        if (isFinalResponse(event) && event.content?.parts?.length) {
            const text = stringifyContent(event).trim();
            if (text) {
                console.log(text);
            }
        }
    }
}

main();
```

---

## Tool Context

For more advanced scenarios, ADK allows you to access additional contextual information within your tool function by including the special parameter `tool_context: ToolContext`. By including this in the function signature, ADK will **automatically** provide an **instance of the ToolContext** class when your tool is called during agent execution.

The **ToolContext** provides access to several key pieces of information and control levers:

- `state: State`: Read and modify the current session's state. Changes made here are tracked and persisted.
- `actions: EventActions`: Influence the agent's subsequent actions after the tool runs.
- `function_call_id: str`: The unique identifier assigned by the framework to this specific invocation of the tool.
- `function_call_event_id: str`: The unique identifier of the **event** that triggered the current tool call.
- `auth_response: Any`: Contains the authentication response/credentials if an authentication flow was completed before this tool call.
- Access to Services: Methods to interact with configured services like Artifacts and Memory.

> **Note:** Do not include the `tool_context` parameter in the tool function docstring. Since `ToolContext` is automatically injected by the ADK framework *after* the LLM decides to call the tool function, it is not relevant for the LLM's decision-making.

### State Management

The `tool_context.state` attribute provides direct read and write access to the state associated with the current session. It behaves like a dictionary but ensures that any modifications are tracked as deltas and persisted by the session service.

- **Reading State**: Use `.get()` method (`context.state.get('my_key', default_value)`).
- **Writing State**: Use `.set()` (`context.state.set('new_key', 'new_value')`). These changes are recorded in the state_delta of the resulting event.
- **State Prefixes**:
  - `app:*`: Shared across all users of the application.
  - `user:*`: Specific to the current user across all their sessions.
  - (No prefix): Specific to the current session.
  - `temp:*`: Temporary, not persisted across invocations.

```typescript
import { Context } from '@google/adk';

// Updates a user-specific preference.
export function updateUserThemePreference(
  value: string,
  context: Context
): Record<string, any> {
  const userPrefsKey = "user:preferences";

  // Get current preferences or initialize if none exist
  const preferences = context.state.get(userPrefsKey, {}) as Record<string, any>;
  preferences["theme"] = value;

  // Write the updated dictionary back to the state
  context.state.set(userPrefsKey, preferences);
  console.log(
    `Tool: Updated user preference ${userPrefsKey} to ${JSON.stringify(context.state.get(userPrefsKey))}`
  );

  return {
    status: "success",
    updated_preference: context.state.get(userPrefsKey),
  };
}
```

### Controlling Agent Flow

The `tool_context.actions` attribute holds an **EventActions** object. Modifying attributes on this object allows your tool to influence what the agent or framework does after the tool finishes execution.

- **`skip_summarization: bool`**: (Default: false) If set to `true`, bypasses the LLM call that typically summarizes the tool's output.
- **`transfer_to_agent: str`**: Set this to the name of another agent to transfer control of the conversation to that agent.
- **`escalate: bool`**: (Default: false) Setting this to `true` signals that the current agent cannot handle the request and should pass control up to its parent agent.

#### Example

```typescript
import { LlmAgent, FunctionTool, Context, InMemoryRunner, isFinalResponse, stringifyContent } from '@google/adk';
import { z } from "zod";
import { Content, createUserContent } from "@google/genai";

function checkAndTransfer(
  params: { query: string },
  context?: Context
): Record<string, any> {
  if (!context) {
    throw new Error("Context is required to transfer agents.");
  }
  if (params.query.toLowerCase().includes("urgent")) {
    console.log("Tool: Urgent query detected, transferring to support_agent.");
    context.actions.transferToAgent = "support_agent";
    return { status: "success", message: "Transferring to support agent." };
  }

  console.log("Tool: Query is not urgent, handling normally.");
  return { status: "success", message: "Query will be handled by the main agent." };
}

const transferTool = new FunctionTool({
  name: "check_and_transfer",
  description: "Checks the user's query and transfers to a support agent if urgent.",
  parameters: z.object({
    query: z.string().describe("The user query to analyze."),
  }),
  execute: checkAndTransfer,
});

const supportAgent = new LlmAgent({
  name: "support_agent",
  description: "Handles urgent user requests about accounts.",
  instruction: "You are the support agent. Handle the user's urgent request.",
  model: "gemini-2.5-flash"
});

const mainAgent = new LlmAgent({
  name: "main_agent",
  description: "The main agent that routes non-urgent queries.",
  instruction: "You are the main agent. Use the check_and_transfer tool to analyze the user query. If the query is not urgent, handle it yourself.",
  tools: [transferTool],
  subAgents: [supportAgent],
  model: "gemini-2.5-flash"
});

async function main() {
  const runner = new InMemoryRunner({ agent: mainAgent, appName: "customer_support_app" });

  console.log("--- Running with a non-urgent query ---");
  await runner.sessionService.createSession({ appName: "customer_support_app", userId: "user1", sessionId: "session1" });
  const nonUrgentMessage: Content = createUserContent("I have a general question about my account.");
  for await (const event of runner.runAsync({ userId: "user1", sessionId: "session1", newMessage: nonUrgentMessage })) {
    if (isFinalResponse(event) && event.content?.parts?.length) {
      const text = stringifyContent(event).trim();
      if (text) console.log(`Final Response: ${text}`);
    }
  }

  console.log("\n--- Running with an urgent query ---");
  await runner.sessionService.createSession({ appName: "customer_support_app", userId: "user1", sessionId: "session2" });
  const urgentMessage: Content = createUserContent("My account is locked and this is urgent!");
  for await (const event of runner.runAsync({ userId: "user1", sessionId: "session2", newMessage: urgentMessage })) {
    if (isFinalResponse(event) && event.content?.parts?.length) {
      const text = stringifyContent(event).trim();
      if (text) console.log(`Final Response: ${text}`);
    }
  }
}

main();
```

##### Explanation

- Two agents are defined: `main_agent` (initial contact) and `support_agent` (specialist).
- The `check_and_transfer` tool examines the user's query for urgency.
- If "urgent" is detected, the tool sets `context.actions.transferToAgent = "support_agent"`, signaling the framework to transfer control.
- For normal queries, no transfer is triggered.

### Authentication

ToolContext provides mechanisms for tools interacting with authenticated APIs:

- **`getAuthResponse(authConfig: AuthConfig)`**: Retrieves credentials after authentication was handled by the framework.
- **`requestCredential(authConfig: AuthConfig)`**: Call this if your tool determines authentication is needed but credentials aren't available. This signals the framework to start an authentication flow.

For detailed explanations, refer to the dedicated Tool Authentication documentation page.

### Context-Aware Data Access Methods

These methods provide convenient ways for your tool to interact with persistent data associated with the session or user.

- **`listArtifacts()`**: Returns a list of filenames for all artifacts currently stored for the session.
- **`loadArtifact(filename: str)`**: Retrieves a specific artifact by its filename. Returns a `Part` object, or `null` if not found.
- **`saveArtifact(filename: str, artifact: Part)`**: Saves a new version of an artifact. Returns the new version number.
- **`searchMemory(query: str)`**: Queries the user's long-term memory using the configured memory service.

#### Example

```typescript
import { Part } from "@google/genai";
import { Context } from '@google/adk';

// Analyzes a document using context from memory.
export async function processDocument(
  params: { documentName: string; analysisQuery: string },
  context?: Context
): Promise<Record<string, any>> {
  if (!context) {
    throw new Error("Context is required for this tool.");
  }

  // 1. List all available artifacts
  const artifacts = await context.listArtifacts();
  console.log(`Listing all available artifacts: ${artifacts}`);

  // 2. Load an artifact
  console.log(`Tool: Attempting to load artifact: ${params.documentName}`);
  const documentPart = await context.loadArtifact(params.documentName);
  if (!documentPart) {
    return {
      status: "error",
      message: `Document '${params.documentName}' not found.`,
    };
  }

  const documentText = documentPart.text ?? "";
  console.log(`Tool: Loaded document '${params.documentName}' (${documentText.length} chars).`);

  // 3. Search memory for related context
  console.log(`Tool: Searching memory for context related to '${params.analysisQuery}'`);
  const memory_results = await context.searchMemory(params.analysisQuery);
  console.log(`Tool: Found ${memory_results.memories.length} relevant memories.`);
  const context_from_memory = memory_results.memories
    .map((m) => m.content.parts[0].text)
    .join("\n");

  // 4. Perform analysis (placeholder)
  const analysisResult =
    `Analysis of '${params.documentName}' regarding '${params.analysisQuery}':\n` +
    `Context from Memory:\n${context_from_memory}\n` +
    `[Placeholder Analysis Result]`;
  console.log("Tool: Performed analysis.");

  // 5. Save the analysis result as a new artifact
  const analysisPart: Part = { text: analysisResult };
  const newArtifactName = `analysis_${params.documentName}`;
  await context.saveArtifact(newArtifactName, analysisPart);
  console.log(`Tool: Saved analysis result to '${newArtifactName}'.`);

  return {
    status: "success",
    analysis_artifact: newArtifactName,
  };
}
```

---

## Defining Effective Tool Functions

When using a function as an ADK Tool, how you define it significantly impacts the agent's ability to use it correctly. The LLM relies on the function's **name**, **parameters**, **type hints**, and **docstring** to understand its purpose.

### Key Guidelines

**Function Name:**
- Use descriptive, verb-noun based names (e.g., `getWeather`, `searchDocuments`, `scheduleMeeting`).
- Avoid generic names like `run`, `process`, or `handleData`.

**Parameters:**
- Use clear and descriptive names (e.g., `city` not `c`).
- Provide TypeScript types for all parameters.
- Ensure all parameter types are JSON serializable (`string`, `number`, `boolean`, arrays, plain objects).
- Avoid default values — all necessary information should be derived by the LLM from context.

**Return Type:**
- The function's return value **must be a plain object** in TypeScript.
- If a non-object type is returned, ADK wraps it: `{ result: your_return_value }`.
- Use **descriptive keys**. Include a `status` key (e.g., `'success'`, `'error'`) to clearly indicate the outcome.

**Docstring / JSDoc Comments:**
- Clearly state what the tool **does**.
- Explain **when** the tool should be used.
- Describe **each parameter** and the **return value structure**.
- Do **not** describe the injected `Context` parameter — it is not relevant to the LLM.

**Example of a good definition:**

```typescript
/**
 * Fetches the current status of a customer's order using its ID.
 *
 * Use this tool ONLY when a user explicitly asks for the status of
 * a specific order and provides the order ID. Do not use it for
 * general inquiries.
 *
 * @param params The parameters for the function.
 * @param params.order_id The unique identifier of the order to look up.
 * @returns A dictionary indicating the outcome.
 *          On success, status is 'success' and includes an 'order' object.
 *          On failure, status is 'error' and includes an 'error_message'.
 */
async function lookupOrderStatus(params: { order_id: string }): Promise<Record<string, any>> {
  const status_details = await fetchStatusFromBackend(params.order_id);
  if (status_details) {
    return {
      "status": "success",
      "order": {
        "state": status_details.state,
        "tracking_number": status_details.tracking,
      },
    };
  } else {
    return { "status": "error", "error_message": `Order ID ${params.order_id} not found.` };
  }
}
```

**Simplicity and Focus:**
- Each tool should ideally perform **one well-defined task**.
- Prefer fewer, clearly defined parameters.
- Use simple data types: `string`, `number`, `boolean`, `string[]`, etc.
- Decompose complex tasks into smaller, more focused tools (e.g., `updateUserName`, `updateUserAddress` rather than one `updateUserProfile`).

---

## Toolsets: Grouping and Dynamically Providing Tools

Supported in ADK: Python v0.5.0 | Typescript v0.2.0

Beyond individual tools, ADK introduces the concept of a **Toolset** via the `BaseToolset` interface. A toolset allows you to manage and provide a collection of `BaseTool` instances, often dynamically, to an agent.

This is beneficial for:
- **Organizing related tools** that serve a common purpose.
- **Dynamic tool availability** based on context (user permissions, session state, etc.).
- **Integrating external tool providers** like OpenAPI specs or MCP servers.

### The `BaseToolset` Interface

Any class acting as a toolset should implement `BaseToolset`. It defines two key methods:

- **`async getTools(): Promise<BaseTool[]>`**: Called when an ADK agent needs to know its available tools. Can use context to dynamically decide which tools to return.
- **`async close(): Promise<void>`**: Called by the ADK framework when the toolset is no longer needed. Implement to release resources (connections, file handles, etc.).

### Using Toolsets with Agents

Include instances of your `BaseToolset` implementations directly in an `LlmAgent`'s `tools` array, alongside individual `BaseTool` instances. ADK will call `getTools()` on each toolset instance and merge the results.

### Example: A Simple Math Toolset

```typescript
import { LlmAgent, FunctionTool, Context, BaseToolset, InMemoryRunner, isFinalResponse, BaseTool, stringifyContent } from '@google/adk';
import { z } from "zod";
import { Content, createUserContent } from "@google/genai";

function addNumbers(params: { a: number; b: number }, context?: Context): Record<string, any> {
  if (!context) {
    throw new Error("Context is required for this tool.");
  }
  const result = params.a + params.b;
  context.state.set("last_math_result", result);
  return { result: result };
}

function subtractNumbers(params: { a: number; b: number }): Record<string, any> {
  return { result: params.a - params.b };
}

function greetUser(params: { name: string }): Record<string, any> {
  return { greeting: `Hello, ${params.name}!` };
}

class SimpleMathToolset extends BaseToolset {
  private readonly tools: BaseTool[];

  constructor(prefix = "") {
    super([]);
    this.tools = [
      new FunctionTool({
        name: `${prefix}add_numbers`,
        description: "Adds two numbers and stores the result in the session state.",
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: addNumbers,
      }),
      new FunctionTool({
        name: `${prefix}subtract_numbers`,
        description: "Subtracts the second number from the first.",
        parameters: z.object({ a: z.number(), b: z.number() }),
        execute: subtractNumbers,
      }),
    ];
  }

  async getTools(): Promise<BaseTool[]> {
    return this.tools;
  }

  async close(): Promise<void> {
    console.log("SimpleMathToolset closed.");
  }
}

async function main() {
  const mathToolset = new SimpleMathToolset("calculator_");
  const greetTool = new FunctionTool({
    name: "greet_user",
    description: "Greets the user.",
    parameters: z.object({ name: z.string() }),
    execute: greetUser,
  });

  const calculatorAgent = new LlmAgent({
    name: "calculator_agent",
    instruction: `You are a calculator and a greeter.
    If the user asks for a math operation, use the calculator tools.
    If the user asks for a greeting, use the greet_user tool.
    The result of the last math operation is stored in the 'last_math_result' state variable.`,
    tools: [greetTool, mathToolset],
    model: "gemini-2.5-flash",
  });

  const runner = new InMemoryRunner({ agent: calculatorAgent, appName: "toolset_app" });
  await runner.sessionService.createSession({ appName: "toolset_app", userId: "user1", sessionId: "session1" });

  const message: Content = createUserContent("What is 5 + 3?");

  for await (const event of runner.runAsync({ userId: "user1", sessionId: "session1", newMessage: message })) {
    if (isFinalResponse(event) && event.content?.parts?.length) {
      const text = stringifyContent(event).trim();
      if (text) {
        console.log(`Response from agent: ${text}`);
      }
    }
  }

  await mathToolset.close();
}

main();
```

In this example:
- `SimpleMathToolset` implements `BaseToolset`, returning `FunctionTool` instances with a customizable prefix.
- The `calculator_agent` is configured with both an individual `greetTool` and an instance of `SimpleMathToolset`.
- ADK calls `mathToolset.getTools()` to expose `greet_user`, `calculator_add_numbers`, and `calculator_subtract_numbers` to the LLM.
- The `addNumbers` tool demonstrates writing to `context.state`.
- `close()` is called to release any resources held by the toolset.

Toolsets offer a powerful way to organize, manage, and dynamically provide collections of tools to your ADK agents, leading to more modular and maintainable agentic applications.