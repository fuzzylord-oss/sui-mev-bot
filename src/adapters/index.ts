/**
 * DEX adapters index.
 * Re-exports all adapters for scanner use.
 */

import type { IDexAdapter } from './types';
import { bluemoveAdapter } from './bluemove';
import { flowxAdapter } from './flowx';
import { aftermathAdapter } from './aftermath';
import { cetusAdapter } from './cetus';
import { kriyaAdapter } from './kriya';
import { abexAdapter } from './abex';
import { naviAdapter } from './navi';
import { turbosAdapter } from './turbos';
import { deepbookAdapter } from './deepbook';
import { shioAdapter } from './shio';

/** All registered DEX adapters */
export const ALL_ADAPTERS: readonly IDexAdapter[] = [
  bluemoveAdapter,
  flowxAdapter,
  aftermathAdapter,
  cetusAdapter,
  kriyaAdapter,
  abexAdapter,
  naviAdapter,
  turbosAdapter,
  deepbookAdapter,
  shioAdapter,
];
