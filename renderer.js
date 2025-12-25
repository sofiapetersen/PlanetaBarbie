import {
    vertexShaderSource,
    fragmentShaderSource,
    objectVertexShaderSource,
    objectFragmentShaderSource,
    depthVertexShaderSource,
    depthFragmentShaderSource,
    depthObjectVertexShaderSource,
    depthObjectFragmentShaderSource
} from './shaders.js';
import { createShader, createProgram } from './webgl-utils.js';
import { createIcosphere, createEdgeIndices } from './geometry.js';
import { mat4 } from './math-utils.js'
import { NoiseGenerator } from './noise.js';
import { OBJLoader } from './obj-loader.js';

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

        // Programa principal para o planeta
        this.program = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, vertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, fragmentShaderSource)
        );

        this.positionLoc = this.gl.getAttribLocation(this.program, 'a_position');
        this.normalLoc = this.gl.getAttribLocation(this.program, 'a_normal');
        this.matrixLoc = this.gl.getUniformLocation(this.program, 'u_matrix');
        this.colorLoc = this.gl.getUniformLocation(this.program, 'u_color');
        this.useColorLoc = this.gl.getUniformLocation(this.program, 'u_useColor');
        this.uvLoc = this.gl.getAttribLocation(this.program, 'a_texcoord');

        // Programa para objetos 3D
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

        // Programa para renderizar depth map do planeta
        this.depthProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, depthVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, depthFragmentShaderSource)
        );

        this.depthPositionLoc = this.gl.getAttribLocation(this.depthProgram, 'a_position');
        this.depthTexcoordLoc = this.gl.getAttribLocation(this.depthProgram, 'a_texcoord');
        this.depthLightMatrixLoc = this.gl.getUniformLocation(this.depthProgram, 'u_lightMatrix');

        // Programa para renderizar depth map dos objetos
        this.depthObjectProgram = createProgram(
            this.gl,
            createShader(this.gl, this.gl.VERTEX_SHADER, depthObjectVertexShaderSource),
            createShader(this.gl, this.gl.FRAGMENT_SHADER, depthObjectFragmentShaderSource)
        );

        this.depthObjectPositionLoc = this.gl.getAttribLocation(this.depthObjectProgram, 'a_position');
        this.depthObjectMatrixLoc = this.gl.getUniformLocation(this.depthObjectProgram, 'u_lightMatrix');

        // Posição da luz (fixa no espaço mundial - simula o sol)
        this.lightPos = [8.0, 6.0, 8.0];
        this.lightTarget = [0, 0, 0];
        this.lightUp = [0, 1, 0];

        // Criar geometria do icosaedro (planeta)
        const geometry = createIcosphere(3);
        this.numElements = geometry.indices.length;
        this.numElementsLines = geometry.edgeIndices.length;

        // VAO para triângulos do planeta
        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);
        
        // Position buffer
        const positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.positions, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.positionLoc);
        this.gl.vertexAttribPointer(this.positionLoc, 3, this.gl.FLOAT, false, 0, 0);
        
        // Normal buffer
        const normalBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.normals, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.normalLoc);
        this.gl.vertexAttribPointer(this.normalLoc, 3, this.gl.FLOAT, false, 0, 0);
        
        // Index buffer para triângulos
        const indexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, geometry.indices, this.gl.STATIC_DRAW);

        // UV buffer
        const uvBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, uvBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, geometry.uvs, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.uvLoc);
        this.gl.vertexAttribPointer(this.uvLoc, 2, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindVertexArray(null);

        // VAO para linhas do planeta (wireframe)
        this.vaoLines = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vaoLines);
        
        // Reutilizar os mesmos buffers de posição e normal
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLoc);
        this.gl.vertexAttribPointer(this.positionLoc, 3, this.gl.FLOAT, false, 0, 0);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        this.gl.enableVertexAttribArray(this.normalLoc);
        this.gl.vertexAttribPointer(this.normalLoc, 3, this.gl.FLOAT, false, 0, 0);
        
        // Index buffer para linhas
        const edgeIndexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, geometry.edgeIndices, this.gl.STATIC_DRAW);
        
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, uvBuffer);
        this.gl.enableVertexAttribArray(this.uvLoc);
        this.gl.vertexAttribPointer(this.uvLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindVertexArray(null);

        // VAO para depth rendering do planeta
        this.depthVao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.depthVao);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.enableVertexAttribArray(this.depthPositionLoc);
        this.gl.vertexAttribPointer(this.depthPositionLoc, 3, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, uvBuffer);
        this.gl.enableVertexAttribArray(this.depthTexcoordLoc);
        this.gl.vertexAttribPointer(this.depthTexcoordLoc, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        this.gl.bindVertexArray(null);

        // Armazenar buffers para uso posterior
        this.positionBuffer = positionBuffer;
        this.uvBuffer = uvBuffer;
        this.indexBuffer = indexBuffer;

        // Controles de rotação
        this.rotationX = 0;
        this.rotationY = 0;
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        this.setupMouseControls();

        // Criar shadow map framebuffer com resolução maior para sombras mais precisas
        this.shadowMapSize = 4096;
        this.createShadowMapFramebuffer();

        // Inicializar gerador de ruído
        this.noiseGenerator = new NoiseGenerator(512, 512);
        this.noiseParams = {
            octaves: 4,
            persistence: 0.45,
            lacunarity: 1.8,
            noiseZoom: 0.4,
            noiseType: 'perlin'
        };
        this.createNoiseTexture();

        // Inicializar objetos
        this.placedObjects = [];
        this.loadedModels = new Map();
        this.cachedNoiseData = null;
        this.objectTexture = null;
        this.loadObjectTexture();

        // Debug da shadow map
        this.showDebugShadowMap = false;
        this.debugShadowMapCanvas = null;
    }

    createShadowMapFramebuffer() {
        const gl = this.gl;

        // Criar depth texture
        this.shadowMap = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.DEPTH_COMPONENT32F,
            this.shadowMapSize,
            this.shadowMapSize,
            0,
            gl.DEPTH_COMPONENT,
            gl.FLOAT,
            null
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Criar framebuffer
        this.shadowFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.TEXTURE_2D,
            this.shadowMap,
            0
        );

        // Desativar cor no framebuffer de profundidade
        gl.drawBuffers([gl.NONE]);
        gl.readBuffer(gl.NONE);

        // Verificar se o framebuffer está completo
        const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
        if (status !== gl.FRAMEBUFFER_COMPLETE) {
            console.error('Shadow framebuffer não está completo:', status);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    async loadObjectTexture() {
        const gl = this.gl;
        const image = new Image();

        return new Promise((resolve, reject) => {
            image.onload = () => {
                this.objectTexture = gl.createTexture();
                gl.bindTexture(gl.TEXTURE_2D, this.objectTexture);

                gl.texImage2D(
                    gl.TEXTURE_2D,
                    0,
                    gl.RGBA,
                    gl.RGBA,
                    gl.UNSIGNED_BYTE,
                    image
                );

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

    setupMouseControls() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const deltaX = e.clientX - this.lastMouseX;
                const deltaY = e.clientY - this.lastMouseY;

                this.rotationY += deltaX * 0.005;
                this.rotationX += deltaY * 0.005;

                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });
    }

    createNoiseTexture() {
        const gl = this.gl;

        const noiseData = this.noiseGenerator.generate(this.noiseParams);
        this.cachedNoiseData = noiseData;

        console.log("Noise data length:", noiseData.length);
        console.log("First 10 values:", noiseData.slice(0, 10));
        const min = noiseData.reduce((a, b) => Math.min(a, b), Infinity);
        const max = noiseData.reduce((a, b) => Math.max(a, b), -Infinity);
        console.log("Min:", min, "Max:", max);
        
        const textureData = new Uint8Array(512 * 512 * 4);
        for (let i = 0; i < noiseData.length; i++) {
            const value = Math.floor(noiseData[i] * 255);
            textureData[i * 4 + 0] = value; // R
            textureData[i * 4 + 1] = value; // G
            textureData[i * 4 + 2] = value; // B
            textureData[i * 4 + 3] = 255;   // A
        }
        
        this.noiseTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
        
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,                
            gl.RGBA,          
            512,              
            512,              
            0,                
            gl.RGBA,          
            gl.UNSIGNED_BYTE, 
            textureData
        );
        
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        
        gl.bindTexture(gl.TEXTURE_2D, null);
        
        this.textureLoc = gl.getUniformLocation(this.program, 'u_noiseTexture');
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    clearScreen() {
        this.gl.clearColor(0.1, 0.1, 0.15, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    render() {
        const gl = this.gl;

        // Matriz de modelo do planeta (rotação)
        const planetModelMatrix = mat4.create();
        mat4.rotateY(planetModelMatrix, planetModelMatrix, this.rotationY);
        mat4.rotateX(planetModelMatrix, planetModelMatrix, this.rotationX);

        // ===== PASSO 1: Renderizar shadow map =====
        // Usar projeção ortográfica para sombras mais realistas e consistentes
        const lightProjectionMatrix = mat4.create();
        const frustumSize = 5.0; // Ajustar para cobrir toda a cena
        mat4.ortho(lightProjectionMatrix, -frustumSize, frustumSize, -frustumSize, frustumSize, 0.1, 30.0);

        // Criar view matrix da luz usando lookAt
        const lightViewMatrix = mat4.create();
        mat4.lookAt(lightViewMatrix,
            this.lightPos,    // eye (posição da luz - fixa no mundo)
            this.lightTarget, // center (alvo da luz - centro do planeta)
            this.lightUp      // up vector
        );

        const lightMatrix = mat4.create();
        mat4.multiply(lightMatrix, lightProjectionMatrix, lightViewMatrix);

        // Matriz completa para shadow map do planeta
        const planetLightMVP = mat4.create();
        mat4.multiply(planetLightMVP, lightMatrix, planetModelMatrix);

        // Configurar viewport para shadow map
        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // Renderizar planeta para shadow map
        gl.useProgram(this.depthProgram);
        gl.uniformMatrix4fv(this.depthLightMatrixLoc, false, planetLightMVP);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
        gl.uniform1i(gl.getUniformLocation(this.depthProgram, 'u_noiseTexture'), 0);

        gl.bindVertexArray(this.depthVao);
        gl.drawElements(gl.TRIANGLES, this.numElements, gl.UNSIGNED_SHORT, 0);

        // Renderizar objetos para shadow map
        this.renderObjectsDepth(lightMatrix, planetModelMatrix);

        // Opcional: debug da shadow map
        if (this.showDebugShadowMap) {
            this.debugShadowMap();
        }

        // ===== PASSO 2: Renderizar cena normal =====
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.clearScreen();

        const projectionMatrix = mat4.create();
        mat4.perspective(
            projectionMatrix,
            Math.PI / 4,
            this.canvas.width / this.canvas.height,
            0.1,
            100.0
        );

        const viewMatrix = mat4.create();
        const cameraPos = [0, 0, 8]; // Posição da câmera
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -8]);

        const planetMVP = mat4.create();
        const planetMV = mat4.create();
        mat4.multiply(planetMV, viewMatrix, planetModelMatrix);
        mat4.multiply(planetMVP, projectionMatrix, planetMV);

        // Renderizar planeta
        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_worldMatrix'), false, planetModelMatrix);
        // Passar lightMatrix diretamente (já inclui a transformação do planeta)
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_lightMatrix'), false, lightMatrix);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_lightPos'), this.lightPos);
        gl.uniform3fv(gl.getUniformLocation(this.program, 'u_cameraPos'), cameraPos);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
        gl.uniform1i(this.textureLoc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowMap'), 1);

        gl.uniform1i(this.useColorLoc, false);
        gl.bindVertexArray(this.vao);
        gl.drawElements(gl.TRIANGLES, this.numElements, gl.UNSIGNED_SHORT, 0);

        // Renderizar objetos
        this.renderObjects(projectionMatrix, viewMatrix, lightMatrix, planetModelMatrix);

        // Desenhar linhas (wireframe) por último para garantir visibilidade
        gl.enable(gl.POLYGON_OFFSET_FILL);
        gl.polygonOffset(1, 1);
        gl.useProgram(this.program); // Garantir que estamos usando o programa correto
        gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
        gl.uniform1i(this.useColorLoc, true);
        gl.uniform3f(this.colorLoc, 0.0, 0.0, 0.0);
        gl.bindVertexArray(this.vaoLines);
        gl.drawElements(gl.LINES, this.numElementsLines, gl.UNSIGNED_SHORT, 0);
        gl.disable(gl.POLYGON_OFFSET_FILL);

        this.rotationY += 0.001;
    }

    debugShadowMap() {
        if (!this.debugShadowMapCanvas) {
            this.debugShadowMapCanvas = document.createElement('canvas');
            this.debugShadowMapCanvas.width = 256;
            this.debugShadowMapCanvas.height = 256;
            this.debugShadowMapCanvas.style.position = 'fixed';
            this.debugShadowMapCanvas.style.top = '10px';
            this.debugShadowMapCanvas.style.right = '10px';
            this.debugShadowMapCanvas.style.border = '1px solid white';
            this.debugShadowMapCanvas.style.zIndex = '1000';
            document.body.appendChild(this.debugShadowMapCanvas);
        }

        const gl = this.gl;
        const debugCtx = this.debugShadowMapCanvas.getContext('2d');
        
        // Ler dados da shadow map
        const pixels = new Float32Array(this.shadowMapSize * this.shadowMapSize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.readPixels(0, 0, this.shadowMapSize, this.shadowMapSize, gl.DEPTH_COMPONENT, gl.FLOAT, pixels);
        
        // Desenhar para debug
        debugCtx.clearRect(0, 0, 256, 256);
        const imageData = debugCtx.createImageData(256, 256);
        
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const idx = (y * 256 + x) * 4;
                const srcX = Math.floor(x * this.shadowMapSize / 256);
                const srcY = Math.floor(y * this.shadowMapSize / 256);
                const depth = pixels[srcY * this.shadowMapSize + srcX];
                
                // Converter profundidade para cor (branco = próximo, preto = distante)
                const value = Math.floor((1.0 - depth) * 255);
                imageData.data[idx] = value;     // R
                imageData.data[idx + 1] = value; // G
                imageData.data[idx + 2] = value; // B
                imageData.data[idx + 3] = 255;   // A
            }
        }
        
        debugCtx.putImageData(imageData, 0, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    toggleDebugShadowMap() {
        this.showDebugShadowMap = !this.showDebugShadowMap;
        if (!this.showDebugShadowMap && this.debugShadowMapCanvas) {
            this.debugShadowMapCanvas.remove();
            this.debugShadowMapCanvas = null;
        }
    }

    updateNoiseTexture() {
        this.cachedNoiseData = null;
        this.createNoiseTexture();
        // Reposicionar todos os objetos existentes
        this.repositionAllObjects();
    }

    setNoiseParams(params) {
        this.noiseParams = { ...this.noiseParams, ...params };
    }

    async loadModel(path) {
        if (this.loadedModels.has(path)) {
            return this.loadedModels.get(path);
        }

        const objData = await OBJLoader.load(path);
        const gl = this.gl;

        const vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, objData.vertices, gl.STATIC_DRAW);

        const indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, objData.indices, gl.STATIC_DRAW);

        const stride = 32; // 3 (pos) + 3 (normal) + 2 (uv) = 8 floats * 4 bytes = 32

        // VAO para renderização normal
        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(this.objectPositionLoc);
        gl.vertexAttribPointer(this.objectPositionLoc, 3, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(this.objectNormalLoc);
        gl.vertexAttribPointer(this.objectNormalLoc, 3, gl.FLOAT, false, stride, 12);

        gl.enableVertexAttribArray(this.objectUVLoc);
        gl.vertexAttribPointer(this.objectUVLoc, 2, gl.FLOAT, false, stride, 24);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.bindVertexArray(null);

        // VAO para depth rendering
        const depthVao = gl.createVertexArray();
        gl.bindVertexArray(depthVao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.enableVertexAttribArray(this.depthObjectPositionLoc);
        gl.vertexAttribPointer(this.depthObjectPositionLoc, 3, gl.FLOAT, false, stride, 0);

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        gl.bindVertexArray(null);

        const model = {
            vao,
            depthVao,
            numElements: objData.indices.length
        };

        this.loadedModels.set(path, model);
        return model;
    }

    getNoiseValueAtUV(u, v) {
        const texWidth = 512;
        const texHeight = 512;
        
        if (!this.cachedNoiseData) {
            this.cachedNoiseData = this.noiseGenerator.generate(this.noiseParams);
        }
        
        // Normalizar UV para 0-1
        u = ((u % 1) + 1) % 1;
        v = ((v % 1) + 1) % 1;
        
        // Interpolação bilinear para maior precisão
        const x = u * (texWidth - 1);
        const y = v * (texHeight - 1);
        
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, texWidth - 1);
        const y2 = Math.min(y1 + 1, texHeight - 1);
        
        const tx = x - x1;
        const ty = y - y1;
        
        // Valores nos 4 pontos ao redor
        const p11 = this.cachedNoiseData[y1 * texWidth + x1];
        const p21 = this.cachedNoiseData[y1 * texWidth + x2];
        const p12 = this.cachedNoiseData[y2 * texWidth + x1];
        const p22 = this.cachedNoiseData[y2 * texWidth + x2];
        
        // Interpolação bilinear
        const top = p11 * (1 - tx) + p21 * tx;
        const bottom = p12 * (1 - tx) + p22 * tx;
        
        return top * (1 - ty) + bottom * ty;
    }

    async placeObject(modelPath, scale) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        const baseX = Math.sin(phi) * Math.cos(theta);
        const baseY = Math.cos(phi);
        const baseZ = Math.sin(phi) * Math.sin(theta);

        const u = 0.5 + Math.atan2(baseZ, baseX) / (2 * Math.PI);
        const v = 0.5 - Math.asin(baseY) / Math.PI;

        const model = await this.loadModel(modelPath);

        if (!this.cachedNoiseData) {
            this.cachedNoiseData = this.noiseGenerator.generate(this.noiseParams);
        }

        const noiseValue = this.getNoiseValueAtUV(u, v);
        const smoothNoise = Math.pow(noiseValue, 1.2);
        const displacement = smoothNoise * 1.8;
        
        const obj = {
            model,
            u,
            v,
            baseX,
            baseY,
            baseZ,
            scale,
            position: [0, 0, 0],
            normal: [baseX, baseY, baseZ],
            noiseValue,
            smoothNoise,
            displacement
        };

        this.placedObjects.push(obj);
        this.updateObjectPosition(obj);
        
        console.log("Objeto colocado:");
        console.log("  UV:", obj.u.toFixed(3), obj.v.toFixed(3));
        console.log("  Noise value:", noiseValue.toFixed(3));
        console.log("  Smooth noise:", smoothNoise.toFixed(3));
        console.log("  Displacement:", displacement.toFixed(3));
        console.log("  Final position:", obj.position.map(p => p.toFixed(3)));
        
        return obj;
    }

    clearObjects() {
        this.placedObjects = [];
    }

    updateObjectPosition(obj) {
        const noiseValue = this.getNoiseValueAtUV(obj.u, obj.v);
        
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

    renderObjectsDepth(lightMatrix, planetModelMatrix) {
        const gl = this.gl;

        if (this.placedObjects.length === 0) {
            return;
        }

        gl.useProgram(this.depthObjectProgram);

        for (const obj of this.placedObjects) {
            const objectLocalMatrix = this.getObjectModelMatrix(obj);

            // Combinar: objeto está no espaço do planeta, planeta está no espaço mundial
            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);

            const lightMVP = mat4.create();
            mat4.multiply(lightMVP, lightMatrix, worldMatrix);

            gl.uniformMatrix4fv(this.depthObjectMatrixLoc, false, lightMVP);

            gl.bindVertexArray(obj.model.depthVao);
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, gl.UNSIGNED_SHORT, 0);
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

    renderObjects(projectionMatrix, viewMatrix, lightMatrix, planetModelMatrix) {
        const gl = this.gl;

        if (!this.objectTexture || this.placedObjects.length === 0) {
            return;
        }

        gl.useProgram(this.objectProgram);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.objectTexture);
        gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
        gl.uniform1i(this.objectTextureLoc, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
        gl.uniform1i(gl.getUniformLocation(this.objectProgram, 'u_shadowMap'), 1);

        gl.uniform3fv(gl.getUniformLocation(this.objectProgram, 'u_lightPos'), this.lightPos);

        for (const obj of this.placedObjects) {
            const objectLocalMatrix = this.getObjectModelMatrix(obj);

            // Combinar: objeto está no espaço do planeta, planeta está no espaço mundial
            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);

            const mvMatrix = mat4.create();
            mat4.multiply(mvMatrix, viewMatrix, worldMatrix);
            const mvpMatrix = mat4.create();
            mat4.multiply(mvpMatrix, projectionMatrix, mvMatrix);

            const lightMVP = mat4.create();
            mat4.multiply(lightMVP, lightMatrix, worldMatrix);

            gl.uniformMatrix4fv(this.objectMatrixLoc, false, mvpMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.objectProgram, 'u_worldMatrix'), false, worldMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.objectProgram, 'u_lightMatrix'), false, lightMVP);

            // Calcular se o objeto está no lado escuro
            const lightDir = [
                this.lightPos[0] - obj.position[0],
                this.lightPos[1] - obj.position[1],
                this.lightPos[2] - obj.position[2]
            ];
            
            // Normalizar
            const len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
            const normalizedLightDir = [lightDir[0]/len, lightDir[1]/len, lightDir[2]/len];
            
            // Produto escalar entre normal do objeto e direção da luz
            const dotProduct = 
                obj.normal[0] * normalizedLightDir[0] +
                obj.normal[1] * normalizedLightDir[1] +
                obj.normal[2] * normalizedLightDir[2];
            
            // Ajustar iluminação baseado na orientação
            // Se dotProduct < 0, objeto está no lado escuro
            const shadowFactor = Math.max(0.2, dotProduct * 0.5 + 0.5);
            
            // Criar uniforme temporário para shadow factor se necessário
            const shadowFactorLoc = gl.getUniformLocation(this.objectProgram, 'u_shadowFactor');
            if (shadowFactorLoc) {
                gl.uniform1f(shadowFactorLoc, shadowFactor);
            }

            gl.bindVertexArray(obj.model.vao);
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, gl.UNSIGNED_SHORT, 0);
        }

        gl.useProgram(this.program);
    }

    // Métodos auxiliares para controle da luz
    setLightPosition(x, y, z) {
        this.lightPos = [x, y, z];
    }

    setLightTarget(x, y, z) {
        this.lightTarget = [x, y, z];
    }

    setLightUp(x, y, z) {
        this.lightUp = [x, y, z];
    }
}