export type FontOption = "bebas" | "franklin" | "baskerville" | "open-sans";

export interface TextElement {
  id: string;
  text: string;
  font: FontOption;
  size: number; // scale factor, 1 = default
  x: number;  // % from left (0-100)
  y: number;  // % from top (0-100)
  target: "front" | "back";
  row: "primary" | "secondary"; // which jersey row the text belongs to
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
  shieldSize: number; // scale factor, 1 = default (~22% of jersey width)
  number: string;
  showNumber: boolean;
  textElements: TextElement[];
  sponsors: SponsorElement[];
}
