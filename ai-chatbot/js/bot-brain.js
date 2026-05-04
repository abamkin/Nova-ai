class BotBrain {
    constructor() {
        this.kb = KnowledgeBase;
        this.context = {
            lastTopic: null,
            gameState: null,
            guessNumber: null,
            guessAttempts: 0,
            quizQuestion: null,
            messageCount: 0,
            userName: null,
            awaitingName: false,
            mood: 'great',
            totalMessages: 0,
            startTime: Date.now(),
            botGreetCount: 0,
            userTopics: {}
        };
        this.typoMap = this._buildTypoMap();
        this.commonWords = this._buildCommonWords();
    }

    processMessage(userMessage) {
        try {
            this.context.messageCount++;
            this.context.totalMessages++;

            const original = userMessage.trim();
            const cleaned = this._cleanInput(original);
            const corrected = this._correctTypos(cleaned);

            if (!corrected || corrected.length === 0) {
                return { text: '🤔 Пустое сообщение. Напиши что-нибудь!', corrected: null };
            }

            // Уведомление об исправлениях
            let typoNotice = null;
            if (corrected !== cleaned) {
                const changes = this._getChanges(cleaned, corrected);
                if (changes.length > 0) {
                    typoNotice = `✏️ Исправлено: ${changes.join(', ')}`;
                }
            }

            // Активные игры
            const gameResp = this._handleGameState(corrected);
            if (gameResp) return { text: gameResp, corrected: typoNotice };

            // Имя пользователя (если бот ожидает)
            if (this.context.awaitingName) {
                const nameResult = this._handleAwaitingName(corrected);
                if (nameResult) return { text: nameResult, corrected: typoNotice };
            }

            // Основной поиск
            const response = this._findBestResponse(corrected, original);
            this._updateMood(corrected);
            this._trackTopic();

            return { text: response, corrected: typoNotice };

        } catch (error) {
            console.error('BotBrain Error:', error);
            return { text: '⚠️ Ой! Ошибка. Попробуй ещё раз!', corrected: null, error: true };
        }
    }

    getMood() {
        const moods = {
            great:    { icon:'😊', text:'Отличное настроение' },
            good:     { icon:'🙂', text:'Хорошее настроение' },
            neutral:  { icon:'😐', text:'Спокойное настроение' },
            thinking: { icon:'🤔', text:'Задумчивое настроение' },
            happy:    { icon:'😄', text:'Весёлое настроение' },
            helpful:  { icon:'🤗', text:'Хочу помочь' },
            playful:  { icon:'😜', text:'Игривое настроение' }
        };
        return moods[this.context.mood] || moods.great;
    }

    // ==================== INPUT PROCESSING ====================

    _cleanInput(text) {
        return text.toLowerCase().trim().replace(/\s+/g, ' ').replace(/[!?.,:;]+$/, '');
    }

    _correctTypos(text) {
        const words = text.split(' ');
        return words.map(word => {
            if (word.length <= 2) return word;
            if (this.typoMap[word]) return this.typoMap[word];
            if (this.commonWords.has(word)) return word;

            let best = word, bestDist = Infinity;
            for (const [typo, fix] of Object.entries(this.typoMap)) {
                if (Math.abs(word.length - typo.length) > 2) continue;
                const d = this._lev(word, typo);
                if (d < bestDist && d <= 1 && word.length > 3) {
                    bestDist = d; best = fix;
                }
            }
            return best;
        }).join(' ');
    }

    _getChanges(original, corrected) {
        const origWords = original.split(' ');
        const corrWords = corrected.split(' ');
        const changes = [];
        for (let i = 0; i < origWords.length; i++) {
            if (origWords[i] !== corrWords[i]) {
                changes.push(`«${origWords[i]}» → «${corrWords[i]}»`);
            }
        }
        return changes;
    }

    _lev(a, b) {
        if (a === b) return 0;
        const m = [];
        for (let i = 0; i <= b.length; i++) m[i] = [i];
        for (let j = 0; j <= a.length; j++) m[0][j] = j;
        for (let i = 1; i <= b.length; i++)
            for (let j = 1; j <= a.length; j++)
                m[i][j] = b[i-1] === a[j-1]
                    ? m[i-1][j-1]
                    : Math.min(m[i-1][j-1]+1, m[i][j-1]+1, m[i-1][j]+1);
        return m[b.length][a.length];
    }

    _buildTypoMap() {
        return {
            // Приветствия
            'приевт':'привет','превет':'привет','привте':'привет','прмвет':'привет',
            'првет':'привет','пиривет':'привет','приветт':'привет','привер':'привет',
            'здраствуйте':'здравствуйте','здарвствуйте':'здравствуйте',
            'здравствуйет':'здравствуйте','здраствуйет':'здравствуйте',
            // Спасибо
            'спасиб':'спасибо','спосибо':'спасибо','спасиьо':'спасибо',
            'спвсибо':'спасибо','спосиб':'спасибо','спвсиб':'спасибо',
            // Разное
            'пажалуйста':'пожалуйста','пожалуста':'пожалуйста',
            'щутка':'шутка','шудка':'шутка','шукта':'шутка','шкута':'шутка',
            'програмирование':'программирование','прграммирование':'программирование',
            'программированеи':'программирование','програмировние':'программирование',
            'джаваскрпт':'javascript','джаваскрипт':'javascript',
            'явскрипт':'javascript','жаваскирпт':'javascript','джавааскрипт':'javascript',
            'питно':'python','пайтно':'python','пайтон':'python','пайтоон':'python',
            'интиресный':'интересный','интерсный':'интересный','интересныей':'интересный',
            'фкт':'факт','фатк':'факт','факкт':'факт','фаакт':'факт',
            'расажи':'расскажи','рассакжи':'расскажи','раскажи':'расскажи',
            'рассскажи':'расскажи','раскажии':'расскажи','расскаж':'расскажи',
            'погдоа':'погода','поогда':'погода','пагода':'погода','пгода':'погода',
            'калькулятро':'калькулятор','каклулятор':'калькулятор',
            'каменьб':'камень','ножныцы':'ножницы','бумгаа':'бумага',
            'скольок':'сколько','скокло':'сколько','скольк':'сколько',
            'врмея':'время','времыа':'время','времяя':'время',
            'совте':'совет','свеот':'совет','совтет':'совет',
            'игар':'игра','ирга':'игра','играа':'игра',
            'помгои':'помоги','помощ':'помощь',
            'истроия':'история','исотрия':'история','историа':'история',
            'муызка':'музыка','музыкыа':'музыка','муызыка':'музыка',
            'фильмф':'фильмы','фльмы':'фильмы','фильмыы':'фильмы',
            'комлимент':'комплимент','кмоплимент':'комплимент',
            'кнгиа':'книга','книгна':'книга','книгаа':'книга',
            'пароьл':'пароль','парольь':'пароль','паорль':'пароль',
            'монеткау':'монетка','монетку':'монетка','мнетка':'монетка',
            'кубки':'кубик','кубки':'кубик','кубки':'кубик',
            'виктроина':'викторина','виктирина':'викторина','виктонира':'викторина',
            'здоровьне':'здоровье','здоровеь':'здоровье',
            'путешетвие':'путешествие','путешествеи':'путешествие',
            'генерируй':'сгенерируй','генерурий':'сгенерируй',
            'подбось':'подбрось','подборсь':'подбрось',
            'предсакжи':'предскажи','предскаижи':'предскажи',
            'стаитстика':'статистика','статичтика':'статистика',
            'переверен':'переверни','перверни':'переверни',
            'случайнео':'случайное','случаной':'случайное',
            'зовту':'зовут','зовуть':'зовут','зоут':'зовут',
            'жваотные':'животные','жиовтные':'животные',
            'космсо':'космос','ксомос':'космос'
        };
    }

    _buildCommonWords() {
        return new Set([
            'как','что','кто','где','когда','почему','зачем','это','мне','тебе',
            'его','её','их','мой','твой','наш','ваш','меня','тебя','нас','вас',
            'для','про','или','если','чтобы','потому','после','перед','между',
            'быть','есть','было','будет','стал','стала','имя','звать','зовут',
            'день','ночь','утро','вечер','год','месяц','неделя','час','минута'
        ]);
    }

    // ==================== RESPONSE FINDING ====================

    _findBestResponse(text, original) {
        // 1. Математика
        const mathResult = this._tryMath(original);
        if (mathResult) return mathResult;

        // 2. Определение имени пользователя
        const nameResult = this._detectUserName(text);
        if (nameResult) return nameResult;

        // 3. Категории (порядок важен!)
        const categories = [
            { data: this.kb.help, topic: 'help' },
            { data: this.kb.clearCommand, topic: 'clear' },
            { data: this.kb.stats, topic: 'stats' },
            { data: this.kb.secretGreeting, topic: 'secretGreeting' },
            { data: this.kb.greetings, topic: 'greeting' },
            { data: this.kb.farewells, topic: 'farewell' },
            { data: this.kb.botName, topic: 'botName' },
            { data: this.kb.userNameQuery, topic: 'userNameQuery' },
            { data: this.kb.botAge, topic: 'botAge' },
            { data: this.kb.aboutBot, topic: 'about' },
            { data: this.kb.howAreYou, topic: 'howAreYou' },
            { data: this.kb.thanks, topic: 'thanks' },
            { data: this.kb.password, topic: 'password' },
            { data: this.kb.coinFlip, topic: 'coin' },
            { data: this.kb.diceRoll, topic: 'dice' },
            { data: this.kb.magicBall, topic: 'magicBall' },
            { data: this.kb.reverse, topic: 'reverse' },
            { data: this.kb.randomNumber, topic: 'randomNumber' },
            { data: this.kb.ascii, topic: 'ascii' },
            { data: this.kb.easterEggs, topic: 'easter' },
            { data: this.kb.compliment, topic: 'compliment' },
            { data: this.kb.jokes, topic: 'joke' },
            { data: this.kb.facts, topic: 'fact' },
            { data: this.kb.advice, topic: 'advice' },
            { data: this.kb.weather, topic: 'weather' },
            { data: this.kb.time, topic: 'time' },
            { data: this.kb.math, topic: 'math' },
            { data: this.kb.rps, topic: 'rps' },
            { data: this.kb.guessGame, topic: 'guess' },
            { data: this.kb.quiz, topic: 'quiz' },
            { data: this.kb.sadness, topic: 'sad' },
            { data: this.kb.happiness, topic: 'happy' },
            { data: this.kb.insults, topic: 'insult' },
            { data: this.kb.games, topic: 'game' },
            { data: this.kb.science, topic: 'science' },
            { data: this.kb.space, topic: 'space' },
            { data: this.kb.history, topic: 'history' },
            { data: this.kb.animals, topic: 'animals' },
            { data: this.kb.food, topic: 'food' },
            { data: this.kb.music, topic: 'music' },
            { data: this.kb.books, topic: 'books' },
            { data: this.kb.movies, topic: 'movies' },
            { data: this.kb.health, topic: 'health' },
            { data: this.kb.love, topic: 'love' },
            { data: this.kb.meaning, topic: 'meaning' },
            { data: this.kb.languages, topic: 'languages' },
            { data: this.kb.money, topic: 'money' },
            { data: this.kb.travel, topic: 'travel' },
            { data: this.kb.learning, topic: 'learning' }
        ];

        // Технологии
        for (const [key, td] of Object.entries(this.kb.technology)) {
            if (this._match(text, td.patterns)) {
                this.context.lastTopic = 'tech_' + key;
                return this._rand(td.responses);
            }
        }

        // Основные
        for (const cat of categories) {
            if (cat.data?.patterns && this._match(text, cat.data.patterns)) {
                this.context.lastTopic = cat.topic;
                return this._handleSpecial(cat.topic, cat.data, text, original);
            }
        }

        // Fuzzy
        const fuzzy = this._fuzzySearch(text);
        if (fuzzy) return fuzzy;

        this.context.lastTopic = 'default';
        return this._rand(this.kb.default.responses);
    }

    _match(text, patterns) {
        return patterns.some(p => {
            const pl = p.toLowerCase();
            if (text === pl) return true;
            if (text.includes(pl)) return true;
            // Проверяем отдельные слова
            const textWords = text.split(' ');
            const patWords = pl.split(' ');
            if (patWords.length === 1) return textWords.includes(pl);
            // Многословные паттерны — проверяем вхождение как подстроку
            return text.includes(pl);
        });
    }

    _fuzzySearch(text) {
        const stopWords = new Set([
            'как','что','кто','где','когда','почему','зачем','меня','тебя',
            'его','её','их','мой','твой','это','есть','мне','тебе','или',
            'для','про','звать','зовут','имя','моё','мое','твоё','твое',
            'ли','бы','же','то','не','ни','да','нет'
        ]);

        const words = text.split(' ').filter(w => w.length >= 4 && !stopWords.has(w));
        if (words.length === 0) return null;

        let best = null, bestScore = 0;

        const cats = [
            ...Object.entries(this.kb.technology).map(([k,v]) => ({data:v,topic:'tech_'+k})),
            {data:this.kb.jokes,topic:'joke'},{data:this.kb.facts,topic:'fact'},
            {data:this.kb.advice,topic:'advice'},{data:this.kb.science,topic:'science'},
            {data:this.kb.history,topic:'history'},{data:this.kb.animals,topic:'animals'},
            {data:this.kb.food,topic:'food'},{data:this.kb.music,topic:'music'},
            {data:this.kb.books,topic:'books'},{data:this.kb.movies,topic:'movies'},
            {data:this.kb.health,topic:'health'},{data:this.kb.space,topic:'space'},
            {data:this.kb.money,topic:'money'},{data:this.kb.travel,topic:'travel'},
            {data:this.kb.learning,topic:'learning'}
        ];

        for (const cat of cats) {
            if (!cat.data?.patterns) continue;
            let score = 0;
            for (const pat of cat.data.patterns) {
                for (const pw of pat.toLowerCase().split(' ')) {
                    if (pw.length < 4) continue;
                    for (const w of words) {
                        const d = this._lev(w, pw);
                        if (d <= 1) score += 1;
                        else if (d === 2 && w.length > 5) score += 0.3;
                    }
                }
            }
            if (score > bestScore) { bestScore = score; best = cat; }
        }

        if (best && bestScore >= 1) {
            this.context.lastTopic = best.topic;
            return this._rand(best.data.responses);
        }
        return null;
    }

    // ==================== SPECIAL HANDLERS ====================

    _handleSpecial(topic, data, text, original) {
        switch (topic) {
            case 'botName':
                this.context.awaitingName = true;
                return this._rand(data.responses);
            case 'userNameQuery':
                return this._replyWithName();
            case 'time': return this._getTime();
            case 'math': return '🔢 Напиши выражение: `2+2`, `15*3`, `sqrt(144)`, `5^2`';
            case 'rps': return this._playRPS(text);
            case 'guess': return this._startGuess();
            case 'quiz': return this._startQuiz();
            case 'password': return this._genPassword();
            case 'coin': return this._flipCoin();
            case 'dice': return this._rollDice();
            case 'magicBall': return this._magicBall();
            case 'stats': return this._getStats();
            case 'reverse': return this._reverse(original);
            case 'randomNumber': return this._randomNum(text);
            case 'clear': return '__CLEAR_CHAT__';
            default: return this._rand(data.responses);
        }
    }

    // ==================== NAME SYSTEM ====================

    _handleAwaitingName(text) {
        const lower = text.trim();

        // Если это вопрос, а не имя — сбросить ожидание
        const questionPatterns = [
            'как тебя зовут','как меня зовут','что','кто','почему',
            'зачем','когда','где','помощь','help'
        ];
        if (questionPatterns.some(q => lower.includes(q))) {
            this.context.awaitingName = false;
            return null; // Не обрабатываем как имя
        }

        if (this._isLikelyName(lower)) {
            return this._saveName(lower);
        }

        return null;
    }

    _detectUserName(text) {
        // Исключаем вопросы о боте
        const botPatterns = [
            'как тебя зовут','твоё имя','твое имя','как тебя звать',
            'как к тебе обращаться','какое у тебя имя','как меня зовут',
            'как меня звать','ты помнишь','помнишь как'
        ];
        if (botPatterns.some(p => text.includes(p))) return null;

        const patterns = [
            /^меня зовут\s+([а-яёa-z-]{2,20}(?:\s+[а-яёa-z-]{2,20})?)$/i,
            /^моё имя\s+([а-яёa-z-]{2,20}(?:\s+[а-яёa-z-]{2,20})?)$/i,
            /^мое имя\s+([а-яёa-z-]{2,20}(?:\s+[а-яёa-z-]{2,20})?)$/i,
            /^зови меня\s+([а-яёa-z-]{2,20}(?:\s+[а-яёa-z-]{2,20})?)$/i,
            /^называй меня\s+([а-яёa-z-]{2,20}(?:\s+[а-яёa-z-]{2,20})?)$/i,
            /^я\s+([а-яёa-z-]{2,20})$/i
        ];

        for (const pat of patterns) {
            const m = text.match(pat);
            if (m && m[1] && this._isLikelyName(m[1])) {
                return this._saveName(m[1]);
            }
        }
        return null;
    }

    _isLikelyName(val) {
        const t = val.trim().toLowerCase();
        const stops = new Set([
            'привет','пока','бот','ии','чат','погода','музыка','фильм',
            'книга','шутка','факт','совет','игра','викторина','монетка',
            'кубик','время','дата','помощь','help','javascript','python',
            'react','linux','git','спасибо','да','нет','ок','ладно',
            'хорошо','плохо','грустно','весело','круто','классно','супер',
            'ура','камень','ножницы','бумага','угадай','сгенерируй',
            'подбрось','брось','переверни','случайное','расскажи',
            'дай','скажи','покажи','сколько','который','какой','какая'
        ]);

        const parts = t.split(/\s+/);
        if (parts.length < 1 || parts.length > 3) return false;
        for (const p of parts) {
            if (!/^[а-яёa-z-]{2,20}$/i.test(p)) return false;
            if (stops.has(p)) return false;
        }
        return true;
    }

    _formatName(name) {
        return name.split(' ').map(p =>
            p.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join('-')
        ).join(' ');
    }

    _saveName(raw) {
        const name = this._formatName(raw);
        this.context.userName = name;
        this.context.awaitingName = false;
        const r = [
            `Приятно познакомиться, **${name}**! 😊 Чем помочь?`,
            `Рад знакомству, **${name}**! 🙌 Спрашивай!`,
            `Запомнил — **${name}**! ✨ Теперь знаю, как тебя зовут.`,
            `Отлично, **${name}**! 🤖 Я — Nova AI. Приятно!`
        ];
        return r[Math.floor(Math.random() * r.length)];
    }

    _replyWithName() {
        if (this.context.userName) {
            return `🙂 Тебя зовут **${this.context.userName}**! Я помню!`;
        }
        return '🙈 Пока не знаю твоё имя. Напиши: `меня зовут ...`';
    }

    // ==================== GAMES ====================

    _handleGameState(text) {
        if (text.includes('стоп') || text.includes('хватит') || text.includes('выход') || text.includes('отмена')) {
            if (this.context.gameState === 'guessing') {
                const n = this.context.guessNumber;
                this.context.gameState = null;
                return `🎮 Конец игры! Число было **${n}**.`;
            }
            if (this.context.gameState === 'quiz') {
                const a = this.context.quizQuestion.a;
                this.context.gameState = null;
                return `🎮 Ответ: **${this._formatName(a)}**. Напиши «викторина» ещё!`;
            }
        }

        if (this.context.gameState === 'guessing') return this._handleGuess(text);
        if (this.context.gameState === 'quiz') return this._handleQuizAnswer(text);
        return null;
    }

    _playRPS(text) {
        const choices = ['камень','ножницы','бумага'];
        const emojis = {камень:'✊',ножницы:'✂️',бумага:'📄'};
        const bot = choices[Math.floor(Math.random()*3)];

        let user = null;
        for (const c of choices) if (text.includes(c)) { user = c; break; }
        if (!user) return '✊✂️📄 Напиши: **камень**, **ножницы** или **бумага**!';

        const r = `${emojis[user]} vs ${emojis[bot]}`;
        if (user === bot) return `${r}\n\n🤝 **Ничья!** Ещё?`;

        const wins = {камень:'ножницы',ножницы:'бумага',бумага:'камень'};
        if (wins[user] === bot) return `${r}\n\n🎉 **Ты победил!** «${user}» бьёт «${bot}»!`;
        return `${r}\n\n😎 **Я выиграл!** «${bot}» бьёт «${user}»! Ещё?`;
    }

    _startGuess() {
        this.context.gameState = 'guessing';
        this.context.guessNumber = Math.floor(Math.random()*10)+1;
        this.context.guessAttempts = 0;
        return '🔢 Загадал число **1-10**! У тебя 3 попытки.\n(«стоп» — выход)';
    }

    _handleGuess(text) {
        const n = parseInt(text);
        if (isNaN(n) || n < 1 || n > 10) return '🔢 Число от **1 до 10**! Или «стоп».';
        this.context.guessAttempts++;
        if (n === this.context.guessNumber) {
            this.context.gameState = null;
            return `🎉 **ПРАВИЛЬНО!** Это **${this.context.guessNumber}**! Угадал с ${this.context.guessAttempts}-й попытки!`;
        }
        if (this.context.guessAttempts >= 3) {
            this.context.gameState = null;
            return `😅 Попытки кончились! Было **${this.context.guessNumber}**. Ещё? «угадай число»`;
        }
        return (n < this.context.guessNumber ? '⬆️ **Больше!**' : '⬇️ **Меньше!**') +
            ` Осталось: ${3-this.context.guessAttempts}`;
    }

    _startQuiz() {
        const qs = this.kb.quiz.questions;
        const q = qs[Math.floor(Math.random()*qs.length)];
        this.context.gameState = 'quiz';
        this.context.quizQuestion = q;
        return `🧠 **Викторина!**\n\n${q.q}\n\n💡 ${q.hint}\n\n(«сдаюсь»/«стоп» — пропустить)`;
    }

    _handleQuizAnswer(text) {
        if (text.includes('сдаюсь') || text.includes('не знаю') || text.includes('пас')) {
            const a = this.context.quizQuestion.a;
            this.context.gameState = null;
            return `😊 Ответ: **${this._formatName(a)}**! Ещё? «викторина»`;
        }
        const correct = this.context.quizQuestion.a.toLowerCase();
        const user = text.toLowerCase().trim();
        if (user.includes(correct) || correct.includes(user) || this._lev(user, correct) <= 2) {
            this.context.gameState = null;
            return `🎉 **Правильно!** **${this._formatName(correct)}**! 🧠 Ещё? «викторина»`;
        }
        return `❌ Не то! Ещё попытка.\n💡 ${this.context.quizQuestion.hint}\n(«сдаюсь» — ответ)`;
    }

    // ==================== UTILITIES ====================

    _getTime() {
        const now = new Date();
        const time = now.toLocaleTimeString('ru-RU');
        const date = now.toLocaleDateString('ru-RU',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
        const h = now.getHours();
        const g = h>=5&&h<12?'🌅 Доброе утро!':h>=12&&h<17?'☀️ Добрый день!':h>=17&&h<22?'🌆 Добрый вечер!':'🌙 Доброй ночи!';
        return `${g}\n\n🕐 **Время:** ${time}\n📅 **Дата:** ${date}`;
    }

    _tryMath(text) {
        const lower = text.toLowerCase();
        let m;

        m = lower.match(/(?:сколько будет|посчитай|вычисли)\s+(.+)/i);
        if (m) { const r = this._evalMath(m[1]); if (r) return r; }

        m = lower.match(/(?:sqrt|корень\s*(?:из\s*)?)[\(]?(\d+)[\)]?/i);
        if (m) { const n=parseInt(m[1]),r=Math.sqrt(n); return `🔢 √${n} = **${Number.isInteger(r)?r:r.toFixed(4)}**`; }

        m = lower.match(/(\d+)\s*(?:в квадрате|²)/i);
        if (m) { const n=parseInt(m[1]); return `🔢 ${n}² = **${n*n}**`; }

        m = lower.match(/(\d+)\s*(?:в кубе|³)/i);
        if (m) { const n=parseInt(m[1]); return `🔢 ${n}³ = **${n**3}**`; }

        m = text.match(/(\d+)\s*[\^]\s*(\d+)/);
        if (m) { return `🔢 ${m[1]}^${m[2]} = **${Math.pow(parseInt(m[1]),parseInt(m[2]))}**`; }

        m = lower.match(/(\d+)\s*%\s*(?:от\s*)?(\d+)/);
        if (m) { return `🔢 ${m[1]}% от ${m[2]} = **${(parseFloat(m[2])*parseFloat(m[1])/100).toFixed(2)}**`; }

        m = text.match(/(-?\d+[\.\d]*)\s*([\+\-\*\/×÷xX:%])\s*(-?\d+[\.\d]*)/);
        if (m) return this._evalSimple(m[1],m[2],m[3]);

        return null;
    }

    _evalSimple(a,op,b) {
        const na=parseFloat(a), nb=parseFloat(b);
        let r, s=op;
        switch(op) {
            case'+': r=na+nb; break;
            case'-': r=na-nb; break;
            case'*':case'×':case'x':case'X': r=na*nb; s='×'; break;
            case'/':case'÷':case':': if(nb===0) return '⚠️ Деление на ноль!'; r=na/nb; s='÷'; break;
            case'%': r=na%nb; break;
            default: return null;
        }
        return `🔢 ${na} ${s} ${nb} = **${Number.isInteger(r)?r:r.toFixed(4)}**`;
    }

    _evalMath(expr) {
        try {
            let s = expr.replace(/[а-яёА-ЯЁ]/g,'').replace(/×/g,'*').replace(/÷|:/g,'/').replace(/\s+/g,'').replace(/,/g,'.').replace(/\^/g,'**');
            if (!/^[\d\+\-\*\/\(\)\.%]+$/.test(s)) return null;
            const r = Function('"use strict";return('+s+')')();
            if (typeof r==='number' && isFinite(r)) {
                return `🔢 ${expr.trim()} = **${Number.isInteger(r)?r:parseFloat(r.toFixed(6))}**`;
            }
        } catch(e) {}
        return null;
    }

    _genPassword() {
        const c='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*_+-=';
        const gen=l=>{let p='';for(let i=0;i<l;i++)p+=c[Math.floor(Math.random()*c.length)];return p;};
        return `🔐 **Пароли:**\n\n**12:** \`${gen(12)}\`\n**16:** \`${gen(16)}\`\n**20:** \`${gen(20)}\`\n\n💡 Используй менеджер паролей! Ещё? «сгенерируй пароль»`;
    }

    _flipCoin() {
        const r = Math.random()<0.5?'Орёл 🦅':'Решка 👑';
        return `🪙 Подбрасываю...\n\n**${r}!**`;
    }

    _rollDice() {
        const n=Math.floor(Math.random()*6)+1;
        return `🎲 Бросаю...\n\n${'⚀⚁⚂⚃⚄⚅'[n-1]} **Выпало: ${n}!**`;
    }

    _magicBall() {
        const a=[
            '🎱 **Бесспорно да!** ✅','🎱 **Определённо!**','🎱 **Без сомнений!** 💯',
            '🎱 **Да!**','🎱 **Скорее да!**','🎱 **Знаки говорят — да!** ✨',
            '🎱 **Вероятно!**','🎱 **Хорошие шансы!**',
            '🎱 **Пока неясно...** 🔮','🎱 **Спроси позже...**',
            '🎱 **Не могу сказать.** 🤐','🎱 **Сконцентрируйся и спроси снова.** 🧘',
            '🎱 **Не рассчитывай.** ❌','🎱 **Мой ответ — нет.**',
            '🎱 **Сомнительно.** 😬','🎱 **Точно нет!**'
        ];
        return a[Math.floor(Math.random()*a.length)]+'\n\n🔮 Ещё вопрос? Напиши «магический шар»';
    }

    _getStats() {
        const up = Math.floor((Date.now()-this.context.startTime)/1000);
        const min = Math.floor(up/60), sec = up%60;
        const m = this.getMood();
        const name = this.context.userName || 'Гость';
        const topics = Object.entries(this.context.userTopics).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([t,c])=>`${t}: ${c}`).join(', ') || 'нет данных';

        return `📊 **Статистика:**\n\n👤 **Имя:** ${name}\n💬 **Сообщений:** ${this.context.totalMessages}\n⏱️ **Сессия:** ${min} мин ${sec} сек\n🧠 **Тема:** ${this.context.lastTopic||'—'}\n${m.icon} **Настроение:** ${m.text}\n🎮 **Игра:** ${this.context.gameState?'активна':'нет'}\n📈 **Частые темы:** ${topics}`;
    }

    _reverse(original) {
        const m = original.match(/(?:переверни|наоборот|reverse|зеркально)\s+(.+)/i);
        if (m && m[1]) {
            return `🔄 «${m[1]}» → «${m[1].split('').reverse().join('')}»`;
        }
        return '🔄 Напиши: **переверни** _текст_\nПример: «переверни Привет мир»';
    }

    _randomNum(text) {
        const m = text.match(/(?:от\s*)?(\d+)\s*(?:до\s*)(\d+)/);
        if (m) {
            const min=parseInt(m[1]),max=parseInt(m[2]);
            return `🎲 Число ${min}-${max}: **${Math.floor(Math.random()*(max-min+1))+min}**`;
        }
        return `🎲 Число (1-100): **${Math.floor(Math.random()*100)+1}**\n💡 «число от 1 до 1000»`;
    }

    // ==================== MOOD & TRACKING ====================

    _updateMood(text) {
        if (this._match(text, this.kb.jokes?.patterns||[])) this.context.mood='happy';
        else if (this._match(text, this.kb.sadness?.patterns||[])) this.context.mood='helpful';
        else if (this._match(text, this.kb.thanks?.patterns||[])) this.context.mood='happy';
        else if (this._match(text, this.kb.insults?.patterns||[])) this.context.mood='neutral';
        else if (this._match(text, this.kb.games?.patterns||[]) || this.context.gameState) this.context.mood='playful';
        else {
            const m=['great','good','great','happy','thinking'];
            this.context.mood = m[Math.floor(Math.random()*m.length)];
        }
    }

    _trackTopic() {
        if (this.context.lastTopic) {
            this.context.userTopics[this.context.lastTopic] = (this.context.userTopics[this.context.lastTopic]||0)+1;
        }
    }

    _rand(arr) {
        if (!arr || arr.length===0) return this._rand(this.kb.default.responses);
        return arr[Math.floor(Math.random()*arr.length)];
    }
}