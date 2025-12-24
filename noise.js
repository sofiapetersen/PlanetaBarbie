import { createNoise4D } from 'https://cdn.skypack.dev/simplex-noise';

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
        const { octaves, persistence, lacunarity, noiseZoom, noiseType = 'perlin' } = params;
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

                let value = (total / maxValue + 1) / 2;
                data[y * this.width + x] = value;
            }
        }
        return data;
    }
    
}