import { describe, it, expect } from 'vitest';
import { DEFAULT_GARAGE, choosePlayerCar, claimCar, needsClaimConfirmation, canClaimFree, loadGarage, saveGarage, PLAYABLE_CARS } from './player-cars';
describe('free claimable cars', () => {
  it('Chiron and the five new cars are free to claim', () => {
    for (const id of ['chiron', 'huracan-evo', 'tourbillon', 'utopia-roadster', 'huayra', 'demon'] as const)
      expect(canClaimFree(DEFAULT_GARAGE, id)).toBe(true);
  });
  it('asks only while the car is not owned', () => {
    expect(needsClaimConfirmation(DEFAULT_GARAGE, 'demon')).toBe(true);
    expect(needsClaimConfirmation(claimCar(DEFAULT_GARAGE, 'demon', true), 'demon')).toBe(false);
  });
  it('does not unlock on cancellation', () => {
    expect(claimCar(DEFAULT_GARAGE, 'chiron', false)).toEqual(DEFAULT_GARAGE);
  });
  it('confirmation unlocks and selects the car', () => {
    expect(claimCar(DEFAULT_GARAGE, 'tourbillon', true)).toEqual({ owned: ['revuelto', 'tourbillon'], selectedCar: 'tourbillon' });
  });
  it('cannot select a car before claiming', () => {
    expect(choosePlayerCar(DEFAULT_GARAGE, 'huayra').selectedCar).toBe('revuelto');
  });
  it('every car belongs to a brand tab', () => {
    expect(PLAYABLE_CARS.filter(c => c.brand === 'ferrari').map(c => c.id)).toEqual(['laferrari']);
    expect(PLAYABLE_CARS.filter(c => c.brand === 'pagani').map(c => c.id)).toEqual(['utopia-roadster', 'huayra']);
  });
});
describe('garage persistence', () => {
  const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
  it('keeps a claimed car selected after reload', () => { const s = mem(); saveGarage(s, claimCar(DEFAULT_GARAGE, 'demon', true)); expect(loadGarage(s)).toEqual({ owned: ['revuelto', 'demon'], selectedCar: 'demon' }); });
  it('migrates the old Chiron save', () => { const s = mem(); s.setItem('garage-state-v1', JSON.stringify({ chironOwned: true, selectedCar: 'chiron' })); expect(loadGarage(s)).toEqual({ owned: ['revuelto', 'chiron'], selectedCar: 'chiron' }); });
  it('never selects an unclaimed car', () => { const s = mem(); s.setItem('garage-state-v1', JSON.stringify({ chironOwned: false, selectedCar: 'chiron' })); expect(loadGarage(s).selectedCar).toBe('revuelto'); });
});

describe('Aventador SVJ giveaway', () => {
  it('can be claimed for free from the store', () => {
    expect(canClaimFree(DEFAULT_GARAGE, 'svj')).toBe(true);
    expect(claimCar(DEFAULT_GARAGE, 'svj', true)).toEqual({ owned: ['revuelto', 'svj'], selectedCar: 'svj' });
  });
});

describe('BMW M4, Jesko and La Voiture Noire', () => {
  it('BMW M4 Competition is claimed for free from the BMW tab and lands in the garage', () => {
    expect(PLAYABLE_CARS.find(c => c.id === 'm4-competition')?.brand).toBe('bmw');
    expect(canClaimFree(DEFAULT_GARAGE, 'm4-competition')).toBe(true);
    expect(claimCar(DEFAULT_GARAGE, 'm4-competition', true)).toEqual({ owned: ['revuelto', 'm4-competition'], selectedCar: 'm4-competition' });
  });
  it('Jesko sits in the Koenigsegg tab and La Voiture Noire in the Bugatti tab', () => {
    expect(PLAYABLE_CARS.find(c => c.id === 'jesko')?.brand).toBe('koenigsegg');
    expect(PLAYABLE_CARS.find(c => c.id === 'voiture-noire')?.brand).toBe('bugatti');
    expect(canClaimFree(DEFAULT_GARAGE, 'jesko')).toBe(true);
    expect(canClaimFree(DEFAULT_GARAGE, 'voiture-noire')).toBe(true);
  });
});
