import React from "react";
import css from "./MicAnimation.module.css";
import Lottie from "lottie-react";
import AnimationData from "./animation.json";
import GraphicEqIcon from "@mui/icons-material/GraphicEq";

function Animation({ micopen, setmicopen, socket, grpc }) {
  return (
    <>
      {micopen && socket && grpc && (
        <div className={!micopen ? css.main : css.main}>
          <div className={`${!micopen ? css.mic2 : css.mic}`}>
            <Lottie animationData={AnimationData} loop={true} />
          </div>

          {micopen && socket && grpc && (
            <GraphicEqIcon className={css.mic_icon} onClick={setmicopen} />
          )}
        </div>
      )}
    </>
  );
}

export default Animation;
