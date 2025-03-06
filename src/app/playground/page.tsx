"use client";

import React from "react";
import DragDropPOC from "./components/dragdroppoc";
import { InBetween } from "./components/inbetween";
import InfiniteCanvas from "./components/rotate";
import FlexGrow from "./components/flexgrow";
import Home from "./components/skewcorners";

type Props = {};

const page = (props: Props) => {
  return (
    <div className="bruh">
      <Home />
    </div>
  );
};

export default page;
