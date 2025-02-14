import React from "react";

type Props = {};

const FlexGrow = (props: Props) => {
  return (
    <div className="h-screen flex p-40 items-center justify-center">
      <div className="h-full w-full  bg-pink-400"></div>
      <div className="h-full w-full flex-1 bg-pink-800"></div>
    </div>
  );
};

export default FlexGrow;
