"use client";

import React from "react";
import DragDropPOC from "./components/dragdroppoc";
import { InBetween } from "./components/inbetween";
import InfiniteCanvas from "./components/rotate";

type Props = {};

const page = (props: Props) => {
  return (
    <div className="bruh">
      <InfiniteCanvas />
    </div>
  );
};

export default page;
