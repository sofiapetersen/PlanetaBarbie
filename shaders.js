const glsl = x => x;

export const depthVertexShaderSource = glsl`#version 300 es
    in vec4 a_position;
    in vec2 a_texcoord;

    uniform mat4 u_lightMatrix;
    uniform sampler2D u_noiseTexture;

    void main() {
        float nv = texture(u_noiseTexture, a_texcoord).r;
        float smoothNoise = pow(nv, 1.2);
        vec3 displacement = a_position.xyz * smoothNoise * 1.8;
        gl_Position = u_lightMatrix * vec4(a_position.xyz + displacement, 1.0);
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

        // Verde mangueira em objeto selecionado
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
    in vec4 a_position;
    in vec3 a_normal;
    in vec2 a_texcoord;

    uniform mat4 u_matrix;
    uniform mat4 u_worldMatrix;
    uniform mat4 u_lightMatrix;
    uniform sampler2D u_noiseTexture;

    out vec3 v_normal;
    out vec2 v_texcoord;
    out float v_height;
    out vec4 v_lightSpacePos;
    out vec3 v_worldPos;

    void main() {
        float nv = texture(u_noiseTexture, a_texcoord).r;

        float smoothNoise = pow(nv, 1.2);
        vec3 displacement = a_position.xyz * smoothNoise * 1.8;
        vec3 localPos = a_position.xyz + displacement;

        vec4 worldPos4 = u_worldMatrix * vec4(localPos, 1.0);
        v_worldPos = worldPos4.xyz;

        gl_Position = u_matrix * vec4(localPos, 1.0);

        v_normal = normalize(mat3(u_worldMatrix) * localPos);
        v_texcoord = a_texcoord;
        v_height = smoothNoise;

        v_lightSpacePos = u_lightMatrix * worldPos4;
    }
`;

export const fragmentShaderSource = glsl`#version 300 es
    precision highp float;

    in vec3 v_normal;
    in vec2 v_texcoord;
    in float v_height;
    in vec4 v_lightSpacePos;
    in vec3 v_worldPos;

    uniform vec3 u_color;
    uniform bool u_useColor;
    uniform sampler2D u_noiseTexture;
    uniform sampler2D u_shadowMap;
    uniform vec3 u_lightPos;
    uniform vec3 u_cameraPos;

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
        if (u_useColor) {
            outColor = vec4(u_color, 1.0);
        } else {
            vec3 lowColor = vec3(0.6, 0.2, 0.4);    // Rosa escuro
            vec3 midColor = vec3(1.0, 0.4, 0.7);    // Rosa médio
            vec3 highColor = vec3(1.0, 0.8, 0.9);   // Rosa claro

            vec3 color;
            if (v_height < 0.5) {
                color = mix(lowColor, midColor, v_height / 0.5);
            } else {
                color = mix(midColor, highColor, (v_height - 0.5) / 0.5);
            }

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

            vec3 skyColor = vec3(0.05, 0.05, 0.08); // Azul muito escuro do espaço
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