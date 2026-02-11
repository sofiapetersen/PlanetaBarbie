import { createNoise4D } from 'https://cdn.skypack.dev/simplex-noise';
import { getFace, cubeFaceToSphereDir, NUM_FACES } from './cube-sphere.js';

//ALGORITMO Mulberry32
function seededRandom(seed) {
    return function() {
        seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export class NoiseGenerator {
    constructor(width, height, seed=null) {
        this.width = width;
        this.height = height;
        this.seed = seed !== null ? seed : Math.floor(Math.random() * 2147483647);
        this.noise4D = createNoise4D(seededRandom(this.seed));
    }

    getSeed() {
        return this.seed;
    }
    
    setSeed(seed) {
        this.seed = seed;
        this.noise4D = createNoise4D(seededRandom(this.seed));
    }

    setWidth(width) {
        this.width = width;
    }

    setHeight(height) {
        this.height = height;
    }
    generate(params) {
        const {
            octaves,
            persistence,
            lacunarity,
            noiseZoom,
            noiseType = 'perlin',
            noiseScale = 1.0
        } = params;
        const data = new Float32Array(this.width * this.height);
        const PI = 3.14159265359;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {

                let total = 0;
                let frequency = 1.0;
                let amplitude = 1.0;
                let maxValue = 0;

                for (let i = 0; i < octaves; i++) {
                    const nx = (x / this.width) * frequency;
                    const ny = (y / this.height) * frequency;

                    const angleX = 2 * PI * nx;
                    const angleY = 2 * PI * ny;

                    const x4d = Math.cos(angleX) * noiseZoom;
                    const y4d = Math.sin(angleX) * noiseZoom;
                    const z4d = Math.cos(angleY) * noiseZoom;
                    const w4d = Math.sin(angleY) * noiseZoom;

                    let noiseValue;
                    if (noiseType === 'random') {
                        noiseValue = Math.random() * 2 - 1;
                    } else if (noiseType === 'ridged') {
                        noiseValue = 1 - Math.abs(this.noise4D(x4d, y4d, z4d, w4d));
                    } else {
                        noiseValue = this.noise4D(x4d, y4d, z4d, w4d);
                    }

                    total += noiseValue * amplitude;

                    maxValue += amplitude;
                    amplitude *= persistence;
                    frequency *= lacunarity;
                }

                // Normaliza para [0,1], depois aplica noiseScale para controlar amplitude
                let value = (total / maxValue + 1) / 2;
                // noiseScale redistribui ao redor de 0.5 (nível médio)
                value = 0.5 + (value - 0.5) * noiseScale;
                value = Math.max(0, Math.min(1, value));
                data[y * this.width + x] = value;
            }
        }
        return data;
    }

    sampleHeightAtDirection(dir, params) {
        const {
            octaves,
            persistence,
            lacunarity,
            noiseZoom,
            noiseType = 'perlin',
            noiseScale = 1.0
        } = params;

        let total = 0;
        let frequency = 1.0;
        let amplitude = 1.0;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            const nx = dir[0] * noiseZoom * frequency;
            const ny = dir[1] * noiseZoom * frequency;
            const nz = dir[2] * noiseZoom * frequency;

            let noiseValue;
            if (noiseType === 'random') {
                // Para random, usar um hash deterministico baseado na direcao
                const h = Math.abs(Math.sin(nx * 12.9898 + ny * 78.233 + nz * 45.164) * 43758.5453);
                noiseValue = (h - Math.floor(h)) * 2 - 1;
            } else if (noiseType === 'ridged') {
                noiseValue = 1 - Math.abs(this.noise4D(nx, ny, nz, 0));
            } else {
                noiseValue = this.noise4D(nx, ny, nz, 0);
            }

            total += noiseValue * amplitude;
            maxValue += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        let value = (total / maxValue + 1) / 2;
        value = 0.5 + (value - 0.5) * noiseScale;
        return Math.max(0, Math.min(1, value));
    }

    sampleHeightAtFace(faceId, s, t, params) {
        const face = getFace(faceId);
        const dir = cubeFaceToSphereDir(face, s, t);
        return this.sampleHeightAtDirection(dir, params);
    }

    generateFaceHeightmap(faceId, resolution, params) {
        const face = getFace(faceId);
        const data = new Float32Array(resolution * resolution);

        for (let ty = 0; ty < resolution; ty++) {
            const t = -1 + 2 * ty / (resolution - 1);
            for (let sx = 0; sx < resolution; sx++) {
                const s = -1 + 2 * sx / (resolution - 1);
                const dir = cubeFaceToSphereDir(face, s, t);
                data[ty * resolution + sx] = this.sampleHeightAtDirection(dir, params);
            }
        }

        return data;
    }

    generateAllFaceHeightmaps(resolution, params) {
        const heightmaps = [];
        for (let f = 0; f < NUM_FACES; f++) {
            heightmaps.push(this.generateFaceHeightmap(f, resolution, params));
        }
        return heightmaps;
    }
}