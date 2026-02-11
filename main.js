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
    const addObjectButton = document.getElementById('add-object');
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

    const noiseScaleInput = document.getElementById('noise-scale');
    const noiseScaleValue = document.getElementById('noise-scale-value');

    noiseScaleInput.addEventListener('input', (e) => {
        noiseScaleValue.textContent = parseFloat(e.target.value).toFixed(1);
        renderer.setNoiseParams({ noiseScale: parseFloat(e.target.value) });
        renderer.updateNoiseTexture();
    });

    const seaLevelInput = document.getElementById('sea-level');
    const seaLevelValue = document.getElementById('sea-level-value');
    const sandRangeInput = document.getElementById('sand-range');
    const sandRangeValue = document.getElementById('sand-range-value');

    seaLevelInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        seaLevelValue.textContent = value.toFixed(2);
        renderer.setSeaLevel(value);
    });

    sandRangeInput.addEventListener('input', (e) => {
        const value = parseFloat(e.target.value);
        sandRangeValue.textContent = value.toFixed(2);
        renderer.setSandRange(value);
    });

    // --- Edição de terreno ---
    const raiseTerrainBtn = document.getElementById('raise-terrain');
    const lowerTerrainBtn = document.getElementById('lower-terrain');
    const brushRadiusInput = document.getElementById('brush-radius');
    const brushRadiusValue = document.getElementById('brush-radius-value');
    const brushStrengthInput = document.getElementById('brush-strength');
    const brushStrengthValue = document.getElementById('brush-strength-value');

    raiseTerrainBtn.addEventListener('click', () => {
        if (renderer.editMode === 'raise') {
            renderer.exitEditMode();
        } else {
            renderer.enterEditMode('raise');
        }
    });

    lowerTerrainBtn.addEventListener('click', () => {
        if (renderer.editMode === 'lower') {
            renderer.exitEditMode();
        } else {
            renderer.enterEditMode('lower');
        }
    });

    brushRadiusInput.addEventListener('input', (e) => {
        brushRadiusValue.textContent = e.target.value;
        renderer.setBrushRadius(parseInt(e.target.value));
    });

    brushStrengthInput.addEventListener('input', (e) => {
        brushStrengthValue.textContent = parseFloat(e.target.value).toFixed(2);
        renderer.setBrushStrength(parseFloat(e.target.value));
    });

    // Atualizar visual dos botões de edição quando o modo muda
    canvas.addEventListener('editModeChanged', (e) => {
        const mode = e.detail.mode;
        raiseTerrainBtn.classList.toggle('active-mode', mode === 'raise');
        lowerTerrainBtn.classList.toggle('active-mode', mode === 'lower');
        raiseTerrainBtn.textContent = mode === 'raise' ? 'Cancelar Elevação' : 'Aumentar Terreno';
        lowerTerrainBtn.textContent = mode === 'lower' ? 'Cancelar Rebaixo' : 'Diminuir Terreno';
    });

    objectScaleInput.addEventListener('input', (e) => {
        objectScaleValue.textContent = parseFloat(e.target.value).toFixed(2);
    });

    placeObjectButton.addEventListener('click', async () => {
        const selectedModel = objectSelect.value;
        const scale = parseFloat(objectScaleInput.value);
        await renderer.placeObject(selectedModel, scale);
    });

    addObjectButton.addEventListener('click', () => {
        if (renderer.isAddMode) {
            // Clicou de novo no botão: cancela o modo de adição
            renderer.exitAddMode();
        } else {
            const selectedModel = objectSelect.value;
            const scale = parseFloat(objectScaleInput.value);
            renderer.enterAddMode(selectedModel, scale);
        }
    });

    clearObjectsButton.addEventListener('click', () => {
        renderer.clearObjects();
    });

    // Tecla Escape cancela modo de adição ou edição de terreno
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (renderer.isAddMode) renderer.exitAddMode();
            if (renderer.editMode !== 'none') renderer.exitEditMode();
        }
    });

    // Atualizar visual do botão quando o modo de adição muda
    canvas.addEventListener('addModeChanged', (e) => {
        if (e.detail.active) {
            addObjectButton.textContent = 'Cancelar Adição';
            addObjectButton.classList.add('active-mode');
        } else {
            addObjectButton.textContent = 'Adicionar Objeto';
            addObjectButton.classList.remove('active-mode');
        }
    });

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

    document.getElementById('zoom-in').addEventListener('click', () => {
        renderer.zoomIn();
    });

    document.getElementById('zoom-out').addEventListener('click', () => {
        renderer.zoomOut();
    });

    document.getElementById('toggle-panel').addEventListener('click', () => {
        const panel = document.getElementById('control-panel');
        panel.classList.toggle('collapsed');
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
        // Modo de edição de terreno: cursor crosshair
        if (renderer.editMode !== 'none') {
            canvas.style.cursor = 'crosshair';
            return;
        }

        // Modo de adição: cursor crosshair
        if (renderer.isAddMode) {
            canvas.style.cursor = 'crosshair';
            return;
        }

        // Arrastando objeto: cursor move
        if (renderer.isObjectDragging) {
            canvas.style.cursor = 'move';
            return;
        }

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