const glsl = x => x;

export const depthVertexShaderSource = glsl`#version 300 es
    layout(location = 0) in vec3 a_position;

    uniform mat4 u_lightMatrix;
    uniform mat4 u_worldMatrix;

    void main() {
        vec4 worldPos = u_worldMatrix * vec4(a_position, 1.0);
        gl_Position = u_lightMatrix * worldPos;
    }
`;

export const depthFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    out vec4 outColor;

    void main() {
        outColor = vec4(1.0);
    }
`;


export const depthObjectVertexShaderSource = glsl`#version 300 es
    in vec4 a_position;

    uniform mat4 u_lightMatrix;
    uniform mat4 u_worldMatrix;

    void main() {
        vec4 worldPos = u_worldMatrix * a_position;
        gl_Position = u_lightMatrix * worldPos;
    }
`;

export const depthObjectFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    out vec4 outColor;

    void main() {
        outColor = vec4(1.0);
    }
`;

export const objectVertexShaderSource = glsl`#version 300 es
    in vec4 a_position;
    in vec3 a_normal;
    in vec2 a_texcoord;

    uniform mat4 u_matrix;
    uniform mat4 u_worldMatrix;
    uniform mat4 u_lightMatrix;

    out vec3 v_normal;
    out vec2 v_texcoord;
    out vec4 v_lightSpacePos;
    out vec3 v_worldPos;

    void main() {
        vec4 worldPos = u_worldMatrix * a_position;
        gl_Position = u_matrix * a_position;
        v_normal = normalize(mat3(u_worldMatrix) * a_normal);
        v_texcoord = a_texcoord;
        v_lightSpacePos = u_lightMatrix * worldPos;
        v_worldPos = worldPos.xyz;
    }
`;

export const objectFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in vec3 v_normal;
    in vec2 v_texcoord;
    in vec4 v_lightSpacePos;
    in vec3 v_worldPos;

    uniform sampler2D u_texture;
    uniform sampler2D u_shadowMap;
    uniform vec3 u_lightPos;
    uniform bool u_isSelected;

    out vec4 outColor;

    float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
        vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;

        if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
            projCoords.y < 0.0 || projCoords.y > 1.0) {
            return 1.0;
        }

        float currentDepth = projCoords.z;
        float NdotL = dot(normal, lightDir);
        float bias = max(0.005 * (1.0 - NdotL), 0.001);

        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(4096.0, 4096.0);
        for(int x = -2; x <= 2; ++x) {
            for(int y = -2; y <= 2; ++y) {
                float pcfDepth = texture(u_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
                shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
            }
        }
        shadow /= 25.0;

        return shadow;
    }

    void main() {
        vec4 texColor = texture(u_texture, v_texcoord);

        vec3 normal = normalize(v_normal);
        vec3 lightDir = normalize(u_lightPos - v_worldPos);

        float NdotL = dot(normal, lightDir);
        float diff = max(NdotL, 0.0);

        float shadow = 1.0;
        if (NdotL > 0.0) {
            shadow = calculateShadow(v_lightSpacePos, normal, lightDir);
        }

        float hemisphereLight = NdotL * 0.5 + 0.5;
        vec3 ambient = mix(vec3(0.01), vec3(0.02), hemisphereLight) * texColor.rgb;
        vec3 diffuse = diff * texColor.rgb * 1.2;

        vec3 lighting = ambient + shadow * diffuse;

        if (u_isSelected) {
            vec3 greenTint = vec3(0.2, 0.8, 0.3);
            lighting = mix(lighting, greenTint, 0.5);
            outColor = vec4(lighting, 0.7);
        } else {
            outColor = vec4(lighting, texColor.a);
        }
    }
`;

export const vertexShaderSource = glsl`#version 300 es
    layout(location = 0) in vec3 a_position;
    layout(location = 1) in vec3 a_normal;
    layout(location = 2) in float a_height;

    uniform mat4 u_matrix;
    uniform mat4 u_worldMatrix;
    uniform mat4 u_lightMatrix;

    out vec3 v_normal;
    out float v_height;
    out vec4 v_lightSpacePos;
    out vec3 v_worldPos;

    void main() {
        vec4 worldPos4 = u_worldMatrix * vec4(a_position, 1.0);
        v_worldPos = worldPos4.xyz;

        gl_Position = u_matrix * vec4(a_position, 1.0);

        v_normal = normalize(mat3(u_worldMatrix) * a_normal);
        v_height = a_height;

        v_lightSpacePos = u_lightMatrix * worldPos4;
    }
`;


export const fragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in vec3 v_normal;
    in float v_height;
    in vec4 v_lightSpacePos;
    in vec3 v_worldPos;

    uniform vec3 u_color;
    uniform bool u_useColor;
    uniform sampler2D u_shadowMap;
    uniform vec3 u_lightPos;
    uniform vec3 u_cameraPos;

    uniform float u_seaLevel;
    uniform float u_sandRange;

    // Cores do terreno por zona de altura
    const vec3 SEAFLOOR_DEEP_COLOR = vec3(0.08, 0.06, 0.04);   // Fundo oceanico escuro
    const vec3 SEAFLOOR_COLOR = vec3(0.18, 0.15, 0.12);   // Fundo oceanico raso
    const vec3 SAND_COLOR = vec3(0.95, 0.88, 0.72);   // Areia #F2E0B8
    const vec3 PLAIN_COLOR = vec3(0.325, 0.588, 0.361);   // Verde claro #53965c
    const vec3 HIGH_COLOR = vec3(0.0588, 0.2235, 0.0824); // Verde escuro #0f3915


    out vec4 outColor;

    float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
        vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;

        if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
            projCoords.y < 0.0 || projCoords.y > 1.0) {
            return 1.0;
        }

        float currentDepth = projCoords.z;
        float NdotL = dot(normal, lightDir);
        float bias = max(0.005 * (1.0 - NdotL), 0.001);

        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(4096.0, 4096.0);
        for(int x = -2; x <= 2; ++x) {
            for(int y = -2; y <= 2; ++y) {
                float pcfDepth = texture(u_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
                shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
            }
        }
        shadow /= 25.0;

        return shadow;
    }

    vec3 getTerrainColor(float h) {
        float sandStart = u_seaLevel - u_sandRange;
        float sandEnd   = u_seaLevel + u_sandRange;

        // Abaixo do nivel do mar: fundo oceanico (sera coberto pela agua)
        float seaFloorDepth = clamp(h / max(sandStart, 0.001), 0.0, 1.0);
        vec3 seaFloorColor = mix(SEAFLOOR_DEEP_COLOR, SEAFLOOR_COLOR, seaFloorDepth);

        // Gradiente da terra: planicie rosa claro -> elevacao rosa escuro
        float landElev = clamp((h - sandEnd) / max(1.0 - sandEnd, 0.001), 0.0, 1.0);
        vec3 landColor = mix(PLAIN_COLOR, HIGH_COLOR, landElev);

        // Transicao suave fundo oceanico -> areia
        float seaToSand = smoothstep(sandStart, u_seaLevel, h);
        vec3 waterSandBlend = mix(seaFloorColor, SAND_COLOR, seaToSand);

        // Transicao suave areia -> terra
        float sandToLand = smoothstep(u_seaLevel, sandEnd, h);
        return mix(waterSandBlend, landColor, sandToLand);
    }

    void main() {
        if (u_useColor) {
            outColor = vec4(u_color, 1.0);
        } else {
            vec3 color = getTerrainColor(v_height);

            vec3 normal = normalize(v_normal);
            vec3 lightDir = normalize(u_lightPos - v_worldPos);

            float NdotL = dot(normal, lightDir);

            float shadow = 1.0;
            if (NdotL > -0.1) {
                shadow = calculateShadow(v_lightSpacePos, normal, lightDir);
            }

            float terminatorSoftness = 0.25;
            float terminatorStart = -0.15;
            float terminatorEnd = terminatorStart + terminatorSoftness;
            float lightIntensity = smoothstep(terminatorStart, terminatorEnd, NdotL);

            vec3 skyColor = vec3(0.05, 0.05, 0.08);
            float hemisphereLight = NdotL * 0.5 + 0.5;
            vec3 ambient = mix(skyColor, vec3(0.2), hemisphereLight) * color;

            float diff = max(NdotL, 0.0);
            vec3 diffuse = diff * color * 1.2;

            vec3 viewDir = normalize(u_cameraPos - v_worldPos);
            float rimDot = 1.0 - max(dot(viewDir, normal), 0.0);
            float rimIntensity = pow(rimDot, 3.0) * max(NdotL, 0.0) * 0.3;
            vec3 rimColor = vec3(1.0, 0.95, 0.9) * rimIntensity;

            vec3 lighting = ambient + (diffuse * shadow * lightIntensity) + rimColor;

            outColor = vec4(lighting, 1.0);
        }
    }
`;


export const waterVertexShaderSource = glsl`#version 300 es
    layout(location = 0) in vec3 a_position;
    layout(location = 1) in vec3 a_normal;

    uniform mat4 u_matrix;
    uniform mat4 u_worldMatrix;
    uniform mat4 u_lightMatrix;
    uniform float u_time;

    out vec3 v_normal;
    out vec4 v_lightSpacePos;
    out vec3 v_worldPos;
    out vec3 v_objectPos;

    float waveHeight(vec3 dir, float t) {
        float h = 0.0;
        h += sin(dir.x * 8.0 + dir.z * 3.0 + t * 1.2) * 0.012;
        h += sin(dir.y * 6.0 + dir.x * 5.0 - t * 0.8) * 0.008;
        h += sin((dir.x + dir.y + dir.z) * 10.0 + t * 1.6) * 0.005;
        h += sin(dir.z * 7.0 - dir.y * 4.0 + t * 1.0) * 0.006;
        return h;
    }

    void main() {
        vec3 dir = normalize(a_position);
        float wave = waveHeight(dir, u_time);
        vec3 displaced = a_position + a_normal * wave;

        vec4 worldPos = u_worldMatrix * vec4(displaced, 1.0);
        v_worldPos = worldPos.xyz;
        gl_Position = u_matrix * vec4(displaced, 1.0);
        v_normal = normalize(mat3(u_worldMatrix) * a_normal);
        v_lightSpacePos = u_lightMatrix * worldPos;
        v_objectPos = a_position;
    }
`;

export const waterFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in vec3 v_normal;
    in vec4 v_lightSpacePos;
    in vec3 v_worldPos;
    in vec3 v_objectPos;

    uniform vec3 u_lightPos;
    uniform vec3 u_cameraPos;
    uniform sampler2D u_shadowMap;
    uniform float u_time;

    const vec3 DEEP_WATER_COLOR    = vec3(0.04, 0.08, 0.22);
    const vec3 SHALLOW_WATER_COLOR = vec3(0.10, 0.30, 0.50);
    const vec3 SPECULAR_COLOR      = vec3(0.8, 0.85, 0.9);

    out vec4 outColor;

    float waveHeight(vec3 dir, float t) {
        float h = 0.0;
        h += sin(dir.x * 8.0 + dir.z * 3.0 + t * 1.2) * 0.012;
        h += sin(dir.y * 6.0 + dir.x * 5.0 - t * 0.8) * 0.008;
        h += sin((dir.x + dir.y + dir.z) * 10.0 + t * 1.6) * 0.005;
        h += sin(dir.z * 7.0 - dir.y * 4.0 + t * 1.0) * 0.006;
        return h;
    }

    vec3 computeWaveNormal(vec3 pos, vec3 baseNormal, float t) {
        vec3 dir = normalize(pos);
        float eps = 0.02;

        vec3 up = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
        vec3 tangent = normalize(cross(up, dir));
        vec3 bitangent = cross(dir, tangent);

        vec3 d1 = normalize(dir + tangent * eps);
        vec3 d2 = normalize(dir + bitangent * eps);

        float h0 = waveHeight(dir, t);
        float h1 = waveHeight(d1, t);
        float h2 = waveHeight(d2, t);

        float scale = 5.0;
        return normalize(baseNormal - tangent * (h1 - h0) / eps * scale - bitangent * (h2 - h0) / eps * scale);
    }

    float calculateShadow(vec4 lightSpacePos, vec3 normal, vec3 lightDir) {
        vec3 projCoords = lightSpacePos.xyz / lightSpacePos.w;
        projCoords = projCoords * 0.5 + 0.5;

        if (projCoords.z > 1.0 || projCoords.x < 0.0 || projCoords.x > 1.0 ||
            projCoords.y < 0.0 || projCoords.y > 1.0) {
            return 1.0;
        }

        float currentDepth = projCoords.z;
        float NdotL = dot(normal, lightDir);
        float bias = max(0.005 * (1.0 - NdotL), 0.001);

        float shadow = 0.0;
        vec2 texelSize = 1.0 / vec2(4096.0, 4096.0);
        for(int x = -2; x <= 2; ++x) {
            for(int y = -2; y <= 2; ++y) {
                float pcfDepth = texture(u_shadowMap, projCoords.xy + vec2(x, y) * texelSize).r;
                shadow += currentDepth - bias > pcfDepth ? 0.0 : 1.0;
            }
        }
        shadow /= 25.0;

        return shadow;
    }

    void main() {
        vec3 baseNormal = normalize(v_normal);
        vec3 normal = computeWaveNormal(v_objectPos, baseNormal, u_time);
        vec3 lightDir = normalize(u_lightPos - v_worldPos);
        vec3 viewDir = normalize(u_cameraPos - v_worldPos);

        float NdotL = dot(normal, lightDir);
        float diff = max(NdotL, 0.0);

        // Fresnel: mais reflexivo nas bordas
        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);

        // Cor base da agua (mistura profundo/raso baseado no angulo de visao)
        vec3 waterColor = mix(DEEP_WATER_COLOR, SHALLOW_WATER_COLOR, 0.4 + fresnel * 0.3);

        // Shadow
        float shadow = 1.0;
        if (NdotL > 0.0) {
            shadow = calculateShadow(v_lightSpacePos, normal, lightDir);
        }

        // Specular (Blinn-Phong)
        vec3 halfVec = normalize(lightDir + viewDir);
        float spec = pow(max(dot(normal, halfVec), 0.0), 64.0);

        // Terminator suave
        float terminatorSoftness = 0.25;
        float terminatorStart = -0.15;
        float terminatorEnd = terminatorStart + terminatorSoftness;
        float lightIntensity = smoothstep(terminatorStart, terminatorEnd, NdotL);

        // Iluminacao
        vec3 ambient = waterColor * 0.15;
        vec3 diffuse = waterColor * diff * 0.8;
        vec3 specular = SPECULAR_COLOR * spec * shadow * 0.5;
        vec3 rim = vec3(0.15, 0.2, 0.3) * fresnel * 0.4;

        vec3 finalColor = ambient + (diffuse * shadow * lightIntensity) + specular + rim;

        // Transparencia: mais opaco no centro, mais transparente nas bordas
        float alpha = 0.65 + fresnel * 0.15;

        outColor = vec4(finalColor, alpha);
    }
`;


export const pickingObjectVertexShaderSource = glsl`#version 300 es
    in vec4 a_position;

    uniform mat4 u_matrix;
    uniform mat4 u_worldMatrix;

    void main() {
        gl_Position = u_matrix * a_position;
    }
`;

export const pickingObjectFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    uniform vec4 u_id;

    out vec4 outColor;

    void main() {
        outColor = u_id;
    }
`;


export const cometVertexShaderSource = glsl`#version 300 es
    in vec3 a_position;
    in vec3 a_normal;

    uniform mat4 u_mvpMatrix;
    uniform mat4 u_modelMatrix;

    out vec3 v_normal;
    out vec3 v_worldPos;
    out vec3 v_localPos;

    void main() {
        vec4 worldPos = u_modelMatrix * vec4(a_position, 1.0);
        v_worldPos = worldPos.xyz;
        gl_Position = u_mvpMatrix * vec4(a_position, 1.0);
        v_normal = normalize(mat3(u_modelMatrix) * a_normal);
        v_localPos = a_position;
    }
`;

export const cometFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in vec3 v_normal;
    in vec3 v_worldPos;
    in vec3 v_localPos;

    uniform vec3 u_cameraPos;
    uniform float u_destroyProgress;

    out vec4 outColor;

    void main() {
        vec3 normal = normalize(v_normal);
        vec3 viewDir = normalize(u_cameraPos - v_worldPos);

        // Cores do cometa: nucleo brilhante -> borda alaranjada
        vec3 coreColor  = vec3(1.0, 0.75, 0.25);  // laranja quente brilhante
        vec3 midColor   = vec3(1.0, 0.35, 0.0);   // laranja forte intenso
        vec3 outerColor = vec3(0.85, 0.05, 0.0);  // vermelho alaranjado profu



        float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 2.5);
        vec3 color = mix(coreColor, midColor, fresnel * 0.7);
        color = mix(color, outerColor, fresnel * fresnel);

        float ambient = 0.6;
        float diff = max(dot(normal, viewDir), 0.0) * 0.4;
        vec3 finalColor = color * (ambient + diff);

        float alpha = 1.0;
        if (u_destroyProgress > 0.0) {
            finalColor = mix(finalColor, vec3(1.0, 0.2, 0.0), u_destroyProgress);
            alpha = 1.0 - u_destroyProgress;
        }

        outColor = vec4(finalColor, alpha);
    }
`;

export const starVertexShaderSource = glsl`#version 300 es
    in vec3 a_position;
    in float a_size;

    uniform mat4 u_viewProjectionMatrix;

    out float v_brightness;

    void main() {
        gl_Position = u_viewProjectionMatrix * vec4(a_position, 1.0);
        gl_PointSize = a_size;
        v_brightness = a_size / 3.0;
    }
`;

export const starFragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in float v_brightness;
    out vec4 outColor;

    void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        if (dist > 0.5) discard;

        float brightness = (1.0 - dist * 2.0) * v_brightness;

        vec3 starColor = vec3(1.0);
        float colorVariation = fract(v_brightness * 123.456);
        if (colorVariation > 0.95) {
            starColor = vec3(1.0, 0.9, 0.95);
        } else if (colorVariation > 0.90) {
            starColor = vec3(0.95, 0.95, 1.0);
        }

        outColor = vec4(starColor * brightness, 1.0);
    }
`;
