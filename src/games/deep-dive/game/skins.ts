import { shop } from '../../../core/meta';

/** Diver suits, bought with arcade coins. */
export interface Skin { id: string; name: string; body: string; belly: string; fins: string; price: number }

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', price: 0 },
  { id: 'coral',   name: 'Coral',   body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', price: 120 },
  { id: 'kelp',    name: 'Kelp',    body: '#4fdc7a', belly: '#2fb35c', fins: '#ffd23f', price: 300 },
  { id: 'royal',   name: 'Royal',   body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', price: 600 },
  { id: 'ghost',   name: 'Ghost',   body: '#eef4ff', belly: '#c9d6ee', fins: '#5fd3ff', price: 1200 },
];

export const suits = shop('deep-dive', 'suit', SKINS);
export const skinIndex = (id: string) => Math.max(0, SKINS.findIndex(s => s.id === id));
