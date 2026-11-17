import { useState } from 'react';
import { ShoppingBag, X, ChevronLeft, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { STORE_CARS, selectStoreCar } from '@/game/store-catalog';
import { PLAYABLE_CARS, formatDollars, isOwned, type Brand, type GarageState, type PlayerCar } from '@/game/player-cars';
import { BRANDS, BRAND_LOGOS } from '@/game/brand-logos';
import chironPhoto from '@/assets/store/chiron-road.jpg.asset.json';
import svjPhoto from '@/assets/store/svj.jpg.asset.json';
import revueltoPhoto from '@/assets/store/revuelto-store.jpg.asset.json';
import m2Photo from '@/assets/store/bmw-m2-store.jpg.asset.json';
import mustangPhoto from '@/assets/store/mustang-rtr-store.jpg.asset.json';
import m4Photo from '@/assets/store/bmw-m4-competition.jpg';
import m8Photo from '@/assets/store/bmw-m8-competition.jpg';
import jeskoPhoto from '@/assets/store/koenigsegg-jesko.jpg';
import voitureNoirePhoto from '@/assets/store/bugatti-voiture-noire.jpg';

const CAR_PHOTOS: Partial<Record<PlayerCar, string>> = {
  chiron: chironPhoto.url, svj: svjPhoto.url, revuelto: revueltoPhoto.url, m2: m2Photo.url, 'mustang-rtr': mustangPhoto.url,
  'm4-competition': m4Photo, 'm8-competition': m8Photo, jesko: jeskoPhoto, 'voiture-noire': voitureNoirePhoto,
};

/** Store tabs: the Revuelto gets its own tab, then one tab per brand. */
type Tab = Brand | 'revuelto';
const TABS: { id: Tab; name: string; logo: string }[] = [
  { id: 'revuelto', name: 'Revuelto', logo: revueltoPhoto.url },
  ...BRANDS.map(b => ({ id: b.id as Tab, name: b.name, logo: BRAND_LOGOS[b.id] })),
];

type Item = { key: string; name: string; image: string | null; brand: Brand } & ({ kind: 'car'; id: PlayerCar; price: number } | { kind: 'demo'; id: string; price: number });

const ITEMS: Item[] = [
  ...PLAYABLE_CARS.map(c => ({ key: c.id, kind: 'car' as const, id: c.id, name: c.name, brand: c.brand, price: c.price, image: CAR_PHOTOS[c.id] ?? null })),
  ...STORE_CARS.filter(c => !PLAYABLE_CARS.some(p => p.id === c.id)).map(c => ({ key: c.id, kind: 'demo' as const, id: c.id, name: c.name, brand: c.brand as Brand, price: c.price, image: c.image })),
];

const itemsFor = (tab: Tab) => tab === 'revuelto' ? ITEMS.filter(i => i.id === 'revuelto') : ITEMS.filter(i => i.brand === tab);

export function CarStore({ onClose, garage, balance, developer, onPick, busy }: {
  onClose: () => void; garage: GarageState; balance: number; developer: boolean; onPick: (car: PlayerCar) => void; busy: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('revuelto');
  const items = itemsFor(tab);
  const tabInfo = TABS.find(b => b.id === tab)!;
  return (
    <section role="dialog" aria-modal="true" aria-label="Loja" className="pointer-events-auto absolute inset-0 z-50 flex flex-col bg-background text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-hud-border px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3"><ShoppingBag className="size-6 text-primary" /><h2 className="font-display text-3xl">LOJA</h2></div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded border border-primary/40 bg-card px-3 py-1.5 font-display text-lg tabular-nums text-primary" aria-label="Seu saldo">
            <Wallet className="size-4" />{developer ? 'GRÁTIS' : formatDollars(balance)}
          </span>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar loja" title="Fechar loja"><X className="size-5" /></Button>
        </div>
      </header>
      <nav role="tablist" aria-label="Marcas" className="flex shrink-0 gap-2 overflow-x-auto border-b border-hud-border px-3 py-3 sm:justify-center sm:px-8" onPointerDown={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
        {TABS.map(b => (
          <Button key={b.id} role="tab" aria-selected={tab === b.id} variant="outline" onClick={() => setTab(b.id)}
            className={`h-auto shrink-0 flex-col gap-1 rounded px-3 py-2 ${tab === b.id ? 'border-primary bg-primary/10 text-primary' : 'border-hud-border bg-card text-foreground'}`}>
            <img src={b.logo} alt="" className={b.id === 'revuelto' ? 'h-10 w-16 rounded-sm object-cover' : 'size-10 object-contain'} />
            <span className="font-display text-xs uppercase tracking-widest">{b.name}</span>
          </Button>
        ))}
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-8" style={{ touchAction: 'pan-x pan-y', WebkitOverflowScrolling: 'touch' }} onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchMove={e => e.stopPropagation()}>
        <div className="mx-auto max-w-5xl">
          <h3 className="mb-5 flex items-center gap-3 border-b border-primary pb-3 font-display text-2xl uppercase text-primary">
            <img src={tabInfo.logo} alt="" className={tab === 'revuelto' ? 'h-8 w-12 rounded-sm object-cover' : 'size-8 object-contain'} />{tabInfo.name}
          </h3>
          {items.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">Nenhum carro {tabInfo.name} disponível ainda.</p>
          ) : (
            <div className={tab === 'revuelto' ? 'mx-auto grid max-w-md grid-cols-1 gap-3' : 'grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5'}>
              {items.map(car => {
                const owned = car.kind === 'car' && (developer || isOwned(garage, car.id));
                const short = car.kind === 'car' && !owned && balance < car.price;
                return (
                  <Button key={car.key} disabled={busy} variant="outline" className="block h-auto w-full overflow-hidden rounded border-hud-border bg-card p-0 text-left text-foreground whitespace-normal hover:border-primary hover:bg-card hover:text-foreground" onClick={() => {
                    if (car.kind === 'car') { onPick(car.id); return; }
                    if (selectStoreCar(car.id).status === 'demo') setSelected(car.name);
                  }} aria-label={car.name}>
                    {car.image
                      ? <img src={car.image} alt={car.name} loading="lazy" className={`w-full bg-secondary object-cover ${tab === 'revuelto' ? 'h-48 sm:h-56' : 'h-20 sm:h-24'}`} />
                      : <img src={BRAND_LOGOS[car.brand]} alt="" loading="lazy" className="h-20 w-full bg-secondary object-contain p-3 sm:h-24" />}
                    <div className="flex flex-col items-start gap-1 p-2.5">
                      <span className="font-display text-base leading-tight">{car.name}</span>
                      {car.kind === 'car' ? (
                        <span className={`text-xs font-semibold ${short ? 'text-muted-foreground' : 'text-primary'}`}>
                          {car.kind === 'car' && isOwned(garage, car.id) ? 'NA GARAGEM' : developer ? 'GRÁTIS (DESENVOLVEDOR)' : formatDollars(car.price)}
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">{formatDollars(car.price)} · EM BREVE</span>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {selected && (
        <div role="alertdialog" aria-modal="true" aria-label="Loja em DEMO" className="absolute inset-0 z-10 flex items-center justify-center bg-scrim p-5">
          <div className="w-full max-w-sm rounded border border-hud-border bg-card p-6 text-center">
            <ShoppingBag className="mx-auto mb-3 size-8 text-primary" />
            <h3 className="font-display text-3xl text-primary">EM BREVE</h3>
            <p className="mt-3 font-semibold">{selected}</p>
            <p className="mt-2 text-sm text-muted-foreground">Este carro chega nas próximas atualizações.</p>
            <Button variant="race" className="mt-5 w-full" onClick={() => setSelected(null)}><ChevronLeft className="size-4" />VOLTAR À LOJA</Button>
          </div>
        </div>
      )}
    </section>
  );
}
