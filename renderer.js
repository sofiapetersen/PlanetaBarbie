import {
    vertexShaderSource,
    fragmentShaderSource,
    objectVertexShaderSource,
    objectFragmentShaderSource,
    depthVertexShaderSource,
    depthFragmentShaderSource,
    depthObjectVertexShaderSource,
    depthObjectFragmentShaderSource,
    pickingObjectVertexShaderSource,
    pickingObjectFragmentShaderSource,
    starVertexShaderSource,
    starFragmentShaderSource,
    waterVertexShaderSource,
    waterFragmentShaderSource,
    cometVertexShaderSource,
    cometFragmentShaderSource
} from './shaders.js';
import { CometManager } from './comet-manager.js';
import { createShader, createProgram } from './webgl-utils.js';
import { mat4 } from './math-utils.js';
import { NoiseGenerator } from './noise.js';
import { OBJLoader } from './obj-loader.js';
import { getFace, cubeFaceToSphereDir, sphereDirToFace, NUM_FACES, projectDirToFace, getAdjacency } from './cube-sphere.js';
import { generateWaterMesh } from './water-mesh.js';

export class Renderer {

    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');
        if (!this.gl) {
            console.error('WebGL2 not supported in this browser.');
            return;
        }

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        this.gl.enable(this.gl.DEPTH_TEST);
        this.gl.enable(this.gl.CULL_FACE);

        this.program = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource)
        );

        this.positionLoc = this.gl.getAttribLocation(this.program, 'a_position');
        this.normalLoc = this.gl.getAttribLocation(this.program, 'a_normal');
        this.heightLoc = this.gl.getAttribLocation(this.program, 'a_height');
        this.matrixLoc = this.gl.getUniformLocation(this.program, 'u_matrix');
        this.colorLoc = this.gl.getUniformLocation(this.program, 'u_color');
        this.useColorLoc = this.gl.getUniformLocation(this.program, 'u_useColor');
        this.seaLevelLoc = this.gl.getUniformLocation(this.program, 'u_seaLevel');
        this.sandRangeLoc = this.gl.getUniformLocation(this.program, 'u_sandRange');

        // Programa para objetos
        this.objectProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, objectVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, objectFragmentShaderSource)
        );

        this.objectPositionLoc = this.gl.getAttribLocation(this.objectProgram, 'a_position');
        this.objectNormalLoc = this.gl.getAttribLocation(this.objectProgram, 'a_normal');
        this.objectUVLoc = this.gl.getAttribLocation(this.objectProgram, 'a_texcoord');
        this.objectMatrixLoc = this.gl.getUniformLocation(this.objectProgram, 'u_matrix');
        this.objectTextureLoc = this.gl.getUniformLocation(this.objectProgram, 'u_texture');
        this.objectIsSelectedLoc = this.gl.getUniformLocation(this.objectProgram, 'u_isSelected');

        // Programa para depth map do terreno
        this.depthProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, depthVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, depthFragmentShaderSource)
        );

        this.depthPositionLoc = this.gl.getAttribLocation(this.depthProgram, 'a_position');
        this.depthLightMatrixLoc = this.gl.getUniformLocation(this.depthProgram, 'u_lightMatrix');
        this.depthWorldMatrixLoc = this.gl.getUniformLocation(this.depthProgram, 'u_worldMatrix');

        // Programa para depth map dos objetos
        this.depthObjectProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, depthObjectVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, depthObjectFragmentShaderSource)
        );

        this.depthObjectPositionLoc = this.gl.getAttribLocation(this.depthObjectProgram, 'a_position');
        this.depthObjectMatrixLoc = this.gl.getUniformLocation(this.depthObjectProgram, 'u_lightMatrix');
        this.depthObjectWorldMatrixLoc = this.gl.getUniformLocation(this.depthObjectProgram, 'u_worldMatrix');

        // Programa para picking de objetos
        this.pickingObjectProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, pickingObjectVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, pickingObjectFragmentShaderSource)
        );

        this.pickingObjectPositionLoc = this.gl.getAttribLocation(this.pickingObjectProgram, 'a_position');
        this.pickingObjectMatrixLoc = this.gl.getUniformLocation(this.pickingObjectProgram, 'u_matrix');
        this.pickingObjectWorldMatrixLoc = this.gl.getUniformLocation(this.pickingObjectProgram, 'u_worldMatrix');
        this.pickingObjectIdLoc = this.gl.getUniformLocation(this.pickingObjectProgram, 'u_id');

        // Programa para agua
        this.waterProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, waterVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, waterFragmentShaderSource)
        );

        this.waterPositionLoc = this.gl.getAttribLocation(this.waterProgram, 'a_position');
        this.waterNormalLoc = this.gl.getAttribLocation(this.waterProgram, 'a_normal');
        this.waterMatrixLoc = this.gl.getUniformLocation(this.waterProgram, 'u_matrix');
        this.waterTimeLoc = this.gl.getUniformLocation(this.waterProgram, 'u_time');

        // Programa para estrelas
        this.starProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, starVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, starFragmentShaderSource)
        );

        this.starPositionLoc = this.gl.getAttribLocation(this.starProgram, 'a_position');
        this.starSizeLoc = this.gl.getAttribLocation(this.starProgram, 'a_size');
        this.starViewProjectionMatrixLoc = this.gl.getUniformLocation(this.starProgram, 'u_viewProjectionMatrix');
        this.initStars();

        this.lightPos = [0.0, 0.0, 15.0];
        this.lightTarget = [0, 0, 0];
        this.lightUp = [0, 1, 0];

        
        // Noise e terreno
        
        this.noiseGenerator = new NoiseGenerator(512, 512);
        this.noiseParams = {
            octaves: 4,
            persistence: 0.5,
            lacunarity: 2.0,
            noiseZoom: 0.5,
            noiseType: 'perlin',
            noiseScale: 2.0
        };

        // Heightmap data por face (cache CPU)
        this.heightmapResolution = 129;
        this.heightmapData = [];
        this.terrainGridSize = 48;

        // Terrain GPU resources
        this.terrainVao = null;
        this.terrainPosBuffer = null;
        this.terrainNormBuffer = null;
        this.terrainHeightBuffer = null;
        this.terrainIdxBuffer = null;
        this.terrainEdgeBuffer = null;
        this.terrainNumIndices = 0;
        this.terrainNumEdgeIndices = 0;

        // Inicializar sistema de terreno
        this.initTerrainSystem();

        
        // Agua
        
        this.seaLevel = 0.30;
        this.sandRange = 0.04;
        this.waterVao = null;
        this.waterNumElements = 0;
        this.time = 0;
        this.initWaterMesh();

        
        // Controles de rotacao e camera
        
        this.rotationX = 0;
        this.rotationY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.cameraDistance = 7.5;
        this.showWireframe = true;

        this.setupMouseControls();

        
        // Shadow map
        
        this.shadowMapSize = 4096;
        this.createShadowMapFramebuffer();

        
        // Picking
        
        this.createPickingFramebuffer();
        this.resizePickingFramebuffer(this.canvas.width, this.canvas.height);
        this.mouseX = -1;
        this.mouseY = -1;
        this.selectedObjectIndex = -1;
        this.hoveredObjectIndex = -1;

        
        // Objetos
        
        this.placedObjects = [];
        this.loadedModels = new Map();
        this.objectTexture = null;
        this.loadObjectTexture();

        // Estado de arraste de objetos
        this.isObjectDragging = false;
        this.draggedObjectIndex = -1;
        this.didMoveObject = false;
        this.dragStartX = 0;
        this.dragStartY = 0;

        // Modo de adicao
        this.isAddMode = false;
        this.addModeModelPath = '';
        this.addModeScale = 1.0;

        // Modo de edicao de terreno
        this.editMode = 'none';
        this.brushRadius = 15;
        this.brushStrength = 0.02;
        this.isTerrainEditing = false;

        // Sistema de cometas
        this.cometManager = new CometManager();
        this.initCometSystem();
        this.lastFrameTime = performance.now();
    }

    
    // TERRAIN SYSTEM
    

    initTerrainSystem() {
        this.generateHeightmaps();
        this.buildTerrainMesh();
    }

    generateHeightmaps() {
        const res = this.heightmapResolution;
        this.heightmapData = [];
        for (let f = 0; f < NUM_FACES; f++) {
            this.heightmapData.push(
                this.noiseGenerator.generateFaceHeightmap(f, res, this.noiseParams)
            );
        }
    }

    sampleHeightFromCache(faceId, s, t) {
        const res = this.heightmapResolution;
        const data = this.heightmapData[faceId];
        if (!data) return 0.5;

        // Converter (s,t) de [-1,+1] para [0, res-1]
        const fx = (s + 1) / 2 * (res - 1);
        const fy = (t + 1) / 2 * (res - 1);

        const x0 = Math.max(0, Math.min(res - 2, Math.floor(fx)));
        const y0 = Math.max(0, Math.min(res - 2, Math.floor(fy)));
        const x1 = x0 + 1;
        const y1 = y0 + 1;

        const tx = fx - x0;
        const ty = fy - y0;

        const h00 = data[y0 * res + x0];
        const h10 = data[y0 * res + x1];
        const h01 = data[y1 * res + x0];
        const h11 = data[y1 * res + x1];

        // Interpolacao bilinear
        const top = h00 * (1 - tx) + h10 * tx;
        const bottom = h01 * (1 - tx) + h11 * tx;
        return top * (1 - ty) + bottom * ty;
    }

    buildTerrainMesh() {
        const gl = this.gl;
        const G = this.terrainGridSize;
        const vertsPerFace = (G + 1) * (G + 1);
        const totalVerts = vertsPerFace * NUM_FACES;
        const trisPerFace = G * G * 2;

        const positions = new Float32Array(totalVerts * 3);
        const normals = new Float32Array(totalVerts * 3);
        const heights = new Float32Array(totalVerts);
        const indices = new Uint32Array(trisPerFace * 3 * NUM_FACES);

        let vertOffset = 0;
        let idxOffset = 0;

        for (let f = 0; f < NUM_FACES; f++) {
            const face = getFace(f);
            const baseVert = vertOffset;

            for (let ty = 0; ty <= G; ty++) {
                const t = -1 + 2 * ty / G;
                for (let sx = 0; sx <= G; sx++) {
                    const s = -1 + 2 * sx / G;

                    const dir = cubeFaceToSphereDir(face, s, t);
                    const h = this.sampleHeightFromCache(f, s, t);

                    const smoothNoise = Math.pow(h, 1.2);
                    const displacement = smoothNoise * 1.8;
                    const radius = 1.0 + displacement;

                    const vi = vertOffset * 3;
                    positions[vi] = dir[0] * radius;
                    positions[vi + 1] = dir[1] * radius;
                    positions[vi + 2] = dir[2] * radius;
                    heights[vertOffset] = smoothNoise;
                    vertOffset++;
                }
            }

            // Verificar se face precisa de flip no winding (right x up deve apontar na direcao da normal)
            const cx = face.right[1] * face.up[2] - face.right[2] * face.up[1];
            const cy = face.right[2] * face.up[0] - face.right[0] * face.up[2];
            const cz = face.right[0] * face.up[1] - face.right[1] * face.up[0];
            const flipWinding = (cx * face.normal[0] + cy * face.normal[1] + cz * face.normal[2]) < 0;

            for (let ty = 0; ty < G; ty++) {
                for (let sx = 0; sx < G; sx++) {
                    const i00 = baseVert + ty * (G + 1) + sx;
                    const i10 = i00 + 1;
                    const i01 = i00 + (G + 1);
                    const i11 = i01 + 1;

                    if (flipWinding) {
                        indices[idxOffset++] = i00;
                        indices[idxOffset++] = i01;
                        indices[idxOffset++] = i10;
                        indices[idxOffset++] = i10;
                        indices[idxOffset++] = i01;
                        indices[idxOffset++] = i11;
                    } else {
                        indices[idxOffset++] = i00;
                        indices[idxOffset++] = i10;
                        indices[idxOffset++] = i01;
                        indices[idxOffset++] = i10;
                        indices[idxOffset++] = i11;
                        indices[idxOffset++] = i01;
                    }
                }
            }
        }

        // Normais: acumular normais dos triangulos nos vertices
        for (let i = 0; i < indices.length; i += 3) {
            const i0 = indices[i], i1 = indices[i + 1], i2 = indices[i + 2];
            const ax = positions[i1 * 3] - positions[i0 * 3];
            const ay = positions[i1 * 3 + 1] - positions[i0 * 3 + 1];
            const az = positions[i1 * 3 + 2] - positions[i0 * 3 + 2];
            const bx = positions[i2 * 3] - positions[i0 * 3];
            const by = positions[i2 * 3 + 1] - positions[i0 * 3 + 1];
            const bz = positions[i2 * 3 + 2] - positions[i0 * 3 + 2];
            const nx = ay * bz - az * by;
            const ny = az * bx - ax * bz;
            const nz = ax * by - ay * bx;
            normals[i0 * 3] += nx; normals[i0 * 3 + 1] += ny; normals[i0 * 3 + 2] += nz;
            normals[i1 * 3] += nx; normals[i1 * 3 + 1] += ny; normals[i1 * 3 + 2] += nz;
            normals[i2 * 3] += nx; normals[i2 * 3 + 1] += ny; normals[i2 * 3 + 2] += nz;
        }
        for (let i = 0; i < totalVerts; i++) {
            const nx = normals[i * 3], ny = normals[i * 3 + 1], nz = normals[i * 3 + 2];
            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 0) {
                normals[i * 3] /= len;
                normals[i * 3 + 1] /= len;
                normals[i * 3 + 2] /= len;
            }
        }

        // Edge indices para wireframe (linhas do grid + diagonais dos triangulos)
        const edgesPerFace = 2 * (G + 1) * G + G * G;
        const totalEdgeIndices = NUM_FACES * edgesPerFace * 2;
        const edgeIndices = new Uint32Array(totalEdgeIndices);
        let ei = 0;
        for (let f = 0; f < NUM_FACES; f++) {
            const base = f * vertsPerFace;
            // Arestas horizontais
            for (let ty = 0; ty <= G; ty++) {
                for (let sx = 0; sx < G; sx++) {
                    edgeIndices[ei++] = base + ty * (G + 1) + sx;
                    edgeIndices[ei++] = base + ty * (G + 1) + sx + 1;
                }
            }
            // Arestas verticais
            for (let sx = 0; sx <= G; sx++) {
                for (let ty = 0; ty < G; ty++) {
                    edgeIndices[ei++] = base + ty * (G + 1) + sx;
                    edgeIndices[ei++] = base + (ty + 1) * (G + 1) + sx;
                }
            }
            // Diagonais dos triangulos (i10 -> i01)
            for (let ty = 0; ty < G; ty++) {
                for (let sx = 0; sx < G; sx++) {
                    edgeIndices[ei++] = base + ty * (G + 1) + sx + 1;
                    edgeIndices[ei++] = base + (ty + 1) * (G + 1) + sx;
                }
            }
        }

        // Upload para GPU
        if (!this.terrainVao) this.terrainVao = gl.createVertexArray();
        gl.bindVertexArray(this.terrainVao);

        if (!this.terrainPosBuffer) this.terrainPosBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.terrainPosBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
        if (this.positionLoc !== -1) {
            gl.enableVertexAttribArray(this.positionLoc);
            gl.vertexAttribPointer(this.positionLoc, 3, gl.FLOAT, false, 0, 0);
        }

        if (!this.terrainNormBuffer) this.terrainNormBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.terrainNormBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.DYNAMIC_DRAW);
        if (this.normalLoc !== -1) {
            gl.enableVertexAttribArray(this.normalLoc);
            gl.vertexAttribPointer(this.normalLoc, 3, gl.FLOAT, false, 0, 0);
        }

        if (!this.terrainHeightBuffer) this.terrainHeightBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.terrainHeightBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, heights, gl.DYNAMIC_DRAW);
        if (this.heightLoc !== -1) {
            gl.enableVertexAttribArray(this.heightLoc);
            gl.vertexAttribPointer(this.heightLoc, 1, gl.FLOAT, false, 0, 0);
        }

        if (!this.terrainIdxBuffer) this.terrainIdxBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.terrainIdxBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);
        this.terrainNumIndices = indices.length;

        gl.bindVertexArray(null);

        if (!this.terrainEdgeBuffer) this.terrainEdgeBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.terrainEdgeBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edgeIndices, gl.DYNAMIC_DRAW);
        this.terrainNumEdgeIndices = ei;

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    
    // WATER MESH
    

    initWaterMesh() {
        const gl = this.gl;
        const waterData = generateWaterMesh(this.seaLevel, 32);

        if (this.waterVao) {
            gl.deleteVertexArray(this.waterVao);
        }

        this.waterVao = gl.createVertexArray();
        gl.bindVertexArray(this.waterVao);

        // Position buffer
        const posBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, waterData.positions, gl.STATIC_DRAW);
        if (this.waterPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.waterPositionLoc);
            gl.vertexAttribPointer(this.waterPositionLoc, 3, gl.FLOAT, false, 0, 0);
        }

        // Normal buffer
        const normBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, waterData.normals, gl.STATIC_DRAW);
        if (this.waterNormalLoc !== -1) {
            gl.enableVertexAttribArray(this.waterNormalLoc);
            gl.vertexAttribPointer(this.waterNormalLoc, 3, gl.FLOAT, false, 0, 0);
        }

        // Index buffer
        const idxBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, waterData.indices, gl.STATIC_DRAW);

        this.waterNumElements = waterData.indices.length;

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    
    // STARS
    

    initStars() {
        const gl = this.gl;
        const numStars = 2000;
        const starData = new Float32Array(numStars * 4);

        for (let i = 0; i < numStars; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 15 + Math.random() * 20;

            starData[i * 4] = radius * Math.sin(phi) * Math.cos(theta);
            starData[i * 4 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            starData[i * 4 + 2] = radius * Math.cos(phi);
            starData[i * 4 + 3] = 1.5 + Math.random() * 2.5;
        }

        this.numStars = numStars;
        this.starVao = gl.createVertexArray();
        gl.bindVertexArray(this.starVao);

        const starBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, starBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, starData, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(this.starPositionLoc);
        gl.vertexAttribPointer(this.starPositionLoc, 3, gl.FLOAT, false, 16, 0);
        gl.enableVertexAttribArray(this.starSizeLoc);
        gl.vertexAttribPointer(this.starSizeLoc, 1, gl.FLOAT, false, 16, 12);

        gl.bindVertexArray(null);
    }

    renderStars(viewProjectionMatrix) {
        const gl = this.gl;
        gl.disable(gl.DEPTH_TEST);
        gl.useProgram(this.starProgram);
        gl.bindVertexArray(this.starVao);
        gl.uniformMatrix4fv(this.starViewProjectionMatrixLoc, false, viewProjectionMatrix);
        gl.drawArrays(gl.POINTS, 0, this.numStars);
        gl.bindVertexArray(null);
        gl.enable(gl.DEPTH_TEST);
    }

    
    // SHADOW MAP
    

    createShadowMapFramebuffer() {
        const gl = this.gl;

        this.shadowMap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT32F,
            this.shadowMapSize, this.shadowMapSize, 0,
            gl.DEPTH_COMPONENT, gl.FLOAT, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowMap, 0);
    }

    
    // PICKING
    

    createPickingFramebuffer() {
        const gl = this.gl;

        this.pickingTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Depth renderbuffer para picking
        this.pickingDepthBuffer = gl.createRenderbuffer();

        this.pickingFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickingTexture, 0);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickingDepthBuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resizePickingFramebuffer(width, height) {
        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

        gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickingDepthBuffer);
        gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    }

    
    // OBJECT TEXTURE
    

    async loadObjectTexture() {
        const gl = this.gl;
        const image = new Image();

        return new Promise((resolve, reject) => {
            image.onload = () => {
                this.objectTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.objectTexture);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.bindTexture(gl.TEXTURE_2D, null);
                resolve();
            };
            image.onerror = reject;
            image.src = 'Assets/textures/spacebits_texture.png';
        });
    }

    
    // MOUSE CONTROLS
    

    setupMouseControls() {
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.editMode !== 'none') {
                this.isTerrainEditing = true;
                const rect = this.canvas.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                this.applyTerrainBrush(mx, my);
                return;
            }

            if (this.isAddMode) return;

            if (this.hoveredObjectIndex >= 0) {
                this.isObjectDragging = true;
                this.draggedObjectIndex = this.hoveredObjectIndex;
                this.selectedObjectIndex = this.hoveredObjectIndex;
                this.didMoveObject = false;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;

                this.canvas.dispatchEvent(new CustomEvent('objectSelected', {
                    detail: {
                        index: this.selectedObjectIndex,
                        object: this.placedObjects[this.selectedObjectIndex]
                    }
                }));
            } else {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

            if (this.isTerrainEditing && this.editMode !== 'none') {
                this.applyTerrainBrush(this.mouseX, this.mouseY);
                return;
            }

            if (this.isObjectDragging && this.draggedObjectIndex >= 0) {
                const dx = e.clientX - this.dragStartX;
                const dy = e.clientY - this.dragStartY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    this.didMoveObject = true;
                }

                if (this.didMoveObject) {
                    const hit = this.raycastPlanet(this.mouseX, this.mouseY);
                    if (hit) {
                        const obj = this.placedObjects[this.draggedObjectIndex];
                        obj.baseX = hit.baseX;
                        obj.baseY = hit.baseY;
                        obj.baseZ = hit.baseZ;
                        obj.faceId = hit.faceId;
                        obj.faceS = hit.faceS;
                        obj.faceT = hit.faceT;
                        this.updateObjectPosition(obj);
                    }
                }
            } else if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouseX;
                const deltaY = e.clientY - this.lastMouseY;
                this.rotationY += deltaX * 0.005;
                this.rotationX += deltaY * 0.005;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isTerrainEditing = false;
            this.isObjectDragging = false;
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.isObjectDragging = false;
            this.isTerrainEditing = false;
            this.mouseX = -1;
            this.mouseY = -1;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.editMode !== 'none') return;

            if (this.didMoveObject) {
                this.didMoveObject = false;
                return;
            }

            // Verificar clique em cometa primeiro
            const rect = this.canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;

            const cometIndex = this.raycastComets(mx, my);
            if (cometIndex >= 0) {
                this.cometManager.destroyCometByClick(cometIndex);
                this.canvas.dispatchEvent(new CustomEvent('scoreChanged', {
                    detail: { score: this.cometManager.score }
                }));
                return;
            }

            if (this.isAddMode) {
                const hit = this.raycastPlanet(mx, my);
                if (hit) {
                    this.placeObjectAtPoint(
                        this.addModeModelPath,
                        this.addModeScale,
                        hit.baseX, hit.baseY, hit.baseZ,
                        hit.faceId, hit.faceS, hit.faceT
                    );
                    this.exitAddMode();
                }
                return;
            }

            if (this.hoveredObjectIndex >= 0) {
                this.selectedObjectIndex = this.hoveredObjectIndex;
                this.canvas.dispatchEvent(new CustomEvent('objectSelected', {
                    detail: {
                        index: this.selectedObjectIndex,
                        object: this.placedObjects[this.selectedObjectIndex]
                    }
                }));
            } else {
                this.selectedObjectIndex = -1;
                this.canvas.dispatchEvent(new CustomEvent('objectDeselected'));
            }
        });
    }

    
    // RAYCASTING
    

    raycastPlanet(mouseX, mouseY) {
        const ndcX = (2 * mouseX / this.canvas.clientWidth) - 1;
        const ndcY = 1 - (2 * mouseY / this.canvas.clientHeight);

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -this.cameraDistance]);

        const planetModelMatrix = mat4.create();
        mat4.rotateY(planetModelMatrix, planetModelMatrix, this.rotationY);
        mat4.rotateX(planetModelMatrix, planetModelMatrix, this.rotationX);

        const vpMatrix = mat4.create();
        mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);
        const vpPlanet = mat4.create();
        mat4.multiply(vpPlanet, vpMatrix, planetModelMatrix);
        const invVPPlanet = mat4.create();
        if (!mat4.invert(invVPPlanet, vpPlanet)) return null;

        function transformPoint4(m, p) {
            const x = m[0]*p[0] + m[4]*p[1] + m[8]*p[2]  + m[12]*p[3];
            const y = m[1]*p[0] + m[5]*p[1] + m[9]*p[2]  + m[13]*p[3];
            const z = m[2]*p[0] + m[6]*p[1] + m[10]*p[2] + m[14]*p[3];
            const w = m[3]*p[0] + m[7]*p[1] + m[11]*p[2] + m[15]*p[3];
            if (w !== 0) return [x/w, y/w, z/w];
            return [x, y, z];
        }

        const nearLocal = transformPoint4(invVPPlanet, [ndcX, ndcY, -1, 1]);
        const farLocal  = transformPoint4(invVPPlanet, [ndcX, ndcY,  1, 1]);

        const rayDir = [
            farLocal[0] - nearLocal[0],
            farLocal[1] - nearLocal[1],
            farLocal[2] - nearLocal[2]
        ];
        const rayLen = Math.sqrt(rayDir[0]**2 + rayDir[1]**2 + rayDir[2]**2);
        rayDir[0] /= rayLen;
        rayDir[1] /= rayLen;
        rayDir[2] /= rayLen;

        // Raio maximo do planeta: 1.0 + 1.8 = 2.8
        const R = 2.8;
        const ox = nearLocal[0], oy = nearLocal[1], oz = nearLocal[2];
        const dx = rayDir[0], dy = rayDir[1], dz = rayDir[2];

        const a = dx*dx + dy*dy + dz*dz;
        const b = 2 * (ox*dx + oy*dy + oz*dz);
        const c = ox*ox + oy*oy + oz*oz - R*R;

        const discriminant = b*b - 4*a*c;
        if (discriminant < 0) return null;

        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t < 0) return null;

        const hitX = ox + t * dx;
        const hitY = oy + t * dy;
        const hitZ = oz + t * dz;

        const len = Math.sqrt(hitX*hitX + hitY*hitY + hitZ*hitZ);
        const baseX = hitX / len;
        const baseY = hitY / len;
        const baseZ = hitZ / len;

        // Converter para coordenadas de face do cubo
        const faceCoord = sphereDirToFace(baseX, baseY, baseZ);

        return {
            baseX, baseY, baseZ,
            faceId: faceCoord.faceId,
            faceS: faceCoord.s,
            faceT: faceCoord.t
        };
    }

    
    // TERRAIN EDITING
    

    enterEditMode(mode) {
        if (this.isAddMode) this.exitAddMode();
        this.editMode = mode;
        this.canvas.dispatchEvent(new CustomEvent('editModeChanged', { detail: { mode } }));
    }

    exitEditMode() {
        this.editMode = 'none';
        this.isTerrainEditing = false;
        this.canvas.dispatchEvent(new CustomEvent('editModeChanged', { detail: { mode: 'none' } }));
    }

    applyTerrainBrush(mouseX, mouseY) {
        const hit = this.raycastPlanet(mouseX, mouseY);
        if (!hit) return;

        const { faceId, faceS, faceT, baseX, baseY, baseZ } = hit;
        const res = this.heightmapResolution;
        const brushRadiusFace = (this.brushRadius / res) * 2;
        const strength = this.editMode === 'raise' ? this.brushStrength : -this.brushStrength;
        const radiusPx = this.brushRadius;

        // Pintar na face primaria
        this.paintBrushOnFace(faceId, faceS, faceT, radiusPx, strength);

        // Cross-face: se o brush se estende alem das bordas da face
        const centerDir = [baseX, baseY, baseZ];
        const adj = getAdjacency(faceId);
        const overflows = [
            { cond: faceS - brushRadiusFace < -1, edge: 'left' },
            { cond: faceS + brushRadiusFace > 1, edge: 'right' },
            { cond: faceT - brushRadiusFace < -1, edge: 'bottom' },
            { cond: faceT + brushRadiusFace > 1, edge: 'top' }
        ];

        for (const { cond, edge } of overflows) {
            if (!cond) continue;

            const adjFaceId = adj[edge].face;
            const projCoord = projectDirToFace(centerDir, adjFaceId);
            if (!projCoord) continue;

            this.paintBrushOnFace(adjFaceId, projCoord.s, projCoord.t, radiusPx, strength);
        }

        // Reconstruir mesh do terreno
        this.buildTerrainMesh();

        // Reposicionar objetos
        this.repositionAllObjects();
    }

    paintBrushOnFace(faceId, centerS, centerT, radiusPx, strength) {
        const res = this.heightmapResolution;
        const data = this.heightmapData[faceId];

        const centerPx = (centerS + 1) / 2 * (res - 1);
        const centerPy = (centerT + 1) / 2 * (res - 1);

        const minX = Math.max(0, Math.floor(centerPx - radiusPx));
        const maxX = Math.min(res - 1, Math.ceil(centerPx + radiusPx));
        const minY = Math.max(0, Math.floor(centerPy - radiusPx));
        const maxY = Math.min(res - 1, Math.ceil(centerPy + radiusPx));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                const dx = x - centerPx;
                const dy = y - centerPy;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > radiusPx) continue;

                const nd = dist / radiusPx;
                const falloff = 1.0 - nd * nd * (3.0 - 2.0 * nd);

                const idx = y * res + x;
                data[idx] = Math.max(0, Math.min(1, data[idx] + strength * falloff));
            }
        }
    }

    
    // OBJECT MANAGEMENT
    

    async loadModel(path) {
        if (this.loadedModels.has(path)) {
            return this.loadedModels.get(path);
        }

        const objData = await OBJLoader.load(path);
        const gl = this.gl;
        const stride = 32;

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, objData.vertices, gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, objData.indices, gl.STATIC_DRAW);

        // VAO principal (objetos)
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        if (this.objectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.objectPositionLoc);
            gl.vertexAttribPointer(this.objectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        }
        if (this.objectNormalLoc !== -1) {
            gl.enableVertexAttribArray(this.objectNormalLoc);
            gl.vertexAttribPointer(this.objectNormalLoc, 3, gl.FLOAT, false, stride, 12);
        }
        if (this.objectUVLoc !== -1) {
            gl.enableVertexAttribArray(this.objectUVLoc);
            gl.vertexAttribPointer(this.objectUVLoc, 2, gl.FLOAT, false, stride, 24);
        }
        gl.bindVertexArray(null);

        // VAO depth
        const depthVao = gl.createVertexArray();
        gl.bindVertexArray(depthVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        if (this.depthObjectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.depthObjectPositionLoc);
            gl.vertexAttribPointer(this.depthObjectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        }
        gl.bindVertexArray(null);

        // VAO picking
        const pickingVao = gl.createVertexArray();
        gl.bindVertexArray(pickingVao);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        if (this.pickingObjectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.pickingObjectPositionLoc);
            gl.vertexAttribPointer(this.pickingObjectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        }
        gl.bindVertexArray(null);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        const model = {
            vao, depthVao, pickingVao, vertexBuffer, indexBuffer,
            numElements: objData.indices.length,
            useUint32: objData.useUint32
        };

        this.loadedModels.set(path, model);
        return model;
    }

    async placeObjectAtPoint(modelPath, scale, baseX, baseY, baseZ, faceId, faceS, faceT) {
        const model = await this.loadModel(modelPath);

        const noiseValue = this.sampleHeightFromCache(faceId, faceS, faceT);
        const smoothNoise = Math.pow(noiseValue, 1.2);
        const displacement = smoothNoise * 1.8;

        const obj = {
            model,
            faceId, faceS, faceT,
            baseX, baseY, baseZ,
            scale,
            position: [0, 0, 0],
            normal: [baseX, baseY, baseZ],
            noiseValue, smoothNoise, displacement
        };

        this.placedObjects.push(obj);
        this.updateObjectPosition(obj);
        return obj;
    }

    enterAddMode(modelPath, scale) {
        if (this.editMode !== 'none') this.exitEditMode();
        this.isAddMode = true;
        this.addModeModelPath = modelPath;
        this.addModeScale = scale;
        this.loadModel(modelPath);
        this.canvas.dispatchEvent(new CustomEvent('addModeChanged', { detail: { active: true } }));
    }

    exitAddMode() {
        this.isAddMode = false;
        this.addModeModelPath = '';
        this.addModeScale = 1.0;
        this.canvas.dispatchEvent(new CustomEvent('addModeChanged', { detail: { active: false } }));
    }

    async placeObject(modelPath, scale) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const baseX = Math.sin(phi) * Math.cos(theta);
        const baseY = Math.cos(phi);
        const baseZ = Math.sin(phi) * Math.sin(theta);

        const faceCoord = sphereDirToFace(baseX, baseY, baseZ);

        const model = await this.loadModel(modelPath);
        const noiseValue = this.sampleHeightFromCache(faceCoord.faceId, faceCoord.s, faceCoord.t);
        const smoothNoise = Math.pow(noiseValue, 1.2);
        const displacement = smoothNoise * 1.8;

        const obj = {
            model,
            faceId: faceCoord.faceId,
            faceS: faceCoord.s,
            faceT: faceCoord.t,
            baseX, baseY, baseZ,
            scale,
            position: [0, 0, 0],
            normal: [baseX, baseY, baseZ],
            noiseValue, smoothNoise, displacement
        };

        this.placedObjects.push(obj);
        this.updateObjectPosition(obj);
        return obj;
    }

    clearObjects() {
        this.placedObjects = [];
    }

    updateObjectPosition(obj) {
        const noiseValue = this.sampleHeightFromCache(obj.faceId, obj.faceS, obj.faceT);
        const smoothNoise = Math.pow(noiseValue, 1.2);
        const displacement = smoothNoise * 1.8;

        const totalRadius = 1.0 + displacement;
        const surfaceOffset = 0.01;

        obj.position[0] = obj.baseX * (totalRadius + surfaceOffset);
        obj.position[1] = obj.baseY * (totalRadius + surfaceOffset);
        obj.position[2] = obj.baseZ * (totalRadius + surfaceOffset);

        obj.normal[0] = obj.baseX;
        obj.normal[1] = obj.baseY;
        obj.normal[2] = obj.baseZ;

        obj.height = smoothNoise;
    }

    repositionAllObjects() {
        for (const obj of this.placedObjects) {
            this.updateObjectPosition(obj);
        }
    }

    getObjectModelMatrix(obj) {
        const modelMatrix = mat4.create();
        const normal = obj.normal;

        let refFront = [0, 0, 1];
        let front = [
            refFront[0] - normal[0] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2]),
            refFront[1] - normal[1] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2]),
            refFront[2] - normal[2] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2])
        ];

        const frontLength = Math.sqrt(front[0]*front[0] + front[1]*front[1] + front[2]*front[2]);
        if (frontLength < 0.001) {
            refFront = [1, 0, 0];
            front = [
                refFront[0] - normal[0] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2]),
                refFront[1] - normal[1] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2]),
                refFront[2] - normal[2] * (normal[0]*refFront[0] + normal[1]*refFront[1] + normal[2]*refFront[2])
            ];
        }

        const frontLen = Math.sqrt(front[0]*front[0] + front[1]*front[1] + front[2]*front[2]);
        if (frontLen > 0) {
            front[0] /= frontLen;
            front[1] /= frontLen;
            front[2] /= frontLen;
        }

        const right = [
            normal[1] * front[2] - normal[2] * front[1],
            normal[2] * front[0] - normal[0] * front[2],
            normal[0] * front[1] - normal[1] * front[0]
        ];

        mat4.set(modelMatrix,
            right[0], right[1], right[2], 0,
            normal[0], normal[1], normal[2], 0,
            front[0], front[1], front[2], 0,
            obj.position[0], obj.position[1], obj.position[2], 1
        );

        mat4.scale(modelMatrix, modelMatrix, [obj.scale, obj.scale, obj.scale]);
        return modelMatrix;
    }

    // Cometa
    initCometSystem() {
        const gl = this.gl;

        this.cometProgram = createProgram(
            gl,
            createShader(gl, gl.VERTEX_SHADER, cometVertexShaderSource),
            createShader(gl, gl.FRAGMENT_SHADER, cometFragmentShaderSource)
        );

        this.cometPositionLoc = gl.getAttribLocation(this.cometProgram, 'a_position');
        this.cometNormalLoc = gl.getAttribLocation(this.cometProgram, 'a_normal');
        this.cometMvpMatrixLoc = gl.getUniformLocation(this.cometProgram, 'u_mvpMatrix');
        this.cometModelMatrixLoc = gl.getUniformLocation(this.cometProgram, 'u_modelMatrix');
        this.cometCameraPosLoc = gl.getUniformLocation(this.cometProgram, 'u_cameraPos');
        this.cometDestroyProgressLoc = gl.getUniformLocation(this.cometProgram, 'u_destroyProgress');

        const t = (1 + Math.sqrt(5)) / 2;
        const rawVerts = [
            -1, t, 0,   1, t, 0,   -1, -t, 0,   1, -t, 0,
             0, -1, t,   0, 1, t,   0, -1, -t,   0, 1, -t,
             t, 0, -1,   t, 0, 1,  -t, 0, -1,  -t, 0, 1
        ];

        for (let i = 0; i < rawVerts.length; i += 3) {
            const len = Math.sqrt(rawVerts[i] ** 2 + rawVerts[i + 1] ** 2 + rawVerts[i + 2] ** 2);
            rawVerts[i] /= len;
            rawVerts[i + 1] /= len;
            rawVerts[i + 2] /= len;
        }

        const icoIndices = [
            0, 11, 5,  0, 5, 1,  0, 1, 7,  0, 7, 10,  0, 10, 11,
            1, 5, 9,  5, 11, 4,  11, 10, 2,  10, 7, 6,  7, 1, 8,
            3, 9, 4,  3, 4, 2,  3, 2, 6,  3, 6, 8,  3, 8, 9,
            4, 9, 5,  2, 4, 11,  6, 2, 10,  8, 6, 7,  9, 8, 1
        ];

        const subdivided = this._subdivideIcosahedron(rawVerts, icoIndices);
        const positions = new Float32Array(subdivided.positions);
        const normals = new Float32Array(subdivided.positions); 
        const indices = new Uint16Array(subdivided.indices);

        this.cometNumIndices = indices.length;

        // VAO para cometas
        this.cometVao = gl.createVertexArray();
        gl.bindVertexArray(this.cometVao);

        const posBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
        gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
        if (this.cometPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.cometPositionLoc);
            gl.vertexAttribPointer(this.cometPositionLoc, 3, gl.FLOAT, false, 0, 0);
        }

        const normBuf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
        gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);
        if (this.cometNormalLoc !== -1) {
            gl.enableVertexAttribArray(this.cometNormalLoc);
            gl.vertexAttribPointer(this.cometNormalLoc, 3, gl.FLOAT, false, 0, 0);
        }

        const idxBuf = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    _subdivideIcosahedron(verts, indices) {
        const midCache = {};
        const newVerts = [...verts];
        const newIndices = [];

        function getMidpoint(i0, i1) {
            const key = Math.min(i0, i1) + '_' + Math.max(i0, i1);
            if (midCache[key] !== undefined) return midCache[key];

            const x = (newVerts[i0 * 3] + newVerts[i1 * 3]) / 2;
            const y = (newVerts[i0 * 3 + 1] + newVerts[i1 * 3 + 1]) / 2;
            const z = (newVerts[i0 * 3 + 2] + newVerts[i1 * 3 + 2]) / 2;
            const len = Math.sqrt(x * x + y * y + z * z);

            const idx = newVerts.length / 3;
            newVerts.push(x / len, y / len, z / len);
            midCache[key] = idx;
            return idx;
        }

        for (let i = 0; i < indices.length; i += 3) {
            const a = indices[i], b = indices[i + 1], c = indices[i + 2];
            const ab = getMidpoint(a, b);
            const bc = getMidpoint(b, c);
            const ca = getMidpoint(c, a);

            newIndices.push(
                a, ab, ca,
                b, bc, ab,
                c, ca, bc,
                ab, bc, ca
            );
        }

        return { positions: newVerts, indices: newIndices };
    }

    getCometModelMatrix(comet) {
        const m = mat4.create();

        mat4.translate(m, m, comet.position);

        const axis = comet.rotationAxis;
        const angle = comet.rotation;
        const c = Math.cos(angle), s = Math.sin(angle);
        const t = 1 - c;
        const x = axis[0], y = axis[1], z = axis[2];

        const rotMatrix = mat4.create();
        mat4.set(rotMatrix,
            t * x * x + c,     t * x * y + s * z, t * x * z - s * y, 0,
            t * x * y - s * z, t * y * y + c,     t * y * z + s * x, 0,
            t * x * z + s * y, t * y * z - s * x, t * z * z + c,     0,
            0, 0, 0, 1
        );

        mat4.multiply(m, m, rotMatrix);

        mat4.scale(m, m, [comet.size, comet.size, comet.size]);

        return m;
    }

    renderComets(projectionMatrix, viewMatrix, cameraPos) {
        const gl = this.gl;
        const comets = this.cometManager.comets;
        if (comets.length === 0) return;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.cometProgram);
        gl.uniform3fv(this.cometCameraPosLoc, cameraPos);

        gl.bindVertexArray(this.cometVao);

        for (const comet of comets) {
            const modelMatrix = this.getCometModelMatrix(comet);
            const mvMatrix = mat4.create();
            mat4.multiply(mvMatrix, viewMatrix, modelMatrix);
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);

            gl.uniformMatrix4fv(this.cometMvpMatrixLoc, false, mvpMatrix);
            gl.uniformMatrix4fv(this.cometModelMatrixLoc, false, modelMatrix);

            const destroyProgress = comet.destroying ? Math.min(comet.destroyTimer / 0.4, 1.0) : 0.0;
            gl.uniform1f(this.cometDestroyProgressLoc, destroyProgress);

            gl.drawElements(gl.TRIANGLES, this.cometNumIndices, gl.UNSIGNED_SHORT, 0);
        }

        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
    }

    raycastComets(mouseX, mouseY) {
        const ndcX = (2 * mouseX / this.canvas.clientWidth) - 1;
        const ndcY = 1 - (2 * mouseY / this.canvas.clientHeight);

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -this.cameraDistance]);

        const vpMatrix = mat4.create();
        mat4.multiply(vpMatrix, projectionMatrix, viewMatrix);
        const invVP = mat4.create();
        if (!mat4.invert(invVP, vpMatrix)) return -1;

        function transformPoint4(m, p) {
            const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12] * p[3];
            const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13] * p[3];
            const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14] * p[3];
            const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15] * p[3];
            if (w !== 0) return [x / w, y / w, z / w];
            return [x, y, z];
        }

        const nearWorld = transformPoint4(invVP, [ndcX, ndcY, -1, 1]);
        const farWorld = transformPoint4(invVP, [ndcX, ndcY, 1, 1]);

        const rayDir = [
            farWorld[0] - nearWorld[0],
            farWorld[1] - nearWorld[1],
            farWorld[2] - nearWorld[2]
        ];
        const rayLen = Math.sqrt(rayDir[0] ** 2 + rayDir[1] ** 2 + rayDir[2] ** 2);
        rayDir[0] /= rayLen;
        rayDir[1] /= rayLen;
        rayDir[2] /= rayLen;

        let closestIndex = -1;
        let closestT = Infinity;

        for (let i = 0; i < this.cometManager.comets.length; i++) {
            const comet = this.cometManager.comets[i];
            if (comet.destroying) continue;

            const cx = comet.position[0], cy = comet.position[1], cz = comet.position[2];
            const R = comet.size * 1.5; 

            const ox = nearWorld[0] - cx;
            const oy = nearWorld[1] - cy;
            const oz = nearWorld[2] - cz;

            const a = rayDir[0] ** 2 + rayDir[1] ** 2 + rayDir[2] ** 2;
            const b = 2 * (ox * rayDir[0] + oy * rayDir[1] + oz * rayDir[2]);
            const c = ox ** 2 + oy ** 2 + oz ** 2 - R * R;

            const disc = b * b - 4 * a * c;
            if (disc < 0) continue;

            const t = (-b - Math.sqrt(disc)) / (2 * a);
            if (t > 0 && t < closestT) {
                closestT = t;
                closestIndex = i;
            }
        }

        return closestIndex;
    }

    getTerrainRadiusAtDir(dirX, dirY, dirZ) {
        const faceCoord = sphereDirToFace(dirX, dirY, dirZ);
        const h = this.sampleHeightFromCache(faceCoord.faceId, faceCoord.s, faceCoord.t);
        const smoothNoise = Math.pow(h, 1.2);
        const displacement = smoothNoise * 1.8;
        return 1.0 + displacement;
    }

    updateAndCheckComets(deltaTime, planetModelMatrix) {
        this.cometManager.updateComets(deltaTime);

        const planetInvMatrix = mat4.create();
        mat4.invert(planetInvMatrix, planetModelMatrix);

        const comets = this.cometManager.comets;
        for (let i = comets.length - 1; i >= 0; i--) {
            const comet = comets[i];
            if (comet.destroying) continue;

            const impact = this.cometManager.checkPlanetCollision(
                comet,
                planetInvMatrix,
                (dx, dy, dz) => this.getTerrainRadiusAtDir(dx, dy, dz)
            );

            if (impact) {
                const craterRadius = this.cometManager.config.craterRadius;
                const craterDepth = this.cometManager.config.craterDepth;

                this.paintBrushOnFace(impact.faceId, impact.faceS, impact.faceT, craterRadius, -craterDepth);

                const adj = getAdjacency(impact.faceId);
                const centerDir = [impact.dirX, impact.dirY, impact.dirZ];
                const brushRadiusFace = (craterRadius / this.heightmapResolution) * 2;

                const overflows = [
                    { cond: impact.faceS - brushRadiusFace < -1, edge: 'left' },
                    { cond: impact.faceS + brushRadiusFace > 1, edge: 'right' },
                    { cond: impact.faceT - brushRadiusFace < -1, edge: 'bottom' },
                    { cond: impact.faceT + brushRadiusFace > 1, edge: 'top' }
                ];

                for (const { cond, edge } of overflows) {
                    if (!cond) continue;
                    const adjFaceId = adj[edge].face;
                    const projCoord = projectDirToFace(centerDir, adjFaceId);
                    if (!projCoord) continue;
                    this.paintBrushOnFace(adjFaceId, projCoord.s, projCoord.t, craterRadius, -craterDepth);
                }

                this.buildTerrainMesh();
                this.repositionAllObjects();

                this.cometManager.destroyCometByImpact(i);
            }
        }
    }


    // RENDER PASSES


    renderTerrainDepth(lightMatrix, planetModelMatrix) {
        const gl = this.gl;
        gl.useProgram(this.depthProgram);
        gl.uniformMatrix4fv(this.depthLightMatrixLoc, false, lightMatrix);
        gl.uniformMatrix4fv(this.depthWorldMatrixLoc, false, planetModelMatrix);

        gl.bindVertexArray(this.terrainVao);
        gl.drawElements(gl.TRIANGLES, this.terrainNumIndices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }

    renderObjectsDepth(lightMatrix, planetModelMatrix) {
        const gl = this.gl;

        if (this.placedObjects.length === 0) return;

        gl.useProgram(this.depthObjectProgram);

        for (const obj of this.placedObjects) {
            const objectLocalMatrix = this.getObjectModelMatrix(obj);
            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);

            gl.uniformMatrix4fv(this.depthObjectMatrixLoc, false, lightMatrix);
            gl.uniformMatrix4fv(this.depthObjectWorldMatrixLoc, false, worldMatrix);

            gl.bindVertexArray(obj.model.depthVao);
            const indexType = obj.model.useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, indexType, 0);
        }

        gl.bindVertexArray(null);
    }

    renderObjectsPicking(projectionMatrix, viewMatrix, planetModelMatrix) {
        const gl = this.gl;

        if (this.placedObjects.length === 0) return;

        gl.useProgram(this.pickingObjectProgram);

        for (let i = 0; i < this.placedObjects.length; i++) {
            const obj = this.placedObjects[i];
            const objectLocalMatrix = this.getObjectModelMatrix(obj);
            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);
            const mvMatrix = mat4.create();
            mat4.multiply(mvMatrix, viewMatrix, worldMatrix);
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);

            const id = i + 1;
            const idColor = [
                ((id >> 0) & 0xFF) / 0xFF,
                ((id >> 8) & 0xFF) / 0xFF,
                ((id >> 16) & 0xFF) / 0xFF,
                ((id >> 24) & 0xFF) / 0xFF
            ];

            gl.uniformMatrix4fv(this.pickingObjectMatrixLoc, false, mvpMatrix);
            gl.uniformMatrix4fv(this.pickingObjectWorldMatrixLoc, false, worldMatrix);
            gl.uniform4fv(this.pickingObjectIdLoc, idColor);

            gl.bindVertexArray(obj.model.pickingVao);
            const indexType = obj.model.useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, indexType, 0);
        }

        gl.bindVertexArray(null);
    }

    pickObject(projectionMatrix, viewMatrix, planetModelMatrix) {
        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.enable(gl.DEPTH_TEST);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.renderObjectsPicking(projectionMatrix, viewMatrix, planetModelMatrix);

        const pixelX = this.mouseX * gl.canvas.width / gl.canvas.clientWidth;
        const pixelY = gl.canvas.height - this.mouseY * gl.canvas.height / gl.canvas.clientHeight - 1;

        const data = new Uint8Array(4);
        gl.readPixels(Math.floor(pixelX), Math.floor(pixelY), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);

        const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);
        this.hoveredObjectIndex = id > 0 ? id - 1 : -1;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    renderTerrain(planetMVP, planetModelMatrix, lightMatrix, cameraPos) {
        const gl = this.gl;

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_worldMatrix'), false, planetModelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_lightMatrix'), false, lightMatrix);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_lightPos'), this.lightPos);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_cameraPos'), cameraPos);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowMap'), 0);

        gl.uniform1f(this.seaLevelLoc, this.seaLevel);
        gl.uniform1f(this.sandRangeLoc, this.sandRange);
        gl.uniform1i(this.useColorLoc, false);

        gl.bindVertexArray(this.terrainVao);
        gl.drawElements(gl.TRIANGLES, this.terrainNumIndices, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);
    }

    renderTerrainWireframe(planetMVP, planetModelMatrix, lightMatrix) {
        const gl = this.gl;

        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_worldMatrix'), false, planetModelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_lightMatrix'), false, lightMatrix);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowMap'), 0);

        gl.uniform1f(this.seaLevelLoc, this.seaLevel);
        gl.uniform1f(this.sandRangeLoc, this.sandRange);

        gl.uniform1i(this.useColorLoc, true);
        gl.uniform3f(this.colorLoc, 0.0, 0.0, 0.0);

        gl.bindVertexArray(this.terrainVao);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.terrainEdgeBuffer);
        gl.drawElements(gl.LINES, this.terrainNumEdgeIndices, gl.UNSIGNED_INT, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.terrainIdxBuffer);

        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.bindVertexArray(null);
    }

    renderWater(planetMVP, planetModelMatrix, lightMatrix, cameraPos) {
        const gl = this.gl;

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.disable(gl.CULL_FACE);

        gl.useProgram(this.waterProgram);
        gl.uniformMatrix4fv(this.waterMatrixLoc, false, planetMVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.waterProgram, 'u_worldMatrix'), false, planetModelMatrix);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.waterProgram, 'u_lightMatrix'), false, lightMatrix);
        gl.uniform3fv(gl.getUniformLocation(this.waterProgram, 'u_lightPos'), this.lightPos);
        gl.uniform3fv(gl.getUniformLocation(this.waterProgram, 'u_cameraPos'), cameraPos);
        gl.uniform1f(this.waterTimeLoc, this.time);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.waterProgram, 'u_shadowMap'), 0);

        gl.bindVertexArray(this.waterVao);
        gl.drawElements(gl.TRIANGLES, this.waterNumElements, gl.UNSIGNED_INT, 0);
        gl.bindVertexArray(null);

        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.disable(gl.BLEND);
    }

    renderObjects(projectionMatrix, viewMatrix, lightMatrix, planetModelMatrix) {
        const gl = this.gl;
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.useProgram(this.objectProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.objectTexture);
        gl.uniform1i(this.objectTextureLoc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.objectProgram, 'u_shadowMap'), 1);

        gl.uniform3fv(gl.getUniformLocation(this.objectProgram, 'u_lightPos'), this.lightPos);

        for (let i = 0; i < this.placedObjects.length; i++) {
            const obj = this.placedObjects[i];
            const objectLocalMatrix = this.getObjectModelMatrix(obj);

            if (i === this.selectedObjectIndex) {
                mat4.scale(objectLocalMatrix, objectLocalMatrix, [1.15, 1.15, 1.15]);
            } else if (i === this.hoveredObjectIndex) {
                mat4.scale(objectLocalMatrix, objectLocalMatrix, [1.08, 1.08, 1.08]);
            }

            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);
            const mvMatrix = mat4.create();
            mat4.multiply(mvMatrix, viewMatrix, worldMatrix);
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);

            gl.uniformMatrix4fv(this.objectMatrixLoc, false, mvpMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.objectProgram, 'u_worldMatrix'), false, worldMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.objectProgram, 'u_lightMatrix'), false, lightMatrix);
            gl.uniform1i(this.objectIsSelectedLoc, i === this.selectedObjectIndex ? 1 : 0);

            gl.bindVertexArray(obj.model.vao);
            const indexType = obj.model.useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, indexType, 0);
        }

        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
    }

    render() {
        const gl = this.gl;

        const now = performance.now();
        const deltaTime = Math.min((now - this.lastFrameTime) / 1000, 0.1);
        this.lastFrameTime = now;

        const planetModelMatrix = mat4.create();
        mat4.rotateY(planetModelMatrix, planetModelMatrix, this.rotationY);
        mat4.rotateX(planetModelMatrix, planetModelMatrix, this.rotationX);

        this.updateAndCheckComets(deltaTime, planetModelMatrix);

        const lightProjectionMatrix = mat4.create();
        const frustumSize = 5.0;
        mat4.ortho(lightProjectionMatrix, -frustumSize, frustumSize, -frustumSize, frustumSize, 0.1, 30.0);

        const lightViewMatrix = mat4.create();
        mat4.lookAt(lightViewMatrix, this.lightPos, this.lightTarget, this.lightUp);

        const lightMatrix = mat4.create();
        mat4.multiply(lightMatrix, lightProjectionMatrix, lightViewMatrix);

        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        this.renderTerrainDepth(lightMatrix, planetModelMatrix);
        this.renderObjectsDepth(lightMatrix, planetModelMatrix);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        gl.clearColor(0.1, 0.1, 0.15, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const viewMatrix = mat4.create();
        const cameraPos = [0, 0, this.cameraDistance];
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -this.cameraDistance]);

        const viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

        this.renderStars(viewProjectionMatrix);

        this.pickObject(projectionMatrix, viewMatrix, planetModelMatrix);

        const planetMV = mat4.create();
        mat4.multiply(planetMV, viewMatrix, planetModelMatrix);
        const planetMVP = mat4.create();
        mat4.multiply(planetMVP, projectionMatrix, planetMV);

        this.renderTerrain(planetMVP, planetModelMatrix, lightMatrix, cameraPos);

        this.renderObjects(projectionMatrix, viewMatrix, lightMatrix, planetModelMatrix);

        if (this.showWireframe) {
            this.renderTerrainWireframe(planetMVP, planetModelMatrix, lightMatrix);
        }

        // Renderizar cometas (antes da agua, pois cometas sao opacos)
        this.renderComets(projectionMatrix, viewMatrix, cameraPos);

        this.renderWater(planetMVP, planetModelMatrix, lightMatrix, cameraPos);

        this.time += 0.016;

        if (!this.isObjectDragging && !this.isAddMode && this.editMode === 'none') {
            this.rotationY += 0.001;
        }
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        if (this.pickingTexture) {
            this.resizePickingFramebuffer(this.canvas.width, this.canvas.height);
        }
    }

    toggleWireframe() {
        this.showWireframe = !this.showWireframe;
        return this.showWireframe;
    }

    updateNoiseTexture() {
        this.generateHeightmaps();
        this.buildTerrainMesh();
        this.repositionAllObjects();
    }

    setNoiseParams(params) {
        this.noiseParams = { ...this.noiseParams, ...params };
    }

    setSeaLevel(value) {
        this.seaLevel = value;
        this.initWaterMesh();
    }

    setSandRange(value) {
        this.sandRange = value;
    }

    setBrushRadius(value) {
        this.brushRadius = value;
    }

    setBrushStrength(value) {
        this.brushStrength = value;
    }

    setLightPosition(x, y, z) {
        this.lightPos = [x, y, z];
    }

    setLightTarget(x, y, z) {
        this.lightTarget = [x, y, z];
    }

    setLightUp(x, y, z) {
        this.lightUp = [x, y, z];
    }

    setSelectedObjectScale(scale) {
        if (this.selectedObjectIndex >= 0 && this.selectedObjectIndex < this.placedObjects.length) {
            this.placedObjects[this.selectedObjectIndex].scale = scale;
        }
    }

    getSelectedObject() {
        if (this.selectedObjectIndex >= 0 && this.selectedObjectIndex < this.placedObjects.length) {
            return this.placedObjects[this.selectedObjectIndex];
        }
        return null;
    }

    getSelectedObjectScreenPosition() {
        if (this.selectedObjectIndex < 0 || this.selectedObjectIndex >= this.placedObjects.length) {
            return null;
        }

        const obj = this.placedObjects[this.selectedObjectIndex];

        const planetModelMatrix = mat4.create();
        mat4.rotateY(planetModelMatrix, planetModelMatrix, this.rotationY);
        mat4.rotateX(planetModelMatrix, planetModelMatrix, this.rotationX);

        const objectLocalMatrix = this.getObjectModelMatrix(obj);
        const worldMatrix = mat4.create();
        mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);

        const viewMatrix = mat4.create();
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -this.cameraDistance]);

        const projectionMatrix = mat4.create();
        mat4.perspective(projectionMatrix, Math.PI / 4, this.canvas.width / this.canvas.height, 0.1, 100.0);

        const worldPos = [worldMatrix[12], worldMatrix[13], worldMatrix[14], 1.0];

        const viewPos = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                viewPos[i] += viewMatrix[j * 4 + i] * worldPos[j];
            }
        }

        const clipPos = [0, 0, 0, 0];
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                clipPos[i] += projectionMatrix[j * 4 + i] * viewPos[j];
            }
        }

        if (clipPos[3] === 0) return null;
        const ndcX = clipPos[0] / clipPos[3];
        const ndcY = clipPos[1] / clipPos[3];

        const screenX = (ndcX * 0.5 + 0.5) * this.canvas.width;
        const screenY = (1 - (ndcY * 0.5 + 0.5)) * this.canvas.height;

        return { x: screenX, y: screenY };
    }

    zoomIn() {
        this.cameraDistance = Math.max(3.0, this.cameraDistance - 0.5);
    }

    zoomOut() {
        this.cameraDistance = Math.min(20.0, this.cameraDistance + 0.5);
    }
}
