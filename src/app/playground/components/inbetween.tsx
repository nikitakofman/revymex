"use client";

import { useEffect, useState } from "react";

export const InBetween = () => {
  const [values, setValues] = useState(null);

  const [viewportWidth, setViewportWidth] = useState<number>(0);

  useEffect(() => {
    setViewportWidth(window.innerWidth);
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  console.log("viewportWIdth", viewportWidth);

  useEffect(() => {
    setTimeout(() => {
      const element1 = document.querySelector(`[data-node-id="dd"]`);
      const element2 = document.querySelector(`[data-node-id="ff"]`);
      const element3 = document.querySelector(`[data-node-id="xx"]`);

      const rect1 = element1?.getBoundingClientRect();
      const rect2 = element2?.getBoundingClientRect();
      const rect3 = element3?.getBoundingClientRect();

      console.log("rect1", rect1?.x);
      console.log("rect2", rect2?.x);
      console.log("rect3", rect3?.x);

      setValues({
        x1: rect2?.x - rect1?.x,
        x2: rect3?.x - rect1?.x,
      });
    }, 1000);
  }, [viewportWidth]);

  return (
    <div className="h-screen w-full p-20 flex  gap-20 items-center justify-center ">
      {["dd", "ff", "xx"].map((num, i) => {
        return (
          <div
            key={i}
            className="size-80 bruh bg-pink-400"
            data-node-id={num}
          />
        );
      })}

      <>
        <div
          className="absolute flex text-black items-center justify-center h-screen size-20 bg-red-200"
          style={{
            left: `${values && values.x1}px`,
          }}
        >
          Handle
        </div>
        <div
          className="absolute h-screen flex text-black items-center justify-center  size-20 bg-red-200"
          style={{
            left: `${values && values.x2}px`,
          }}
        >
          Handle
        </div>
      </>
    </div>
  );
};
