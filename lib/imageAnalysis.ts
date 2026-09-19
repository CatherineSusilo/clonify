import sharp from "sharp";
import cvReadyPromise from "@techstark/opencv-js";

/** Runs actual OpenCV (via @techstark/opencv-js, WASM) on a reference photo
 * or blueprint image: grayscale -> Canny edge detection -> contour finding,
 * then keeps the largest contour (the building/room outline in a blueprint,
 * or the dominant wall boundary in an interior photo) and simplifies it with
 * cv.approxPolyDP. This is the OpenCV-computed counterpart to the OSM
 * footprint analysis in blueprintAnalysis.ts, run on the image itself
 * rather than on map data.
 *
 * opencv-js expects browser ImageData (Uint8ClampedArray + width/height),
 * not encoded JPEG/PNG bytes, so sharp decodes the image to raw RGBA first. */
export type ImageAnalysis = {
  width: number;
  height: number;
  edgePixelRatio: number;
  largestContourCorners: number;
  largestContourPoints: { x: number; y: number }[];
};

export async function analyzeImageWithOpenCV(imageBuffer: Buffer): Promise<ImageAnalysis> {
  const cv = await cvReadyPromise;

  const { data, info } = await sharp(imageBuffer)
    .resize(800, 800, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const src = cv.matFromImageData({ data: new Uint8ClampedArray(data), width: info.width, height: info.height });
  const gray = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Canny(gray, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let largest: { area: number; points: { x: number; y: number }[] } | null = null;
    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const area = cv.contourArea(contour);
      if (!largest || area > largest.area) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, 0.01 * cv.arcLength(contour, true), true);
        const points: { x: number; y: number }[] = [];
        for (let p = 0; p < approx.rows; p++) {
          points.push({ x: approx.data32S[p * 2], y: approx.data32S[p * 2 + 1] });
        }
        approx.delete();
        largest = { area, points };
      }
      contour.delete();
    }

    const edgePixelCount = cv.countNonZero(edges);

    return {
      width: info.width,
      height: info.height,
      edgePixelRatio: edgePixelCount / (info.width * info.height),
      largestContourCorners: largest?.points.length ?? 0,
      largestContourPoints: largest?.points ?? [],
    };
  } finally {
    src.delete();
    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}
