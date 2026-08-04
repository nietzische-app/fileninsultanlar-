/**
 * Saf maç kuralları — skor, set, üç temas.
 * Game.js bu fonksiyonları kullanır; Vitest doğrudan test eder.
 */

import { RULES } from './constants.js';

/**
 * Set bitti mi?
 * @param {number} home
 * @param {number} away
 * @param {typeof RULES} [rules]
 */
export function isSetOver(home, away, rules = RULES) {
  const target = rules.pointsPerSet;
  return (
    (home >= target || away >= target) &&
    (Math.abs(home - away) >= rules.winBy ||
      home >= rules.pointCap ||
      away >= rules.pointCap)
  );
}

/**
 * Seti kazanan taraf. Beraberlikte null (olmamalı — isSetOver true iken).
 * @param {number} home
 * @param {number} away
 * @returns {'home'|'away'|null}
 */
export function setWinner(home, away) {
  if (home === away) return null;
  return home > away ? 'home' : 'away';
}

/**
 * Maç bitti mi? (set sayısı)
 * @param {{ home: number, away: number }} sets
 * @param {typeof RULES} [rules]
 */
export function isMatchOver(sets, rules = RULES) {
  return sets.home >= rules.setsToWin || sets.away >= rules.setsToWin;
}

/**
 * Maçı kazanan taraf.
 * @param {{ home: number, away: number }} sets
 * @returns {'home'|'away'|null}
 */
export function matchWinner(sets) {
  if (sets.home === sets.away) return null;
  return sets.home > sets.away ? 'home' : 'away';
}

/**
 * Üç temas kuralı — bir temas sonrası yeni durum.
 * @param {{ side: string|null, count: number }} touch
 * @param {'home'|'away'} side
 * @param {typeof RULES} [rules]
 * @returns {{ touch: { side: string, count: number }, foul: boolean }}
 */
export function applyTouch(touch, side, rules = RULES) {
  const next =
    touch.side === side
      ? { side, count: touch.count + 1 }
      : { side, count: 1 };

  return {
    touch: next,
    foul: next.count > rules.maxTouches,
  };
}

/**
 * Temas türünü belirler (smaç / yerden vuruş / manşet / dalış).
 * @param {{ diving: boolean, acting: boolean, airborne: boolean, controlled: boolean }} opts
 * @returns {'dive'|'spike'|'hit'|'bump'}
 */
export function resolveHitType({ diving, acting, airborne, controlled }) {
  if (diving) return 'dive';
  if (acting && controlled) return airborne ? 'spike' : 'hit';
  return 'bump';
}

/**
 * Gelen top hızına göre hücum kontrolü mümkün mü?
 * İlk temasta sert top manşet zorlar; 2.+ temasta serbest.
 * @param {number} incomingSpeed
 * @param {number} touchCount
 * @param {number} attackControlSpeed
 */
export function canAttackOnTouch(incomingSpeed, touchCount, attackControlSpeed) {
  return incomingSpeed < attackControlSpeed || touchCount > 1;
}
