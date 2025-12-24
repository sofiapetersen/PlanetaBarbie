function createIcosphere(subdivisions = 2) {
    const t = (1.0 + Math.sqrt(5.0)) / 2.0;
    
    let positions = [
        -1, t, 0,   1, t, 0,   -1, -t, 0,   1, -t, 0,
        0, -1, t,   0, 1, t,   0, -1, -t,   0, 1, -t,
        t, 0, -1,   t, 0, 1,   -t, 0, -1,   -t, 0, 1
    ];
    
    let indices = [
        0, 11, 5,   0, 5, 1,   0, 1, 7,   0, 7, 10,   0, 10, 11,
        1, 5, 9,    5, 11, 4,   11, 10, 2,  10, 7, 6,   7, 1, 8,
        3, 9, 4,    3, 4, 2,    3, 2, 6,    3, 6, 8,    3, 8, 9,
        4, 9, 5,    2, 4, 11,   6, 2, 10,   8, 6, 7,    9, 8, 1
    ];
    
    for (let i = 0; i < subdivisions; i++) {
        const newIndices = [];
        const midpointCache = {};
        
        function getMidpoint(i1, i2) {
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            if (midpointCache[key] !== undefined) return midpointCache[key];
            
            const v1 = [positions[i1*3], positions[i1*3+1], positions[i1*3+2]];
            const v2 = [positions[i2*3], positions[i2*3+1], positions[i2*3+2]];
            const mid = [
                (v1[0] + v2[0]) / 2,
                (v1[1] + v2[1]) / 2,
                (v1[2] + v2[2]) / 2
            ];
            
            const len = Math.sqrt(mid[0]*mid[0] + mid[1]*mid[1] + mid[2]*mid[2]);
            mid[0] /= len;
            mid[1] /= len;
            mid[2] /= len;
            
            const idx = positions.length / 3;
            positions.push(mid[0], mid[1], mid[2]);
            midpointCache[key] = idx;
            return idx;
        }
        
        for (let j = 0; j < indices.length; j += 3) {
            const v1 = indices[j];
            const v2 = indices[j + 1];
            const v3 = indices[j + 2];
            
            const a = getMidpoint(v1, v2);
            const b = getMidpoint(v2, v3);
            const c = getMidpoint(v3, v1);
            
            newIndices.push(v1, a, c);
            newIndices.push(v2, b, a);
            newIndices.push(v3, c, b);
            newIndices.push(a, b, c);
        }
        
        indices = newIndices;
    }
    
    for (let i = 0; i < positions.length; i += 3) {
        const len = Math.sqrt(
            positions[i]*positions[i] + 
            positions[i+1]*positions[i+1] + 
            positions[i+2]*positions[i+2]
        );
        positions[i] /= len;
        positions[i+1] /= len;
        positions[i+2] /= len;
    }

    const uvs = [];
    for (let i = 0; i < positions.length; i += 3) {
        const x = positions[i];
        const y = positions[i + 1];
        const z = positions[i + 2];
        
        const u = 0.5 + Math.atan2(z, x) / (2 * Math.PI);
        const v = 0.5 - Math.asin(y) / Math.PI;
        
        uvs.push(u, v);
    }
    
    const edgeIndices = createEdgeIndices(indices);

    return {
        positions:   new Float32Array(positions),
        normals:     new Float32Array(positions),
        indices:     new Uint16Array(indices),
        uvs:         new Float32Array(uvs),
        edgeIndices: edgeIndices
    };
}

function createEdgeIndices(triangleIndices) {
    const edges = new Set();
    const edgeIndices = [];
    
    for (let i = 0; i < triangleIndices.length; i += 3) {
        const v0 = triangleIndices[i];
        const v1 = triangleIndices[i + 1];
        const v2 = triangleIndices[i + 2];
        
        const edge1 = v0 < v1 ? `${v0}_${v1}` : `${v1}_${v0}`;
        const edge2 = v1 < v2 ? `${v1}_${v2}` : `${v2}_${v1}`;
        const edge3 = v2 < v0 ? `${v2}_${v0}` : `${v0}_${v2}`;
        
        edges.add(edge1);
        edges.add(edge2);
        edges.add(edge3);
    }

    edges.forEach(edge => {
        const [v0, v1] = edge.split('_').map(Number);
        edgeIndices.push(v0, v1);
    });
    
    return new Uint16Array(edgeIndices);
}

export { createIcosphere, createEdgeIndices };