import { sphereDirToFace } from './cube-sphere.js';

export class CometManager {

    constructor() {
        this.comets = [];
        this.score = 0;

        // Parametros configuraveis
        this.config = {
            spawnMinTime: 5,
            spawnMaxTime: 15,
            cometSpeed: 1,
            cometSizeRange: [0.08, 0.15],
            craterRadius: 20,
            craterDepth: 0.1,
            maxComets: 5,
            spawnDistance: 6.0,
        };

        this.timeSinceLastSpawn = 0;
        this.nextSpawnTime = this._randomSpawnTime();
    }

    _randomSpawnTime() {
        const { spawnMinTime, spawnMaxTime } = this.config;
        return spawnMinTime + Math.random() * (spawnMaxTime - spawnMinTime);
    }

    spawnComet() {
        if (this.comets.length >= this.config.maxComets) return null;

        const angle = Math.random() * Math.PI * 2;
        const spawnRadius = 3.5 + Math.random() * 1.5; 
        const spawnX = Math.cos(angle) * spawnRadius;
        const spawnY = Math.sin(angle) * spawnRadius;
        const spawnZ = 1.5 + Math.random() * 2.5; 

        const size = this.config.cometSizeRange[0] +
            Math.random() * (this.config.cometSizeRange[1] - this.config.cometSizeRange[0]);

        const len = Math.sqrt(spawnX * spawnX + spawnY * spawnY + spawnZ * spawnZ);
        const dirX = -spawnX / len;
        const dirY = -spawnY / len;
        const dirZ = -spawnZ / len;

        const rax = Math.random() - 0.5;
        const ray = Math.random() - 0.5;
        const raz = Math.random() - 0.5;
        const rlen = Math.sqrt(rax * rax + ray * ray + raz * raz) || 1;

        const comet = {
            position: [spawnX, spawnY, spawnZ],
            direction: [dirX, dirY, dirZ],
            size,
            speed: this.config.cometSpeed * (0.8 + Math.random() * 0.4),
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: 1.5 + Math.random() * 3.0,
            rotationAxis: [rax / rlen, ray / rlen, raz / rlen],
            alive: true,
            destroying: false,
            destroyTimer: 0,
            originalSize: size,
        };

        this.comets.push(comet);
        return comet;
    }

    updateComets(deltaTime) {
        this.timeSinceLastSpawn += deltaTime;
        if (this.timeSinceLastSpawn >= this.nextSpawnTime) {
            this.spawnComet();
            this.timeSinceLastSpawn = 0;
            this.nextSpawnTime = this._randomSpawnTime();
        }

        for (const comet of this.comets) {
            if (comet.destroying) {
                comet.destroyTimer += deltaTime;
                comet.size *= 0.85;
                if (comet.destroyTimer > 0.4) {
                    comet.alive = false;
                }
                continue;
            }

            comet.position[0] += comet.direction[0] * comet.speed * deltaTime;
            comet.position[1] += comet.direction[1] * comet.speed * deltaTime;
            comet.position[2] += comet.direction[2] * comet.speed * deltaTime;

            comet.rotation += comet.rotationSpeed * deltaTime;
        }

        this.comets = this.comets.filter(c => c.alive);
    }

    destroyCometByClick(index) {
        if (index < 0 || index >= this.comets.length) return false;
        const comet = this.comets[index];
        if (comet.destroying) return false;

        comet.destroying = true;
        comet.destroyTimer = 0;
        this.score++;
        return true;
    }

    destroyCometByImpact(index) {
        if (index < 0 || index >= this.comets.length) return;
        this.comets[index].alive = false;
    }

    checkPlanetCollision(comet, planetInvMatrix, getTerrainRadius) {
        const wp = comet.position;

        // Transformar posicao do cometa para espaco local do planeta
        const lx = planetInvMatrix[0] * wp[0] + planetInvMatrix[4] * wp[1] + planetInvMatrix[8] * wp[2] + planetInvMatrix[12];
        const ly = planetInvMatrix[1] * wp[0] + planetInvMatrix[5] * wp[1] + planetInvMatrix[9] * wp[2] + planetInvMatrix[13];
        const lz = planetInvMatrix[2] * wp[0] + planetInvMatrix[6] * wp[1] + planetInvMatrix[10] * wp[2] + planetInvMatrix[14];

        const dist = Math.sqrt(lx * lx + ly * ly + lz * lz);
        if (dist < 0.001) return null;

        const dirX = lx / dist;
        const dirY = ly / dist;
        const dirZ = lz / dist;

        const terrainRadius = getTerrainRadius(dirX, dirY, dirZ);

        if (dist <= terrainRadius + comet.size * 0.5) {
            const faceCoord = sphereDirToFace(dirX, dirY, dirZ);
            return {
                dirX, dirY, dirZ,
                faceId: faceCoord.faceId,
                faceS: faceCoord.s,
                faceT: faceCoord.t,
            };
        }

        return null;
    }
}
