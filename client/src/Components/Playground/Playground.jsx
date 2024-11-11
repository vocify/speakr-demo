import React, { useEffect, useRef, useState } from "react";
import css from "./Playground.module.scss";
import toast from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import settings from "../../Assets/SVG/Setting.svg";
import Down from "../../Assets/SVG/Down.svg";
import { GiBroom } from "react-icons/gi";
import { BsInfoCircle } from "react-icons/bs";
import { RiAiGenerate } from "react-icons/ri";

const voices = [
  {
    name: "JILL",
    value: "jill",
  },
  {
    name: "JACK",
    value: "jack",
  },
];

const Playground = () => {
  const [temperature, setTemperature] = useState(0.7);
  const [threshold, setThreshold] = useState(0.5);
  const [silenceDuration, setSilenceDuration] = useState(100);
  const [mobileView, setmobileView] = useState(false);
  const [generating, setgenerating] = useState(false);
  const [isVoices, setisVoices] = useState(false);
  const [selectedVoice, setselectedVoice] = useState(voices[0]);
  const [ismicopen, setismicopen] = useState(false); //false
  const [ismic, setismic] = useState(false);
  const [audioStream, setAudioStream] = useState(null);
  const [audioContext, setAudioContext] = useState(null);
  const sourceRef = useRef(null);
  const audioContextRef = useRef(null);
  const playing = useRef(false);
  const [isplaying, setisplaying] = useState(false);
  const lastshifted = useRef(null);
  const bufferQueue = useRef([]);
  const socket = useRef(null);
  const isgrpc = useRef(null);
  const [isgrpcs, setisgrpc] = useState(false); //false
  const [socketConnected, setsocketConnected] = useState(false);
  const [audioContextState, setaudioContextState] = useState(false);
  if (!sessionStorage.getItem("sessionId")) {
    const sessionId = uuidv4();
    sessionStorage.setItem("sessionId", sessionId);
  }
  const [session, setsession] = useState(sessionStorage.getItem("sessionId"));
  const [system_prompt, setsetsystemPrompt] = useState("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [interval, setinterval] = useState(null);

  const [chathistory, setchathistory] = useState([]);
  const msgref = useRef(null);

  useEffect(() => {
    if (chathistory) {
      msgref?.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [chathistory]);

  const handlePlay = async () => {
    try {
      if (!isgrpc.current) {
        return;
      }
      playing.current = true;
      setisplaying(true);

      const base64Data = bufferQueue.current.shift(); // Get the Base64 encoded string
      lastshifted.current = base64Data;

      // Decode the Base64 string into binary data
      // Decode the Base64 to a Uint8Array
      const bytes = new Uint8Array(
        atob(base64Data)
          .split("")
          .map((char) => char.charCodeAt(0))
      );

      // Convert Uint8Array to ArrayBuffer
      let arrayBuffer = bytes.buffer;

      const metadataEndIndex = bytes.indexOf(0); // Find null byte separating name from audio data
      let metadata = new TextDecoder().decode(bytes.slice(0, metadataEndIndex));
      metadata = JSON.parse(metadata);

      const { session_id, sequence_id, transcript } = metadata;

      arrayBuffer = arrayBuffer.slice(metadataEndIndex + 1, arrayBuffer.length);

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
        sourceRef.current.transcript = transcript;

        // Define what happens when the audio ends
        sourceRef.current.onended = () => {
          lastshifted.current = null;
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
                  transcript: sourceRef?.current?.transcript,
                },
              })
            );
          }

          // If there are more buffers in the queue, play them
          if (bufferQueue.current.length > 0) {
            playing.current = true;
            setisplaying(true);
            handlePlay();
          } else {
            playing.current = false;
            setisplaying(false);
          }
        };
      } catch (error) {
        // console.error("Error decoding audio data:", error);
      }
    } catch (error) {
      // console.error("Error in handlePlay: ", error);
    }
  };

  const handlemicchange = async () => {
    if (ismicopen && sourceRef.current) {
      sourceRef.current.onended = null; // Prevent onended from being called again
      sourceRef.current.stop(); // Stop the currently playing buffer
      sourceRef.current.disconnect(); // Disconnect from the audio context
      sourceRef.current = null; // Clear the reference
      bufferQueue.current = [];
    }
    if (!ismicopen) {
      // await startAudioStream();
      setismicopen(true);
      socket.current.send(
        JSON.stringify({
          type: "start",
          msg: JSON.stringify({
            temperature: temperature,
            silenceDuration: silenceDuration,
            voice: selectedVoice?.value,
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
    ws.onopen = () => {
      // console.log("WebSocket connected");
      // socket.current = ws;
      // setsocketConnected(true);
      // toast.success("Now You can speak...");
    };

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);

        const { type, msg } = data;

        switch (type) {
          case "initial":
            socket.current = ws;
            setsocketConnected(true);
            break;
          case "media":
            const bytes = new Uint8Array(
              atob(msg)
                .split("")
                .map((char) => char.charCodeAt(0))
            );

            const metadataEndIndex = bytes.indexOf(0); // Find null byte separating name from audio data
            let metadata = new TextDecoder().decode(
              bytes.slice(0, metadataEndIndex)
            );
            metadata = JSON.parse(metadata);

            const { sequence_id } = metadata;

            if (sequence_id !== "-2") {
              bufferQueue.current.push(msg);
            }

            // Start playing if not currently playing
            if (!playing.current && bufferQueue.current.length > 0) {
              await handlePlay();
            }
            break;
          case "info":
            toast.error(msg);
            break;
          case "ready":
            isgrpc.current = true;
            setisgrpc(true);
            await startAudioStream();
            break;
          case "pause":
            if (sourceRef.current) {
              sourceRef.current.onended = null; // Prevent onended from being called again
              sourceRef.current.stop(); // Stop the currently playing buffer
              sourceRef.current.disconnect(); // Disconnect from the audio context
              sourceRef.current = null; // Clear the reference
            }
            playing.current = false;
            setgenerating(true);
            setisplaying(false);
            break;
          case "continue":
            if (lastshifted.current) {
              bufferQueue.current.unshift(lastshifted.current);
              lastshifted.current = null;
            }
            setgenerating(false);
            handlePlay();
            break;
          case "clear":
            bufferQueue.current = [];
            playing.current = false;
            setgenerating(false);
            setisplaying(false);

            if (sourceRef.current) {
              sourceRef.current.onended = null; // Prevent onended from being called again
              sourceRef.current.stop(); // Stop the currently playing buffer
              sourceRef.current.disconnect(); // Disconnect from the audio context
              sourceRef.current = null; // Clear the reference
            }
            break;
          case "end":
            try {
              // if (audioContextState) {
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
                  // console.error(err);
                });
              await stopAudioStream();
              setismicopen(false);
              // }
            } catch (error) {
              // console.error("Error in closing audioContext.");
            }
            break;
          case "chathistory":
            setchathistory(msg);
            break;
          default:
            break;
        }
      } catch (error) {
        // console.error("Error in websocket media.");
      }
    };

    ws.onclose = async () => {
      try {
        await audioStream.getTracks().forEach((track) => track.stop());
        setAudioStream(null);
        setElapsedTime(0);
      } catch (err) {
        // console.error(err);
      }
    };

    ws.onerror = (err) => {
      // console.error("Websocket Error", err);
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
      if (!socket.current || socket.current.readyState !== WebSocket.OPEN) {
        toast.error("Please reload the page.");
      }
      const startTime = Date.now();
      setchathistory([]);
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime); // Update elapsed time
      }, 1000);
      setinterval(interval);
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
                    // console.error(err);
                  });
                await stopAudioStream();
                toast.error("Please start again.");
                setismicopen(false);
              }
            } catch (error) {
              // console.error("Error in closing audioContext.");
            }
          }
          if (isgrpc.current) {
            // if (socket.current.grpc) {
            socket.current.send(l16Data);
          }
        } catch (err) {
          // console.error("Error in sending buffer.");
        }
      };

      audioInput.connect(scriptProcessorNode);
      scriptProcessorNode.connect(audioContext.destination);
    } catch (error) {
      // console.error("Error accessing microphone:", error);
    }
  };

  const stopAudioStream = async () => {
    setgenerating(false);
    setismicopen(false);
    setElapsedTime(0);
    if (interval) {
      clearInterval(interval);
    }
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
        // console.error(err);
      }
      try {
        if (socket.current.readyState === WebSocket.OPEN) {
          isgrpc.current = false;
          socket.current.send(JSON.stringify({ type: "stop", msg: "stop" }));
        }
        audioContext
          .close()
          .then(() => {
            // console.log("AudioContext closed.");
          })
          .catch((err) => {
            // console.error("Error in closing the audioContext.", err);
          });
      } catch (err) {
        // console.error("Error in closing the audioContext.");
      }
    }
  };
  const getButtonText = () => {
    if (!ismicopen) {
      return "Start";
    }
    if (ismicopen && !isgrpcs) {
      return "Starting";
    }
    if (isgrpcs) {
      return "Stop";
    }
    return ""; // Fallback, although this case shouldn't occur with given logic
  };

  const formatTime = (milliseconds) => {
    let totalSeconds = Math.floor(milliseconds / 1000);
    let hours = Math.floor(totalSeconds / 3600);
    let minutes = Math.floor((totalSeconds % 3600) / 60);
    let seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
      2,
      "0"
    )}:${String(seconds).padStart(2, "0")}`;
  };

  return (
    <div className={css.main}>
      <div className={css.container}>
        {/* Realtime Conversation Section */}
        <div className={css.header}>
          <div className={css.nav}>
            {/* <img src={clear} alt="" srcset="" />
          <div className={css.toolkit}>clear</div> */}
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
            <div className={`${css.clarbtn} ${!mobileView && css.marginclear}`}>
              <button
                onClick={() => {
                  sessionStorage.removeItem("sessionId");
                  const sessionId = uuidv4();
                  setchathistory([]);
                  sessionStorage.setItem("sessionId", sessionId);
                  setsession(sessionStorage.getItem("sessionId"));
                  toast.success("New Session Started.");
                }}
              >
                <GiBroom className={css.broom} />
                clear
              </button>
            </div>
            <div className={css.conversation}>
              {chathistory.length > 0 &&
                chathistory.map((item, index) => {
                  return (
                    <>
                      <div className={css.message} key={index}>
                        <div className={css.msg}>
                          <div className={css.speaker}>{item.speaker}</div>
                          <div>{item.content}</div>
                        </div>
                      </div>
                      <div ref={msgref}></div>
                    </>
                  );
                })}
            </div>
            <div className={`${css.speakNow}`}>
              {socketConnected ? (
                <div>
                  <div className={`${css.startstop}`}>
                    <div className={`${css.totaltime}`}>
                      {!ismicopen ? "00:00:00" : formatTime(elapsedTime)}
                    </div>
                    <div
                      className={`${css.generateIcon} ${
                        generating && css.generating
                      } ${!generating && css.notgeneerating}`}
                    >
                      <RiAiGenerate />
                    </div>
                    <button onClick={handlemicchange}>{getButtonText()}</button>
                  </div>
                </div>
              ) : (
                <div>Connecting...</div>
              )}
            </div>
          </div>
        </div>

        {/* Controls Section */}
        <div className={!mobileView ? css.controls : css.controlsMobile}>
          <div className={css.contolsMobile}>
            <h4 className={css.heading}>
              System Instructions{" "}
              <span className={css.parametersInfo}>
                <BsInfoCircle className={css.infoicon} />
                <div className={css.parainfoContent}>
                  Override the default instructions that shape the model's
                  behavior.
                </div>
              </span>
            </h4>
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
              <label htmlFor="threshold">
                Threshold{" "}
                <span className={css.parametersInfo}>
                  <BsInfoCircle className={css.infoicon} />
                  <div className={css.parainfoContent}>
                    Voice activity detection threshold. Lower values are more
                    sensitive.
                  </div>
                </span>
              </label>

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
              <label htmlFor="silenceDuration">
                Silence duration{" "}
                <span className={css.parametersInfo}>
                  <BsInfoCircle className={css.infoicon} />
                  <div className={css.parainfoContent}>
                    Duration of silence before the AI considers speaking to have
                    ended.
                  </div>
                </span>
              </label>
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
              <label htmlFor="temperature">
                Temperature{" "}
                <span className={css.parametersInfo}>
                  <BsInfoCircle className={css.infoicon} />
                  <div className={css.parainfoContent}>
                    Controls randomness: Lowering results in less random
                    completions. As the temperature approaches zero, the model
                    will become deterministic and repetitive.
                  </div>
                </span>
              </label>
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
