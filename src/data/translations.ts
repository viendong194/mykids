export interface LanguageStrings {
  play: string;
  replay: string;
  well_done: string;
  excellent: string;
  score: string;
  congrats: string;
  help_tap: string;
  select_age: string;
  back: string;
  parents: string;
  choose_topic: string;
  loading: string;
  coming_soon: string;
  total_playtime: string;
  accuracy: string;
  attempts: string;
  reset_stats: string;
}

export const TRANSLATIONS: Record<string, LanguageStrings> = {
  vi: {
    play: "CHƠI",
    replay: "Chơi lại 🧸",
    well_done: "Giỏi lắm! 🌟",
    excellent: "Xuất sắc! 🎉",
    score: "Sao: ",
    congrats: "Bé đã hoàn thành tất cả!",
    help_tap: "Hãy chạm vào hình đúng nhé",
    select_age: "BÉ MẤY TUỔI RỒI NHỈ? 🎈",
    back: "Quay lại",
    parents: "PHỤ HUYNH ⚙️",
    choose_topic: "BÉ CHỌN CHỦ ĐỀ 🧸",
    loading: "Đang tải...",
    coming_soon: "Sắp có thêm nhiều trò chơi thú vị bé nhé! 🧸",
    total_playtime: "THỜI GIAN ĐÃ CHƠI\n(phút)",
    accuracy: "ĐỘ CHÍNH XÁC\n(tỷ lệ ghép đúng)",
    attempts: "Đã trả lời: {correct} đúng / {incorrect} sai",
    reset_stats: "XÓA SỐ LIỆU 🗑️"
  },
  en: {
    play: "PLAY",
    replay: "Play again 🧸",
    well_done: "Well done! 🌟",
    excellent: "Excellent! 🎉",
    score: "Stars: ",
    congrats: "You finished all levels!",
    help_tap: "Tap on the correct image",
    select_age: "HOW OLD ARE YOU? 🎈",
    back: "Back",
    parents: "PARENTS ⚙️",
    choose_topic: "CHOOSE A TOPIC 🧸",
    loading: "Loading...",
    coming_soon: "More fun games coming soon! 🧸",
    total_playtime: "TOTAL PLAY TIME\n(minutes)",
    accuracy: "MATCH ACCURACY\n(percent correct)",
    attempts: "Total attempts: {correct} correct / {incorrect} incorrect",
    reset_stats: "RESET STATS 🗑️"
  },
  zh: {
    play: "开始",
    replay: "再玩一次 🧸",
    well_done: "太棒了！🌟",
    excellent: "非常出色！🎉",
    score: "星星: ",
    congrats: "你完成了所有关卡！",
    help_tap: "请点击正确的图片",
    select_age: "你今年几岁啦？ 🎈",
    back: "返回",
    parents: "家长专区 ⚙️",
    choose_topic: "选择主题 🧸",
    loading: "加载中...",
    coming_soon: "更多好玩的游戏即将推出！🧸",
    total_playtime: "累计游玩时间\n(分钟)",
    accuracy: "匹配正确率\n(百分比)",
    attempts: "总计尝试: {correct} 正确 / {incorrect} 错误",
    reset_stats: "重置数据 🗑️"
  },
  ja: {
    play: "あそぶ",
    replay: "もういちど 🧸",
    well_done: "よくできたね！🌟",
    excellent: "すばらしい！🎉",
    score: "ほし: ",
    congrats: "すべてのレベルをクリアしたよ！",
    help_tap: "ただしいタッチをしてね",
    select_age: "なんさいですか？ 🎈",
    back: "もどる",
    parents: "ほごしゃ ⚙️",
    choose_topic: "テーマをえらんでね 🧸",
    loading: "ロードちゅう...",
    coming_soon: "たのしいゲームがもうすぐとうじょうするよ！🧸",
    total_playtime: "あそんだじかん\n(ふん)",
    accuracy: "せいかくさ\n(せいかいりつ)",
    attempts: "あそんだかいすう: しょうかい {correct} / まちがい {incorrect}",
    reset_stats: "リセット 🗑️"
  }
};
export default TRANSLATIONS;
