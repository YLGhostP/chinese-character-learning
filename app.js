// 全域狀態
const App = {
    settings: { current_grade: 1, current_semester: 1, gameTime: 90 },
    progress: {},
    vocab: [],
    currentFiltered: [],
    currentCardIndex: 0
};

// 遊戲狀態
let gameState = {
    words: [],
    matchedIds: new Set(),
    totalTime: 90,
    remainingTime: 90,
    score: 0,
    combo: 0,
    maxCombo: 0,
    mistakes: 0,
    lives: 3,
    timerId: null,
    isPlaying: false,
    startTimestamp: 0,
    endTimestamp: 0
};

// 點擊配對狀態
let selectedZhuyinId = null;

// ========== 頁面切換 ==========
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(`${page}-page`).classList.remove('hidden');

    if (page === 'learn') initLearnMode();
    if (page === 'game') startGame();
    if (page === 'home') updateProgressStats();
}

// ========== localStorage ==========
function loadStorage() {
    const savedSettings = localStorage.getItem('app_settings');
    const savedProgress = localStorage.getItem('vocab_progress');

    if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        App.settings = { ...App.settings, ...parsed };
    }
    if (savedProgress) App.progress = JSON.parse(savedProgress);
}

function saveStorage() {
    localStorage.setItem('app_settings', JSON.stringify(App.settings));
    localStorage.setItem('vocab_progress', JSON.stringify(App.progress));
}

// ========== 字庫 ==========
async function loadVocab() {
    const [res1, res2] = await Promise.all([
        fetch('word1.json'),
        fetch('word2.json')
    ]);

    const data1 = await res1.json();
    const data2 = await res2.json();

    App.vocab = [];

    // 處理 word1.json
    data1.forEach(level => {
        level.characters.forEach(char => {
            char.grade = level.grade;
            char.semester = level.semester;
            App.vocab.push(char);

            if (!App.progress[char.id]) {
                App.progress[char.id] = { hasSeen: false, failCount: 0, successCount: 0, wrongWeight: 0 };
            }
            if (App.progress[char.id].wrongWeight === undefined) {
                App.progress[char.id].wrongWeight = 0;
            }
        });
    });

    // 處理 word2.json
    data2.forEach(level => {
        level.characters.forEach(char => {
            char.grade = level.grade;
            char.semester = level.semester;
            App.vocab.push(char);

            if (!App.progress[char.id]) {
                App.progress[char.id] = { hasSeen: false, failCount: 0, successCount: 0, wrongWeight: 0 };
            }
            if (App.progress[char.id].wrongWeight === undefined) {
                App.progress[char.id].wrongWeight = 0;
            }
        });
    });

    filterVocab();
    saveStorage();
}

function filterVocab() {
    App.currentFiltered = App.vocab.filter(c =>
        c.grade === App.settings.current_grade &&
        c.semester === App.settings.current_semester
    );
}

// ========== 年級選擇器 ==========
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

// ========== 時間選擇器 ==========
function renderTimeSelector() {
    const container = document.getElementById('time-selector');
    if (!container) return;
    const buttons = container.querySelectorAll('.time-btn');

    buttons.forEach(btn => {
        const time = parseInt(btn.dataset.time);
        const isSelected = App.settings.gameTime === time;
        btn.className = `time-btn px-4 py-2 rounded-lg text-sm font-medium transition-all ${isSelected
            ? 'bg-indigo-600 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`;
        btn.onclick = () => {
            App.settings.gameTime = time;
            saveStorage();
            renderTimeSelector();
        };
    });
}

// ========== 學習模式 ==========
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
    document.getElementById('example-zhuyin-display').textContent = '';
    document.getElementById('card-counter').textContent = `${App.currentCardIndex + 1} / ${App.currentFiltered.length}`;

    App.progress[card.id].hasSeen = true;
    saveStorage();
}

// ========== 語音朗讀 ==========
function speakCharacterWithZhuyin(char, zhuyin) {
    window.speechSynthesis.cancel();

    const utter1 = new SpeechSynthesisUtterance(char);
    utter1.lang = 'zh-TW';
    utter1.rate = 0.65;

    utter1.onend = () => {
        setTimeout(() => {
            let toneName = '';
            if (zhuyin.includes('ˊ')) toneName = ' 二聲';
            else if (zhuyin.includes('ˇ')) toneName = ' 三聲';
            else if (zhuyin.includes('ˋ')) toneName = ' 四聲';
            else if (zhuyin.includes('˙')) toneName = ' 輕聲';
            else toneName = ' 一聲';

            let cleanZhuyin = zhuyin.replace(/[ˊˇˋ˙]/g, '');
            let speakText = cleanZhuyin.split('').join('  ') + toneName;

            const utter2 = new SpeechSynthesisUtterance(speakText);
            utter2.lang = 'zh-TW';
            utter2.rate = 0.5;

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

function speakText(text) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
}

// ========== 遊戲模式：連連看 ==========
function startGame() {
    // 重置點擊選中狀態
    selectedZhuyinId = null;

    // 隱藏結束畫面
    document.getElementById('game-complete').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');

    // 檢查最少看過 6 個字
    const seenWords = App.currentFiltered.filter(w => App.progress[w.id].hasSeen);
    if (seenWords.length < 6) {
        alert('請先在「認識新字」模式看過至少 6 個字再來玩哦！');
        showPage('home');
        return;
    }

    // ========== 錯誤權重出題模式 ==========
    // 1. 找出錯誤權重 > 0 的字，按權重降序排列
    const wrongWeightWords = seenWords
        .filter(w => App.progress[w.id].wrongWeight > 0)
        .sort((a, b) => App.progress[b.id].wrongWeight - App.progress[a.id].wrongWeight);

    // 2. 最多取 2 個錯誤權重最高的字
    const selected = [];
    const reviewCount = Math.min(2, wrongWeightWords.length);
    for (let i = 0; i < reviewCount; i++) {
        selected.push(wrongWeightWords[i]);
    }

    // 3. 從剩餘的字中（錯誤權重 = 0）隨機選取補滿 6 個
    const remainingWords = seenWords.filter(w => !selected.includes(w));
    const needed = 6 - selected.length;

    if (remainingWords.length < needed) {
        // 如果剩餘字不夠，放寬限制從所有 seenWords 中隨機補
        const allOthers = seenWords.filter(w => !selected.some(s => s.id === w.id));
        const shuffledOthers = [...allOthers].sort(() => Math.random() - 0.5);
        for (let i = 0; i < Math.min(needed, shuffledOthers.length); i++) {
            selected.push(shuffledOthers[i]);
        }
    } else {
        const shuffledRemaining = [...remainingWords].sort(() => Math.random() - 0.5);
        for (let i = 0; i < needed; i++) {
            selected.push(shuffledRemaining[i]);
        }
    }

    // 4. 最終 6 個字一起洗牌
    selected.sort(() => Math.random() - 0.5);

    const gameTime = App.settings.gameTime || 90;

    // 初始化遊戲狀態
    gameState = {
        words: selected,
        matchedIds: new Set(),
        totalTime: gameTime,
        remainingTime: gameTime,
        score: 0,
        combo: 0,
        maxCombo: 0,
        mistakes: 0,
        lives: 3,
        timerId: null,
        isPlaying: true,
        startTimestamp: Date.now(),
        endTimestamp: 0
    };

    renderCharDropZone(selected);
    renderZhuyinDragZone(selected);
    updateGameHUD();
    startTimer();
}

// 渲染國字放置區
function renderCharDropZone(words) {
    const zone = document.getElementById('char-drop-zone');
    zone.innerHTML = '';

    words.forEach(word => {
        const slot = document.createElement('div');
        slot.className = 'char-slot';
        slot.dataset.id = word.id;
        slot.dataset.char = word.char;
        slot.textContent = word.char;

        // 桌面版拖放事件
        slot.addEventListener('dragover', handleDragOver);
        slot.addEventListener('dragenter', handleDragEnter);
        slot.addEventListener('dragleave', handleDragLeave);
        slot.addEventListener('drop', handleDrop);

        // 點擊配對事件
        slot.addEventListener('click', handleSlotClick);

        zone.appendChild(slot);
    });
}

// 渲染注音拖拽區
function renderZhuyinDragZone(words) {
    const zone = document.getElementById('zhuyin-drag-zone');
    zone.innerHTML = '';

    // 隨機打亂注音順序
    const shuffled = [...words].sort(() => Math.random() - 0.5);

    shuffled.forEach(word => {
        const card = document.createElement('div');
        card.className = 'zhuyin-card';
        card.draggable = true;
        card.dataset.id = word.id;
        card.dataset.zhuyin = word.zhuyin;
        card.textContent = word.zhuyin;

        // 桌面版拖放事件
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);

        // 觸控事件
        card.addEventListener('touchstart', handleTouchStart, { passive: false });
        card.addEventListener('touchmove', handleTouchMove, { passive: false });
        card.addEventListener('touchend', handleTouchEnd);

        // 點擊配對事件
        card.addEventListener('click', handleZhuyinClick);

        zone.appendChild(card);
    });
}

// ========== 桌面版拖放 ==========
let draggedId = null;
let draggedElement = null;

function handleDragStart(e) {
    if (!gameState.isPlaying) {
        e.preventDefault();
        return;
    }
    draggedId = this.dataset.id;
    draggedElement = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedId);
}

function handleDragEnd(e) {
    draggedId = null;
    draggedElement = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (!this.classList.contains('matched')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drag-over');

    const dropId = this.dataset.id;
    const dragId = e.dataTransfer.getData('text/plain');

    if (dropId === dragId) {
        handleMatchSuccess(this, dragId);
    } else {
        handleMatchFail(dragId);
    }
}

// ========== 觸控版拖放 + 點擊判斷 ==========
let touchDrag = {
    active: false,
    id: null,
    element: null,
    clone: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    hasMoved: false
};

function handleTouchStart(e) {
    if (!gameState.isPlaying) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = this.getBoundingClientRect();

    touchDrag.active = true;
    touchDrag.id = this.dataset.id;
    touchDrag.element = this;
    touchDrag.offsetX = touch.clientX - rect.left;
    touchDrag.offsetY = touch.clientY - rect.top;
    touchDrag.startX = touch.clientX;
    touchDrag.startY = touch.clientY;
    touchDrag.hasMoved = false;

    this.style.opacity = '0.3';
}

function handleTouchMove(e) {
    if (!touchDrag.active) return;
    e.preventDefault();

    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchDrag.startX);
    const dy = Math.abs(touch.clientY - touchDrag.startY);

    // 移動超過 10px 視為拖拽
    if (dx > 10 || dy > 10) {
        touchDrag.hasMoved = true;
    }

    // 只有在確定是拖拽後才創建 clone
    if (touchDrag.hasMoved && !touchDrag.clone) {
        const rect = touchDrag.element.getBoundingClientRect();
        const clone = touchDrag.element.cloneNode(true);
        clone.classList.add('dragging');
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        document.body.appendChild(clone);
        touchDrag.clone = clone;
    }

    if (touchDrag.clone) {
        touchDrag.clone.style.left = (touch.clientX - touchDrag.offsetX) + 'px';
        touchDrag.clone.style.top = (touch.clientY - touchDrag.offsetY) + 'px';
    }
}

function handleTouchEnd(e) {
    if (!touchDrag.active) return;

    const touch = e.changedTouches[0];

    // 還原原始元素樣式
    touchDrag.element.style.opacity = '';

    // 如果沒有移動超過閾值，視為點擊
    if (!touchDrag.hasMoved) {
        if (touchDrag.clone) touchDrag.clone.remove();
        resetTouchDrag();
        // 觸發點擊配對
        handleZhuyinClickRaw(touchDrag.id);
        return;
    }

    // 否則視為拖拽結束
    if (touchDrag.clone) {
        touchDrag.clone.remove();
    }

    // 檢查是否在 char-slot 上方
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);
    const slot = elementBelow?.closest('.char-slot');

    if (slot && !slot.classList.contains('matched')) {
        const dropId = slot.dataset.id;
        if (dropId === touchDrag.id) {
            handleMatchSuccess(slot, touchDrag.id);
        } else {
            handleMatchFail(touchDrag.id);
        }
    }

    resetTouchDrag();
}

function resetTouchDrag() {
    touchDrag = { active: false, id: null, element: null, clone: null, offsetX: 0, offsetY: 0, startX: 0, startY: 0, hasMoved: false };
}

// ========== 點擊配對機制（備用 + 主用） ==========
function handleZhuyinClick(e) {
    if (!gameState.isPlaying) return;
    // 防止點擊事件與拖放衝突
    if (e && e.type === 'click' && draggedElement) return;
    handleZhuyinClickRaw(this.dataset.id);
}

function handleZhuyinClickRaw(wordId) {
    if (!gameState.isPlaying) return;
    if (gameState.matchedIds.has(wordId)) return;

    // 清除之前的選中狀態
    document.querySelectorAll('.zhuyin-card').forEach(c => {
        c.classList.remove('ring-4', 'ring-indigo-400', 'scale-110');
    });

    // 如果點擊已選中的，取消選中
    if (selectedZhuyinId === wordId) {
        selectedZhuyinId = null;
        return;
    }

    // 選中新的注音
    selectedZhuyinId = wordId;
    const card = document.querySelector(`.zhuyin-card[data-id="${wordId}"]`);
    if (card) {
        card.classList.add('ring-4', 'ring-indigo-400', 'scale-110');
    }
}

function handleSlotClick(e) {
    if (!gameState.isPlaying) return;
    if (this.classList.contains('matched')) return;

    const slotId = this.dataset.id;

    if (selectedZhuyinId) {
        if (slotId === selectedZhuyinId) {
            handleMatchSuccess(this, selectedZhuyinId);
        } else {
            handleMatchFail(selectedZhuyinId);
        }
        selectedZhuyinId = null;
        // 清除選中樣式
        document.querySelectorAll('.zhuyin-card').forEach(c => {
            c.classList.remove('ring-4', 'ring-indigo-400', 'scale-110');
        });
    }
}

// ========== 配對結果處理 ==========
function handleMatchSuccess(slot, wordId) {
    if (gameState.matchedIds.has(wordId)) return;

    gameState.matchedIds.add(wordId);
    gameState.combo++;
    if (gameState.combo > gameState.maxCombo) gameState.maxCombo = gameState.combo;

    // 計算分數
    const multiplier = getComboMultiplier(gameState.combo);
    const points = Math.round(100 * multiplier);
    gameState.score += points;

    // 更新進度：答對減少錯誤權重（最少到0）
    App.progress[wordId].successCount++;
    if (App.progress[wordId].wrongWeight > 0) {
        App.progress[wordId].wrongWeight--;
    }
    saveStorage();

    // UI 更新
    slot.classList.add('matched');
    const zhuyinCard = document.querySelector(`.zhuyin-card[data-id="${wordId}"]`);
    if (zhuyinCard) zhuyinCard.classList.add('matched');

    updateGameHUD();
    spawnParticles(slot);
    speakText(slot.dataset.char);

    // 檢查是否全部完成
    if (gameState.matchedIds.size === gameState.words.length) {
        setTimeout(gameComplete, 600);
    }
}

function handleMatchFail(wordId) {
    gameState.mistakes++;
    gameState.combo = 0;
    gameState.lives--;

    // 更新進度：答錯增加錯誤權重
    App.progress[wordId].failCount++;
    App.progress[wordId].wrongWeight++;
    saveStorage();

    // 注音卡片震動
    const zhuyinCard = document.querySelector(`.zhuyin-card[data-id="${wordId}"]`);
    if (zhuyinCard) {
        zhuyinCard.classList.remove('shake');
        void zhuyinCard.offsetWidth;
        zhuyinCard.classList.add('shake');
        setTimeout(() => zhuyinCard.classList.remove('shake'), 400);
    }

    updateGameHUD();

    // 生命歸零則遊戲結束
    if (gameState.lives <= 0) {
        setTimeout(() => gameOver('lives'), 500);
    }
}

function getComboMultiplier(combo) {
    if (combo >= 4) return 2.0;
    if (combo === 3) return 1.5;
    if (combo === 2) return 1.2;
    return 1.0;
}

// ========== HUD 更新 ==========
function updateGameHUD() {
    document.getElementById('game-score').textContent = `${gameState.score} 分`;

    // 生命顯示
    const livesEl = document.getElementById('game-lives');
    if (livesEl) {
        let hearts = '';
        for (let i = 0; i < gameState.lives; i++) hearts += '❤️';
        for (let i = gameState.lives; i < 3; i++) hearts += '🖤';
        livesEl.textContent = hearts;
    }

    const comboEl = document.getElementById('game-combo');
    if (gameState.combo >= 2) {
        comboEl.textContent = `🔥 x${gameState.combo}`;
        comboEl.classList.remove('hidden');
        void comboEl.offsetWidth;
        comboEl.style.animation = 'none';
        comboEl.offsetHeight;
        comboEl.style.animation = '';
    } else {
        comboEl.classList.add('hidden');
    }
}

// ========== 計時器 ==========
function startTimer() {
    clearInterval(gameState.timerId);
    updateTimerDisplay();

    gameState.timerId = setInterval(() => {
        gameState.remainingTime--;
        updateTimerDisplay();

        if (gameState.remainingTime <= 0) {
            gameOver('time');
        }
    }, 1000);
}

function updateTimerDisplay() {
    const timerText = document.getElementById('timer-text');
    const timerBar = document.getElementById('timer-bar');

    timerText.textContent = `${gameState.remainingTime} 秒`;

    const pct = (gameState.remainingTime / gameState.totalTime) * 100;
    timerBar.style.width = `${pct}%`;

    timerBar.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-red-500');
    if (pct > 50) {
        timerBar.classList.add('bg-green-500');
    } else if (pct > 25) {
        timerBar.classList.add('bg-yellow-500');
    } else {
        timerBar.classList.add('bg-red-500');
    }
}

function stopTimer() {
    clearInterval(gameState.timerId);
    gameState.timerId = null;
}

// ========== 遊戲結束 ==========
function gameComplete() {
    gameState.isPlaying = false;
    gameState.endTimestamp = Date.now();
    stopTimer();

    const elapsed = Math.floor((gameState.endTimestamp - gameState.startTimestamp) / 1000);
    const timeBonus = gameState.remainingTime * 10;
    const finalScore = gameState.score + timeBonus;
    gameState.score = finalScore;

    // 星星評級
    const stars = calculateStars(elapsed, gameState.mistakes);

    // 顯示完成畫面
    document.getElementById('complete-emoji').textContent = stars === 3 ? '🏆' : stars === 2 ? '👍' : '🙂';
    document.getElementById('complete-title').textContent = stars === 3 ? '完美通關！' : stars === 2 ? '表現不錯！' : '恭喜完成！';
    document.getElementById('complete-score').textContent = `總分：${finalScore}`;
    document.getElementById('complete-detail').textContent = `用時 ${elapsed} 秒 · 錯誤 ${gameState.mistakes} 次 · 最高連擊 x${gameState.maxCombo}`;
    document.getElementById('complete-bonus').textContent = timeBonus > 0 ? `⏱️ 時間獎勵 +${timeBonus} 分` : '';

    // 星星動畫
    const starEls = document.querySelectorAll('#star-rating .star');
    starEls.forEach((el, i) => {
        el.classList.remove('earned');
        if (i < stars) {
            setTimeout(() => el.classList.add('earned'), 300 + i * 400);
        }
    });

    document.getElementById('game-complete').classList.remove('hidden');

    // 煙火慶祝
    if (stars >= 2) {
        setTimeout(() => spawnFireworks(), 800);
    }
}

function gameOver(reason) {
    gameState.isPlaying = false;
    gameState.endTimestamp = Date.now();
    stopTimer();

    const isTimeUp = reason === 'time';
    const titleEl = document.querySelector('#game-over h2');
    const emojiEl = document.querySelector('#game-over .text-6xl');

    if (titleEl) titleEl.textContent = isTimeUp ? '時間到！' : '生命用盡！';
    if (emojiEl) emojiEl.textContent = isTimeUp ? '⏰' : '💔';

    document.getElementById('over-matched').textContent = gameState.matchedIds.size;
    document.getElementById('over-total').textContent = gameState.words.length;
    document.getElementById('over-score').textContent = `總分：${gameState.score}`;
    document.getElementById('game-over').classList.remove('hidden');
}

function calculateStars(elapsed, mistakes) {
    const gameTime = App.settings.gameTime || 90;
    // 根據總時間調整評級標準
    const quickThreshold = Math.floor(gameTime * 0.5);
    const normalThreshold = Math.floor(gameTime * 0.78);

    if (mistakes <= 1 && elapsed <= quickThreshold) return 3;
    if (mistakes <= 3 && elapsed <= normalThreshold) return 2;
    return 1;
}

// ========== 粒子效果 ==========
function spawnParticles(targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const container = document.getElementById('particles-container');

    const colors = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#a78bfa'];

    for (let i = 0; i < 12; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        p.style.left = centerX + 'px';
        p.style.top = centerY + 'px';
        p.style.width = (6 + Math.random() * 6) + 'px';
        p.style.height = p.style.width;
        p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const dist = 40 + Math.random() * 60;
        p.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--ty', Math.sin(angle) * dist + 'px');

        container.appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }
}

function spawnFireworks() {
    const container = document.getElementById('particles-container');
    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];

    for (let f = 0; f < 3; f++) {
        setTimeout(() => {
            const centerX = window.innerWidth * (0.2 + Math.random() * 0.6);
            const centerY = window.innerHeight * (0.2 + Math.random() * 0.5);

            for (let i = 0; i < 20; i++) {
                const p = document.createElement('div');
                p.className = 'firework-particle';
                p.style.left = centerX + 'px';
                p.style.top = centerY + 'px';
                p.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];

                const angle = (Math.PI * 2 * i) / 20;
                const dist = 60 + Math.random() * 80;
                p.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
                p.style.setProperty('--dy', Math.sin(angle) * dist + 'px');

                container.appendChild(p);
                setTimeout(() => p.remove(), 1200);
            }
        }, f * 400);
    }
}

// ========== 進度統計 ==========
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

// ========== 事件監聽 ==========
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
    document.getElementById('char-display').onclick = (e) => {
        e.stopPropagation();
        const card = App.currentFiltered[App.currentCardIndex];
        if (card) speakCharacterWithZhuyin(card.char, card.zhuyin);
    };
    document.getElementById('example-display').onclick = (e) => {
        e.stopPropagation();
        const card = App.currentFiltered[App.currentCardIndex];
        if (card) speakText(card.example);
    };
});

// ========== 初始化 ==========
async function init() {
    loadStorage();
    await loadVocab();
    renderGradeSelector();
    renderSemesterSelector();
    renderTimeSelector();
    updateProgressStats();
}

init();
