// The pet's mood is whichever stat is currently furthest outside its
// healthy band — either too low OR too high. That single "dominant
// emotion" drives both which face/body art shows and a gameplay penalty.
//
// Every emotion below has its own dedicated face. Only 'hungry' and
// 'stuffed' also get a dedicated *body* pose (per the initial design ask);
// the rest reuse the standing 'base' body — mechanically they're still
// fully wired up (each affects decay rates / movement via `effect`) even
// without a pose of their own. To add a body pose for one: draw it into
// every body-type folder under assets/character/parts/body/ using the same
// pose key, then point that emotion's `bodyPose` at it. To add/replace a
// face: draw face-<key>.png in assets/character/parts/face/ using the same
// viewBox as the existing parts, then fill in its `face` entry below (bare
// filename, no folder).
//
// `bodyPose` is a pose *key*, not a filename — the player's chosen body
// type (slim/round/tall, see items.js and room.js's setBodyType) supplies
// its own art for every pose, so this module doesn't know or care which
// body type is equipped. Adding a 4th body type later means adding a new
// assets/character/parts/body/<type>/ folder with one file per existing
// pose key; no changes needed here.

const FACE_DIR = 'assets/character/parts/face/';

export const EMOTIONS = {
  happy: {
    face: 'face-neutral.png',
    bodyPose: 'base',
    reason: () => 'Every need is being met — keep it up!',
  },
  hungry: {
    // food too low
    test: (s) => 30 - s.food,
    face: 'face-hungry.png',
    bodyPose: 'hungry',
    effect: { funMult: 1.8, loveMult: 1.8 },
    line: "I'm hungry...",
    reason: (s) => `Food is low (${Math.round(s.food)}/100) — feed your pet.`,
  },
  stuffed: {
    // food too high — ate past full (see the "irresistible" food items in
    // items.js), overfull and sluggish
    test: (s) => s.food - 92,
    face: 'face-stuffed.png',
    bodyPose: 'stuffed',
    effect: { sleepMult: 1.6, moveMult: 0.6 },
    line: '*sluggish*',
    reason: (s) => `Food is way too high (${Math.round(s.food)}/100) — it ate past full.`,
  },
  thirsty: {
    // water too low — dehydration hurts health
    test: (s) => 25 - s.water,
    face: 'face-thirsty.png',
    bodyPose: 'base',
    effect: { healthPenaltyMult: 1.6 },
    line: 'So thirsty...',
    reason: (s) => `Water is low (${Math.round(s.water)}/100) — give your pet water.`,
  },
  exhausted: {
    // sleep too low — moves slowly
    test: (s) => 25 - s.sleep,
    face: 'face-exhausted.png',
    bodyPose: 'base',
    effect: { moveMult: 0.6 },
    line: 'Getting sleepy...',
    reason: (s) => `Sleep is low (${Math.round(s.sleep)}/100) — let your pet rest.`,
  },
  bored: {
    // fun too low — love fades faster when bored
    test: (s) => 25 - s.fun,
    face: 'face-bored.png',
    bodyPose: 'base',
    effect: { loveMult: 1.6 },
    line: "I'm bored...",
    reason: (s) => `Fun is low (${Math.round(s.fun)}/100) — play with your pet.`,
  },
  sad: {
    // love/health too low, or the room has piled up 6+ messes
    test: (s, ctx) => Math.max(25 - s.love, 30 - s.health, (ctx.messCount >= 6 ? 15 : 0)),
    face: 'face-sad.png',
    bodyPose: 'base',
    effect: {},
    line: 'I miss you...',
    // Whichever of the three matches how test() above actually picked
    // 'sad' as the dominant emotion — same priority order (mess, then
    // love, then health) so this can never name a cause that isn't
    // really the tallest one.
    reason: (s, ctx) => {
      const messSeverity = ctx.messCount >= 6 ? 15 : 0;
      const loveSeverity = 25 - s.love;
      const healthSeverity = 30 - s.health;
      if (messSeverity > 0 && messSeverity >= loveSeverity && messSeverity >= healthSeverity) {
        return `The room is a mess (${ctx.messCount} messes) — clean it up.`;
      }
      if (loveSeverity >= healthSeverity) return `Love is low (${Math.round(s.love)}/100) — give it some Pet time.`;
      return `Health is low (${Math.round(s.health)}/100).`;
    },
  },
};

// Returns the key of whichever emotion is currently most "in need" (has the
// highest positive severity), or 'happy' if nothing is out of band.
export function computeEmotion(state, ctx = {}) {
  let best = 'happy';
  let bestSeverity = 0;
  for (const [key, def] of Object.entries(EMOTIONS)) {
    if (!def.test) continue;
    const severity = def.test(state.stats, ctx);
    if (severity > bestSeverity) {
      best = key;
      bestSeverity = severity;
    }
  }
  return best;
}

// Returns { face: <resolved path>, bodyPose: <pose key> }. The caller
// (room.js) resolves bodyPose into an actual file using the equipped body
// type, since this module has no notion of which body type is equipped.
export function emotionAssetPaths(key) {
  const def = EMOTIONS[key] || EMOTIONS.happy;
  return { face: FACE_DIR + def.face, bodyPose: def.bodyPose };
}

export function emotionEffect(key) {
  return (EMOTIONS[key] && EMOTIONS[key].effect) || {};
}

export function emotionLine(key) {
  return EMOTIONS[key] && EMOTIONS[key].line;
}

// Human-readable "why is it feeling this way" text — used by the mood
// display's hover tooltip (see renderMoodDisplay() in js/main.js). Takes
// `stats` (state.stats, same as computeEmotion()'s def.test() above) and
// the same `ctx` ({ messCount }) so a 'sad' caused by mess vs. love vs.
// health is never misattributed.
export function emotionReason(key, stats, ctx = {}) {
  const def = EMOTIONS[key] || EMOTIONS.happy;
  return def.reason ? def.reason(stats, ctx) : '';
}
