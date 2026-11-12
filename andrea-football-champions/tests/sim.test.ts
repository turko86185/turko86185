import { it } from 'vitest';
import { Vector3 } from 'three';
import { planKick } from '../src/game/trajectory/TrajectoryPlanner';
import { GoalkeeperAI } from '../src/game/ai/Goalkeeper';
import { DefenderAI } from '../src/game/ai/Defender';
import { BallPhysics } from '../src/game/physics/BallPhysics';
import { BALL_R } from '../src/game/physics/constants';
import { applyDifficulty, LevelSession } from '../src/game/match/sessions';
import { LEVELS } from '../src/game/levels/levels';

// Simula tiri "da bambino": mira casuale verso la porta da x=36
it('percentuali di gol per difficoltà', () => {
  for (const lvlId of [5, 40, 90]) {
    const row: string[] = [];
    for (const lev of ['facile', 'medio', 'difficile'] as const) {
      const cfg = applyDifficulty(new LevelSession(LEVELS[lvlId - 1], 'roma', 'casa').nextConfig(), lev);
      let goals = 0, passOk = 0; const N = 2000;
      for (let i = 0; i < N; i++) {
        const z = (Math.random() - 0.5) * 9, y = 0.3 + Math.random() * 2;
        const kp = new Vector3(52.5 - 0.9, 0, (Math.random() - 0.5) * 1.5);
        const plan = planKick({ ballPos: new Vector3(36, BALL_R, (Math.random() - 0.5) * 10), path: [new Vector3(36, 0, 0), new Vector3(52.5, 0, z)], goalPoint: new Vector3(52.5, y, z), teammates: [], opponents: [], keeperPos: kp, assist: cfg.assist, gestureSpeed: 1200, canShoot: true })!;
        const k: any = { pos: kp.clone(), maxSpeed: 4, facing: Math.PI, anim: {}, play() {}, locked: false };
        const ai = new GoalkeeperAI(k, cfg.difficulty);
        ai.onShot(plan);
        const b = new BallPhysics(); b.launch(plan);
        let scored = false;
        for (let s = 0; s < 180 && !scored; s++) {
          ai.update(1 / 60);
          if (ai.checkSave(b.pos)) break;
          if (b.update(1 / 60).some((e) => e.type === 'goal')) scored = true;
        }
        if (scored) goals++;
        // passaggio rasoterra con difensore a metà strada
        const pp = planKick({ ballPos: new Vector3(20, BALL_R, 0), path: [new Vector3(20, 0, 0), new Vector3(34, 0, 0)], teammates: [{ id: 1, pos: new Vector3(34, 0, 0) }], opponents: [], keeperPos: null, assist: cfg.assist, gestureSpeed: 1000, canShoot: false })!;
        const da = new DefenderAI({ pos: new Vector3(27, 0, 2.5 + Math.random() * 2), maxSpeed: 6, facing: 0 } as any, cfg.difficulty);
        da.onKick(pp);
        if (!da.willIntercept) passOk++;
      }
      row.push(`${lev}: gol ${(goals / N * 100).toFixed(0)}% passaggi ok ${(passOk / N * 100).toFixed(0)}%`);
    }
    console.log(`Livello ${lvlId} → ` + row.join(' | '));
  }
});
