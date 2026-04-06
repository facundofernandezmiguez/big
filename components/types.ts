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

export interface JerseyConfig {
  color: string;
  secondaryColor: string;
  letterColor: string;
  letterColorBack: string;
  shieldUrl: string | null;
  showShield: boolean;
  shieldPosition: "center" | "left" | "right";
  number: string;
  showNumber: boolean;
  showFrontNumber: boolean;
  frontNumberPosition: "center" | "left" | "right";
  textElements: TextElement[];
}
