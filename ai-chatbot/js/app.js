(function() {
    'use strict';

    const $ = id => document.getElementById(id);

    const el = {
        chatArea:$('chatArea'), messages:$('messagesContainer'), welcome:$('welcomeScreen'),
        input:$('messageInput'), sendBtn:$('sendBtn'), charCount:$('charCount'),
        history:$('chatHistory'), newChatBtn:$('newChatBtn'), clearBtn:$('clearHistoryBtn'),
        themeBtn:$('themeBtn'), menuBtn:$('menuBtn'), sidebar:$('sidebar'),
        overlay:$('sidebarOverlay'), scrollBtn:$('scrollBottomBtn'),
        toasts:$('toastContainer'), statusMood:$('statusMood'),
        searchInput:$('searchChats'), exportBtn:$('exportBtn'),
        emojiBtn:$('emojiBtn'), quickPanel:$('quickPanel'),
        headerNewChat:$('headerNewChat'), inputWrapper:$('inputWrapper')
    };

    const state = { chats:{}, currentChatId:null, theme:'dark', isProcessing:false, quickOpen:false };
    const bot = new BotBrain();

    function init() {
        loadState(); applyTheme(); renderHistory(); setupEvents(); updateMood();
        if (!state.currentChatId || !state.chats[state.currentChatId]) showWelcome();
        else loadChat(state.currentChatId);
        if (window.innerWidth > 768) el.input.focus();
    }

    function setupEvents() {
        el.sendBtn.addEventListener('click', send);
        el.input.addEventListener('keydown', e => {
            if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); send(); }
        });
        el.input.addEventListener('input', () => { autoResize(); updateCharCount(); updateSendBtn(); });

        el.newChatBtn.addEventListener('click', () => newChat());
        el.headerNewChat?.addEventListener('click', () => newChat());
        el.clearBtn.addEventListener('click', clearAll);
        el.themeBtn.addEventListener('click', toggleTheme);
        el.menuBtn.addEventListener('click', toggleSidebar);
        el.overlay.addEventListener('click', closeSidebar);

        el.exportBtn?.addEventListener('click', exportChat);

        el.emojiBtn?.addEventListener('click', toggleQuickPanel);

        document.querySelectorAll('.chip').forEach(c =>
            c.addEventListener('click', () => { el.input.value = c.dataset.message; send(); })
        );

        document.querySelectorAll('.quick-item').forEach(q =>
            q.addEventListener('click', () => { el.input.value = q.dataset.msg; toggleQuickPanel(); send(); })
        );

        el.chatArea.addEventListener('scroll', () => {
            const {scrollTop,scrollHeight,clientHeight} = el.chatArea;
            el.scrollBtn.style.display = (scrollHeight-scrollTop-clientHeight<100)?'none':'flex';
        });
        el.scrollBtn.addEventListener('click', scrollBottom);

        el.searchInput?.addEventListener('input', () => renderHistory(el.searchInput.value));

        document.addEventListener('keydown', e => {
            if (e.key==='Escape') { closeSidebar(); if (state.quickOpen) toggleQuickPanel(); }
        });

        document.addEventListener('click', e => {
            if (state.quickOpen && !el.quickPanel.contains(e.target) && e.target !== el.emojiBtn) {
                toggleQuickPanel();
            }
        });
    }

    // ==================== SEND ====================

    function send() {
        const text = el.input.value.trim();
        if (!text || state.isProcessing) return;

        state.isProcessing = true;
        if (!state.currentChatId) newChat(false);
        hideWelcome();

        const userMsg = { role:'user', text, time:new Date().toISOString() };
        addMsg(userMsg); renderMsg(userMsg); clearInput(); scrollBottom();

        if (state.chats[state.currentChatId].messages.length === 1) {
            state.chats[state.currentChatId].title = text.substring(0,35) + (text.length>35?'…':'');
            renderHistory();
        }

        showTyping();

        const delay = 400 + Math.random()*800;
        setTimeout(() => {
            hideTyping();
            try {
                const resp = bot.processMessage(text);

                // Специальная команда очистки
                if (resp.text === '__CLEAR_CHAT__') {
                    state.chats[state.currentChatId].messages = [];
                    el.messages.innerHTML = '';
                    showWelcome();
                    state.isProcessing = false;
                    toast('Чат очищен', 'success');
                    return;
                }

                let botText = resp.text;
                if (resp.corrected) botText = `*${resp.corrected}*\n\n${botText}`;

                const botMsg = { role:'bot', text:botText, time:new Date().toISOString() };
                addMsg(botMsg); renderMsg(botMsg); scrollBottom();
                save(); updateMood();

                if (resp.error) toast('Ошибка обработки', 'error');
            } catch(e) {
                console.error(e);
                hideTyping();
                const errMsg = { role:'bot', text:'⚠️ Ошибка. Попробуй ещё!', time:new Date().toISOString() };
                addMsg(errMsg); renderMsg(errMsg);
                toast('Ошибка', 'error');
            }
            state.isProcessing = false;
        }, delay);
    }

    // ==================== RENDER ====================

    function renderMsg(msg) {
        const div = document.createElement('div');
        div.className = `message ${msg.role}`;
        const av = msg.role==='bot'?'🤖':'👤';
        const t = formatTime(msg.time);
        const html = formatText(msg.text);

        div.innerHTML = `
            <div class="message-avatar">${av}</div>
            <div class="message-content">
                <div class="message-bubble">
                    ${html}
                    ${msg.role==='bot'?'<button class="copy-btn" onclick="window._copy(this)">📋</button>':''}
                </div>
                <div class="message-time">${t}</div>
                ${msg.role==='bot'?`<div class="message-actions">
                    <button class="message-action-btn" onclick="window._react(this,'👍')">👍</button>
                    <button class="message-action-btn" onclick="window._react(this,'👎')">👎</button>
                </div>`:''}
            </div>`;

        el.messages.appendChild(div);
    }

    function formatText(text) {
        let f = escapeHtml(text);
        f = f.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
        f = f.replace(/`([^`]+)`/g, '<code>$1</code>');
        f = f.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        f = f.replace(/\*(.+?)\*/g, '<em>$1</em>');
        f = f.replace(/^• (.+)$/gm, '<li>$1</li>');
        f = f.replace(/\n/g, '<br>');
        f = f.replace(/<br>(<li>)/g, '$1');
        f = f.replace(/(<\/li>)<br>/g, '$1');
        return f;
    }

    function escapeHtml(t) { const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }

    // ==================== TYPING ====================

    function showTyping() {
        const d = document.createElement('div');
        d.className='typing-indicator'; d.id='typingIndicator';
        d.innerHTML=`<div class="message-avatar">🤖</div><div class="typing-dots"><span></span><span></span><span></span></div>`;
        el.messages.appendChild(d); scrollBottom();
    }
    function hideTyping() { const t=$('typingIndicator'); if(t)t.remove(); }

    // ==================== CHAT MANAGEMENT ====================

    function newChat(notify=true) {
        const id='chat_'+Date.now();
        state.chats[id]={id,title:'Новый чат',messages:[],created:new Date().toISOString()};
        state.currentChatId=id;
        el.messages.innerHTML='';
        showWelcome(); renderHistory(); save();
        if(notify) toast('Новый чат','success');
        if(window.innerWidth>768) el.input.focus();
        bot.context.gameState=null;
        bot.context.awaitingName=false;
    }

    function loadChat(id) {
        if(!state.chats[id]) return;
        state.currentChatId=id;
        el.messages.innerHTML='';
        const chat=state.chats[id];
        if(chat.messages.length===0) showWelcome();
        else { hideWelcome(); chat.messages.forEach(m=>renderMsg(m)); scrollBottom(); }
        renderHistory(); save(); closeSidebar();
    }

    function deleteChat(id,e) {
        e.stopPropagation();
        delete state.chats[id];
        if(state.currentChatId===id) {
            const ids=Object.keys(state.chats);
            if(ids.length>0) loadChat(ids[ids.length-1]);
            else { state.currentChatId=null; el.messages.innerHTML=''; showWelcome(); }
        }
        renderHistory(); save(); toast('Удалено','info');
    }

    function clearAll() {
        if(Object.keys(state.chats).length===0) { toast('Уже пусто','info'); return; }
        state.chats={}; state.currentChatId=null;
        el.messages.innerHTML=''; showWelcome(); renderHistory(); save();
        toast('История очищена','success');
    }

    function addMsg(msg) {
        if(!state.currentChatId||!state.chats[state.currentChatId]) return;
        state.chats[state.currentChatId].messages.push(msg);
    }

    // ==================== HISTORY ====================

    function renderHistory(search='') {
        const label=el.history.querySelector('.history-label');
        el.history.innerHTML=''; el.history.appendChild(label);

        let ids=Object.keys(state.chats).reverse();
        if(search) {
            const s=search.toLowerCase();
            ids=ids.filter(id=>(state.chats[id].title||'').toLowerCase().includes(s));
        }

        if(ids.length===0) {
            const e=document.createElement('div');
            e.style.cssText='padding:20px 12px;text-align:center;color:var(--text-sidebar-dim);font-size:0.8rem;';
            e.textContent=search?'Ничего не найдено':'Нет чатов';
            el.history.appendChild(e); return;
        }

        ids.forEach(id=>{
            const chat=state.chats[id];
            const item=document.createElement('div');
            item.className=`history-item${id===state.currentChatId?' active':''}`;
            item.innerHTML=`
                <span class="history-item-icon">💬</span>
                <span class="history-item-text">${escapeHtml(chat.title)}</span>
                <button class="delete-chat" title="Удалить">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>`;
            item.addEventListener('click',()=>loadChat(id));
            item.querySelector('.delete-chat').addEventListener('click',e=>deleteChat(id,e));
            el.history.appendChild(item);
        });
    }

    // ==================== EXPORT ====================

    function exportChat() {
        if(!state.currentChatId||!state.chats[state.currentChatId]) { toast('Нет чата','info'); return; }
        const chat=state.chats[state.currentChatId];
        let text=`=== ${chat.title} ===\n${chat.created}\n\n`;
        chat.messages.forEach(m=>{
            const who=m.role==='user'?'Вы':'Nova AI';
            const t=formatTime(m.time);
            text+=`[${t}] ${who}:\n${m.text}\n\n`;
        });
        const blob=new Blob([text],{type:'text/plain'});
        const url=URL.createObjectURL(blob);
        const a=document.createElement('a');
        a.href=url; a.download=`chat-${Date.now()}.txt`; a.click();
        URL.revokeObjectURL(url);
        toast('Чат экспортирован!','success');
    }

    // ==================== UI ====================

    function showWelcome() { el.welcome.style.display='flex'; el.messages.style.display='none'; }
    function hideWelcome() { el.welcome.style.display='none'; el.messages.style.display='block'; }

    function toggleTheme() {
        state.theme=state.theme==='light'?'dark':'light';
        applyTheme(); save();
        toast(`${state.theme==='dark'?'🌙 Тёмная':'☀️ Светлая'} тема`,'info');
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme',state.theme);
        const icon=el.themeBtn.querySelector('.theme-icon');
        const label=el.themeBtn.querySelector('.theme-label');
        icon.textContent=state.theme==='dark'?'☀️':'🌙';
        label.textContent=state.theme==='dark'?'Светлая тема':'Тёмная тема';
    }

    function updateMood() {
        const m=bot.getMood();
        el.statusMood.textContent=`${m.icon} ${m.text}`;
    }

    function toggleSidebar() { el.sidebar.classList.toggle('open'); el.overlay.classList.toggle('active'); }
    function closeSidebar() { el.sidebar.classList.remove('open'); el.overlay.classList.remove('active'); }

    function toggleQuickPanel() {
        state.quickOpen=!state.quickOpen;
        el.quickPanel.style.display=state.quickOpen?'block':'none';
    }

    function clearInput() {
        el.input.value=''; autoResize(); updateCharCount(); updateSendBtn();
    }

    function autoResize() {
        el.input.style.height='auto';
        el.input.style.height=Math.min(el.input.scrollHeight,150)+'px';
    }

    function updateCharCount() {
        const n=el.input.value.length;
        el.charCount.textContent=n;
        el.charCount.className='char-count'+(n>2500?' danger':n>2000?' warning':'');
    }

    function updateSendBtn() { el.sendBtn.disabled=el.input.value.trim().length===0; }

    function scrollBottom() {
        requestAnimationFrame(()=>{ el.chatArea.scrollTop=el.chatArea.scrollHeight; });
    }

    function formatTime(iso) {
        try { return new Date(iso).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); }
        catch { return ''; }
    }

    function toast(msg,type='info') {
        const t=document.createElement('div');
        t.className=`toast ${type}`;
        const icons={success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
        t.innerHTML=`<span>${icons[type]||'ℹ️'}</span><span>${msg}</span>`;
        el.toasts.appendChild(t);
        setTimeout(()=>t.remove(),3000);
    }

    // ==================== PERSISTENCE ====================

    function save() {
        try { localStorage.setItem('nova_ai_state',JSON.stringify({
            chats:state.chats,currentChatId:state.currentChatId,theme:state.theme
        })); } catch(e) { console.error('Save error',e); }
    }

    function loadState() {
        try {
            const s=localStorage.getItem('nova_ai_state');
            if(s){const d=JSON.parse(s);state.chats=d.chats||{};state.currentChatId=d.currentChatId;state.theme=d.theme||'dark';}
        } catch(e) { console.error('Load error',e); state.chats={}; state.currentChatId=null; state.theme='dark'; }
    }

    // ==================== GLOBAL ====================

    window._copy=function(btn) {
        const bubble=btn.closest('.message-bubble');
        const text=bubble.textContent.replace('📋','').trim();
        navigator.clipboard.writeText(text).then(()=>{
            btn.textContent='✅'; setTimeout(()=>btn.textContent='📋',1500);
            toast('Скопировано!','success');
        }).catch(()=>{
            const ta=document.createElement('textarea');ta.value=text;
            document.body.appendChild(ta);ta.select();document.execCommand('copy');
            document.body.removeChild(ta);
            btn.textContent='✅'; setTimeout(()=>btn.textContent='📋',1500);
        });
    };

    window._react=function(btn,emoji) {
        btn.style.transform='scale(1.4)';
        setTimeout(()=>btn.style.transform='scale(1)',200);
        toast(`${emoji}`,'info');
    };

    init();
})();