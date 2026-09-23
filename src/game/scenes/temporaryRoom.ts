import Phaser from 'phaser';

/** Temporary isometric shell. Replace this drawing with room artwork later.
 * Characters remain separate sprites in RoomScene. No permanent room assets. */
export function drawTemporaryRoom(scene: Phaser.Scene) {
  const g = scene.add.graphics();
  const outline = 0x77655e;
  const polygon = (points: number[][], color: number, stroke = true) => {
    const vertices = points.map(([x, y]) => new Phaser.Geom.Point(x, y));
    g.fillStyle(color, 1).fillPoints(vertices, true);
    if (stroke) g.lineStyle(2, outline, 1).strokePoints(vertices, true);
  };
  const line = (points: number[][], color: number, width = 2) => {
    g.lineStyle(width, color, 1).strokePoints(points.map(([x, y]) => new Phaser.Geom.Point(x, y)), false);
  };

  g.fillStyle(0x637b80, 0.13).fillEllipse(640, 574, 414, 58);
  // Raised diamond floor and its front-facing thickness.
  polygon([[450, 450], [640, 560], [640, 578], [450, 468]], 0xc6a58c);
  polygon([[640, 560], [830, 450], [830, 468], [640, 578]], 0xb99881);
  polygon([[640, 340], [830, 450], [640, 560], [450, 450]], 0xf0ddbd);
  for (const t of [0.25, 0.5, 0.75]) {
    line([[640 - 190 * t, 340 + 110 * t], [830 - 190 * t, 450 + 110 * t]], 0xe0c7a7, 1);
  }

  // Two open-front walls, following the reference's dollhouse perspective.
  polygon([[450, 450], [450, 260], [640, 150], [640, 340]], 0xfff0df);
  polygon([[640, 150], [830, 260], [830, 450], [640, 340]], 0xd9e5e4);
  line([[455, 435], [640, 328], [825, 435]], 0xc4afa0, 5);
  line([[450, 260], [640, 150], [830, 260]], 0x99857b, 8);
  line([[450, 260], [640, 150], [830, 260]], 0xe5d5c5, 4);

  // Placeholder window and blind on the left wall.
  polygon([[483, 276], [598, 210], [598, 310], [483, 377]], 0xc4dfe2);
  polygon([[489, 344], [592, 284], [592, 306], [489, 366]], 0xa8b99b, false);
  line([[540, 244], [540, 344]], 0xfff8eb, 4);
  line([[483, 276], [483, 377], [598, 310], [598, 210]], 0xb79671, 5);
  for (let i = 0; i < 4; i++) {
    line([[479, 269 + i * 10], [602, 198 + i * 10]], 0xb68d5e, 6);
    line([[479, 267 + i * 10], [602, 196 + i * 10]], 0xe7c18b, 3);
  }

  // Simple sliding glass panel on the right wall; no interactive furniture.
  polygon([[660, 179], [813, 268], [813, 423], [660, 335]], 0xb8d1d7);
  line([[671, 205], [708, 267]], 0xd4e4e7, 3);
  line([[754, 270], [795, 338]], 0xd4e4e7, 3);
  line([[737, 224], [737, 379]], 0x8d999e, 5);
  line([[660, 179], [660, 335], [813, 423], [813, 268], [660, 179]], 0x929397, 5);
  line([[745, 310], [745, 330]], 0x77655e, 4);
}
