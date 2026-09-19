/** Generates a minimal, self-contained .glb (binary glTF 2.0) for a simple
 * open-top room — floor + 4 walls — colored from the scan's own metadata.
 * Used as the visible fallback whenever a real photo-to-3D reconstruction
 * isn't available, so the viewer shows an actual room shape instead of an
 * unrelated placeholder model. No network calls, no dependencies: this is
 * plain geometry + the glTF binary container format, built by hand. */

type Vec3 = [number, number, number];
type Quad = { positions: number[]; normals: number[]; indices: number[]; color: Vec3 };

function hexToRgb(hex: string): Vec3 {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0.75, 0.75, 0.72];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** One quad from 4 corners (wound so `normal` points toward the visible face). */
function quad(corners: [Vec3, Vec3, Vec3, Vec3], normal: Vec3, color: Vec3): Quad {
  return {
    positions: corners.flat(),
    normals: [normal, normal, normal, normal].flat(),
    indices: [0, 1, 2, 0, 2, 3],
    color,
  };
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

  const parts: Quad[] = [];
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
    const xs = [0, 3, 6, 9].map((o) => part.positions[o]);
    const ys = [1, 4, 7, 10].map((o) => part.positions[o]);
    const zs = [2, 5, 8, 11].map((o) => part.positions[o]);
    accessors.push({
      bufferView: posViewIdx,
      componentType: 5126,
      count: 4,
      type: "VEC3",
      min: [Math.min(...xs), Math.min(...ys), Math.min(...zs)],
      max: [Math.max(...xs), Math.max(...ys), Math.max(...zs)],
    });
    const positionAccessor = accessors.length - 1;

    const normBuf = Buffer.from(new Float32Array(part.normals).buffer);
    const normViewIdx = pushChunk(normBuf, 34962);
    accessors.push({ bufferView: normViewIdx, componentType: 5126, count: 4, type: "VEC3" });
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
