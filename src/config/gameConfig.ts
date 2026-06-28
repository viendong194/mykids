export interface AgeGroup {
  id: string;
  label: {
    vi: string;
    en: string;
    zh: string;
    ja: string;
  };
  color: number;
  borderColor: number;
}

export const AGE_GROUPS: AgeGroup[] = [
  {
    id: "2-3",
    label: {
      vi: "BÉ 2 - 3 TUỔI 🐣",
      en: "AGES 2 - 3 🐣",
      zh: "2 - 3 岁 🐣",
      ja: "2 - 3 歳 🐣"
    },
    color: 0xF06292, // Hồng phấn dễ thương
    borderColor: 0xE91E63
  },
  {
    id: "4-6",
    label: {
      vi: "BÉ 4 - 6 TUỔI 🧸",
      en: "AGES 4 - 6 🧸",
      zh: "4 - 6 岁 🧸",
      ja: "4 - 6 歳 🧸"
    },
    color: 0xFFB74D, // Vàng cam ấm áp
    borderColor: 0xFF9800
  },
  {
    id: "6-8",
    label: {
      vi: "BÉ 6 - 8 TUỔI 🎓",
      en: "AGES 6 - 8 🎓",
      zh: "6 - 8 岁 🎓",
      ja: "6 - 8 歳 🎓"
    },
    color: 0x4DB6AC, // Xanh ngọc lục bảo cát
    borderColor: 0x009688
  }
];
