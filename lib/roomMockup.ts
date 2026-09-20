/** Generates a minimal, self-contained .glb (binary glTF 2.0) for a simple
 * open-top room — floor + 4 walls — colored from the scan's own metadata.
 * Used as the visible fallback whenever a real photo-to-3D reconstruction
 * isn't available, so the viewer shows an actual room shape instead of an
 * unrelated placeholder model. No network calls, no dependencies: this is
 * plain geometry + the glTF binary container format, built by hand. */

type Vec3 = [number, number, number];
type Face = { positions: number[]; normals: number[]; indices: number[]; color: Vec3; vertexCount: number };

function hexToRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.75, 0.75, 0.72];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** One flat N-gon face, fan-triangulated from its first vertex (wound so
 * `normal` points toward the visible side). A quad is just the n=4 case. */
function face(corners: Vec3[], normal: Vec3, color: Vec3): Face {
  const indices: number[] = [];
  for (let i = 1; i < corners.length - 1; i++) indices.push(0, i, i + 1);
  return {
    positions: corners.flat(),
    normals: corners.map(() => normal).flat(),
    indices,
    color,
    vertexCount: corners.length,
  };
}

function quad(corners: [Vec3, Vec3, Vec3, Vec3], normal: Vec3, color: Vec3): Face {
  return face(corners, normal, color);
}

export function buildRoomMockupGlb(options: {
  width?: number;
  depth?: number;
  height?: number;
  levels?: number;
  wallColorHex?: string;
  floorColorHex?: string;
}): Buffer {
  const w = (options.width ?? 4) / 2;
  const d = (options.depth ?? 4) / 2;
  const h = options.height ?? 2.7;
  const levels = Math.max(1, Math.min(12, options.levels ?? 1));
  const wallColor = hexToRgb(options.wallColorHex ?? "#c9c2b3");
  const floorColor = hexToRgb(options.floorColorHex ?? "#8a7660");

  const parts: Face[] = [];
  for (let level = 0; level < levels; level += 1) {
    const y = level * h;
    parts.push(
      quad([[-w, y, -d], [w, y, -d], [w, y, d], [-w, y, d]], [0, 1, 0], floorColor),
      quad([[-w, y, -d], [-w, y + h, -d], [w, y + h, -d], [w, y, -d]], [0, 0, 1], wallColor),
      quad([[w, y, d], [w, y + h, d], [-w, y + h, d], [-w, y, d]], [0, 0, -1], wallColor),
      quad([[-w, y, d], [-w, y + h, d], [-w, y + h, -d], [-w, y, -d]], [1, 0, 0], wallColor),
      quad([[w, y, -d], [w, y + h, -d], [w, y + h, d], [w, y, d]], [-1, 0, 0], wallColor)
    );
  }

  return buildGlbFromFaces(parts);
}

/** Extrudes a real 2D footprint polygon (already in flat local meters, e.g.
 * from blueprintAnalysis.projectToLocalMeters or an OpenCV-detected
 * contour) into an open-top 3D room: a floor matching the polygon's exact
 * shape plus one wall quad per polygon edge. */
export function buildBlueprintExtrusionGlb(
  footprint: { x: number; y: number }[],
  options: { height?: number; wallColorHex?: string; floorColorHex?: string } = {}
): Buffer {
  if (footprint.length < 3) throw new Error("Footprint needs at least 3 points to extrude");

  const h = options.height ?? 2.7;
  const wallColor = hexToRgb(options.wallColorHex ?? "#c9c2b3");
  const floorColor = hexToRgb(options.floorColorHex ?? "#8a7660");
  // glTF is Y-up; the footprint's 2D (x, y) plane maps to 3D (x, 0, z).
  const ring = footprint.map(({ x, y }): Vec3 => [x, 0, y]);

  const parts: Face[] = [face(ring, [0, 1, 0], floorColor)];
  for (let i = 0; i < ring.length; i++) {
    const [x1, , z1] = ring[i];
    const [x2, , z2] = ring[(i + 1) % ring.length];
    // Outward-facing normal, perpendicular to the edge in the XZ plane.
    const normal: Vec3 = [z2 - z1, 0, -(x2 - x1)];
    const len = Math.hypot(normal[0], normal[2]) || 1;
    parts.push(
      quad(
        [
          [x1, 0, z1],
          [x2, 0, z2],
          [x2, h, z2],
          [x1, h, z1],
        ],
        [normal[0] / len, 0, normal[2] / len],
        wallColor
      )
    );
  }

  return buildGlbFromFaces(parts);
}

/** Builds a compact glTF point cloud directly from MapAnything's metric
 * world-space points. This keeps the local path honest: no generic box and no
 * second image-to-3D model is substituted when MapAnything is enabled. */
export function buildPointCloudGlb(points: [number, number, number][]): Buffer {
  const finite = points.filter((point) => point.every(Number.isFinite)).slice(0, 12000);
  if (finite.length === 0) throw new Error("Point cloud is empty");
  const positions = finite.flat();
  const ys = finite.map((point) => point[1]);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const colors = finite.flatMap(([, y]) => {
    const t = (y - minY) / (maxY - minY || 1);
    return [0.2 + t * 0.3, 0.8 + t * 0.15, 0.45 + t * 0.4, 1];
  });
  const positionBytes = Buffer.from(new Float32Array(positions).buffer);
  const colorBytes = Buffer.from(new Float32Array(colors).buffer);
  const pad = (buffer: Buffer) => Buffer.concat([buffer, Buffer.alloc((4 - (buffer.length % 4)) % 4)]);
  const positionOffset = 0;
  const colorOffset = pad(positionBytes).length;
  const bin = Buffer.concat([pad(positionBytes), pad(colorBytes)]);
  const xs = finite.map((point) => point[0]);
  const zs = finite.map((point) => point[2]);
  const gltf = {
    asset: { version: "2.0", generator: "clonify-map-anything" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{
      primitives: [{
        attributes: { POSITION: 0, COLOR_0: 1 },
        mode: 0,
      }],
    }],
    accessors: [
      {
        bufferView: 0, componentType: 5126, count: finite.length, type: "VEC3",
        min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
        max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
      },
      { bufferView: 1, componentType: 5126, count: finite.length, type: "VEC4" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: positionOffset, byteLength: positionBytes.length, target: 34962 },
      { buffer: 0, byteOffset: colorOffset, byteLength: colorBytes.length, target: 34962 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  return packageGlb(gltf, bin);
}

function buildGlbFromFaces(parts: Face[]): Buffer {
  const bufferViews: { buffer: number; byteOffset: number; byteLength: number; target: number }[] = [];
  const accessors: Record<string, unknown>[] = [];
  const chunks: Buffer[] = [];
  let byteOffset = 0;

  function pushChunk(buf: Buffer, target: number) {
    const pad = (4 - (buf.length % 4)) % 4;
    const padded = pad === 0 ? buf : Buffer.concat([buf, Buffer.alloc(pad)]);
    chunks.push(padded);
    bufferViews.push({ buffer: 0, byteOffset, byteLength: buf.length, target });
    byteOffset += padded.length;
    return bufferViews.length - 1;
  }

  const materials = parts.map((part) => ({
    pbrMetallicRoughness: {
      baseColorFactor: [...part.color, 1],
      metallicFactor: 0,
      roughnessFactor: 0.9,
    },
    doubleSided: true,
  }));

  const primitives = parts.map((part, i) => {
    const posBuf = Buffer.from(new Float32Array(part.positions).buffer);
    const posViewIdx = pushChunk(posBuf, 34962);
    const xs = part.positions.filter((_, i) => i % 3 === 0);
    const ys = part.positions.filter((_, i) => i % 3 === 1);
    const zs = part.positions.filter((_, i) => i % 3 === 2);
    accessors.push({
      bufferView: posViewIdx,
      componentType: 5126,
      count: part.vertexCount,
      type: "VEC3",
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    });
    const positionAccessor = accessors.length - 1;

    const normBuf = Buffer.from(new Float32Array(part.normals).buffer);
    const normViewIdx = pushChunk(normBuf, 34962);
    accessors.push({ bufferView: normViewIdx, componentType: 5126, count: part.vertexCount, type: "VEC3" });
    const normalAccessor = accessors.length - 1;

    const idxBuf = Buffer.from(new Uint16Array(part.indices).buffer);
    const idxViewIdx = pushChunk(idxBuf, 34963);
    accessors.push({ bufferView: idxViewIdx, componentType: 5123, count: part.indices.length, type: "SCALAR" });
    const indexAccessor = accessors.length - 1;

    return {
      attributes: { POSITION: positionAccessor, NORMAL: normalAccessor },
      indices: indexAccessor,
      material: i,
    };
  });

  const binBuffer = Buffer.concat(chunks);

  const gltf = {
    asset: { version: "2.0", generator: "clonify-room-mockup" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives }],
    materials,
    accessors,
    bufferViews,
    buffers: [{ byteLength: binBuffer.length }],
  };

  const jsonStr = JSON.stringify(gltf);
  const jsonPadded = Buffer.from(jsonStr + " ".repeat((4 - (jsonStr.length % 4)) % 4));

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0); // 'glTF'
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binBuffer.length, 8);

  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4); // 'JSON'

  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4); // 'BIN\0'

  return Buffer.concat([header, jsonChunkHeader, jsonPadded, binChunkHeader, binBuffer]);
}

function packageGlb(gltf: Record<string, unknown>, binBuffer: Buffer): Buffer {
  const jsonStr = JSON.stringify(gltf);
  const jsonPadded = Buffer.from(jsonStr + " ".repeat((4 - (jsonStr.length % 4)) % 4));
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonPadded.length + 8 + binBuffer.length, 8);
  const jsonChunkHeader = Buffer.alloc(8);
  jsonChunkHeader.writeUInt32LE(jsonPadded.length, 0);
  jsonChunkHeader.writeUInt32LE(0x4e4f534a, 4);
  const binChunkHeader = Buffer.alloc(8);
  binChunkHeader.writeUInt32LE(binBuffer.length, 0);
  binChunkHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonChunkHeader, jsonPadded, binChunkHeader, binBuffer]);
}
