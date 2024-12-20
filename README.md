# Speakr Integration Guide

This guide will walk you through integrating and running the Speakr service on your local machine.

### Prerequisites

Before getting started, ensure that you have the following:

- Node.js (version 14.x or higher)
- npm (version 6.x or higher)
- A Speakr API Key (visit Speakr to obtain it)

### For a comprehensive guide on integrating Twilio with Speakr, refer to the [Twilio Integration repository](https://github.com/vocify/twilio-integration).

### Getting Started

#### Step 1: Add Your API Key

- Visit the Speakr Playground to get your API key.
- Create or update the config.env file in the server directory with the following content:

```bash
SPEAKR_APIKEY = your_api_key_here
```

Ensure the API key is valid and complete.

#### Step 2: Install Dependencies & Start the Application

You need to set up both the client and server for the Speakr service to function correctly.

#### Client Setup

- Navigate to the client directory:
- Note: The provided client is meant to serve as a reference for developers to understand how to establish a connection with Speakr using React.js. It is not mandatory to use this client you can create your own implementation or integrate Speakr directly into your server-side code.

```bash
cd client
```

- Install dependencies:

```bash
npm install
```

- Start the client:

```bash
npm start
```

#### Server Setup

- Navigate to the server directory:

```bash
cd server
```

- Install dependencies:

```bash
npm install
```

- Start the server:

```bash
npm start
```

## Speakr WebSocket Protocol

To initialize the Speakr connection and start streaming the audio buffer, follow these steps:

To communicate with the Speakr service, the developer must adhere to certain WebSocket protocols and event handling.

### Make the connection

```javascript
const WebSocket = require("ws");
const socket = new WebSocket(`wss://api.speakr.online/v2v?api_key=${api_key}`);
```

Upon a successful connection, the server will send :

```json
{
  "type": "initial",
  "msg": "connected"
}
```

### Sending the Start Message:

- To initiate the connection, the client must send a message with the required parameters: `temperature`, `voice`, `silenceDuration`, `threshold`, and a `system_prompt`. Below is the structured format for the message:

#### Parameters:

- **temperature**: Range 0 to 1 (ideal: 0.7)
- **voice**: Options are either `"jill"` or `"jack"`
- **silenceDuration**: Range 10ms to 1000ms (ideal: 100ms)
- **threshold**: Range 0 to 1 (ideal: 0.5)
- **system_prompt**: Provide the system prompt as a string
- **sessionId**: A unique session identifier as a string

#### Example JSON Structure:

```json
{
  "type": "start",
  "msg": JSON.stringify({
    "temperature": <number>,           // Example: 0.7
    "voice": <string>,                 // Example: "jill"
    "voice_provider": "speakr_eng_v1",         // Keep this value constant
    "silenceDuration": <number>,       // Example: 100
    "threshold": <number>,             // Example: 0.5
    "system_prompt": <string>,         // Yor are a friendly AI assistant
    "sessionId": <string>              // Example: "12345"
  })
}
```

- Once the connection is initialized after receiving the start message and setting up all the required paramaters, you will receive:

```json
{
  "type": "ready",
  "msg": "connected"
}
```

#### Send Audio Buffer to speakr

- After sending the "start" message, the client needs to stream the audio buffer to the server as binary data, which the server will process.
- The audio buffer should be encoded in Linear16 format with a sample rate of 8000 Hz and a buffer size of 512 bytes.

```javascript
// Audio encoding: Linear16 (16-bit linear PCM)
// Sample rate: 8000 Hz
// Buffer size: 512 bytes
socket.send(audioBuffer);
```

#### Sending Status Updates to speakr

- You must include the sequence_id of the buffer that was played and the session_id corresponding to the session from which the buffer was received.
- When sending the audio buffer along with status information (i.e., session and sequence details), use the following message format:

```json
{
  "type": "status",
  "msg": {
    "session_id": "<session_id>",
    "sequence_id": "<sequence_id>"
  }
}
```

#### Send this message to the speakr for ending the connection

Close the connection

```json
{
  "type": "stop",
  "msg": "stop"
}
```

#### API Key Information received from speakr

### `info` Event

In case of invalid API key or balance issues, Speakr will send an information message:

```json
{
  "type": "info",
  "msg": "error_message"
}
```

### `pause` Event

This event occurs when the user interrupts the conversation. However, it might not always indicate an intentional interruption. You can clear the buffer sent to Twilio but handle it with caution.

```json
{
  "type": "pause",
  "msg": "pause"
}
```

### `continue` Event

If the interruption is not significant, replay the previous response's buffer from where the interruption occurred.

```json
{
  "type": "continue",
  "msg": "continue"
}
```

### `media` Event

- Buffer is encode with base64
- You will receive the session_id and sequence_id and transcript of the buffer encoded in the buffer

#### Code if you want to send the buffer with the session_id and sequence_id :

- If you implement the code of detecting which buffer is played on the client side then you can send the buffer with the metadata and can decode it in the client side.
- You can take help from the client provided in the repo.

```javascript
const message = Buffer.from(msg, "base64");
const base64buffer = message.toString("base64");
wss.send(JSON.stringify({ type: "media", msg: base64buffer }));
```

#### If you want to send the buffer without the session_id and sequence_id :

- If you implement the code of detecting which buffer is played on the server side(if you are working with Twilio like providers) then you can send the buffer without the metadata and can use Twilio mark functionality for detecting which buffer is played on the client device.
- When you the get played session_id and sequence_id you can send them to speakr using the status event.
- If you require a transcript for any feature, it will be available in the metadata under 'transcript'. If the `sequence_id` is -2, it indicates the user's transcript, whereas if the `sequence_id` is between 1 and infinity, it corresponds to the AI's transcript.

```javascript
const message = Buffer.from(msg, "base64");
const metadataEndIndex = message.indexOf(0);
const metadataString = message.slice(0, metadataEndIndex).toString("utf-8");
const bufferWithoutMetadata = message.slice(metadataEndIndex + 1);

const { session_id, sequence_id, transcript } = JSON.parse(metadataString);
console.log(session_id, sequence_id, transcript);

if (sequence_id === "-2") {
  // Transcript for User
  console.log("User : ", transcript);
} else if (
  sequence_id !== "0" &&
  sequence_id !== "-1"
) {
  // Transcript for AI
  console.log("AI : ", transcript);
}

const base64buffer = bufferWithoutMetadata.toString("base64");
wss.send(JSON.stringify({ type: "media", msg: base64buffer }));
```

#### Interruption Event received from speakr

You will receive a clear event when there is an interruption. Upon receiving this message, you can clear the previously sent buffer and begin playing the upcoming buffers :

```json
{
  "type": "clear",
  "msg": "clear"
}
```

#### After the Connection is Closed successfully speakr will send this event

- When the connection is terminated, you will receive:
- Later on you will receive the credits used for this connection in the msg

```json
{
  "type": "end",
  "msg": "end"
}
```

#### Troubleshooting

- Invalid API Key: Ensure that the API key in your config.env file is correct and has sufficient balance.
- Connection Issues: Check the server logs for detailed error messages or WebSocket connection errors.
- Buffer Issues: Verify the incoming buffer with Buffer.isBuffer() to confirm correct data format.

For further assistance, please consult the Speakr documentation or reach out to support.
