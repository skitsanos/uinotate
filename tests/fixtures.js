export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4AWP4/x8AAwAB/8hw3wgAAAAASUVORK5CYII=";
export const PNG_BYTES = Buffer.from(PNG.split(",")[1], "base64").length;
export function pngCanvas(document) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.toDataURL = () => PNG;
  return canvas;
}
