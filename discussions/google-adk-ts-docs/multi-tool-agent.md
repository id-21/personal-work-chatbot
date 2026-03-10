# Build a multi-tool agent

This quickstart guides you through installing the Agent Development Kit (ADK), setting up a basic agent with multiple tools, and running it locally either in the terminal or in the interactive, browser-based dev UI.

This quickstart assumes a local IDE (VS Code, PyCharm, IntelliJ IDEA, etc.) with Python 3.10+ or Java 17+ and terminal access. This method runs the application entirely on your machine and is recommended for internal development.

## 1. Set up Environment & Install ADK

Create a new project directory, initialize it, and install dependencies:

```bash
mkdir my-adk-agent
cd my-adk-agent
npm init -y
npm install @google/adk @google/adk-devtools
npm install -D typescript
```

Create a `tsconfig.json` file with the following content. This configuration ensures your project correctly handles modern Node.js modules.

tsconfig.json

```json
{
  "compilerOptions": {
    "target": "es2020",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    // set to false to allow CommonJS module syntax:
    "verbatimModuleSyntax": false
  }
}
```

To install ADK and setup the environment, proceed to the following steps.

## 2. Create Agent Project

### Project structure

You will need to create the following project structure:

```console
parent_folder/
    multi_tool_agent/
        __init__.py
        agent.py
        .env
```

Create the folder `multi_tool_agent`:

```bash
mkdir multi_tool_agent/
```

Note for Windows users

When using ADK on Windows for the next few steps, we recommend creating Python files using File Explorer or an IDE because the following commands (`mkdir`, `echo`) typically generate files with null bytes and/or incorrect encoding.

### `.env`

Create a `.env` file in the same folder:

```shell
touch multi_tool_agent/.env
```

```shell
type nul > multi_tool_agent\.env
```

More instructions about this file are described in the next section on [Set up the model](#set-up-the-model).

You will need to create the following project structure in your `my-adk-agent` directory:

```console
my-adk-agent/
    agent.ts
    .env
    package.json
    tsconfig.json
```

### `agent.ts`

Create an `agent.ts` file in your project folder:

```shell
touch agent.ts
```

```shell
type nul > agent.ts
```

Copy and paste the following code into `agent.ts`:

agent.ts

```typescript
import 'dotenv/config';
import { FunctionTool, LlmAgent } from '@google/adk';
import { z } from 'zod';

const getWeather = new FunctionTool({
  name: 'get_weather',
  description: 'Retrieves the current weather report for a specified city.',
  parameters: z.object({
    city: z.string().describe('The name of the city for which to retrieve the weather report.'),
  }),
  execute: ({ city }) => {
    if (city.toLowerCase() === 'new york') {
      return {
        status: 'success',
        report:
          'The weather in New York is sunny with a temperature of 25 degrees Celsius (77 degrees Fahrenheit).',
      };
    } else {
      return {
        status: 'error',
        error_message: `Weather information for '${city}' is not available.`,
      };
    }
  },
});

const getCurrentTime = new FunctionTool({
  name: 'get_current_time',
  description: 'Returns the current time in a specified city.',
  parameters: z.object({
    city: z.string().describe("The name of the city for which to retrieve the current time."),
  }),
  execute: ({ city }) => {
    let tz_identifier: string;
    if (city.toLowerCase() === 'new york') {
      tz_identifier = 'America/New_York';
    } else {
      return {
        status: 'error',
        error_message: `Sorry, I don't have timezone information for ${city}.`,
      };
    }

    const now = new Date();
    const report = `The current time in ${city} is ${now.toLocaleString('en-US', { timeZone: tz_identifier })}`;

    return { status: 'success', report: report };
  },
});

export const rootAgent = new LlmAgent({
  name: 'weather_time_agent',
  model: 'gemini-2.5-flash',
  description: 'Agent to answer questions about the time and weather in a city.',
  instruction: 'You are a helpful agent who can answer user questions about the time and weather in a city.',
  tools: [getWeather, getCurrentTime],
});
```

### `.env`

Create a `.env` file in the same folder:

```shell
touch .env
```

```shell
type nul > .env
```

More instructions about this file are described in the next section on [Set up the model](#set-up-the-model).

## 3. Set up the model

Your agent's ability to understand user requests and generate responses is powered by a Large Language Model (LLM). Your agent needs to make secure calls to this external LLM service, which **requires authentication credentials**. Without valid authentication, the LLM service will deny the agent's requests, and the agent will be unable to function.

Model Authentication guide

For a detailed guide on authenticating to different models, see the [Authentication guide](/adk-docs/agents/models/google-gemini#google-ai-studio). This is a critical step to ensure your agent can make calls to the LLM service.

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey).

1. When using Python, open the **`.env`** file located inside (`multi_tool_agent/`) and copy-paste the following code.

   multi_tool_agent/.env

   ```text
   GOOGLE_GENAI_USE_VERTEXAI=FALSE
   GOOGLE_API_KEY=PASTE_YOUR_ACTUAL_API_KEY_HERE
   ```

   When using TypeScript, the `.env` file is automatically loaded by the `import 'dotenv/config';` line at the top of your `agent.ts` file.

   `env title=""multi_tool_agent/.env" GOOGLE_GENAI_USE_VERTEXAI=FALSE GOOGLE_GENAI_API_KEY=PASTE_YOUR_ACTUAL_API_KEY_HERE`

1. Replace `PASTE_YOUR_ACTUAL_API_KEY_HERE` with your actual `API KEY`.

## 4. Run Your Agent

Tip

When using `adk run` you can inject prompts into the agent to start by piping text to the command like so:

```shell
echo "Please start by listing files" | adk run file_listing_agent
```

Run the following command, to chat with your Weather agent.

```text
adk run multi_tool_agent
```

To exit, use Cmd/Ctrl+C.

`adk api_server` enables you to create a local FastAPI server in a single command, enabling you to test local cURL requests before you deploy your agent.

To learn how to use `adk api_server` for testing, refer to the [documentation on using the API server](/adk-docs/runtime/api-server/).

Using the terminal, navigate to your agent project directory:

```console
my-adk-agent/      <-- navigate to this directory
    agent.ts
    .env
    package.json
    tsconfig.json
```

There are multiple ways to interact with your agent:

Run the following command to launch the **dev UI**.

```shell
npx adk web
```

**Step 1:** Open the URL provided (usually `http://localhost:8000` or `http://127.0.0.1:8000`) directly in your browser.

**Step 2.** In the top-left corner of the UI, select your agent from the dropdown. The agents are listed by their filenames, so you should select "agent".

Troubleshooting

If you do not see "agent" in the dropdown menu, make sure you are running `npx adk web` in the directory containing your `agent.ts` file.

**Step 3.** Now you can chat with your agent using the textbox:

**Step 4.** By using the `Events` tab at the left, you can inspect individual function calls, responses and model responses by clicking on the actions:

On the `Events` tab, you can also click the `Trace` button to see the trace logs for each event that shows the latency of each function calls:

Run the following command to chat with your agent.

```text
npx adk run agent.ts
```

To exit, use Cmd/Ctrl+C.

`npx adk api_server` enables you to create a local Express.js server in a single command, enabling you to test local cURL requests before you deploy your agent.

To learn how to use `api_server` for testing, refer to the [documentation on testing](/adk-docs/runtime/api-server/).

Using the terminal, navigate to the parent directory of your agent project (e.g. using `cd ..`):

```console
project_folder/                <-- navigate to this directory
├── pom.xml (or build.gradle)
├── src/
├── └── main/
│       └── java/
│           └── agents/
│               └── multitool/
│                   └── MultiToolAgent.java
└── test/
```

Run the following command from the terminal to launch the Dev UI.

**DO NOT change the main class name of the Dev UI server.**

**Step 1:** Open the URL provided (usually `http://localhost:8080` or `http://127.0.0.1:8080`) directly in your browser.

**Step 2.** In the top-left corner of the UI, you can select your agent in the dropdown. Select "multi_tool_agent".

Troubleshooting

If you do not see "multi_tool_agent" in the dropdown menu, make sure you are running the `mvn` command at the location where your Java source code is located (usually `src/main/java`).

**Step 3.** Now you can chat with your agent using the textbox:

**Step 4.** You can also inspect individual function calls, responses and model responses by clicking on the actions:

Caution: ADK Web for development only

ADK Web is ***not meant for use in production deployments***. You should use ADK Web for development and debugging purposes only.

With Maven, run the `main()` method of your Java class with the following command:

terminal

```console
mvn compile exec:java -Dexec.mainClass="agents.multitool.MultiToolAgent"
```

With Gradle, the `build.gradle` or `build.gradle.kts` build file should have the following Java plugin in its `plugins` section:

```groovy
plugins {
    id('java')
    // other plugins
}
```

Then, elsewhere in the build file, at the top-level, create a new task to run the `main()` method of your agent:

```groovy
tasks.register('runAgent', JavaExec) {
    classpath = sourceSets.main.runtimeClasspath
    mainClass = 'agents.multitool.MultiToolAgent'
}
```

Finally, on the command-line, run the following command:

```console
gradle runAgent
```

### 📝 Example prompts to try

- What is the weather in New York?
- What is the time in New York?
- What is the weather in Paris?
- What is the time in Paris?

## 🎉 Congratulations!

You've successfully created and interacted with your first agent using ADK!

______________________________________________________________________

## 🛣️ Next steps

- **Go to the tutorial**: Learn how to add memory, session, state to your agent: [tutorial](https://google.github.io/adk-docs/tutorials/index.md).
- **Delve into advanced configuration:** Explore the [setup](https://google.github.io/adk-docs/get-started/installation/index.md) section for deeper dives into project structure, configuration, and other interfaces.
- **Understand Core Concepts:** Learn about [agents concepts](https://google.github.io/adk-docs/agents/index.md).
