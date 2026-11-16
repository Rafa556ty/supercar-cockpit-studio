import type { Brand } from "./player-cars";
import lamborghini from "@/assets/brands/lamborghini.png";
import ferrari from "@/assets/brands/ferrari.png";
import bugatti from "@/assets/brands/bugatti.png";
import koenigsegg from "@/assets/brands/koenigsegg.png";
import pagani from "@/assets/brands/pagani.png";
import dodge from "@/assets/brands/dodge.png";
import bmw from "@/assets/brands/bmw.png";
import ford from "@/assets/brands/ford.svg";

export const BRANDS: { id: Brand; name: string }[] = [
  { id: "ford", name: "Ford" },
  { id: "lamborghini", name: "Lamborghini" },
  { id: "ferrari", name: "Ferrari" },
  { id: "bugatti", name: "Bugatti" },
  { id: "koenigsegg", name: "Koenigsegg" },
  { id: "pagani", name: "Pagani" },
  { id: "dodge", name: "Dodge" },
  { id: "bmw", name: "BMW" },
];
export const BRAND_LOGOS: Record<Brand, string> = { ford, lamborghini, ferrari, bugatti, koenigsegg, pagani, dodge, bmw };
