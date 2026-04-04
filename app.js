// 全域狀態
const App = {
    settings: { current_grade: 1, current_semester: 1 },
    progress: {},
    vocab: [],
    currentFiltered: [],
    currentCardIndex: 0
};

// 頁面切換
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${page}-page`).classList.remove('hidden');

    if (page === 'learn') initLearnMode();
    if (page === 'game') startGame();
    if (page === 'home') updateProgressStats();
}

// 載入 localStorage
function loadStorage() {
    const savedSettings = localStorage.getItem('app_settings');
    const savedProgress = localStorage.getItem('vocab_progress');

    if (savedSettings) App.settings = JSON.parse(savedSettings);
    if (savedProgress) App.progress = JSON.parse(savedProgress);
}

// 儲存 localStorage
function saveStorage() {
    localStorage.setItem('app_settings', JSON.stringify(App.settings));
    localStorage.setItem('vocab_progress', JSON.stringify(App.progress));
}

// 初始化字庫
async function loadVocab() {
    const res = await fetch('word1.json');
    const data = await res.json();

    App.vocab = [];
    data.forEach(level => {
        level.characters.forEach(char => {
            char.grade = level.grade;
            char.semester = level.semester;
            App.vocab.push(char);

            if (!App.progress[char.id]) {
                App.progress[char.id] = { hasSeen: false, failCount: 0, successCount: 0 };
            }
        });
    });

    filterVocab();
    saveStorage();
}

// 過濾字庫
function filterVocab() {
    App.currentFiltered = App.vocab.filter(c =>
        c.grade === App.settings.current_grade &&
        c.semester === App.settings.current_semester
    );
}

// 年級選擇器
function renderGradeSelector() {
    const gradeSel = document.getElementById('grade-selector');
    gradeSel.innerHTML = '';

    for (let g = 1; g <= 6; g++) {
        const btn = document.createElement('button');
        btn.className = `py-3 rounded-xl font-medium transition-all ${App.settings.current_grade === g
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`;
        btn.textContent = `${g} 年級`;
        btn.onclick = () => {
            App.settings.current_grade = g;
            filterVocab();
            saveStorage();
            renderGradeSelector();
            renderSemesterSelector();
            updateProgressStats();
        };
        gradeSel.appendChild(btn);
    }
}

function renderSemesterSelector() {
    const semSel = document.getElementById('semester-selector');
    semSel.innerHTML = '';

    [1, 2].forEach(s => {
        const btn = document.createElement('button');
        btn.className = `px-6 py-2 rounded-lg font-medium transition-all ${App.settings.current_semester === s
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`;
        btn.textContent = s === 1 ? '上學期' : '下學期';
        btn.onclick = () => {
            App.settings.current_semester = s;
            filterVocab();
            saveStorage();
            renderSemesterSelector();
            updateProgressStats();
        };
        semSel.appendChild(btn);
    });
}

// 學習模式
function initLearnMode() {
    App.currentCardIndex = 0;
    renderCurrentCard();
}

function renderCurrentCard() {
    const card = App.currentFiltered[App.currentCardIndex];
    if (!card) return;

    document.getElementById('char-display').textContent = card.char;
    document.getElementById('zhuyin-display').textContent = card.zhuyin;
    document.getElementById('example-display').textContent = card.example;
    // 暫時先顯示造詞文字 未來可擴充完整注音對照
    document.getElementById('example-zhuyin-display').textContent = '';
    document.getElementById('card-counter').textContent = `${App.currentCardIndex + 1} / ${App.currentFiltered.length}`;

    App.progress[card.id].hasSeen = true;
    saveStorage();
}

// 注音拆解朗讀 單字模式
function speakCharacterWithZhuyin(char, zhuyin) {
    window.speechSynthesis.cancel();

    // 先念字
    const utter1 = new SpeechSynthesisUtterance(char);
    utter1.lang = 'zh-TW';
    utter1.rate = 0.55;

    // 停頓後念注音拆解
    utter1.onend = () => {
        setTimeout(() => {
            // 聲調符號轉換成文字念出
            let toneName = '';
            if (zhuyin.includes('ˊ')) toneName = ' 二聲';
            else if (zhuyin.includes('ˇ')) toneName = ' 三聲';
            else if (zhuyin.includes('ˋ')) toneName = ' 四聲';
            else if (zhuyin.includes('˙')) toneName = ' 輕聲';
            else toneName = ' 一聲';

            // 過濾聲調符號只保留注音符號本體
            let cleanZhuyin = zhuyin.replace(/[ˊˇˋ˙]/g, '');
            let speakText = cleanZhuyin.split('').join('  ') + toneName;

            const utter2 = new SpeechSynthesisUtterance(speakText);
            utter2.lang = 'zh-TW';
            utter2.rate = 0.7;

            // 最後再念一次字
            utter2.onend = () => {
                setTimeout(() => {
                    const utter3 = new SpeechSynthesisUtterance(char);
                    utter3.lang = 'zh-TW';
                    utter3.rate = 0.7;
                    window.speechSynthesis.speak(utter3);
                }, 150);
            };
            window.speechSynthesis.speak(utter2);
        }, 150);
    };

    window.speechSynthesis.speak(utter1);
}

// 一般語音朗讀
function speakText(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
}

// 遊戲模式
function startGame() {
    document.getElementById('game-complete').classList.add('hidden');
    document.getElementById('game-board').classList.remove('hidden');

    // 依權重選字
    const seenWords = App.currentFiltered.filter(w => App.progress[w.id].hasSeen);
    if (seenWords.length < 6) {
        alert('請先在「認識新字」模式看過至少 6 個字再來玩哦！');
        showPage('home');
        return;
    }

    // 加權隨機抽取
    const weighted = seenWords.map(w => ({
        word: w,
        weight: 1 + App.progress[w.id].failCount * 2 - App.progress[w.id].successCount * 0.5
    }));

    weighted.sort((a, b) => b.weight - a.weight);
    const selected = weighted.slice(0, 6).map(x => x.word);

    // 建立牌組
    const cards = [];
    selected.forEach(w => {
        cards.push({ id: w.id, type: 'char', value: w.char, word: w });
        cards.push({ id: w.id, type: 'zhuyin', value: w.zhuyin, word: w });
    });

    // 洗牌
    for (let i = cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [cards[i], cards[j]] = [cards[j], cards[i]];
    }

    renderGameBoard(cards);
}

let gameState = {
    cards: [],
    flipped: [],
    matched: new Set(),
    canClick: true,
    moves: 0
};

function renderGameBoard(cards) {
    gameState = { cards, flipped: [], matched: new Set(), canClick: true, moves: 0 };
    const board = document.getElementById('game-board');
    board.innerHTML = '';

    cards.forEach((card, idx) => {
        const el = document.createElement('div');
        el.className = 'flip-card aspect-square';
        el.innerHTML = `
            <div class="flip-card-inner w-full h-full relative">
                <div class="flip-card-front absolute w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-3xl shadow-lg cursor-pointer">
                    ?
                </div>
                <div class="flip-card-back absolute w-full h-full bg-white rounded-xl flex items-center justify-center ${card.type === 'char' ? 'text-5xl' : 'text-2xl'} text-gray-800 shadow-lg">
                    ${card.value}
                </div>
            </div>
        `;
        el.onclick = () => flipCard(idx);
        board.appendChild(el);
    });

    updateGameScore();
}

function flipCard(idx) {
    if (!gameState.canClick) return;
    if (gameState.flipped.includes(idx)) return;
    if (gameState.matched.has(idx)) return;

    const els = document.querySelectorAll('#game-board .flip-card');
    els[idx].classList.add('flipped');
    gameState.flipped.push(idx);

    if (gameState.flipped.length === 2) {
        gameState.canClick = false;
        gameState.moves++;
        updateGameScore();
        checkMatch();
    }
}

function checkMatch() {
    const [a, b] = gameState.flipped;
    const cardA = gameState.cards[a];
    const cardB = gameState.cards[b];
    const els = document.querySelectorAll('#game-board .flip-card');

    setTimeout(() => {
        if (cardA.id === cardB.id && cardA.type !== cardB.type) {
            // 配對成功
            gameState.matched.add(a);
            gameState.matched.add(b);

            els[a].classList.add('success-animation');
            els[b].classList.add('success-animation');

            App.progress[cardA.id].successCount++;

            if (gameState.matched.size === gameState.cards.length) {
                setTimeout(gameComplete, 500);
            }
        } else {
            // 配對失敗
            els[a].classList.add('shake-animation');
            els[b].classList.add('shake-animation');

            setTimeout(() => {
                els[a].classList.remove('flipped');
                els[b].classList.remove('flipped');
                els[a].classList.remove('shake-animation');
                els[b].classList.remove('shake-animation');
            }, 400);

            App.progress[cardA.id].failCount++;
            App.progress[cardB.id].failCount++;
        }

        saveStorage();
        gameState.flipped = [];
        gameState.canClick = true;
    }, 600);
}

function updateGameScore() {
    document.getElementById('game-score').textContent = `步數：${gameState.moves}`;
}

function gameComplete() {
    document.getElementById('game-board').classList.add('hidden');
    document.getElementById('game-complete').classList.remove('hidden');
    document.getElementById('game-result').textContent = `你用了 ${gameState.moves} 步完成！`;
}

// 進度統計
function updateProgressStats() {
    const total = App.currentFiltered.length;
    const seen = App.currentFiltered.filter(w => App.progress[w.id].hasSeen).length;
    const percent = Math.round(seen / total * 100);

    document.getElementById('progress-stats').innerHTML = `
        <div class="flex justify-between mb-2">
            <span>已學習</span>
            <span>${seen} / ${total} (${percent}%)</span>
        </div>
        <div class="w-full bg-gray-200 rounded-full h-3">
            <div class="bg-indigo-600 h-3 rounded-full transition-all" style="width: ${percent}%"></div>
        </div>
    `;
}

// 事件監聽
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('btn-learn').onclick = () => showPage('learn');
    document.getElementById('btn-game').onclick = () => showPage('game');
    document.getElementById('btn-prev').onclick = () => {
        if (App.currentCardIndex > 0) {
            App.currentCardIndex--;
            renderCurrentCard();
        }
    };
    document.getElementById('btn-next').onclick = () => {
        if (App.currentCardIndex < App.currentFiltered.length - 1) {
            App.currentCardIndex++;
            renderCurrentCard();
        }
    };
    // 點擊漢字讀單字 加上注音拆解朗讀
    document.getElementById('char-display').onclick = (e) => {
        e.stopPropagation();
        const card = App.currentFiltered[App.currentCardIndex];
        if (card) speakCharacterWithZhuyin(card.char, card.zhuyin);
    };

    // 點擊造詞讀造詞
    document.getElementById('example-display').onclick = (e) => {
        e.stopPropagation();
        const card = App.currentFiltered[App.currentCardIndex];
        if (card) speakText(card.example);
    };
});

// 初始化
async function init() {
    loadStorage();
    await loadVocab();
    renderGradeSelector();
    renderSemesterSelector();
    updateProgressStats();
}

init();
