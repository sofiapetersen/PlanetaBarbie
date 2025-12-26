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
        renderer.setLightPosition(0.0, 0.0, 15.0);
        lightXInput.value = 0.0;
        lightYInput.value = 0.0;
        lightZInput.value = 15.0;
        lightXValue.textContent = '0.0';
        lightYValue.textContent = '0.0';
        lightZValue.textContent = '15.0';
    });

    document.getElementById('wireframeBtn').addEventListener('click', () => {
        const isVisible = renderer.toggleWireframe();
        document.getElementById('wireframeBtn').textContent =
            isVisible ? 'Ocultar Malha' : 'Mostrar Malha';
    });

    const selectedObjectControls = document.getElementById('selected-object-controls');
    const selectedObjectScaleInput = document.getElementById('selected-object-scale');
    const selectedObjectScaleValue = document.getElementById('selected-object-scale-value');

    selectedObjectScaleInput.addEventListener('input', (e) => {
        const scale = parseFloat(e.target.value);
        selectedObjectScaleValue.textContent = scale.toFixed(2);
        renderer.setSelectedObjectScale(scale);
    });

    const floatingSlider = document.getElementById('floating-scale-slider');
    const floatingScaleInput = document.getElementById('floating-scale-input');
    const floatingScaleValue = document.getElementById('floating-scale-value');

    floatingScaleInput.addEventListener('input', (e) => {
        const scale = parseFloat(e.target.value);
        floatingScaleValue.textContent = scale.toFixed(2);
        renderer.setSelectedObjectScale(scale);
    });

    canvas.addEventListener('objectSelected', (e) => {
        const obj = e.detail.object;

        floatingSlider.style.display = 'block';
        floatingScaleInput.value = obj.scale;
        floatingScaleValue.textContent = obj.scale.toFixed(2);
    });

    canvas.addEventListener('objectDeselected', () => {
        floatingSlider.style.display = 'none';
    });


    canvas.style.cursor = 'grab';
    let lastHoveredIndex = -1;

    function updateCursor() {
        if (renderer.hoveredObjectIndex >= 0) {
            canvas.style.cursor = 'pointer';
            if (lastHoveredIndex !== renderer.hoveredObjectIndex) {
                lastHoveredIndex = renderer.hoveredObjectIndex;
            }
        } else {
            if (renderer.isDragging) {
                canvas.style.cursor = 'grabbing';
            } else {
                canvas.style.cursor = 'grab';
            }
            lastHoveredIndex = -1;
        }
    }

    function updateFloatingSliderPosition() {
        if (floatingSlider.style.display === 'block') {
            const screenPos = renderer.getSelectedObjectScreenPosition();
            if (screenPos) {
                const rect = canvas.getBoundingClientRect();
                floatingSlider.style.left = (rect.left + screenPos.x + 30) + 'px';
                floatingSlider.style.top = (rect.top + screenPos.y - 30) + 'px';
            }
        }
    }

    function animate() {
        renderer.render();
        updateCursor();
        updateFloatingSliderPosition();
        requestAnimationFrame(animate);
    }

    animate();
}
main();