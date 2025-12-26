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
    pickingObjectFragmentShaderSource
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

        this.lightPos = [0.0, 0.0, 15.0];
        this.lightTarget = [0, 0, 0];
        this.lightUp = [0, 1, 0];

        const geometry = createIcosphere(3);
        this.numElements = geometry.indices.length;
        this.numElementsLines = geometry.edgeIndices.length;

        // Vertex Array Object para triângulos do planeta
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
        if (this.normalLoc !== -1) {
            this.gl.enableVertexAttribArray(this.normalLoc);
            this.gl.vertexAttribPointer(this.normalLoc, 3, this.gl.FLOAT, false, 0, 0);
        }
        
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

        // VAO para wireframe (linhas)
        this.vaoLines = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vaoLines);
        
        // Position buffer para linhas
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, positionBuffer);
        this.gl.enableVertexAttribArray(this.positionLoc);
        this.gl.vertexAttribPointer(this.positionLoc, 3, this.gl.FLOAT, false, 0, 0);
        
        // Normal buffer para linhas
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, normalBuffer);
        if (this.normalLoc !== -1) {
            this.gl.enableVertexAttribArray(this.normalLoc);
            this.gl.vertexAttribPointer(this.normalLoc, 3, this.gl.FLOAT, false, 0, 0);
        }
        
        // UV buffer para linhas
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, uvBuffer);
        this.gl.enableVertexAttribArray(this.uvLoc);
        this.gl.vertexAttribPointer(this.uvLoc, 2, this.gl.FLOAT, false, 0, 0);
        
        // Index buffer para linhas
        const edgeIndexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, edgeIndexBuffer);
        this.gl.bufferData(this.gl.ELEMENT_ARRAY_BUFFER, geometry.edgeIndices, this.gl.STATIC_DRAW);

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

        // Armazenar buffers
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

        // Criar shadow map framebuffer 
        this.shadowMapSize = 4096;
        this.createShadowMapFramebuffer();

        // Criar picking framebuffer
        this.createPickingFramebuffer();
        // Inicializar o tamanho do picking framebuffer
        this.resizePickingFramebuffer(this.canvas.width, this.canvas.height);

        // Variáveis para controle de picking
        this.mouseX = -1;
        this.mouseY = -1;
        this.selectedObjectIndex = -1;
        this.hoveredObjectIndex = -1;

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

        // Controle do wireframe
        this.showWireframe = true;
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
    }

    createPickingFramebuffer() {
        const gl = this.gl;

        // Criar textura para picking
        this.pickingTexture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        // Criar framebuffer
        this.pickingFramebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickingFramebuffer);

        // Anexar textura e depth buffer
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.pickingTexture,
            0
        );
        gl.framebufferRenderbuffer(
            gl.FRAMEBUFFER,
            gl.DEPTH_ATTACHMENT,
            gl.RENDERBUFFER,
            this.pickingDepthBuffer
        );

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resizePickingFramebuffer(width, height) {
        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.pickingTexture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );

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

    // girar o planeta
    setupMouseControls() {
        this.canvas.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                this.lastMouseX = e.clientX;
                this.lastMouseY = e.clientY;
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;

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
            this.mouseX = -1;
            this.mouseY = -1;
        });

        this.canvas.addEventListener('click', (e) => {
            if (this.hoveredObjectIndex >= 0) {
                this.selectedObjectIndex = this.hoveredObjectIndex;

                const event = new CustomEvent('objectSelected', {
                    detail: {
                        index: this.selectedObjectIndex,
                        object: this.placedObjects[this.selectedObjectIndex]
                    }
                });
                this.canvas.dispatchEvent(event);
            } else {
                this.selectedObjectIndex = -1;
                const event = new CustomEvent('objectDeselected');
                this.canvas.dispatchEvent(event);
            }
        });
    }

    createNoiseTexture() {
        const gl = this.gl;

        const noiseData = this.noiseGenerator.generate(this.noiseParams);
        this.cachedNoiseData = noiseData;
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
        this.resizePickingFramebuffer(this.canvas.width, this.canvas.height);
    }

    clearScreen() {
        this.gl.clearColor(0.1, 0.1, 0.15, 1.0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    }

    renderObjectsPicking(projectionMatrix, viewMatrix, planetModelMatrix) {
        const gl = this.gl;

        if (this.placedObjects.length === 0) {
            return;
        }

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
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
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
        gl.readPixels(
            Math.floor(pixelX),
            Math.floor(pixelY),
            1,
            1,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            data
        );

        const id = data[0] + (data[1] << 8) + (data[2] << 16) + (data[3] << 24);

        if (id > 0) {
            this.hoveredObjectIndex = id - 1;
        } else {
            this.hoveredObjectIndex = -1;
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    render() {
        const gl = this.gl;

        const planetModelMatrix = mat4.create();
        mat4.rotateY(planetModelMatrix, planetModelMatrix, this.rotationY);
        mat4.rotateX(planetModelMatrix, planetModelMatrix, this.rotationX);

        const lightProjectionMatrix = mat4.create();
        const frustumSize = 5.0; 
        mat4.ortho(lightProjectionMatrix, -frustumSize, frustumSize, -frustumSize, frustumSize, 0.1, 30.0);

        const lightViewMatrix = mat4.create();
        mat4.lookAt(lightViewMatrix,
            this.lightPos,
            this.lightTarget,
            this.lightUp
        );

        const lightMatrix = mat4.create();
        mat4.multiply(lightMatrix, lightProjectionMatrix, lightViewMatrix);

        const planetLightMVP = mat4.create();
        mat4.multiply(planetLightMVP, lightMatrix, planetModelMatrix);

        gl.viewport(0, 0, this.shadowMapSize, this.shadowMapSize);
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFramebuffer);
        gl.clear(gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);

        // Objetos fazem sombra
        this.renderObjectsDepth(lightMatrix, planetModelMatrix);

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
        const cameraPos = [0, 0, 8]; 
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -8]);

        this.pickObject(projectionMatrix, viewMatrix, planetModelMatrix);

        const planetMVP = mat4.create();
        const planetMV = mat4.create();
        mat4.multiply(planetMV, viewMatrix, planetModelMatrix);
        mat4.multiply(planetMVP, projectionMatrix, planetMV);

        gl.useProgram(this.program);
        gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
        gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_worldMatrix'), false, planetModelMatrix);

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
        gl.drawElements(gl.TRIANGLES, this.numElements, gl.UNSIGNED_INT, 0);  

        // Renderizar objetos
        this.renderObjects(projectionMatrix, viewMatrix, lightMatrix, planetModelMatrix);

        if (this.showWireframe) {
            gl.enable(gl.POLYGON_OFFSET_FILL);
            gl.polygonOffset(1, 1);
            gl.useProgram(this.program);
            
            gl.uniformMatrix4fv(this.matrixLoc, false, planetMVP);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_worldMatrix'), false, planetModelMatrix);
            gl.uniformMatrix4fv(gl.getUniformLocation(this.program, 'u_lightMatrix'), false, lightMatrix);
            
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, this.noiseTexture);
            gl.uniform1i(this.textureLoc, 0);
            
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, this.shadowMap);
            gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowMap'), 1);
            
            gl.uniform1i(this.useColorLoc, true);
            gl.uniform3f(this.colorLoc, 0.0, 0.0, 0.0);
            gl.bindVertexArray(this.vaoLines);
            gl.drawElements(gl.LINES, this.numElementsLines, gl.UNSIGNED_INT, 0); 
            gl.disable(gl.POLYGON_OFFSET_FILL);
        }

        this.rotationY += 0.001;
    }

    toggleWireframe() {
        this.showWireframe = !this.showWireframe;
        return this.showWireframe;
    }

    updateNoiseTexture() {
        this.cachedNoiseData = null;
        this.createNoiseTexture();
        this.repositionAllObjects();
    }

    setNoiseParams(params) {
        this.noiseParams = { ...this.noiseParams, ...params };
    }

    // Carregar objeto
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

        const vao = gl.createVertexArray();
        gl.bindVertexArray(vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        if (this.objectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.objectPositionLoc);
            gl.vertexAttribPointer(this.objectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        } else {
            console.warn('objectPositionLoc is -1');
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

        const depthVao = gl.createVertexArray();
        gl.bindVertexArray(depthVao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        if (this.depthObjectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.depthObjectPositionLoc);
            gl.vertexAttribPointer(this.depthObjectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        } else {
            console.warn('depthObjectPositionLoc is -1');
        }

        gl.bindVertexArray(null);

        const pickingVao = gl.createVertexArray();
        gl.bindVertexArray(pickingVao);

        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

        if (this.pickingObjectPositionLoc !== -1) {
            gl.enableVertexAttribArray(this.pickingObjectPositionLoc);
            gl.vertexAttribPointer(this.pickingObjectPositionLoc, 3, gl.FLOAT, false, stride, 0);
        } else {
            console.warn('pickingObjectPositionLoc is -1');
        }

        gl.bindVertexArray(null);

        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

        const model = {
            vao,
            depthVao,
            pickingVao,
            vertexBuffer,
            indexBuffer,
            numElements: objData.indices.length,
            useUint32: objData.useUint32 
        };

        this.loadedModels.set(path, model);
        return model;
    }

    // Pra colocar os objetos na superficie do planeta
    getNoiseValueAtUV(u, v) {
        const texWidth = 512;
        const texHeight = 512;
        
        if (!this.cachedNoiseData) {
            this.cachedNoiseData = this.noiseGenerator.generate(this.noiseParams);
        }
        
        // Normalizar UV para 0-1
        u = ((u % 1) + 1) % 1;
        v = ((v % 1) + 1) % 1;
        
        const x = u * (texWidth - 1);
        const y = v * (texHeight - 1);
        
        const x1 = Math.floor(x);
        const y1 = Math.floor(y);
        const x2 = Math.min(x1 + 1, texWidth - 1);
        const y2 = Math.min(y1 + 1, texHeight - 1);
        
        const tx = x - x1;
        const ty = y - y1;
        
        const p11 = this.cachedNoiseData[y1 * texWidth + x1];
        const p21 = this.cachedNoiseData[y1 * texWidth + x2];
        const p12 = this.cachedNoiseData[y2 * texWidth + x1];
        const p22 = this.cachedNoiseData[y2 * texWidth + x2];
        
        const top = p11 * (1 - tx) + p21 * tx;
        const bottom = p12 * (1 - tx) + p22 * tx;
        
        return top * (1 - ty) + bottom * ty;
    }

    // Calculos de posição dos objetos
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

    // Pra quando mexer no noise
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

            const worldMatrix = mat4.create();
            mat4.multiply(worldMatrix, planetModelMatrix, objectLocalMatrix);

            gl.uniformMatrix4fv(this.depthObjectMatrixLoc, false, lightMatrix);
            gl.uniformMatrix4fv(this.depthObjectWorldMatrixLoc, false, worldMatrix);

            gl.bindVertexArray(obj.model.depthVao);
            
            const indexType = obj.model.useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, indexType, 0);
        }
        
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    
    // Pra colocar os objetos na superficie do planeta
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

    // Pra renderizar os objetos
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

            const lightDir = [
                this.lightPos[0] - obj.position[0],
                this.lightPos[1] - obj.position[1],
                this.lightPos[2] - obj.position[2]
            ];

            const len = Math.sqrt(lightDir[0]*lightDir[0] + lightDir[1]*lightDir[1] + lightDir[2]*lightDir[2]);
            const normalizedLightDir = [lightDir[0]/len, lightDir[1]/len, lightDir[2]/len];
            
            const dotProduct = 
                obj.normal[0] * normalizedLightDir[0] +
                obj.normal[1] * normalizedLightDir[1] +
                obj.normal[2] * normalizedLightDir[2];
            
            const shadowFactor = Math.max(0.2, dotProduct * 0.5 + 0.5);
            
            const shadowFactorLoc = gl.getUniformLocation(this.objectProgram, 'u_shadowFactor');
            if (shadowFactorLoc) {
                gl.uniform1f(shadowFactorLoc, shadowFactor);
            }

            gl.bindVertexArray(obj.model.vao);
            
            const indexType = obj.model.useUint32 ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
            gl.drawElements(gl.TRIANGLES, obj.model.numElements, indexType, 0);
        }
        gl.bindVertexArray(null);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.useProgram(this.program);

        gl.disable(gl.BLEND);
    }

    // Controle da luz
    setLightPosition(x, y, z) {
        this.lightPos = [x, y, z];
    }

    setLightTarget(x, y, z) {
        this.lightTarget = [x, y, z];
    }

    setLightUp(x, y, z) {
        this.lightUp = [x, y, z];
    }

    // Controle de objetos selecionados
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
        mat4.translate(viewMatrix, viewMatrix, [0, 0, -8]);

        const projectionMatrix = mat4.create();
        mat4.perspective(
            projectionMatrix,
            Math.PI / 4,
            this.canvas.width / this.canvas.height,
            0.1,
            100.0
        );

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
}