export const VIEWPORT_SIZES = {
  DESKTOP: { id: "viewport-1440", width: 1440 },
  TABLET: { id: "viewport-768", width: 768 },
  MOBILE: { id: "viewport-375", width: 375 },
} as const;

export const DESKTOP_VIEWPORT = VIEWPORT_SIZES.DESKTOP.id;
