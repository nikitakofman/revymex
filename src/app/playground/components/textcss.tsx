import React from "react";

const TextCss = () => {
  const [textColor, setTextColor] = React.useState("white");

  const changeTextColor = () => {
    setTextColor("red");
  };

  const [fontSize, setFontSize] = React.useState("20px");

  const changeFontSize = () => {
    setFontSize("30px");
  };

  return (
    <div>
      <p
        style={{
          color: textColor,
          transition: "all 0.3s ease",
          fontSize: fontSize,
        }}
      >
        wesh
      </p>
      <button onClick={changeTextColor}>Change Text Color</button>
      <button onClick={changeFontSize}>Change Font Size</button>
    </div>
  );
};

export default TextCss;
