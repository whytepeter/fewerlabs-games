/** Diver suits, unlocked by collecting pearls (lifetime total, never spent). */
export interface Skin { id: string; name: string; body: string; belly: string; fins: string; cost: number }

export const SKINS: Skin[] = [
  { id: 'classic', name: 'Classic', body: '#ffd23f', belly: '#f2a91e', fins: '#ff7a2f', cost: 0 },
  { id: 'coral',   name: 'Coral',   body: '#ff7aa8', belly: '#e9558a', fins: '#7a5cff', cost: 60 },
  { id: 'kelp',    name: 'Kelp',    body: '#4fdc7a', belly: '#2fb35c', fins: '#ffd23f', cost: 180 },
  { id: 'royal',   name: 'Royal',   body: '#9b6bff', belly: '#7a49e6', fins: '#ffc43d', cost: 400 },
  { id: 'ghost',   name: 'Ghost',   body: '#eef4ff', belly: '#c9d6ee', fins: '#5fd3ff', cost: 800 },
];

export const skinIndex = (id: string) => Math.max(0, SKINS.findIndex(s => s.id === id));
