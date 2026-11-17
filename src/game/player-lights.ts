// Which GLB materials are each playable car's real lamps. The lit area comes
// from the model's own lens geometry/texture, so the glow sits exactly where
// the real car's headlights and taillights are.
import type { PlayerCar } from "./player-cars";

export type LampSpec = {
  /** Lamp clusters: the front half becomes headlights, the rear half taillights. */
  lamp: RegExp;
  /** Red lenses (rear only). */
  tail: RegExp;
  /** Brake-only elements. */
  brake?: RegExp;
};

export const PLAYER_LAMPS: Partial<Record<PlayerCar, LampSpec>> = {
  "mustang-rtr": { lamp: /LightB_Material1$/, tail: /^red_glass$/ },
  m2: { lamp: /LightD_Material1$/, tail: /^red_glass$/ },
  laferrari: { lamp: /^uv1MAT_Light1$|^glass_lishgt$/, tail: /^red_glass$/ },
  "huracan-evo": { lamp: /LightA_Material1$|^glass_light$|^emiss$/, tail: /^red_glass$/ },
  tourbillon: { lamp: /LightA_Material1$/, tail: /^red_glass$/ },
  "utopia-roadster": { lamp: /LightA_Material1$/, tail: /^utopiared_glass$/ },
  huayra: { lamp: /^pag_lights$|^pag_runninglight$/, tail: /^pag_taillight_L$/, brake: /^pag_brakelight$/ },
  demon: { lamp: /^lightglass$/, tail: /^redglass$/ },
  "chiron-ss300": { lamp: /^CSR2_Light$|^headlight$|^Park_light$/, tail: /^GlassRed$|^brake_park_light$/, brake: /^brake_light$/ },
  "m8-competition": { lamp: /^m8f92_lowbeam$|^m8f92_runninglight3$/, tail: /^m8f92_taillight$|^m8f92_glass_red$/ },
  "m4-competition": { lamp: /^m4car_emissive1$/, tail: /$^/ },
  jesko: { lamp: /^Lights$|^light_ref$/, tail: /^GlassRedMtl$/ },
  "voiture-noire": { lamp: /2019LightA_Material$/, tail: /^RED_GLASS$/ },
  svj: { lamp: /^svj_glow_pos$/, tail: /^svj_glow_back$/, brake: /^svj_glow_brake$/ },
};

export type LampRole = "lamp" | "tail" | "brake";
export function lampRole(car: PlayerCar, material: string): LampRole | null {
  const spec = PLAYER_LAMPS[car];
  if (!spec) return null;
  if (spec.brake?.test(material)) return "brake";
  if (spec.tail.test(material)) return "tail";
  if (spec.lamp.test(material)) return "lamp";
  return null;
}

/** Cars whose lamps are fully dark by day / outside tunnels (no DRL glow). */
export const DARK_BY_DAY = new Set<PlayerCar>(["svj", "mustang-rtr", "m2"]);

/** Emissive levels: automatic on in tunnels / at night, daytime keeps a dim DRL unless `darkByDay`. */
export function lampLevels(lightsOn: boolean, braking: boolean, darkByDay = false) {
  return {
    head: lightsOn ? 3.2 : darkByDay ? 0 : 0.5,
    tail: braking ? 3 : lightsOn ? 1.6 : darkByDay ? 0 : 0.15,
    brake: braking ? 4 : 0,
  };
}
