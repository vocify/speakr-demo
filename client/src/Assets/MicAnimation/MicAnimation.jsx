import React from "react";
import css from "./MicAnimation.module.css";
import Lottie from "lottie-react";
import AnimationData from "./animation.json";
import MicIcon from "@mui/icons-material/Mic";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";
import Spinner from "../Gif/spinner.gif";

function Animation({ micopen, setmicopen, socket, grpc }) {
  return (
    <div className={!micopen ? css.main : css.main}>
      <div className={`${!micopen ? css.mic2 : css.mic}`}>
        <Lottie animationData={AnimationData} loop={true} />
      </div>

      {!micopen && socket && (
        <MicIcon className={css.mic_icon} onClick={setmicopen} />
      )}

      {micopen && socket && grpc && (
        <GraphicEqIcon className={css.mic_icon} onClick={setmicopen} />
      )}

      {!micopen && !socket && (
        <img src={Spinner} alt="" srcset="" className={`${css.spiner}`} />
      )}

      {micopen && !grpc && (
        <img src={Spinner} alt="" srcset="" className={`${css.spiner}`} />
      )}
    </div>
  );
}

export default Animation;
