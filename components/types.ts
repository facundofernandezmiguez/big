export interface JerseyConfig {
  color: string;
  secondaryColor: string;
  letterColor: string;
  letterColorBack: string;
  shieldUrl: string | null;
  showShield: boolean;
  shieldPosition: "center" | "left" | "right";
  shieldSize: number;
  number: string;
  showNumber: boolean;
  showFrontNumber: boolean;
  frontNumberPosition: "center" | "left" | "right";
  teamName: string;
  teamNameFont: "arial-black" | "impact" | "bebas" | "roboto" | "montserrat" | "oswald" | "teko" | "anton";
}
