// Playable cars, their store price in dollars, and the saved garage.
export type PlayerCar = 'mustang-rtr' | 'm2' | 'revuelto' | 'chiron' | 'huracan-evo' | 'tourbillon' | 'utopia-roadster' | 'huayra' | 'demon' | 'chiron-ss300' | 'laferrari' | 'svj' | 'm4-competition' | 'm8-competition' | 'jesko' | 'voiture-noire';
export type Brand = 'ford' | 'lamborghini' | 'ferrari' | 'bugatti' | 'koenigsegg' | 'pagani' | 'dodge' | 'bmw';

export type PlayableSpec = {
  id: PlayerCar;
  name: string;
  brand: Brand;
  /** Store price in dollars; 0 = starter car, owned from the start. */
  price: number;
  /** Engine sound and speed cluster family. */
  sound: 'revuelto' | 'chiron';
};

/** The car every new player starts with. */
export const STARTER_CAR: PlayerCar = 'mustang-rtr';

export const PLAYABLE_CARS: PlayableSpec[] = [
  { id: 'mustang-rtr', name: 'Ford Mustang RTR Spec 5', brand: 'ford', price: 0, sound: 'revuelto' },
  { id: 'revuelto', name: 'Lamborghini Revuelto', brand: 'lamborghini', price: 2_400_000, sound: 'revuelto' },
  { id: 'svj', name: 'Lamborghini Aventador SVJ LP 770-4 2019', brand: 'lamborghini', price: 2_100_000, sound: 'revuelto' },
  { id: 'huracan-evo', name: 'Lamborghini Huracán EVO 2019', brand: 'lamborghini', price: 1_600_000, sound: 'revuelto' },
  { id: 'laferrari', name: 'Ferrari LaFerrari 2014', brand: 'ferrari', price: 3_000_000, sound: 'revuelto' },
  { id: 'chiron', name: 'Bugatti Chiron', brand: 'bugatti', price: 4_000_000, sound: 'chiron' },
  { id: 'chiron-ss300', name: 'Bugatti Chiron Super Sport 300+', brand: 'bugatti', price: 7_500_000, sound: 'chiron' },
  { id: 'tourbillon', name: 'Bugatti Tourbillon 2026', brand: 'bugatti', price: 6_000_000, sound: 'chiron' },
  { id: 'voiture-noire', name: 'Bugatti La Voiture Noire 2019', brand: 'bugatti', price: 5_200_000, sound: 'chiron' },
  { id: 'jesko', name: 'Koenigsegg Jesko Attack 2019', brand: 'koenigsegg', price: 6_800_000, sound: 'revuelto' },
  { id: 'utopia-roadster', name: 'Pagani Utopia Roadster 2025', brand: 'pagani', price: 3_700_000, sound: 'revuelto' },
  { id: 'huayra', name: 'Pagani Huayra', brand: 'pagani', price: 2_700_000, sound: 'revuelto' },
  { id: 'demon', name: 'Dodge Challenger SRT Demon', brand: 'dodge', price: 1_200_000, sound: 'revuelto' },
  { id: 'm2', name: 'BMW M2 G87 Widebody 2026', brand: 'bmw', price: 600_000, sound: 'revuelto' },
  { id: 'm4-competition', name: 'BMW M4 Competition 2025', brand: 'bmw', price: 1_000_000, sound: 'revuelto' },
  { id: 'm8-competition', name: 'BMW M8 Competition Coupé', brand: 'bmw', price: 1_400_000, sound: 'revuelto' },
];

export const carSpec = (id: PlayerCar) => PLAYABLE_CARS.find(c => c.id === id)!;
export const isPlayerCar = (v: unknown): v is PlayerCar => PLAYABLE_CARS.some(c => c.id === v);
export const carPrice = (id: PlayerCar) => carSpec(id).price;

export type GarageState = { owned: PlayerCar[]; selectedCar: PlayerCar };
export const DEFAULT_GARAGE: GarageState = { owned: [STARTER_CAR], selectedCar: STARTER_CAR };

export const isOwned = (state: GarageState, car: PlayerCar) => state.owned.includes(car);

/** Developer copy of the garage: every car unlocked, nothing bought or saved as owned. */
export function devGarage(state: GarageState): GarageState {
  return { owned: PLAYABLE_CARS.map(c => c.id), selectedCar: state.selectedCar };
}

export function choosePlayerCar(state: GarageState, car: PlayerCar): GarageState {
  return isOwned(state, car) ? { ...state, selectedCar: car } : state;
}

export const canAfford = (balance: number, car: PlayerCar) => balance >= carPrice(car);

/** Buy a car with dollars: it is added to the garage and selected. Null when it can't be bought. */
export function buyCar(state: GarageState, balance: number, car: PlayerCar): { garage: GarageState; balance: number } | null {
  if (isOwned(state, car)) return null;
  if (!canAfford(balance, car)) return null;
  const owned = PLAYABLE_CARS.map(c => c.id).filter(id => id === car || state.owned.includes(id));
  return { garage: { owned, selectedCar: car }, balance: balance - carPrice(car) };
}

const GARAGE_KEY = "garage-state-v2";
type KV = Pick<Storage, "getItem" | "setItem">;
/** `anySelectable`: developer mode, where every car may stay selected after reload. */
export function loadGarage(store: KV, anySelectable = false): GarageState {
  try {
    const raw = JSON.parse(store.getItem(GARAGE_KEY) ?? "null");
    if (!raw || typeof raw !== "object") return DEFAULT_GARAGE;
    const owned = new Set<PlayerCar>([STARTER_CAR]);
    if (Array.isArray(raw.owned)) for (const c of raw.owned) if (isPlayerCar(c)) owned.add(c);
    const list = PLAYABLE_CARS.map(c => c.id).filter(id => owned.has(id));
    return { owned: list, selectedCar: isPlayerCar(raw.selectedCar) && (anySelectable || owned.has(raw.selectedCar)) ? raw.selectedCar : STARTER_CAR };
  } catch { return DEFAULT_GARAGE; }
}
export function saveGarage(store: KV, state: GarageState) { store.setItem(GARAGE_KEY, JSON.stringify(state)); }

const WALLET_KEY = "wallet-dollars-v1";
export function loadBalance(store: KV): number {
  const n = Number(store.getItem(WALLET_KEY) ?? 0);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}
export function saveBalance(store: KV, balance: number) { store.setItem(WALLET_KEY, String(Math.max(0, Math.floor(balance)))); }

/**
 * Developer = playing inside Lovable (editor preview or local dev server).
 * The published link and custom domains are players: cars cost dollars there.
 */
export function isDeveloperHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === 'localhost' || h === '127.0.0.1' || h.startsWith('id-preview--') || h.startsWith('preview--') || h.endsWith('.lovableproject.com');
}

/** "$25.000" — dollars written with Brazilian thousands separators. */
export const formatDollars = (n: number) => `$${Math.round(n).toLocaleString('pt-BR')}`;
