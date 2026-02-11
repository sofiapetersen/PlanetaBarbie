export const FACE_POS_X = 0;
export const FACE_NEG_X = 1;
export const FACE_POS_Y = 2;
export const FACE_NEG_Y = 3;
export const FACE_POS_Z = 4;
export const FACE_NEG_Z = 5;

const FACES = [
    { // +X
        id: FACE_POS_X,
        normal: [1, 0, 0],
        right:  [0, 0, -1],
        up:     [0, 1, 0]
    },
    { // -X
        id: FACE_NEG_X,
        normal: [-1, 0, 0],
        right:  [0, 0, 1],
        up:     [0, 1, 0]
    },
    { // +Y
        id: FACE_POS_Y,
        normal: [0, 1, 0],
        right:  [1, 0, 0],
        up:     [0, 0, 1]
    },
    { // -Y
        id: FACE_NEG_Y,
        normal: [0, -1, 0],
        right:  [1, 0, 0],
        up:     [0, 0, -1]
    },
    { // +Z
        id: FACE_POS_Z,
        normal: [0, 0, 1],
        right:  [1, 0, 0],
        up:     [0, 1, 0]
    },
    { // -Z
        id: FACE_NEG_Z,
        normal: [0, 0, -1],
        right:  [-1, 0, 0],
        up:     [0, 1, 0]
    }
];

const ADJACENCY = [
    // +X (face 0): top=+Y, bottom=-Y, left=+Z, right=-Z
    { top: { face: 2, edgeMap: 'right' }, bottom: { face: 3, edgeMap: 'right' }, left: { face: 4, edgeMap: 'right' }, right: { face: 5, edgeMap: 'left' } },
    // -X (face 1): top=+Y, bottom=-Y, left=-Z, right=+Z
    { top: { face: 2, edgeMap: 'left' }, bottom: { face: 3, edgeMap: 'left' }, left: { face: 5, edgeMap: 'right' }, right: { face: 4, edgeMap: 'left' } },
    // +Y (face 2): top=-Z, bottom=+Z, left=-X, right=+X
    { top: { face: 5, edgeMap: 'top' }, bottom: { face: 4, edgeMap: 'top' }, left: { face: 1, edgeMap: 'top' }, right: { face: 0, edgeMap: 'top' } },
    // -Y (face 3): top=+Z, bottom=-Z, left=-X, right=+X
    { top: { face: 4, edgeMap: 'bottom' }, bottom: { face: 5, edgeMap: 'bottom' }, left: { face: 1, edgeMap: 'bottom' }, right: { face: 0, edgeMap: 'bottom' } },
    // +Z (face 4): top=+Y, bottom=-Y, left=-X, right=+X
    { top: { face: 2, edgeMap: 'bottom' }, bottom: { face: 3, edgeMap: 'top' }, left: { face: 1, edgeMap: 'right' }, right: { face: 0, edgeMap: 'left' } },
    // -Z (face 5): top=+Y, bottom=-Y, left=+X, right=-X
    { top: { face: 2, edgeMap: 'top' }, bottom: { face: 3, edgeMap: 'bottom' }, left: { face: 0, edgeMap: 'right' }, right: { face: 1, edgeMap: 'left' } }
];

export function getFace(faceId) {
    return FACES[faceId];
}

export function getAdjacency(faceId) {
    return ADJACENCY[faceId];
}

export function cubeFaceToSphereDir(face, s, t) {
    const x = face.normal[0] + s * face.right[0] + t * face.up[0];
    const y = face.normal[1] + s * face.right[1] + t * face.up[1];
    const z = face.normal[2] + s * face.right[2] + t * face.up[2];
    const len = Math.sqrt(x * x + y * y + z * z);
    return [x / len, y / len, z / len];
}

export function sphereDirToFace(dx, dy, dz) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    const az = Math.abs(dz);

    let faceId, s, t;

    if (ax >= ay && ax >= az) {
        if (dx > 0) {
            faceId = FACE_POS_X;
            s = -dz / ax;
            t = dy / ax;
        } else {
            faceId = FACE_NEG_X;
            s = dz / ax;
            t = dy / ax;
        }
    } else if (ay >= ax && ay >= az) {
        if (dy > 0) {
            faceId = FACE_POS_Y;
            s = dx / ay;
            t = dz / ay;
        } else {
            faceId = FACE_NEG_Y;
            s = dx / ay;
            t = -dz / ay;
        }
    } else {
        if (dz > 0) {
            faceId = FACE_POS_Z;
            s = dx / az;
            t = dy / az;
        } else {
            faceId = FACE_NEG_Z;
            s = -dx / az;
            t = dy / az;
        }
    }

    return { faceId, s, t };
}

export function sphereDistance(dir1, dir2) {
    const dot = dir1[0] * dir2[0] + dir1[1] * dir2[1] + dir1[2] * dir2[2];
    return Math.acos(Math.max(-1, Math.min(1, dot)));
}

export function projectDirToFace(dir, faceId) {
    const face = FACES[faceId];
    const dDotN = dir[0] * face.normal[0] + dir[1] * face.normal[1] + dir[2] * face.normal[2];
    if (Math.abs(dDotN) < 0.0001) return null;

    const k = 1.0 / dDotN;
    const px = k * dir[0] - face.normal[0];
    const py = k * dir[1] - face.normal[1];
    const pz = k * dir[2] - face.normal[2];

    const s = px * face.right[0] + py * face.right[1] + pz * face.right[2];
    const t = px * face.up[0] + py * face.up[1] + pz * face.up[2];

    return { s, t };
}

export const NUM_FACES = 6;
