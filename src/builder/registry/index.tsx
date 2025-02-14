export const elementRegistry = [
  {
    type: "frame",
    defaultProps: {
      style: {
        width: "300px",
        height: "300px",
        padding: "20px",
      },
    },
  },
  {
    type: "image",
    defaultProps: {
      src: "https://hatrabbits.com/wp-content/uploads/2017/01/random.jpg",
      style: {
        width: "300px",
        height: "300px",
      },
    },
  },
  {
    type: "text",
    defaultProps: {
      text: "<p>New Text</p>",
      style: {
        fontSize: "20px",
        fontWeight: "bold",
      },
    },
  },
  {
    type: "spline",
    defaultProps: {},
  },
  {
    type: "video",
    defaultProps: {
      src: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    },
  },
];
