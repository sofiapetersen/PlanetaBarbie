export class OBJLoader {
    static async load(url) {
        const response = await fetch(url);
        const text = await response.text();
        return this.parse(text);
    }

    static parse(text) {
        const lines = text.split('\n');
        const positions = [];
        const normals = [];
        const texCoords = [];
        const vertices = [];
        const indexList = [];

        for (let line of lines) {
            line = line.trim();
            if (line.startsWith('v ')) {
                const parts = line.split(/\s+/);
                positions.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (line.startsWith('vn ')) {
                const parts = line.split(/\s+/);
                normals.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                );
            } else if (line.startsWith('vt ')) {
                const parts = line.split(/\s+/);
                texCoords.push(
                    parseFloat(parts[1]),
                    parseFloat(parts[2])
                );
            } else if (line.startsWith('f ')) {
                const parts = line.split(/\s+/).slice(1);
                const faceVertices = [];

                for (let part of parts) {
                    const vertexIndices = part.split('/');
                    const vIndex = parseInt(vertexIndices[0]) - 1;
                    const vtIndex = vertexIndices[1] ? parseInt(vertexIndices[1]) - 1 : null;
                    const vnIndex = vertexIndices[2] ? parseInt(vertexIndices[2]) - 1 : null;

                    faceVertices.push({
                        position: vIndex,
                        texCoord: vtIndex,
                        normal: vnIndex
                    });
                }

                for (let i = 1; i < faceVertices.length - 1; i++) {
                    [faceVertices[0], faceVertices[i], faceVertices[i + 1]].forEach(v => {
                        vertices.push(
                            positions[v.position * 3],
                            positions[v.position * 3 + 1],
                            positions[v.position * 3 + 2]
                        );

                        if (v.normal !== null && normals.length > 0) {
                            vertices.push(
                                normals[v.normal * 3],
                                normals[v.normal * 3 + 1],
                                normals[v.normal * 3 + 2]
                            );
                        } else {
                            vertices.push(0, 1, 0);
                        }

                        if (v.texCoord !== null && texCoords.length > 0) {
                            vertices.push(
                                texCoords[v.texCoord * 2],
                                texCoords[v.texCoord * 2 + 1]
                            );
                        } else {
                            vertices.push(0, 0);
                        }

                        indexList.push(indexList.length);
                    });
                }
            }
        }

        return {
            vertices: new Float32Array(vertices),
            indices: new Uint16Array(indexList)
        };
    }
}
