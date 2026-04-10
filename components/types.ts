export type FontOption = "arial-black" | "impact" | "bebas" | "roboto" | "montserrat" | "oswald" | "teko" | "anton";

export interface TextElement {
  id: string;
  text: string;
  font: FontOption;
  size: number; // scale factor, 1 = default
  x: number;  // % from left (0-100)
  y: number;  // % from top (0-100)
  target: "front" | "back";
}

export interface SponsorElement {
  id: string;
  imageUrl: string;
  fileName: string;
  x: number;  // % from left (0-100)
  y: number;  // % from top (0-100)
  size: number; // scale factor, 1 = default (~15% of jersey width)
  target: "front" | "back";
}

export interface JerseyConfig {
  color: string;
  secondaryColor: string;
  useGradient: boolean;
  gradientColor: string;
  useGradientSecondary: boolean;
  gradientSecondaryColor: string;
  letterColor: string;
  letterColorBack: string;
  shieldUrl: string | null;
  showShield: boolean;
  shieldPosition: "center" | "left" | "right";
  number: string;
  showNumber: boolean;
  textElements: TextElement[];
  sponsors: SponsorElement[];
}
