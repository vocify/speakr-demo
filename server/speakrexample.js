const WebSocket = require("ws");
const { Buffer } = require("buffer");
const { TextDecoder } = require("util");
const { api_key } = require("./config");
const audio_stream = (wss) => {
  try {
    if (!api_key || api_key.length < 67) {
      wss.send(
        JSON.stringify({
          type: "info",
          msg: "Check for the SPEAKR_APIKEY in config.env",
        })
      );
      wss.close();
      return;
    }
    // Make websocket connection with speakr
    const socket = new WebSocket(
      `wss://api.speakr.online/v2v?api_key=${api_key}`
    );

    // Events from the client

    /* 
1. The client must send the audio buffer to the server.
2. The client must send a "start" message to initiate the service with the required parameters.
3. The client must send the status of the played audio buffer back to the server for managing chat history.
4. The client must send an "end" message to close the connection.
*/

    wss.on("message", async (message) => {
      try {
        if (Buffer.isBuffer(message)) {
          socket.send(message);
        } else {
          const data = JSON.parse(message);

          const { type, msg } = data;

          console.log({ type, msg });

          switch (type) {
            case "start": // It is for starting the buffer and it should have the metadata
              // Parameters you have to send to the server
              const {
                temperature,
                prefixPadding,
                silenceDuration,
                threshold,
                system_prompt,
                sessionId,
              } = JSON.parse(msg);

              const config = JSON.stringify({
                temperature: temperature,
                prefixPadding: prefixPadding,
                silenceDuration: silenceDuration,
                threshold: threshold,
                system_prompt: system_prompt,
                sessionId: sessionId,
              });
              socket.send(JSON.stringify({ type: "start", msg: config }));
              break;
            case "status": // It should have session_id and sequence_id
              socket.send(JSON.stringify({ type: "status", msg: msg }));
              break;
            case "stop": // It is for stoping the buffer
              console.log("Client Stoped the stream.");
              socket.send(JSON.stringify({ type: "stop", msg: "stop" }));
              break;
            default:
              break;
          }
        }
      } catch (error) {
        console.error(`Eror in frontend socket : ${error}`);
      }
    });

    // Events from the server

    /* 
1. You will receive a message of type "initial" with the msg "initial" when the WebSocket is connected.
2. You will receive a message of type "grpcConnection" with the msg "connected" when the WebSocket connection is fully established.
3. You will receive an audio buffer that you can verify using the Buffer.isBuffer.
4. You will receive a message of type "info" containing important information, such as invalid API keys or insufficient credits.
5. You will receive a message of type "end" with the msg "end" when the connection is closed.
*/

    socket.on("message", async (message) => {
      try {
        if (Buffer.isBuffer(message)) {
          const bytes = new Uint8Array(message);
          const metadataEndIndex = bytes.indexOf(0);
          const metadataString = new TextDecoder().decode(
            bytes.slice(0, metadataEndIndex)
          );
          const { session_id, sequence_id } = JSON.parse(metadataString);

          const bufferWithoutMetadata = message.slice(metadataEndIndex + 1);
          if (bufferWithoutMetadata.length <= 0) return;

          // Depending on your logic, you can choose whether to handle the status part on the server side or client side.

          // Option 1: Send buffer with metadata (session_id, sequence_id) to handle tracking on the server
          wss.send(messageWithMetadata);

          // Option 2: Send buffer without metadata if tracking or status handling is managed by the client
          // wss.send(bufferWithoutMetadata);
        } else if (typeof message === "string") {
          const { type, msg } = JSON.parse(message);

          switch (type) {
            case "initial":
              // connected
              wss.send(JSON.stringify({ type: "initial", msg: "connected" }));
              break;
            case "info":
              // Invalid API Key
              // API key required
              // Not sufficient balance
              wss.send(JSON.stringify({ type: "info", msg: msg }));
              break;
            case "clear":
              wss.send(JSON.stringify({ type: "clear", msg: "clear" }));
              break;
            case "end":
              wss.send(JSON.stringify({ type: "end", msg: "end" }));
              break;
            case "grpcConnection":
              wss.send(
                JSON.stringify({ type: "grpcConnection", msg: "connected" })
              );
              break;
            default:
              break;
          }
        }
      } catch (error) {
        console.error(`Error in onmessage : ${error}`);
      }
    });

    socket.on("error", (error) => {
      console.error(`speakr WebSocket error: ${error}`);
    });

    socket.on("close", () => {
      console.log("Disconnected from the speakr server.");
    });

    wss.on("error", (error) => {
      console.error(`Client WebSocket error: ${error}`);
    });

    wss.on("close", () => {
      console.log("Disconnected from the client server.");
    });
  } catch (error) {
    console.error(`Error in the speakrexample. ${error}`);
  }
};

module.exports = { audio_stream };
