import { describe, it, expect } from 'vitest';
import { DEFAULT_GARAGE, STARTER_CAR, PLAYABLE_CARS, buyCar, carPrice, choosePlayerCar, devGarage, isDeveloperHost, loadBalance, loadGarage, saveBalance, saveGarage } from './player-cars';

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

describe('starter car and prices', () => {
  it('the Mustang RTR is the free starter car', () => {
    expect(STARTER_CAR).toBe('mustang-rtr');
    expect(DEFAULT_GARAGE).toEqual({ owned: ['mustang-rtr'], selectedCar: 'mustang-rtr' });
    expect(carPrice('mustang-rtr')).toBe(0);
  });
  it('store prices match the owner list', () => {
    expect(carPrice('m2')).toBe(600_000);
    expect(carPrice('m4-competition')).toBe(1_000_000);
    expect(carPrice('m8-competition')).toBe(1_400_000);
    expect(carPrice('demon')).toBe(1_200_000);
    expect(carPrice('huracan-evo')).toBe(1_600_000);
    expect(carPrice('svj')).toBe(2_100_000);
    expect(carPrice('revuelto')).toBe(2_400_000);
    expect(carPrice('huayra')).toBe(2_700_000);
    expect(carPrice('laferrari')).toBe(3_000_000);
    expect(carPrice('utopia-roadster')).toBe(3_700_000);
    expect(carPrice('chiron')).toBe(4_000_000);
    expect(carPrice('voiture-noire')).toBe(5_200_000);
    expect(carPrice('tourbillon')).toBe(6_000_000);
    expect(carPrice('jesko')).toBe(6_800_000);
    expect(carPrice('chiron-ss300')).toBe(7_500_000);
  });
  it('M2 sits in the BMW tab and the Mustang in the Ford tab', () => {
    expect(PLAYABLE_CARS.find(c => c.id === 'm2')?.brand).toBe('bmw');
    expect(PLAYABLE_CARS.find(c => c.id === 'mustang-rtr')?.brand).toBe('ford');
  });
});

describe('buying with dollars', () => {
  it('buys a car, selects it and takes the price', () => {
    expect(buyCar(DEFAULT_GARAGE, 650_000, 'm2')).toEqual({ garage: { owned: ['mustang-rtr', 'm2'], selectedCar: 'm2' }, balance: 50_000 });
  });
  it('refuses when the balance is short', () => {
    expect(buyCar(DEFAULT_GARAGE, 599_999, 'm2')).toBeNull();
  });
  it('cannot select a car before buying it', () => {
    expect(choosePlayerCar(DEFAULT_GARAGE, 'revuelto').selectedCar).toBe('mustang-rtr');
  });
});

describe('saving', () => {
  it('keeps a bought car selected after reload', () => {
    const s = mem(); saveGarage(s, buyCar(DEFAULT_GARAGE, 600_000, 'm2')!.garage);
    expect(loadGarage(s)).toEqual({ owned: ['mustang-rtr', 'm2'], selectedCar: 'm2' });
  });
  it('a player never reloads into a car they do not own', () => {
    const s = mem(); saveGarage(s, { owned: ['mustang-rtr'], selectedCar: 'chiron' });
    expect(loadGarage(s).selectedCar).toBe('mustang-rtr');
    expect(loadGarage(s, true).selectedCar).toBe('chiron');
  });
  it('remembers the dollar balance', () => {
    const s = mem(); saveBalance(s, 41_000); expect(loadBalance(s)).toBe(41_000);
  });
});

describe('developer gets every car free', () => {
  it('Lovable preview and local dev are the developer', () => {
    expect(isDeveloperHost('id-preview--bec0f7f6.lovable.app')).toBe(true);
    expect(isDeveloperHost('localhost')).toBe(true);
  });
  it('the published link charges', () => {
    expect(isDeveloperHost('supercar-cockpit-studio.lovable.app')).toBe(false);
  });
  it('developer garage owns every car without buying', () => {
    expect(devGarage(DEFAULT_GARAGE).owned).toHaveLength(PLAYABLE_CARS.length);
  });
});
