import React, { useEffect, useRef, useState } from "react";
import css from "./Playground.module.scss";
import MicAnimation from "../../Assets/MicAnimation/MicAnimation";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import settings from "../../Assets/SVG/Setting.svg";
import Down from "../../Assets/SVG/Down.svg";

const DefaultVoices = [
  {
    name: "EVA",
  },
];

const Playground = () => {
  const [temperature, setTemperature] = useState(0.7);
  const [threshold, setThreshold] = useState(0.5);
  const [prefixPadding, setPrefixPadding] = useState(500);
  const [silenceDuration, setSilenceDuration] = useState(500);
  const [mobileView, setmobileView] = useState(false);
  const [isVoices, setisVoices] = useState(false);
  const [voices, setvoices] = useState(DefaultVoices);
  const [selectedVoice, setselectedVoice] = useState(voices[0]);

  const [ismicopen, setismicopen] = useState(false);
  const [ismic, setismic] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const sourceRef = useRef(null);
  const audioContextRef = useRef(null);
  const playing = useRef(false);
  const bufferQueue = useRef([]);
  const socket = useRef(null);
  const isgrpc = useRef(null);
  const [isgrpcs, setisgrpc] = useState(false);
  const [socketConnected, setsocketConnected] = useState(false);
  const [audioContextState, setaudioContextState] = useState(false);
  const sessionId = uuidv4();
  if (!sessionStorage.getItem("sessionId")) {
    sessionStorage.setItem("sessionId", sessionId);
  }
  const [session, setsession] = useState(sessionId);
  const [system_prompt, setsetsystemPrompt] = useState("");

  useEffect(() => {
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handlePlay = async () => {
    try {
      if (!isgrpc.current) {
        return;
      }
      playing.current = true;

      const data = bufferQueue.current.shift();
      if (data instanceof Blob) {
        let arrayBuffer = await data.arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        const metadataEndIndex = bytes.indexOf(0);
        let metadata = new TextDecoder().decode(
          bytes.slice(0, metadataEndIndex)
        );
        metadata = JSON.parse(metadata);

        const { session_id, sequence_id } = metadata;
        arrayBuffer = arrayBuffer.slice(
          metadataEndIndex + 1,
          arrayBuffer.length
        );

        try {
          if (audioContextRef.current.state === "suspended") {
            await audioContextRef.current.resume();
          }
          const audioBuffer = await audioContextRef.current.decodeAudioData(
            arrayBuffer
          );

          // Disconnect the old source if it exists
          if (sourceRef.current) {
            sourceRef.current.disconnect();
          }

          // Create a new source and set its properties
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          source.start(0); // Start the playback
          sourceRef.current = source;
          sourceRef.current.session_id = session_id;
          sourceRef.current.sequence_id = sequence_id;

          // Define what happens when the audio ends
          sourceRef.current.onended = () => {
            if (
              socket.current.readyState === WebSocket.OPEN &&
              sourceRef?.current?.sequence_id
            ) {
              socket.current.send(
                JSON.stringify({
                  type: "status",
                  msg: {
                    session_id: sourceRef?.current?.session_id,
                    sequence_id: sourceRef?.current?.sequence_id,
                  },
                })
              );
            }

            // If there are more buffers in the queue, play them
            if (bufferQueue.current.length > 0) {
              playing.current = true;
              handlePlay();
            } else {
              playing.current = false;
            }
          };
        } catch (error) {
          console.error("Error decoding audio data:", error);
          // if (bufferQueue.current.length > 0) {
          //   playing.current = true;
          //   handlePlay();
          // } else {
          //   playing.current = false;
          // }
        }
      } else {
        console.error("Received unexpected data type:", data);
      }
    } catch (error) {
      console.error("Error in handlePlay: ", error);
    }
  };

  const handlemicchange = async () => {
    if (ismicopen && sourceRef.current) {
      sourceRef.current.onended = null;
      sourceRef.current.stop();
      sourceRef.current.disconnect();
      sourceRef.current = null;
      bufferQueue.current = [];
    }
    if (!ismicopen) {
      setismicopen(true);
      socket.current.send(
        JSON.stringify({
          type: "start",
          msg: JSON.stringify({
            temperature: temperature,
            prefixPadding: prefixPadding,
            silenceDuration: silenceDuration,
            voice: selectedVoice,
            threshold: threshold,
            system_prompt: system_prompt,
            sessionId: session,
          }),
        })
      );
    } else {
      stopAudioStream();
    }
    ismic ? setismic(false) : setismic(true);
  };

  useEffect(() => {
    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    audioContextRef.current = audioContext;
    setaudioContextState(true);
    const websocketURL = `ws://localhost:8081/v2v`;
    const ws = new WebSocket(websocketURL);

    // let cansend = false;

    ws.onmessage = async (event) => {
      if (event.data instanceof Blob) {
        // let arrayBuffer = await event.data.arrayBuffer();

        // const bytes = new Uint8Array(arrayBuffer);
        // const metadataEndIndex = bytes.indexOf(0);
        // let metadata = new TextDecoder().decode(
        //   bytes.slice(0, metadataEndIndex)
        // );
        // metadata = JSON.parse(metadata);

        // const { sequence_id } = metadata;
        // if (sequence_id === "0") {
        //   bufferQueue.current = [];
        //   playing.current = false;
        //   cansend = false;

        //   if (sourceRef.current) {
        //     sourceRef.current.onended = null;
        //     sourceRef.current.stop();
        //     sourceRef.current.disconnect();
        //     sourceRef.current = null;
        //   }
        // }

        // if (sequence_id === "1") {
        //   cansend = true;
        // }
        // if (sequence_id !== "0" && cansend) {
        bufferQueue.current.push(event.data);
        // }
        if (!playing.current && bufferQueue.current.length > 0) {
          await handlePlay();
        }
      } else {
        const data = JSON.parse(event.data);

        const { type, msg } = data;

        switch (type) {
          case "initial":
            socket.current = ws;
            setsocketConnected(true);
            break;
          case "info":
            toast.error(msg);
            break;
          case "grpcConnection":
            isgrpc.current = true;
            setisgrpc(true);
            await startAudioStream();
            break;
          case "clear":
            bufferQueue.current = [];
            playing.current = false;

            if (sourceRef.current) {
              sourceRef.current.onended = null;
              sourceRef.current.stop();
              sourceRef.current.disconnect();
              sourceRef.current = null;
            }
            break;
          case "end":
            try {
              audioContext
                .close()
                .then(() => {
                  setaudioContextState(false);
                  if (ismicopen) {
                    toast.error("Please restart the conversation.");
                  }
                })
                .catch((err) => {
                  if (ismicopen) {
                    toast.error("Please restart the conversation.");
                  }
                });
              await stopAudioStream();
              setismicopen(false);
            } catch (error) {
              console.log("Error in closing audioContext.");
            }
            break;
          default:
            break;
        }
      }
    };

    ws.onclose = async () => {
      try {
        await audioStream.getTracks().forEach((track) => track.stop());
        setAudioStream(null);
      } catch (err) {
        console.log(err);
      }
    };

    ws.onerror = (err) => {
      console.log("Websocket Error", err);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  function floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const sample = Math.max(-1, Math.min(1, input[i]));
      output[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }
    return output.buffer;
  }

  const startAudioStream = async () => {
    try {
      if (!socket.current) {
        toast.error("Please try again.. Socket");
        return;
      }
      audioContextRef.current = new (window.AudioContext ||
        window.webkitAudioContext)();
      setismicopen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setAudioStream(stream);

      const audioContext = new AudioContext({
        sampleRate: 8000,
      });

      setAudioContext(audioContext);
      const audioInput = audioContext.createMediaStreamSource(stream);
      const bufferSize = 256;
      const scriptProcessorNode = audioContext.createScriptProcessor(
        bufferSize,
        1,
        1
      );

      scriptProcessorNode.onaudioprocess = async (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const l16Data = floatTo16BitPCM(inputData);
        try {
          if (!isgrpc.current) {
            try {
              if (audioContextState) {
                audioContext
                  .close()
                  .then(() => {
                    setaudioContextState(false);
                    toast.error("Please restart the conversation.");
                  })
                  .catch((err) => {
                    toast.error("Please restart the conversation.");
                    console.log(err);
                  });
                await stopAudioStream();
                toast.error("Please start again.");
                setismicopen(false);
              }
            } catch (error) {
              console.log("Error in closing audioContext.");
            }
          }
          if (isgrpc.current) {
            // if (socket.current.grpc) {
            socket.current.send(l16Data);
          }
        } catch (err) {
          console.error("Error in sending buffer.");
        }
      };

      audioInput.connect(scriptProcessorNode);
      scriptProcessorNode.connect(audioContext.destination);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const stopAudioStream = async () => {
    setismicopen(false);
    if (
      socket.current &&
      audioStream &&
      socket.current.readyState === WebSocket.OPEN
    ) {
      try {
        if (audioStream) {
          await audioStream.getTracks().forEach((track) => track.stop());
          setAudioStream(null);
        }
      } catch (err) {
        console.log(err);
      }
      try {
        if (socket.current.readyState === WebSocket.OPEN) {
          isgrpc.current = false;
          socket.current.send(JSON.stringify({ type: "stop", msg: "stop" }));
        }
        audioContext.close().catch((err) => {
          console.log("Error in closing the audioContext.", err);
        });
      } catch (err) {
        console.log("Error in closing the audioContext.");
      }
    }
  };

  return (
    <div className={css.main}>
      <div className={css.container}>
        <div className={css.header}>
          <div className={css.nav}>
            <h3>Realtime</h3>
            <img
              src={settings}
              onClick={() => {
                setmobileView((prv) => !prv);
              }}
              alt=""
              srcset=""
            />
          </div>

          <div className={css.realtime}>
            <div className={css.conversation}>
              <div className={`${css.speakNow}`}>
                {socketConnected ? (
                  <div className={`${css.mic_border}`}>
                    <MicAnimation
                      micopen={ismicopen}
                      setmicopen={handlemicchange}
                      socket={socketConnected}
                      grpc={isgrpcs}
                    />
                  </div>
                ) : (
                  <div>Connecting...</div>
                )}
                <div className={css.startSession}>
                  <button
                    onClick={() => {
                      sessionStorage.removeItem("sessionId");
                      sessionStorage.setItem("sessionId", sessionId);
                      setsession(sessionStorage.getItem("sessionId"));
                      toast.success("New Session Started.");
                    }}
                  >
                    Start New Session
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className={!mobileView ? css.controls : css.controlsMobile}>
          <div className={css.contolsMobile}>
            <h4 className={css.heading}>System Instructions</h4>
            {mobileView && (
              <img
                src={settings}
                className={css.setting}
                onClick={() => {
                  setmobileView((prv) => !prv);
                }}
                alt=""
                srcset=""
              />
            )}
          </div>
          <textarea
            placeholder="You are a friendly AI assistant."
            value={system_prompt}
            onChange={(e) => {
              setsetsystemPrompt(e.target.value);
            }}
          ></textarea>

          <h4>Voice</h4>
          <div name="voice" id="" className={css.voices}>
            <div
              onClick={() => {
                setisVoices((prv) => !prv);
              }}
            >
              {selectedVoice.name}{" "}
              <span>
                <img src={Down} alt="" />
              </span>
            </div>
            {isVoices && (
              <>
                <div className={`${css.voicesOptions}`}>
                  <ul>
                    {voices.map((item, index) => {
                      return (
                        <li
                          key={index}
                          className={`${
                            selectedVoice === item ? css.selected : null
                          }`}
                        >
                          <div
                            onClick={() => {
                              setisVoices((prv) => !prv);
                              setselectedVoice(item);
                            }}
                          >
                            {item.name}
                          </div>{" "}
                        </li>
                      );
                    })}
                  </ul>
                  <footer>more audios coming soon</footer>
                </div>
              </>
            )}
          </div>

          <div className={css.sliderGroup}>
            <div className={css.sliderinfo}>
              <label htmlFor="threshold">Threshold</label>
              <span className={css.parameters}>{threshold}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
            />
          </div>

          <div className={css.sliderGroup}>
            <div className={css.sliderinfo}>
              <label htmlFor="silenceDuration">Silence duration</label>
              <span>{silenceDuration} ms</span>
            </div>
            <input
              type="range"
              min="10"
              max="1000"
              step="10"
              value={silenceDuration}
              onChange={(e) => setSilenceDuration(parseInt(e.target.value))}
            />
          </div>

          <h4>Model configuration</h4>
          <div className={css.sliderGroup}>
            <div className={css.sliderinfo}>
              <label htmlFor="temperature">Temperature</label>
              <span>{temperature}</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Playground;
