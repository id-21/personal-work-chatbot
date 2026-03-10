# LLM Agent

Supported in ADK Python v0.1.0 Typescript v0.2.0 Go v0.1.0 Java v0.1.0

The `LlmAgent` (often aliased simply as `Agent`) is a core component in ADK, acting as the "thinking" part of your application. It leverages the power of a Large Language Model (LLM) for reasoning, understanding natural language, making decisions, generating responses, and interacting with tools.

Unlike deterministic [Workflow Agents](https://google.github.io/adk-docs/agents/workflow-agents/index.md) that follow predefined execution paths, `LlmAgent` behavior is non-deterministic. It uses the LLM to interpret instructions and context, deciding dynamically how to proceed, which tools to use (if any), or whether to transfer control to another agent.

Building an effective `LlmAgent` involves defining its identity, clearly guiding its behavior through instructions, and equipping it with the necessary tools and capabilities.

## Defining the Agent's Identity and Purpose

First, you need to establish what the agent *is* and what it's *for*.

- **`name` (Required):** Every agent needs a unique string identifier. This `name` is crucial for internal operations, especially in multi-agent systems where agents need to refer to or delegate tasks to each other. Choose a descriptive name that reflects the agent's function (e.g., `customer_support_router`, `billing_inquiry_agent`). Avoid reserved names like `user`.
- **`description` (Optional, Recommended for Multi-Agent):** Provide a concise summary of the agent's capabilities. This description is primarily used by *other* LLM agents to determine if they should route a task to this agent. Make it specific enough to differentiate it from peers (e.g., "Handles inquiries about current billing statements," not just "Billing agent").
- **`model` (Required):** Specify the underlying LLM that will power this agent's reasoning. This is a string identifier like `"gemini-2.5-flash"`. The choice of model impacts the agent's capabilities, cost, and performance. See the [Models](/adk-docs/agents/models/) page for available options and considerations.

```typescript
// Example: Defining the basic identity
const capitalAgent = new LlmAgent({
    model: 'gemini-2.5-flash',
    name: 'capital_agent',
    description: 'Answers user questions about the capital city of a given country.',
    // instruction and tools will be added next
});
```

## Guiding the Agent: Instructions (`instruction`)

The `instruction` parameter is arguably the most critical for shaping an `LlmAgent`'s behavior. It's a string (or a function returning a string) that tells the agent:

- Its core task or goal.
- Its personality or persona (e.g., "You are a helpful assistant," "You are a witty pirate").
- Constraints on its behavior (e.g., "Only answer questions about X," "Never reveal Y").
- How and when to use its `tools`. You should explain the purpose of each tool and the circumstances under which it should be called, supplementing any descriptions within the tool itself.
- The desired format for its output (e.g., "Respond in JSON," "Provide a bulleted list").

**Tips for Effective Instructions:**

- **Be Clear and Specific:** Avoid ambiguity. Clearly state the desired actions and outcomes.
- **Use Markdown:** Improve readability for complex instructions using headings, lists, etc.
- **Provide Examples (Few-Shot):** For complex tasks or specific output formats, include examples directly in the instruction.
- **Guide Tool Use:** Don't just list tools; explain *when* and *why* the agent should use them.

**State:**

- The instruction is a string template, you can use the `{var}` syntax to insert dynamic values into the instruction.
- `{var}` is used to insert the value of the state variable named var.
- `{artifact.var}` is used to insert the text content of the artifact named var.
- If the state variable or artifact does not exist, the agent will raise an error. If you want to ignore the error, you can append a `?` to the variable name as in `{var?}`.

```typescript
// Example: Adding instructions
const capitalAgent = new LlmAgent({
    model: 'gemini-2.5-flash',
    name: 'capital_agent',
    description: 'Answers user questions about the capital city of a given country.',
    instruction: `You are an agent that provides the capital city of a country.
        When a user asks for the capital of a country:
        1. Identify the country name from the user's query.
        2. Use the \`getCapitalCity\` tool to find the capital.
        3. Respond clearly to the user, stating the capital city.
        Example Query: "What's the capital of {country}?"
        Example Response: "The capital of France is Paris."
        `,
    // tools will be added next
});
```

*(Note: For instructions that apply to* all *agents in a system, consider using `global_instruction` on the root agent, detailed further in the [Multi-Agents](https://google.github.io/adk-docs/agents/multi-agents/index.md) section.)*

## Equipping the Agent: Tools (`tools`)

Tools give your `LlmAgent` capabilities beyond the LLM's built-in knowledge or reasoning. They allow the agent to interact with the outside world, perform calculations, fetch real-time data, or execute specific actions.

- **`tools` (Optional):** Provide a list of tools the agent can use. Each item in the list can be:
  - A native function or method (wrapped as a `FunctionTool`). Python ADK automatically wraps the native function into a `FunctionTool` whereas, you must explicitly wrap your Java methods using `FunctionTool.create(...)`
  - An instance of a class inheriting from `BaseTool`.
  - An instance of another agent (`AgentTool`, enabling agent-to-agent delegation - see [Multi-Agents](https://google.github.io/adk-docs/agents/multi-agents/index.md)).

The LLM uses the function/tool names, descriptions (from docstrings or the `description` field), and parameter schemas to decide which tool to call based on the conversation and its instructions.

```typescript
import {z} from 'zod';
import { LlmAgent, FunctionTool } from '@google/adk';

// Define the schema for the tool's input parameters
const getCapitalCityParamsSchema = z.object({
    country: z.string().describe('The country to get capital for.'),
});

// Define the tool function itself
async function getCapitalCity(params: z.infer<typeof getCapitalCityParamsSchema>): Promise<{ capitalCity: string }> {
const capitals: Record<string, string> = {
    'france': 'Paris',
    'japan': 'Tokyo',
    'canada': 'Ottawa',
};
const result = capitals[params.country.toLowerCase()] ??
    `Sorry, I don't know the capital of ${params.country}.`;
return {capitalCity: result}; // Tools must return an object
}

// Create an instance of the FunctionTool
const getCapitalCityTool = new FunctionTool({
    name: 'getCapitalCity',
    description: 'Retrieves the capital city for a given country.',
    parameters: getCapitalCityParamsSchema,
    execute: getCapitalCity,
});

// Add the tool to the agent
const capitalAgent = new LlmAgent({
    model: 'gemini-2.5-flash',
    name: 'capitalAgent',
    description: 'Answers user questions about the capital city of a given country.',
    instruction: 'You are an agent that provides the capital city of a country...', // Note: the full instruction is omitted for brevity
    tools: [getCapitalCityTool], // Provide the FunctionTool instance in an array
});
```

Learn more about Tools in [Custom Tools](/adk-docs/tools-custom/).

## Advanced Configuration & Control

Beyond the core parameters, `LlmAgent` offers several options for finer control:

### Fine-Tuning LLM Generation (`generate_content_config`)

You can adjust how the underlying LLM generates responses using `generate_content_config`.

- **`generate_content_config` (Optional):** Pass an instance of [`google.genai.types.GenerateContentConfig`](https://googleapis.github.io/python-genai/genai.html#genai.types.GenerateContentConfig) to control parameters like `temperature` (randomness), `max_output_tokens` (response length), `top_p`, `top_k`, and safety settings.

```typescript
import { GenerateContentConfig } from '@google/genai';

const generateContentConfig: GenerateContentConfig = {
    temperature: 0.2, // More deterministic output
    maxOutputTokens: 250,
};

const agent = new LlmAgent({
    // ... other params
    generateContentConfig,
});
```

### Structuring Data (`input_schema`, `output_schema`, `output_key`)

For scenarios requiring structured data exchange with an `LLM Agent`, the ADK provides mechanisms to define expected input and desired output formats using schema definitions.

- **`input_schema` (Optional):** Define a schema representing the expected input structure. If set, the user message content passed to this agent *must* be a JSON string conforming to this schema. Your instructions should guide the user or preceding agent accordingly.
- **`output_schema` (Optional):** Define a schema representing the desired output structure. If set, the agent's final response *must* be a JSON string conforming to this schema.

Warning: Using `output_schema` with `tools`

Using `output_schema` with `tools` in the same LLM request is only supported by specific models, including [Gemini 3.0](https://ai.google.dev/gemini-api/docs/function-calling?example=meeting#structured-output). For other models, workarounds using [function tools](https://github.com/google/adk-python/blob/main/src/google/adk/flows/llm_flows/_output_schema_processor.py)) in ADK may not work reliably. In such cases, consider using sub-agents that handle output formatting separately.

- **`output_key` (Optional):** Provide a string key. If set, the text content of the agent's *final* response will be automatically saved to the session's state dictionary under this key. This is useful for passing results between agents or steps in a workflow.
  - In Python, this might look like: `session.state[output_key] = agent_response_text`
  - In Java: `session.state().put(outputKey, agentResponseText)`
  - In Golang, within a callback handler: `ctx.State().Set(output_key, agentResponseText)`

The input and output schema is typically a `Pydantic` BaseModel.

```typescript
import {z} from 'zod';
import { Schema, Type } from '@google/genai';

// Define the schema for the output
const CapitalOutputSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        capital: {
            type: Type.STRING,
            description: 'The capital of the country.',
        },
    },
    required: ['capital'],
};

// Create the LlmAgent instance
const structuredCapitalAgent = new LlmAgent({
    // ... name, model, description
    instruction: `You are a Capital Information Agent. Given a country, respond ONLY with a JSON object containing the capital. Format: {"capital": "capital_name"}`,
    outputSchema: CapitalOutputSchema, // Enforce JSON output
    outputKey: 'found_capital', // Store result in state['found_capital']
    // Cannot use tools effectively here
});
```

The input and output schema is a `google.genai.types.Schema` object.

### Managing Context (`include_contents`)

Control whether the agent receives the prior conversation history.

- **`include_contents` (Optional, Default: `'default'`):** Determines if the `contents` (history) are sent to the LLM.
  - `'default'`: The agent receives the relevant conversation history.
  - `'none'`: The agent receives no prior `contents`. It operates based solely on its current instruction and any input provided in the *current* turn (useful for stateless tasks or enforcing specific contexts).

```typescript
const statelessAgent = new LlmAgent({
    // ... other params
    includeContents: 'none',
});
```

### Planner

Supported in ADKPython v0.1.0

**`planner` (Optional):** Assign a `BasePlanner` instance to enable multi-step reasoning and planning before execution. There are two main planners:

- **`BuiltInPlanner`:** Leverages the model's built-in planning capabilities (e.g., Gemini's thinking feature). See [Gemini Thinking](https://ai.google.dev/gemini-api/docs/thinking) for details and examples.

  Here, the `thinking_budget` parameter guides the model on the number of thinking tokens to use when generating a response. The `include_thoughts` parameter controls whether the model should include its raw thoughts and internal reasoning process in the response.

  ```python
  from google.adk import Agent
  from google.adk.planners import BuiltInPlanner
  from google.genai import types

  my_agent = Agent(
      model="gemini-2.5-flash",
      planner=BuiltInPlanner(
          thinking_config=types.ThinkingConfig(
              include_thoughts=True,
              thinking_budget=1024,
          )
      ),
      # ... your tools here
  )
  ```

- **`PlanReActPlanner`:** This planner instructs the model to follow a specific structure in its output: first create a plan, then execute actions (like calling tools), and provide reasoning for its steps. *It's particularly useful for models that don't have a built-in "thinking" feature*.

  ```python
  from google.adk import Agent
  from google.adk.planners import PlanReActPlanner

  my_agent = Agent(
      model="gemini-2.5-flash",
      planner=PlanReActPlanner(),
      # ... your tools here
  )
  ```

  The agent's response will follow a structured format:

  ```text
  [user]: ai news
  [google_search_agent]: /*PLANNING*/
  1. Perform a Google search for "latest AI news" to get current updates and headlines related to artificial intelligence.
  2. Synthesize the information from the search results to provide a summary of recent AI news.

  /*ACTION*/
  /*REASONING*/
  The search results provide a comprehensive overview of recent AI news, covering various aspects like company developments, research breakthroughs, and applications. I have enough information to answer the user's request.

  /*FINAL_ANSWER*/
  Here's a summary of recent AI news:
  ....
  ```

Example for using built-in-planner:

```python
from dotenv import load_dotenv


import asyncio
import os

from google.genai import types
from google.adk.agents.llm_agent import LlmAgent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.artifacts.in_memory_artifact_service import InMemoryArtifactService # Optional
from google.adk.planners import BasePlanner, BuiltInPlanner, PlanReActPlanner
from google.adk.models import LlmRequest

from google.genai.types import ThinkingConfig
from google.genai.types import GenerateContentConfig

import datetime
from zoneinfo import ZoneInfo

APP_NAME = "weather_app"
USER_ID = "1234"
SESSION_ID = "session1234"

def get_weather(city: str) -> dict:
    """Retrieves the current weather report for a specified city.

    Args:
        city (str): The name of the city for which to retrieve the weather report.

    Returns:
        dict: status and result or error msg.
    """
    if city.lower() == "new york":
        return {
            "status": "success",
            "report": (
                "The weather in New York is sunny with a temperature of 25 degrees"
                " Celsius (77 degrees Fahrenheit)."
            ),
        }
    else:
        return {
            "status": "error",
            "error_message": f"Weather information for '{city}' is not available.",
        }


def get_current_time(city: str) -> dict:
    """Returns the current time in a specified city.

    Args:
        city (str): The name of the city for which to retrieve the current time.

    Returns:
        dict: status and result or error msg.
    """

    if city.lower() == "new york":
        tz_identifier = "America/New_York"
    else:
        return {
            "status": "error",
            "error_message": (
                f"Sorry, I don't have timezone information for {city}."
            ),
        }

    tz = ZoneInfo(tz_identifier)
    now = datetime.datetime.now(tz)
    report = (
        f'The current time in {city} is {now.strftime("%Y-%m-%d %H:%M:%S %Z%z")}'
    )
    return {"status": "success", "report": report}

# Step 1: Create a ThinkingConfig
thinking_config = ThinkingConfig(
    include_thoughts=True,   # Ask the model to include its thoughts in the response
    thinking_budget=256      # Limit the 'thinking' to 256 tokens (adjust as needed)
)
print("ThinkingConfig:", thinking_config)

# Step 2: Instantiate BuiltInPlanner
planner = BuiltInPlanner(
    thinking_config=thinking_config
)
print("BuiltInPlanner created.")

# Step 3: Wrap the planner in an LlmAgent
agent = LlmAgent(
    model="gemini-2.5-pro-preview-03-25",  # Set your model name
    name="weather_and_time_agent",
    instruction="You are an agent that returns time and weather",
    planner=planner,
    tools=[get_weather, get_current_time]
)

# Session and Runner
session_service = InMemorySessionService()
session = session_service.create_session(app_name=APP_NAME, user_id=USER_ID, session_id=SESSION_ID)
runner = Runner(agent=agent, app_name=APP_NAME, session_service=session_service)

# Agent Interaction
def call_agent(query):
    content = types.Content(role='user', parts=[types.Part(text=query)])
    events = runner.run(user_id=USER_ID, session_id=SESSION_ID, new_message=content)

    for event in events:
        print(f"\nDEBUG EVENT: {event}\n")
        if event.is_final_response() and event.content:
            final_answer = event.content.parts[0].text.strip()
            print("\n🟢 FINAL ANSWER\n", final_answer, "\n")

call_agent("If it's raining in New York right now, what is the current temperature?")
```

## Putting It Together: Example

Code

Here's the complete basic `capital_agent`:

```javascript
// Copyright 2025 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { LlmAgent, FunctionTool, InMemoryRunner, isFinalResponse } from '@google/adk';
import { createUserContent, Schema, Type } from '@google/genai';
import type { Part } from '@google/genai';
 import { z } from 'zod';

// --- 1. Define Constants ---
const APP_NAME = "capital_app_ts";
const USER_ID = "test_user_789";
const SESSION_ID_TOOL_AGENT = "session_tool_agent_ts";
const SESSION_ID_SCHEMA_AGENT = "session_schema_agent_ts";
const MODEL_NAME = "gemini-2.5-flash"; // Using flash for speed

// --- 2. Define Schemas ---

// A. Schema for the Tool's parameters (using Zod)
const CountryInput = z.object({
    country: z.string().describe('The country to get the capital for.'),
});

// B. Output schema ONLY for the second agent (using ADK's Schema type)
const CapitalInfoOutputSchema: Schema = {
    type: Type.OBJECT,
    description: "Schema for capital city information.",
    properties: {
        capital: {
            type: Type.STRING,
            description: "The capital city of the country."
        },
        population_estimate: {
            type: Type.STRING,
            description: "An estimated population of the capital city."
        },
    },
    required: ["capital", "population_estimate"],
};


// --- 3. Define the Tool (Only for the first agent) ---
async function getCapitalCity(params: z.infer<typeof CountryInput>): Promise<{ result: string }> {
    console.log(`\n-- Tool Call: getCapitalCity(country='${params.country}') --`);
    const capitals: Record<string, string> = {
        'united states': 'Washington, D.C.',
        'canada': 'Ottawa',
        'france': 'Paris',
        'japan': 'Tokyo',
    };
    const result = capitals[params.country.toLowerCase()] ??
        `Sorry, I couldn't find the capital for ${params.country}.`;
    console.log(`-- Tool Result: '${result}' --`);
    return { result: result }; // Tools must return an object
}

// --- 4. Configure Agents ---

// Agent 1: Uses a tool and outputKey
const getCapitalCityTool = new FunctionTool({
    name: 'get_capital_city',
    description: 'Retrieves the capital city for a given country',
    parameters: CountryInput,
    execute: getCapitalCity,
});

const capitalAgentWithTool = new LlmAgent({
    model: MODEL_NAME,
    name: 'capital_agent_tool',
    description: 'Retrieves the capital city using a specific tool.',
    instruction: `You are a helpful agent that provides the capital city of a country using a tool.
The user will provide the country name in a JSON format like {"country": "country_name"}.
1. Extract the country name.
2. Use the \`get_capital_city\` tool to find the capital.
3. Respond with a JSON object with the key 'capital' and the value as the capital city.
`,
    tools: [getCapitalCityTool],
    outputKey: "capital_tool_result", // Store final text response
});

// Agent 2: Uses outputSchema (NO tools possible)
const structuredInfoAgentSchema = new LlmAgent({
    model: MODEL_NAME,
    name: 'structured_info_agent_schema',
    description: 'Provides capital and estimated population in a specific JSON format.',
    instruction: `You are an agent that provides country information.
The user will provide the country name in a JSON format like {"country": "country_name"}.
Respond ONLY with a JSON object matching this exact schema:
${JSON.stringify(CapitalInfoOutputSchema, null, 2)}
Use your knowledge to determine the capital and estimate the population. Do not use any tools.
`,
    // *** NO tools parameter here - using outputSchema prevents tool use ***
    outputSchema: CapitalInfoOutputSchema,
    outputKey: "structured_info_result",
});


// --- 5. Define Agent Interaction Logic ---
async function callAgentAndPrint(
    runner: InMemoryRunner,
    agent: LlmAgent,
    sessionId: string,
    queryJson: string
) {
    console.log(`\n>>> Calling Agent: '${agent.name}' | Query: ${queryJson}`);
    const message = createUserContent(queryJson);

    let finalResponseContent = "No final response received.";
    for await (const event of runner.runAsync({ userId: USER_ID, sessionId: sessionId, newMessage: message })) {
        if (isFinalResponse(event) && event.content?.parts?.length) {
            finalResponseContent = event.content.parts.map((part: Part) => part.text ?? '').join('');
        }
    }
    console.log(`<<< Agent '${agent.name}' Response: ${finalResponseContent}`);

    // Check the session state
    const currentSession = await runner.sessionService.getSession({ appName: APP_NAME, userId: USER_ID, sessionId: sessionId });
    if (!currentSession) {
        console.log(`--- Session not found: ${sessionId} ---`);
        return;
    }
    const storedOutput = currentSession.state[agent.outputKey!];

    console.log(`--- Session State ['${agent.outputKey}']: `);
    try {
        // Attempt to parse and pretty print if it's JSON
        const parsedOutput = JSON.parse(storedOutput as string);
        console.log(JSON.stringify(parsedOutput, null, 2));
    } catch (e) {
        // Otherwise, print as a string
        console.log(storedOutput);
    }
    console.log("-".repeat(30));
}

// --- 6. Run Interactions ---
async function main() {
    // Set up runners for each agent
    const capitalRunner = new InMemoryRunner({ appName: APP_NAME, agent: capitalAgentWithTool });
    const structuredRunner = new InMemoryRunner({ appName: APP_NAME, agent: structuredInfoAgentSchema });

    // Create sessions
    console.log("--- Creating Sessions ---");
    await capitalRunner.sessionService.createSession({ appName: APP_NAME, userId: USER_ID, sessionId: SESSION_ID_TOOL_AGENT });
    await structuredRunner.sessionService.createSession({ appName: APP_NAME, userId: USER_ID, sessionId: SESSION_ID_SCHEMA_AGENT });

    console.log("\n--- Testing Agent with Tool ---");
    await callAgentAndPrint(capitalRunner, capitalAgentWithTool, SESSION_ID_TOOL_AGENT, '{"country": "France"}');
    await callAgentAndPrint(capitalRunner, capitalAgentWithTool, SESSION_ID_TOOL_AGENT, '{"country": "Canada"}');

    console.log("\n\n--- Testing Agent with Output Schema (No Tool Use) ---");
    await callAgentAndPrint(structuredRunner, structuredInfoAgentSchema, SESSION_ID_SCHEMA_AGENT, '{"country": "France"}');
    await callAgentAndPrint(structuredRunner, structuredInfoAgentSchema, SESSION_ID_SCHEMA_AGENT, '{"country": "Japan"}');
}

main();
```


*(This example demonstrates the core concepts. More complex agents might incorporate schemas, context control, planning, etc.)*

## Related Concepts (Deferred Topics)

While this page covers the core configuration of `LlmAgent`, several related concepts provide more advanced control and are detailed elsewhere:

- **Callbacks:** Intercepting execution points (before/after model calls, before/after tool calls) using `before_model_callback`, `after_model_callback`, etc. See [Callbacks](https://google.github.io/adk-docs/callbacks/types-of-callbacks/index.md).
- **Multi-Agent Control:** Advanced strategies for agent interaction, including planning (`planner`), controlling agent transfer (`disallow_transfer_to_parent`, `disallow_transfer_to_peers`), and system-wide instructions (`global_instruction`). See [Multi-Agents](https://google.github.io/adk-docs/agents/multi-agents/index.md).
