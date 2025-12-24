import { Renderer } from './renderer.js';

function main() {
    const canvas = document.querySelector("#glcanvas");
    const renderer = new Renderer(canvas);

    if (!renderer.gl) {
        alert("Unable to initialize WebGL. Your browser or machine may not support it.");
        return;
    }

    const octavesInput = document.getElementById('octaves');
    const persistenceInput = document.getElementById('persistence');
    const lacunarityInput = document.getElementById('lacunarity');
    const zoomInput = document.getElementById('zoom');
    const seedInput = document.getElementById('seed');
    const noiseTypeInput = document.getElementById('noise-type');

    const octavesValue = document.getElementById('octaves-value');
    const persistenceValue = document.getElementById('persistence-value');
    const lacunarityValue = document.getElementById('lacunarity-value');
    const zoomValue = document.getElementById('zoom-value');

    const objectSelect = document.getElementById('object-select');
    const objectScaleInput = document.getElementById('object-scale');
    const objectScaleValue = document.getElementById('object-scale-value');
    const placeObjectButton = document.getElementById('place-object');
    const clearObjectsButton = document.getElementById('clear-objects');

    const lightXInput = document.getElementById('light-x');
    const lightYInput = document.getElementById('light-y');
    const lightZInput = document.getElementById('light-z');
    const lightXValue = document.getElementById('light-x-value');
    const lightYValue = document.getElementById('light-y-value');
    const lightZValue = document.getElementById('light-z-value');
    const resetLightButton = document.getElementById('reset-light');

    octavesInput.addEventListener('input', (e) => {
        octavesValue.textContent = e.target.value;
        renderer.setNoiseParams({ octaves: parseInt(e.target.value) });
        renderer.updateNoiseTexture();
    });

    persistenceInput.addEventListener('input', (e) => {
        persistenceValue.textContent = parseFloat(e.target.value).toFixed(2);
        renderer.setNoiseParams({ persistence: parseFloat(e.target.value) });
        renderer.updateNoiseTexture();
    });

    lacunarityInput.addEventListener('input', (e) => {
        lacunarityValue.textContent = parseFloat(e.target.value).toFixed(1);
        renderer.setNoiseParams({ lacunarity: parseFloat(e.target.value) });
        renderer.updateNoiseTexture();
    });

    zoomInput.addEventListener('input', (e) => {
        zoomValue.textContent = parseFloat(e.target.value).toFixed(1);
        renderer.setNoiseParams({ noiseZoom: parseFloat(e.target.value) });
        renderer.updateNoiseTexture();
    });


    noiseTypeInput.addEventListener('change', (e) => {
        renderer.setNoiseParams({ noiseType: e.target.value });
        renderer.updateNoiseTexture();
    });


    objectScaleInput.addEventListener('input', (e) => {
        objectScaleValue.textContent = parseFloat(e.target.value).toFixed(2);
    });

    placeObjectButton.addEventListener('click', async () => {
        const selectedModel = objectSelect.value;
        const scale = parseFloat(objectScaleInput.value);
        await renderer.placeObject(selectedModel, scale);
    });

    clearObjectsButton.addEventListener('click', () => {
        renderer.clearObjects();
    });

    // Light position controls
    lightXInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        lightXValue.textContent = value.toFixed(1);
        renderer.setLightPosition(value, renderer.lightPos[1], renderer.lightPos[2]);
    });

    lightYInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        lightYValue.textContent = value.toFixed(1);
        renderer.setLightPosition(renderer.lightPos[0], value, renderer.lightPos[2]);
    });

    lightZInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        lightZValue.textContent = value.toFixed(1);
        renderer.setLightPosition(renderer.lightPos[0], renderer.lightPos[1], value);
    });

    resetLightButton.addEventListener('click', () => {
        renderer.setLightPosition(8.0, 6.0, 8.0);
        lightXInput.value = 8.0;
        lightYInput.value = 6.0;
        lightZInput.value = 8.0;
        lightXValue.textContent = '8.0';
        lightYValue.textContent = '6.0';
        lightZValue.textContent = '8.0';
    });

    function animate() {
        renderer.render();
        requestAnimationFrame(animate);
    }

    animate();
}
main();