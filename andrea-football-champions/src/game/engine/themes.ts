export interface StadiumTheme {
  id: string;
  name: string;
  skyTop: string; skyBottom: string;
  grassA: string; grassB: string;
  sunColor: string; sunIntensity: number; ambient: number;
  night: boolean;
  standColor: string;
  fog: string;
  snow?: boolean;
  unlockStars: number;
}

export const STADIUMS: StadiumTheme[] = [
  { id: 'sole', name: 'Stadio del Sole', skyTop: '#3a8ee6', skyBottom: '#bfe3ff', grassA: '#3f9b3a', grassB: '#4cae45', sunColor: '#fff6e0', sunIntensity: 2.2, ambient: 1.1, night: false, standColor: '#5b6b80', fog: '#bfe3ff', unlockStars: 0 },
  { id: 'stelle', name: 'Stadio delle Stelle', skyTop: '#050b24', skyBottom: '#1b2a5a', grassA: '#2f8a34', grassB: '#3a9b3f', sunColor: '#e8f0ff', sunIntensity: 2.4, ambient: 0.7, night: true, standColor: '#2b3447', fog: '#16224a', unlockStars: 30 },
  { id: 'tramonto', name: 'Stadio del Tramonto', skyTop: '#3b2a6b', skyBottom: '#ff9a55', grassA: '#4a913a', grassB: '#57a145', sunColor: '#ffc58a', sunIntensity: 2.0, ambient: 0.9, night: false, standColor: '#6a4f5e', fog: '#ff9a55', unlockStars: 80 },
  { id: 'neve', name: 'Stadio della Neve', skyTop: '#8aa4c2', skyBottom: '#e8f1fa', grassA: '#4f9a4b', grassB: '#5aa857', sunColor: '#ffffff', sunIntensity: 1.8, ambient: 1.2, night: false, standColor: '#7a8696', fog: '#e8f1fa', snow: true, unlockStars: 150 },
  { id: 'campioni', name: 'Arena dei Campioni', skyTop: '#140626', skyBottom: '#4a1b6e', grassA: '#2e8c3c', grassB: '#3b9e48', sunColor: '#fff0c8', sunIntensity: 2.6, ambient: 0.75, night: true, standColor: '#3a2350', fog: '#2a1240', unlockStars: 220 }
];

export const getStadium = (id: string) => STADIUMS.find((s) => s.id === id) ?? STADIUMS[0];
