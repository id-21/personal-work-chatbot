This documentation provides a guide on using the **Cloud Speech-to-Text API** to transcribe streaming audio in real-time. Streaming recognition is available via **gRPC** only.

---

## 🎙️ Overview: Streaming Speech Recognition

*Streaming speech recognition* allows you to send audio to the Cloud Speech-to-Text API and receive transcription results in real-time as the audio is processed.

> **Note:** To stop listening after a single word (e.g., for voice commands), set the `single_utterance` field to `true` in the `StreamingRecognitionConfig` object.

---

## 🛠️ Methods of Implementation

### 1. Perform Streaming Recognition on a Local File

While synchronous or asynchronous recognition is usually recommended for files, you can stream a local file to the API.

**Constraints:**

* **Limit:** 10 MB maximum for the initial request and individual messages.
* **Encoding:** 16-bit signed little-endian (LINEAR16).
* **Sample Rate:** 16000 Hz.

#### **Example (Node.js)**

```javascript
const fs = require('fs');
const speech = require('@google-cloud/speech');
const client = new speech.SpeechClient();

const request = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'en-US',
  },
  interimResults: false,
};

const recognizeStream = client
  .streamingRecognize(request)
  .on('error', console.error)
  .on('data', data => {
    console.log(`Transcription: ${data.results[0].alternatives[0].transcript}`);
  });

fs.createReadStream('./path/to/audio.raw').pipe(recognizeStream);

```

---

### 2. Perform Streaming Recognition on a Live Microphone Stream

This method transcribes real-time audio received directly from a microphone.

#### **Requirements for Node.js:**

You must install **SoX** and ensure it is in your `$PATH`.

* **macOS:** `brew install sox`
* **Linux:** `sudo apt-get install sox libsox-fmt-all`
* **Windows:** Download the binaries from SourceForge.

#### **Example (Python)**

```python
from google.cloud import speech
import pyaudio

# Audio recording parameters
RATE = 16000
CHUNK = int(RATE / 10)  # 100ms

client = speech.SpeechClient()
config = speech.RecognitionConfig(
    encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
    sample_rate_hertz=RATE,
    language_code="en-US",
)
streaming_config = speech.StreamingRecognitionConfig(config=config, interim_results=True)

# Define a generator to yield audio chunks from the mic
# (Requires custom MicrophoneStream class implementation)
with MicrophoneStream(RATE, CHUNK) as stream:
    audio_generator = stream.generator()
    requests = (speech.StreamingRecognizeRequest(audio_content=content) for content in audio_generator)
    responses = client.streaming_recognize(streaming_config, requests)
    
    # Process transcription responses
    listen_print_loop(responses)

```

---

### 3. Endless Streaming

Standard streaming requests have a time limit (typically 60–305 seconds depending on the version). For "endless" streaming, you must implement logic to:

1. **Track the time** of the current stream.
2. **Close and restart** the stream before the limit is reached.
3. **Handle bridging** by resending a small portion of the last audio chunk to ensure no words are cut off during the restart.

---

## 🚀 Next Steps

* **Authentication:** Set up Application Default Credentials (ADC) to interact with the API.
* **Accuracy:** Learn how to use *Speech Adaptation* to improve the recognition of specific words or phrases.
* **Migration:** If you are a new user, Google recommends using the **V2 API**.

Would you like me to help you write a specific script in **Python**, **Java**, or **Go** for your wallpaper mural project's voice control?

```javascript
const recorder = require('node-record-lpcm16');

// Imports the Google Cloud client library
const speech = require('@google-cloud/speech');

// Creates a client
const client = new speech.SpeechClient();

/**
 * TODO(developer): Uncomment the following lines before running the sample.
 */
// const encoding = 'Encoding of the audio file, e.g. LINEAR16';
// const sampleRateHertz = 16000;
// const languageCode = 'BCP-47 language code, e.g. en-US';

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
  },
  interimResults: false, // If you want interim results, set this to true
};

// Create a recognize stream
const recognizeStream = client
  .streamingRecognize(request)
  .on('error', console.error)
  .on('data', data =>
    process.stdout.write(
      data.results[0] && data.results[0].alternatives[0]
        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
        : '\n\nReached transcription time limit, press Ctrl+C\n'
    )
  );

// Start recording and send the microphone input to the Speech API.
// Ensure SoX is installed, see https://www.npmjs.com/package/node-record-lpcm16#dependencies
recorder
  .record({
    sampleRateHertz: sampleRateHertz,
    threshold: 0,
    // Other options, see https://www.npmjs.com/package/node-record-lpcm16#options
    verbose: false,
    recordProgram: 'rec', // Try also "arecord" or "sox"
    silence: '10.0',
  })
  .stream()
  .on('error', console.error)
  .pipe(recognizeStream);

console.log('Listening, press Ctrl+C to stop.');
```