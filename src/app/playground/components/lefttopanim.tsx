"use client";

import React, { useState } from "react";

type Props = {};

const LeftTopAnim = (props: Props) => {
  const [leftTop, setLeftTop] = useState({
    left: "400px",
    top: "400px",
  });

  const handleleftTopChange = () => {
    if (leftTop.left === "400px") {
      setLeftTop({
        left: "200px",
        top: "90px",
      });
    } else if (leftTop.left === "200px") {
      setLeftTop({
        left: "400px",
        top: "400px",
      });
    }
  };

  return (
    <div className="h-screen flex items-center justify-center bg-white">
      <div
        className="absolute  left-10 text-black top-10"
        onClick={handleleftTopChange}
      >
        make move
      </div>
      <div
        style={{
          position: "absolute",
          left: leftTop.left,
          top: leftTop.top,
        }}
        className="size-20 bg-pink-400 transition-all duration-1000 ease-out"
      />
    </div>
  );
};

export default LeftTopAnim;
