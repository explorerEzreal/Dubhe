export type ModelInstanceState =
  | 'unknown'
  | 'checking'
  | 'pulling'
  | 'ready'
  | 'busy'
  | 'error'
  | 'stopped'
  | 'offline';

export const MODEL_INSTANCE_STATES: readonly ModelInstanceState[] = [
  'unknown',
  'checking',
  'pulling',
  'ready',
  'busy',
  'error',
  'stopped',
  'offline',
];

export function isReady(state: ModelInstanceState): boolean {
  return state === 'ready';
}
