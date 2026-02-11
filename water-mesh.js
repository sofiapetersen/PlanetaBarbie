import { getFace, cubeFaceToSphereDir, NUM_FACES } from './cube-sphere.js';

export function generateWaterMesh(seaLevel, gridSize = 16) {
    // Calcular raio da agua usando mesma formula do terreno
    const smoothSea = Math.pow(seaLevel, 1.2);
    const waterRadius = 1.0 + smoothSea * 1.8;

    const vertsPerFace = (gridSize + 1) * (gridSize + 1);
    const totalVerts = vertsPerFace * NUM_FACES;
    const quadsPerFace = gridSize * gridSize;
    const trisPerFace = quadsPerFace * 2;
    const totalTris = trisPerFace * NUM_FACES;

    const positions = new Float32Array(totalVerts * 3);
    const normals = new Float32Array(totalVerts * 3);
    const indices = new Uint32Array(totalTris * 3);

    let vertOffset = 0;
    let idxOffset = 0;

    for (let f = 0; f < NUM_FACES; f++) {
        const face = getFace(f);
        const baseVert = vertOffset;
        for (let ty = 0; ty <= gridSize; ty++) {
            const t = -1 + 2 * ty / gridSize;
            for (let sx = 0; sx <= gridSize; sx++) {
                const s = -1 + 2 * sx / gridSize;

                const dir = cubeFaceToSphereDir(face, s, t);

                const vi = vertOffset * 3;
                positions[vi + 0] = dir[0] * waterRadius;
                positions[vi + 1] = dir[1] * waterRadius;
                positions[vi + 2] = dir[2] * waterRadius;

                normals[vi + 0] = dir[0];
                normals[vi + 1] = dir[1];
                normals[vi + 2] = dir[2];

                vertOffset++;
            }
        }

        for (let ty = 0; ty < gridSize; ty++) {
            for (let sx = 0; sx < gridSize; sx++) {
                const i00 = baseVert + ty * (gridSize + 1) + sx;
                const i10 = baseVert + ty * (gridSize + 1) + sx + 1;
                const i01 = baseVert + (ty + 1) * (gridSize + 1) + sx;
                const i11 = baseVert + (ty + 1) * (gridSize + 1) + sx + 1;

                indices[idxOffset++] = i00;
                indices[idxOffset++] = i10;
                indices[idxOffset++] = i01;

                indices[idxOffset++] = i10;
                indices[idxOffset++] = i11;
                indices[idxOffset++] = i01;
            }
        }
    }

    return { positions, normals, indices, waterRadius };
}
