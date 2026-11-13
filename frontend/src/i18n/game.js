/**
 * Text for the mini-game page only (constitution III: all UI text lives in src/i18n/).
 * Only src/game/main.jsx imports this file, so the home page never downloads it.
 * Merged into `t` by <LanguageProvider extraStrings={gameStrings}>, read as `t.game.*`.
 * Aikido terms stay untranslated.
 */
export const gameStrings = {
  en: {
    game: {
      meta: {
        title: 'Aikido Parry – Tenshinkai Aikido',
      },
      title: 'Aikido Parry',
      intro: 'Time your parry and throw the troublemakers, Aikido style.',
      quickControls: 'Arrows or W A S D to move. Tap Space to parry, hold Space to block. J to strike.',
      character: {
        legend: 'Choose your aikidoka',
        male: 'Male',
        female: 'Female',
      },
      start: 'Start',
      placeholderArt: 'Placeholder art and sounds.',
      canvasLabel:
        'Game area: your character faces the troublemakers. Play with the keyboard or the on-screen buttons.',
      error: {
        message: "The game couldn't start. Try reloading, or go back to the dojo website.",
        reload: 'Reload',
      },
      backToSite: 'Back to the dojo website',
      hud: {
        health: 'Health',
        score: 'Score',
        sound: 'Sound',
        controls: 'On-screen buttons',
        on: 'On',
        off: 'Off',
      },
      results: {
        won: 'You win!',
        lost: 'Good try!',
        throws: 'Throws',
        perfectParries: 'Perfect parries',
        enemiesDefeated: 'Troublemakers defeated',
        score: 'Score',
        playAgain: 'Play again',
      },
      feedback: {
        combo: 'Combo!',
        dodged: 'Dodged!',
      },
      touch: {
        controls: 'Game controls',
        move: 'Move',
        up: 'Up',
        down: 'Down',
        left: 'Left',
        right: 'Right',
        parry: 'Parry',
        strike: 'Strike',
      },
    },
  },
  vi: {
    game: {
      meta: {
        title: 'Aikido Parry – Aikido Tenshinkai',
      },
      title: 'Aikido Parry',
      intro: 'Canh đúng lúc để đỡ đòn và quật ngã những kẻ quậy phá theo phong cách Aikido.',
      quickControls: 'Phím mũi tên hoặc W A S D để di chuyển. Nhấn Space để đỡ đòn, giữ Space để chặn. J để đánh.',
      character: {
        legend: 'Chọn võ sinh Aikido của bạn',
        male: 'Nam',
        female: 'Nữ',
      },
      start: 'Bắt đầu',
      placeholderArt: 'Hình ảnh và âm thanh tạm thời.',
      canvasLabel:
        'Khu vực trò chơi: nhân vật của bạn đối đầu với những kẻ quậy phá. Chơi bằng bàn phím hoặc các nút trên màn hình.',
      error: {
        message: 'Không thể khởi động trò chơi. Hãy thử tải lại trang, hoặc quay về trang web của võ đường.',
        reload: 'Tải lại',
      },
      backToSite: 'Quay về trang web võ đường',
      hud: {
        health: 'Máu',
        score: 'Điểm',
        sound: 'Âm thanh',
        controls: 'Nút trên màn hình',
        on: 'Bật',
        off: 'Tắt',
      },
      results: {
        won: 'Bạn thắng rồi!',
        lost: 'Cố gắng tốt lắm!',
        throws: 'Số lần quật ngã',
        perfectParries: 'Đỡ đòn hoàn hảo',
        enemiesDefeated: 'Kẻ quậy phá bị hạ',
        score: 'Điểm',
        playAgain: 'Chơi lại',
      },
      feedback: {
        combo: 'Combo!',
        dodged: 'Né được!',
      },
      touch: {
        controls: 'Nút điều khiển',
        move: 'Di chuyển',
        up: 'Lên',
        down: 'Xuống',
        left: 'Trái',
        right: 'Phải',
        parry: 'Đỡ đòn',
        strike: 'Đánh',
      },
    },
  },
};
