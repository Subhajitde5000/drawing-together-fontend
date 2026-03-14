"use client";

import { useEffect, useRef } from "react";

interface PhaserGameProps {
  role: "police" | "thief";
}

// ─── Tile indices (row-major, zero-indexed from generated tileset) ─────────
const T = {
  GRASS:     0,
  GRASS2:    1,
  ROAD_H:    2,
  ROAD_V:    3,
  ROAD_X:    4,
  PAVEMENT:  5,
  ROOF:      6,
  WALL:      7,
  WATER:     8,
  TREE:      9,
  // second row
  PARK:     10,
  ROAD_TL:  11,
  ROAD_TR:  12,
  ROAD_BL:  13,
  ROAD_BR:  14,
  SHADOW:   15,
  BUSH:     16,
  DIRT:     17,
  FLOWER:   18,
  BENCH:    19,
};

// ─── Procedural map generator ──────────────────────────────────────────────
function buildMap(W: number, H: number): number[][] {
  const map: number[][] = Array.from({ length: H }, () =>
    Array(W).fill(T.GRASS)
  );

  // Helper
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && x < W && y >= 0 && y < H) map[y][x] = t;
  };

  // Draw horizontal roads every 12 tiles
  for (let y = 0; y < H; y++) {
    if (y % 12 === 0 || y % 12 === 1) {
      for (let x = 0; x < W; x++) map[y][x] = T.ROAD_H;
    }
  }
  // Draw vertical roads every 16 tiles
  for (let x = 0; x < W; x++) {
    if (x % 16 === 0 || x % 16 === 1) {
      for (let y = 0; y < H; y++) map[y][x] = T.ROAD_V;
    }
  }
  // Mark intersections
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if ((y % 12 === 0 || y % 12 === 1) && (x % 16 === 0 || x % 16 === 1)) {
        map[y][x] = T.ROAD_X;
      }
    }
  }

  // Add city blocks (buildings) in the spaces between roads
  for (let blockY = 0; blockY * 12 + 12 < H; blockY++) {
    for (let blockX = 0; blockX * 16 + 16 < W; blockX++) {
      const startX = blockX * 16 + 2;
      const startY = blockY * 12 + 2;
      const blockW = 14;
      const blockH = 10;

      // Pavement around the block perimeter
      for (let dy = 0; dy < blockH; dy++) {
        for (let dx = 0; dx < blockW; dx++) {
          const bx = startX + dx;
          const by = startY + dy;
          const isBorder = dx === 0 || dx === blockW - 1 || dy === 0 || dy === blockH - 1;
          set(bx, by, isBorder ? T.PAVEMENT : T.GRASS2);
        }
      }

      // Randomly choose block type
      const rand = (blockX * 7 + blockY * 13) % 5;

      if (rand === 0) {
        // Park
        for (let dy = 1; dy < blockH - 1; dy++) {
          for (let dx = 1; dx < blockW - 1; dx++) {
            set(startX + dx, startY + dy, T.PARK);
          }
        }
        // Trees in park
        for (let dy = 1; dy < blockH - 1; dy += 3) {
          for (let dx = 1; dx < blockW - 1; dx += 3) {
            set(startX + dx, startY + dy, T.TREE);
          }
        }
      } else if (rand === 1) {
        // Pond
        for (let dy = 2; dy < blockH - 2; dy++) {
          for (let dx = 2; dx < blockW - 2; dx++) {
            set(startX + dx, startY + dy, T.WATER);
          }
        }
        for (let dy = 1; dy < blockH - 1; dy += 2) {
          set(startX + 1, startY + dy, T.BUSH);
          set(startX + blockW - 2, startY + dy, T.BUSH);
        }
      } else {
        // Building (roof tiles in the interior)
        for (let dy = 1; dy < blockH - 1; dy++) {
          for (let dx = 1; dx < blockW - 1; dx++) {
            set(startX + dx, startY + dy, T.ROOF);
          }
        }
        // Shadow on bottom & right edges
        for (let dx = 1; dx < blockW - 1; dx++) {
          set(startX + dx, startY + blockH - 1, T.SHADOW);
        }
        for (let dy = 1; dy < blockH - 1; dy++) {
          set(startX + blockW - 1, startY + dy, T.SHADOW);
        }
        // Wall border colour
        for (let dx = 0; dx < blockW; dx++) {
          set(startX + dx, startY, T.WALL);
          set(startX + dx, startY + blockH - 1, T.WALL);
        }
        for (let dy = 0; dy < blockH; dy++) {
          set(startX, startY + dy, T.WALL);
          set(startX + blockW - 1, startY + dy, T.WALL);
        }
      }
    }
  }

  // Sprinkle some flowers & benches on pavement areas
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (map[y][x] === T.PAVEMENT) {
        if ((x * 3 + y * 7) % 17 === 0) map[y][x] = T.FLOWER;
        if ((x * 5 + y * 11) % 23 === 0) map[y][x] = T.BENCH;
      }
    }
  }

  return map;
}

export default function PhaserGame({ role }: PhaserGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let game: { destroy: (arg0: boolean) => void } | null = null;

    import("phaser").then((PhaserModule) => {
      const Phaser = PhaserModule.default;

      const MAP_W = 80;
      const MAP_H = 60;
      const TILE_SIZE = 32;
      const mapData = buildMap(MAP_W, MAP_H);

      // Colour palette for programmatic texture generation
      const TILE_COLORS: Record<number, number[]> = {
        [T.GRASS]:    [0x4ade80, 0x22c55e],
        [T.GRASS2]:   [0x86efac, 0x4ade80],
        [T.ROAD_H]:   [0x475569, 0x334155],
        [T.ROAD_V]:   [0x475569, 0x334155],
        [T.ROAD_X]:   [0x374151, 0x1e293b],
        [T.PAVEMENT]: [0xcbd5e1, 0x94a3b8],
        [T.ROOF]:     [0x64748b, 0x475569],
        [T.WALL]:     [0x7f6543, 0x5f4c30],
        [T.WATER]:    [0x38bdf8, 0x0ea5e9],
        [T.TREE]:     [0x15803d, 0x166534],
        [T.PARK]:     [0x86efac, 0x4ade80],
        [T.ROAD_TL]:  [0x475569, 0x334155],
        [T.ROAD_TR]:  [0x475569, 0x334155],
        [T.ROAD_BL]:  [0x475569, 0x334155],
        [T.ROAD_BR]:  [0x475569, 0x334155],
        [T.SHADOW]:   [0x1e293b, 0x0f172a],
        [T.BUSH]:     [0x16a34a, 0x15803d],
        [T.DIRT]:     [0xa16207, 0x78350f],
        [T.FLOWER]:   [0xfbbf24, 0xf59e0b],
        [T.BENCH]:    [0x78350f, 0x451a03],
      };

      class GameScene extends Phaser.Scene {
        private player!: Phaser.GameObjects.Rectangle & { speed?: number };
        private playerBody!: Phaser.Physics.Arcade.Body;
        private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
        private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
        private tileSprites: Phaser.GameObjects.Rectangle[][] = [];

        constructor() {
          super({ key: "GameScene" });
        }

        create() {
          const worldW = MAP_W * TILE_SIZE;
          const worldH = MAP_H * TILE_SIZE;

          // Generate tile textures programmatically using Graphics
          Object.entries(TILE_COLORS).forEach(([tileId, [colTop, colBottom]]) => {
            const g = this.add.graphics();
            // Base fill
            g.fillStyle(colBottom, 1);
            g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            // Lighter top half for depth illusion
            g.fillStyle(colTop, 1);
            g.fillRect(0, 0, TILE_SIZE, TILE_SIZE / 2);
            // Subtle highlight pixel line
            g.fillStyle(0xffffff, 0.12);
            g.fillRect(0, 0, TILE_SIZE, 2);

            // Special details per tile type
            const id = Number(tileId);
            if (id === T.ROAD_H || id === T.ROAD_V || id === T.ROAD_X) {
              // Road markings (dashed white centre line)
              g.fillStyle(0xffffff, 0.5);
              if (id === T.ROAD_H || id === T.ROAD_X) {
                g.fillRect(4, 14, 8, 4);
                g.fillRect(20, 14, 8, 4);
              }
              if (id === T.ROAD_V || id === T.ROAD_X) {
                g.fillRect(14, 4, 4, 8);
                g.fillRect(14, 20, 4, 8);
              }
            }
            if (id === T.TREE) {
              // Tree trunk
              g.fillStyle(0x92400e, 1); g.fillRect(13, 20, 6, 12);
              // Tree canopy
              g.fillStyle(0x166534, 1); g.fillCircle(16, 13, 12);
              g.fillStyle(0x15803d, 1); g.fillCircle(16, 11, 9);
              g.fillStyle(0x86efac, 0.4); g.fillCircle(12, 10, 5);
            }
            if (id === T.WATER) {
              g.fillStyle(0x7dd3fc, 0.4);
              g.fillRect(2, 8, 28, 3);
              g.fillRect(5, 18, 22, 3);
            }
            if (id === T.ROOF) {
              // AC unit details
              g.fillStyle(0x94a3b8, 1); g.fillRect(4, 4, 8, 6); g.fillRect(18, 18, 8, 6);
              g.fillStyle(0x475569, 1); g.fillRect(5, 5, 6, 4); g.fillRect(19, 19, 6, 4);
            }
            if (id === T.FLOWER) {
              g.fillStyle(0xfbbf24, 1); g.fillCircle(16, 16, 5);
              g.fillStyle(0xfde68a, 1); g.fillCircle(16, 16, 3);
            }
            if (id === T.BENCH) {
              g.fillStyle(0x92400e, 1);
              g.fillRect(4, 12, 24, 4); // seat
              g.fillRect(4, 8, 24, 3);  // back
              g.fillRect(4, 16, 3, 8); g.fillRect(25, 16, 3, 8); // legs
            }
            if (id === T.SHADOW) {
              g.fillStyle(0x000000, 0.5);
              g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
            }

            g.generateTexture(`tile_${tileId}`, TILE_SIZE, TILE_SIZE);
            g.destroy();
          });

          // Render tilemap as individual sprites grouped in a container
          const tileContainer = this.add.container(0, 0);

          for (let y = 0; y < MAP_H; y++) {
            this.tileSprites[y] = [];
            for (let x = 0; x < MAP_W; x++) {
              const tileId = mapData[y][x];
              const px = x * TILE_SIZE;
              const py = y * TILE_SIZE;
              const rect = this.add.image(px, py, `tile_${tileId}`).setOrigin(0, 0);
              tileContainer.add(rect);
            }
          }

          // ── Player character ──────────────────────────────────────────────
          const playerColor = role === "police" ? 0x3b82f6 : 0xef4444;
          const playerHighlight = role === "police" ? 0x93c5fd : 0xfca5a5;

          // Draw player texture
          const pg = this.add.graphics();
          // Body
          pg.fillStyle(playerColor, 1);
          pg.fillRoundedRect(4, 8, 24, 20, 4);
          // Head
          pg.fillStyle(0xfde68a, 1);
          pg.fillCircle(16, 8, 8);
          // Hat / cap
          pg.fillStyle(playerColor, 1);
          if (role === "police") {
            pg.fillRect(8, 0, 16, 5); // police cap visor
          } else {
            pg.fillStyle(0x1c1917, 1);
            pg.fillRect(6, 0, 20, 10); // thief balaclava
            pg.fillStyle(0xfde68a, 1);
            pg.fillRect(10, 3, 12, 5); // eye slot
          }
          // Badge / detail
          pg.fillStyle(playerHighlight, 1);
          pg.fillRect(12, 14, 8, 5);
          // Legs
          pg.fillStyle(0x1e293b, 1);
          pg.fillRect(6, 26, 8, 6);
          pg.fillRect(18, 26, 8, 6);
          pg.generateTexture("player", TILE_SIZE, TILE_SIZE);
          pg.destroy();

          this.player = this.physics.add.existing(
            this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE, playerColor).setOrigin(0.5, 0.5)
          ) as unknown as Phaser.GameObjects.Rectangle & { speed?: number };

          // replace the plain rectangle with the drawn texture
          const playerSprite = this.add.image(
            3 * TILE_SIZE + 16,
            3 * TILE_SIZE + 16,
            "player"
          ).setDepth(10);

          const playerPhysics = this.physics.add.existing(
            this.add.rectangle(3 * TILE_SIZE + 16, 3 * TILE_SIZE + 16, 20, 24)
          ) as unknown as Phaser.GameObjects.Rectangle;

          const body = (playerPhysics as unknown as { body: Phaser.Physics.Arcade.Body }).body;
          body.setCollideWorldBounds(true);

          // Track player sprite to physics object
          this.events.on("update", () => {
            playerSprite.x = playerPhysics.x + 10;
            playerSprite.y = playerPhysics.y + 12;
          });

          // Camera
          this.cameras.main.setBounds(0, 0, worldW, worldH);
          this.cameras.main.startFollow(playerPhysics, true, 0.08, 0.08);
          this.cameras.main.setZoom(1.5);

          // Physics world bounds
          this.physics.world.setBounds(0, 0, worldW, worldH);

          // Input
          this.cursors = this.input.keyboard!.createCursorKeys();
          this.wasd = {
            up:    this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
            down:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
            left:  this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
            right: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
          };

          // Store references  
          (this as unknown as Record<string, unknown>)._playerPhysics = playerPhysics;
          (this as unknown as Record<string, unknown>)._playerSprite = playerSprite;

          // --- Ambient decorations: animated dots/lights on rooftops ---
          for (let i = 0; i < 15; i++) {
            const rx = Phaser.Math.Between(TILE_SIZE, worldW - TILE_SIZE);
            const ry = Phaser.Math.Between(TILE_SIZE, worldH - TILE_SIZE);
            // only place on what looks like rooftops
            const tx = Math.floor(rx / TILE_SIZE);
            const ty = Math.floor(ry / TILE_SIZE);
            if (mapData[ty]?.[tx] === T.ROOF) {
              const dot = this.add.circle(rx, ry, 3, 0xff4444).setDepth(9);
              this.tweens.add({
                targets: dot,
                alpha: { from: 1, to: 0.1 },
                duration: 800 + i * 200,
                yoyo: true,
                repeat: -1,
              });
            }
          }
        }

        update() {
          const playerPhysics = (this as unknown as Record<string, unknown>)._playerPhysics as Phaser.GameObjects.Rectangle;
          if (!playerPhysics) return;
          const body = (playerPhysics as unknown as { body: Phaser.Physics.Arcade.Body }).body;
          const speed = 160;

          let vx = 0;
          let vy = 0;

          if (this.cursors.left.isDown || this.wasd.left.isDown)  vx = -speed;
          if (this.cursors.right.isDown || this.wasd.right.isDown) vx = speed;
          if (this.cursors.up.isDown || this.wasd.up.isDown)    vy = -speed;
          if (this.cursors.down.isDown || this.wasd.down.isDown)  vy = speed;

          // diagonal normalise
          if (vx !== 0 && vy !== 0) {
            vx *= 0.707;
            vy *= 0.707;
          }

          body.setVelocity(vx, vy);
        }
      }

      const container = containerRef.current!;
      const w = container.clientWidth  || 800;
      const h = container.clientHeight || 600;

      game = new Phaser.Game({
        type: Phaser.AUTO,
        width: w,
        height: h,
        backgroundColor: "#1e293b",
        parent: container,
        scene: GameScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: "arcade",
          arcade: { gravity: { x: 0, y: 0 }, debug: false },
        },
        render: {
          pixelArt: false,
          antialias: true,
        },
      });

      gameRef.current = game;
    });

    return () => {
      if (game) {
        game.destroy(true);
        gameRef.current = null;
      }
    };
  }, [role]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ cursor: "crosshair" }}
    />
  );
}
