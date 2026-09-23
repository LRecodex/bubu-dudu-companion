import Phaser from 'phaser';
import { normalizeAppearance, type Appearance } from '../furniture';

/** Temporary isometric shell. Replace this drawing with room artwork later.
 * Characters remain separate sprites in RoomScene. No permanent room assets. */
export function drawTemporaryRoom(scene: Phaser.Scene, appearance?: Appearance) {
  const g = scene.add.graphics();
  const finish = normalizeAppearance(appearance);
  const wall = Phaser.Display.Color.HexStringToColor(finish.wallColor).color;
  const floor = Phaser.Display.Color.HexStringToColor(finish.floorColor).color;
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
  // Map each finish into its surface plane so seams follow the room perspective.
  const surface = (origin: number[], u: number[], v: number[], color: number, design: Appearance['wallDesign']) => {
    const point = (a: number, b: number) => [origin[0] + u[0] * a + v[0] * b, origin[1] + u[1] * a + v[1] * b];
    polygon([point(0, 0), point(1, 0), point(1, 1), point(0, 1)], color);
    const seam = (a: number[], b: number[], alpha = .2) => {
      g.lineStyle(1.4, 0x695344, alpha).strokePoints([a, b].map(([x, y]) => new Phaser.Geom.Point(x, y)), false);
    };
    if (design === 'Plain') return;
    const rows = design === 'Stripes' ? 10 : 6;
    for (let row = 0; row < rows; row++) {
      const b = row / rows;
      if (design === 'Stripes' && row % 2 === 0) {
        g.fillStyle(0xffffff, .22).fillPoints([point(0, b), point(1, b), point(1, b + 1 / rows), point(0, b + 1 / rows)].map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
      }
      if (row) seam(point(0, b), point(1, b));
      if (design === 'Wood') {
        for (let col = 0; col < 3; col++) {
          const a = (col + (row % 2 ? .5 : 1)) / 3;
          if (a < 1) seam(point(a, b), point(a, b + 1 / rows));
          seam(point(col / 3 + .03, b + .06), point(col / 3 + .25, b + .06), .08);
        }
      }
    }
    if (design === 'Tiles') for (let col = 1; col < 6; col++) seam(point(col / 6, 0), point(col / 6, 1));
  };
  polygon([[450, 450], [640, 560], [640, 578], [450, 468]], 0xc6a58c);
  polygon([[640, 560], [830, 450], [830, 468], [640, 578]], 0xb99881);
  surface([640, 340], [190, 110], [-190, 110], floor, finish.floorDesign);
  surface([450, 260], [190, -110], [0, 190], wall, finish.wallDesign);
  surface([640, 150], [190, 110], [0, 190], wall, finish.wallDesign);
  g.fillStyle(0x637b80, .10).fillPoints([[640, 150], [830, 260], [830, 450], [640, 340]].map(([x, y]) => new Phaser.Geom.Point(x, y)), true);
  line([[455, 435], [640, 328], [825, 435]], 0xc4afa0, 5);
  line([[450, 260], [640, 150], [830, 260]], 0x99857b, 8);
  line([[450, 260], [640, 150], [830, 260]], 0xe5d5c5, 4);
  return g;
}
