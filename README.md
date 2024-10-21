# Speakr Integration Guide

This guide will walk you through integrating and running the Speakr service on your local machine.

### Prerequisites

Before getting started, ensure that you have the following:

- Node.js (version 14.x or higher)
- npm (version 6.x or higher)
- A Speakr API Key (visit Speakr to obtain it)

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
Note: The provided client is meant to serve as a reference for developers to understand how to establish a connection with Speakr using React.js. It is not mandatory to use this client you can create your own implementation or integrate Speakr directly into your server-side code.

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
cd client
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

To communicate with the Speakr service, the developer must adhere to certain WebSocket protocols and event handling.

### What you have to provide

#### Starting the Connection

To initialize the Speakr connection and start streaming the audio buffer, follow these steps:

- Send the Start Message: The client must first send a message to initiate the connection, passing necessary parameters such as temperature, prefixPadding, silenceDuration, threshold, and a system_prompt. You can structure the message like this:

```json
{
  "type": "start",
  "msg": JSON.stringify({
    "temperature": <number>,
    "prefixPadding": <string>,
    "silenceDuration": <number>,
    "threshold": <number>,
    "system_prompt": <string>,
    "sessionId": <string>
  })
}
```

#### Send Audio Buffer

After sending the "start" message, the client needs to stream the audio buffer to the server. The audio buffer should be sent as binary data, and the server will process it. You can use the following code to send the buffer:

```jsvascript
  socket.send(audioBuffer);
```

#### Sending Status Updates

While sending the audio buffer status (i.e., session and sequence details), send the following message:

```json
{
  "type": "status",
  "msg": {
    "session_id": "<session_id>",
    "sequence_id": "<sequence_id>"
  }
}
```

#### End the Connection

Close the connection

```json
{
  "type": "stop",
  "msg": "stop"
}
```

### What you will get

### Make the connection

```javascript
const socket = new WebSocket(
  `wss://api.speakr.online/v2v?api_key=${api_key}`
);
```

#### Connection Established

Upon a successful connection, the server will send:

```json
{
  "type": "initial",
  "msg": "connected"
}
```

#### Ready State

Once the connection is fully ready after sending the start message and all the required paramaters, you will receive:

```json
{
  "type": "ready",
  "msg": "connected"
}
```

#### Audio Buffer

When an audio buffer is received from Speakr, you can verify the message using the Buffer module:

```javascript
Buffer.isBuffer(socketMessage);
```

#### API Key Information

In case of invalid API key or balance issues, Speakr will send an information message:

```json
{
  "type": "info",
  "msg": "error_message"
}
```

#### Interruption Event

You may receive an event to indicate an interruption:

```json
{
  "type": "clear",
  "msg": "clear"
}
```

#### Connection Closed

When the connection is terminated, you will receive:

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
