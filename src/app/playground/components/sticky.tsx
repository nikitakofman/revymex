import React from "react";

type Props = {};

const Sticky = (props: Props) => {
  return (
    <>
      <div className="h-[2000px] bg-blu-100 flex items-center justify-center">
        <div
          className="size-80 bg-blue-500"
          style={{
            position: "sticky",
            top: 200,
          }}
        >
          hi
        </div>
      </div>
      <div className="h-[2000px] bg-blu-100 flex items-center justify-center">
        <div
          className="size-80 bg-blue-500"
          style={{
            position: "sticky",
            top: 200,
          }}
        >
          hi
        </div>
      </div>
    </>
  );
};

export default Sticky;
