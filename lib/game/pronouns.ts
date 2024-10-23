export type PronounsType = {
  heshe: string;
  himher: string;
  hisher: string;
  hishers: string;
  himselfherself: string;
  Heshe: string;
  Himher: string;
  Hisher: string;
  Hishers: string;
  Himselfherself: string;
};

export type GenderNamesType = "male" | "female" | "neutral";

const PRONOUNS: Record<GenderNamesType, PronounsType> = {
  male: {
    heshe: "he",
    himher: "him",
    hisher: "his",
    hishers: "his",
    himselfherself: "himself",
    Heshe: "He",
    Himher: "Him",
    Hisher: "His",
    Hishers: "His",
    Himselfherself: "Himself",
  },
  female: {
    heshe: "she",
    himher: "her",
    hisher: "her",
    hishers: "hers",
    himselfherself: "herself",
    Heshe: "She",
    Himher: "Her",
    Hisher: "Her",
    Hishers: "Hers",
    Himselfherself: "Herself",
  },
  neutral: {
    heshe: "they",
    himher: "them",
    hisher: "their",
    hishers: "theirs",
    himselfherself: "themself",
    Heshe: "They",
    Himher: "Them",
    Hisher: "Their",
    Hishers: "Theirs",
    Himselfherself: "Themself",
  },
};

const GENDER_NAMES: Record<string, GenderNamesType> = {
  "he/him": "male",
  "she/her": "female",
  "they/them": "neutral",
  male: "male",
  female: "female",
  man: "male",
  woman: "female",
};

export function pronounsForGender(gender: string): PronounsType {
  const t = GENDER_NAMES[(gender || "").toLowerCase()] || "neutral";
  return PRONOUNS[t];
}
