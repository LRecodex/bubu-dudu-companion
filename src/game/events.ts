import Phaser from 'phaser';
import type { Interaction } from './config';

/** The one channel between React and the Phaser scene. React asks for an
 * interaction; the scene reports whether one is running so the menu can
 * disable itself instead of queueing up overlapping scenes. */
export const gameEvents = new Phaser.Events.EventEmitter();

export const playInteraction = (key: Interaction) => gameEvents.emit('play-interaction', key);
export const onInteractionState = (listener: (busy: boolean) => void) => {
  gameEvents.on('interaction-state', listener);
  return () => { gameEvents.off('interaction-state', listener); };
};
