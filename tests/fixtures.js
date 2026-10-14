export const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=";
export const PNG_BYTES = Buffer.from(PNG.split(",")[1], "base64").length;
export function pngCanvas(document) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  canvas.toDataURL = () => PNG;
  return canvas;
}
