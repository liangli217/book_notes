class ThoughtNotes {
    constructor() {
        this.data = {
            books: [],
            podcasts: []
        };
        this.currentItem = null;
        this.currentType = null;
        this.currentTab = 'books';
        this.recognition = null;
        this.isListening = false;
        this.currentListeningTarget = null;
        this.init();
    }

    init() {
        this.loadData();
        this.bindEvents();
        this.initSpeechRecognition();
        this.renderCurrentTab();
    }

    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.speechLang = localStorage.getItem('speechLang') || 'zh-CN';
            this.recognition.lang = this.speechLang;
            this.finalTranscriptLength = 0;

            this.recognition.onresult = (event) => {
                let interimText = '';
                let finalText = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        finalText += transcript;
                    } else {
                        interimText += transcript;
                    }
                }

                if (finalText && this.currentListeningTarget) {
                    const editor = document.getElementById(this.currentListeningTarget);
                    if (editor) {
                        const currentText = editor.innerText;
                        const needsNewline = currentText.length > 0 && !currentText.endsWith('\n');
                        const insertText = (needsNewline ? '<br>' : '') + finalText
                            .replace(/&/g, '&amp;')
                            .replace(/</g, '&lt;')
                            .replace(/>/g, '&gt;');
                        editor.innerHTML += insertText;
                        editor.dispatchEvent(new Event('input', { bubbles: true }));
                        editor.scrollTop = editor.scrollHeight;
                    }
                }

                this.updateInterimPreview(interimText);
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'no-speech' || event.error === 'aborted') {
                    return;
                }
                if (event.error === 'not-allowed') {
                    alert('请允许浏览器使用麦克风权限');
                }
                this.stopListening();
            };

            this.recognition.onend = () => {
                this.updateInterimPreview('');
                if (this.isListening) {
                    try {
                        this.recognition.lang = this.speechLang;
                        this.recognition.start();
                    } catch (e) {
                        console.error('Recognition restart error:', e);
                    }
                }
            };
        }
    }

    updateInterimPreview(text) {
        let preview = document.getElementById('interimPreview');
        if (!text) {
            if (preview) preview.remove();
            return;
        }
        if (!preview && this.currentListeningTarget) {
            const textarea = document.getElementById(this.currentListeningTarget);
            if (!textarea) return;
            preview = document.createElement('div');
            preview.id = 'interimPreview';
            preview.className = 'interim-preview';
            textarea.parentNode.insertBefore(preview, textarea.nextSibling);
        }
        if (preview) {
            preview.textContent = text;
        }
    }

    setSpeechLang(lang) {
        this.speechLang = lang;
        this.recognition.lang = lang;
        localStorage.setItem('speechLang', lang);
        this.updateLangButtons();
    }

    startListening(targetId, button) {
        if (!this.recognition) {
            alert('您的浏览器不支持语音识别功能，请使用Chrome浏览器');
            return;
        }

        if (this.isListening) {
            this.stopListening();
        }

        this.currentListeningTarget = targetId;
        this.isListening = true;
        this.recognition.lang = this.speechLang;
        button.classList.add('listening');
        button.innerHTML = '⏹️ 停止';

        try {
            this.recognition.start();
        } catch (e) {
            console.error('Recognition start error:', e);
        }
    }

    stopListening() {
        if (this.recognition) {
            this.isListening = false;
            try {
                this.recognition.stop();
            } catch (e) {
                console.error('Recognition stop error:', e);
            }
        }

        document.querySelectorAll('.voice-btn.listening').forEach(btn => {
            btn.classList.remove('listening');
            btn.innerHTML = '🎤 语音';
        });

        this.updateInterimPreview('');
        this.currentListeningTarget = null;
    }

    toggleListening(targetId, button) {
        if (this.isListening && this.currentListeningTarget === targetId) {
            this.stopListening();
        } else {
            this.startListening(targetId, button);
        }
    }

    loadData() {
        const savedData = localStorage.getItem('thoughtNotes');
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                this.data = {
                    books: parsed.books || [],
                    podcasts: parsed.podcasts || []
                };
            } catch (e) {
                console.error('Failed to parse saved data:', e);
            }
        } else {
            const oldData = localStorage.getItem('biographyNotes');
            if (oldData) {
                try {
                    this.data.books = JSON.parse(oldData);
                    this.saveData();
                } catch (e) {
                    console.error('Failed to migrate old data:', e);
                }
            }
        }
    }

    saveData() {
        localStorage.setItem('thoughtNotes', JSON.stringify(this.data));
    }

    bindEvents() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tab = e.currentTarget.dataset.tab;
                this.switchTab(tab);
            });
        });

        document.getElementById('addNewBookBtn').addEventListener('click', () => this.showModal('addBookModal'));
        document.getElementById('addNewPodcastBtn').addEventListener('click', () => this.showModal('addPodcastModal'));
        document.getElementById('backToListBtn').addEventListener('click', () => this.goBackToList());
        document.getElementById('addNewNoteBtn').addEventListener('click', () => this.addNewNote());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportData());
        document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    }

    exportData() {
        const data = {
            thoughtNotes: JSON.parse(localStorage.getItem('thoughtNotes') || '{"books":[],"podcasts":[]}'),
            speechLang: localStorage.getItem('speechLang') || 'zh-CN',
            exportDate: new Date().toISOString()
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `notes-backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (!confirm('导入数据将覆盖当前所有笔记，确定继续吗？')) return;

                if (data.thoughtNotes) localStorage.setItem('thoughtNotes', JSON.stringify(data.thoughtNotes));
                if (data.speechLang) localStorage.setItem('speechLang', data.speechLang);

                this.loadData();
                this.renderCurrentTab();
                alert('数据导入成功！');
            } catch (err) {
                alert('导入失败：文件格式错误');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    switchTab(tab) {
        this.currentTab = tab;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });

        document.querySelectorAll('.page[data-page]').forEach(page => {
            page.classList.toggle('active', page.dataset.page === tab);
        });

        this.renderCurrentTab();
    }

    renderCurrentTab() {
        if (this.currentTab === 'books') {
            this.renderBooksPage();
        } else if (this.currentTab === 'podcasts') {
            this.renderPodcastsPage();
        }
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.querySelectorAll('input').forEach(input => input.value = '');
        if (modal.querySelector('select')) {
            modal.querySelector('select').selectedIndex = 0;
        }
        modal.classList.add('active');
        const firstInput = modal.querySelector('input, select');
        if (firstInput) firstInput.focus();
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }

    addBook() {
        const title = document.getElementById('newBookTitle').value.trim();
        const author = document.getElementById('newBookAuthor').value.trim();
        const cover = document.getElementById('newBookCover').value.trim();

        if (!title) {
            alert('请输入书名');
            return;
        }

        const newBook = {
            id: Date.now(),
            type: 'book',
            title: title,
            author: author,
            cover: cover,
            notes: [],
            createdAt: new Date().toISOString()
        };

        this.data.books.push(newBook);
        this.saveData();
        this.closeModal('addBookModal');
        this.renderBooksPage();
    }

    addPodcast() {
        const type = document.getElementById('newPodcastType').value;
        const title = document.getElementById('newPodcastTitle').value.trim();
        const creator = document.getElementById('newPodcastCreator').value.trim();
        const url = document.getElementById('newPodcastUrl').value.trim();
        const cover = document.getElementById('newPodcastCover').value.trim();

        if (!title) {
            alert('请输入标题');
            return;
        }

        const newPodcast = {
            id: Date.now(),
            type: type,
            title: title,
            creator: creator,
            url: url,
            cover: cover,
            notes: [],
            createdAt: new Date().toISOString()
        };

        this.data.podcasts.push(newPodcast);
        this.saveData();
        this.closeModal('addPodcastModal');
        this.renderPodcastsPage();
    }

    deleteItem(type, itemId) {
        const typeLabel = type === 'books' ? '这本书' : '这个视频/播客';
        if (!confirm(`确定要删除${typeLabel}及其所有笔记吗？`)) return;

        this.data[type] = this.data[type].filter(item => item.id !== itemId);
        this.saveData();
        this.renderCurrentTab();
    }

    goBackToList() {
        document.querySelectorAll('.page[data-page]').forEach(page => {
            page.classList.toggle('active', page.dataset.page === this.currentTab);
        });
        document.getElementById('notesPage').classList.remove('active');
        this.currentItem = null;
        this.currentType = null;
        this.renderCurrentTab();
    }

    goToNotesPage(type, itemId) {
        const items = type === 'books' ? this.data.books : this.data.podcasts;
        this.currentItem = items.find(item => item.id === itemId);
        this.currentType = type;
        
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById('notesPage').classList.add('active');
        this.renderNotesPage();
    }

    renderBooksPage() {
        const grid = document.getElementById('booksGrid');
        if (this.data.books.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; color: #868e96; margin-top: 60px;">
                    <p style="font-size: 18px; margin-bottom: 10px;">书架空空如也</p>
                    <p style="font-size: 14px;">点击上方"添加新书"开始你的阅读之旅</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.data.books.map(book => this.renderItemCard('books', book)).join('');
    }

    renderPodcastsPage() {
        const grid = document.getElementById('podcastsGrid');
        if (this.data.podcasts.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1/-1; text-align: center; color: #868e96; margin-top: 60px;">
                    <p style="font-size: 18px; margin-bottom: 10px;">暂无视频或播客</p>
                    <p style="font-size: 14px;">点击上方"添加视频/播客"开始记录</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.data.podcasts.map(podcast => this.renderItemCard('podcasts', podcast)).join('');
    }

    renderItemCard(type, item) {
        const metaLabel = item.type === 'book' ? item.author : item.creator;
        const typeLabel = item.type === 'book' ? '' : (item.type === 'video' ? '🎬 视频' : '🎧 播客');

        return `
            <div class="item-card ${item.type}">
                <div class="item-header">
                    ${item.cover ? `
                    <div class="item-cover-wrapper">
                        <img src="${item.cover}" alt="${item.title}" class="item-cover" onerror="this.onerror=null;this.style.display='none';this.parentElement.innerHTML='<div class=\\'item-cover-placeholder\\'><span>${item.title.charAt(0)}</span></div>'">
                    </div>
                ` : `
                    <div class="item-cover-placeholder">
                        <span>${item.title.charAt(0)}</span>
                    </div>
                `}
                    <div class="item-info">
                        <div class="item-title">${item.title}</div>
                        <div class="item-meta">${metaLabel || '未知'}</div>
                        ${typeLabel ? `<div class="item-type-badge">${typeLabel}</div>` : ''}
                    </div>
                    <div class="item-stats">${item.notes.length} 条</div>
                </div>
                
                ${item.url ? `
                <div class="item-url">
                    <a href="${item.url}" target="_blank" rel="noopener noreferrer">🔗 打开链接</a>
                </div>
                ` : ''}
                
                <div class="item-notes">
                    ${item.notes.length === 0 ? `
                        <div class="no-notes">暂无笔记</div>
                    ` : item.notes.slice(0, 3).map(note => `
                        <div class="note-item">
                            ${note.timestamp ? `<div class="note-timestamp">⏱️ ${note.timestamp}</div>` : ''}
                            <div class="note-quote">${this.getPreviewText(note.quote, 50)}</div>
                            ${note.reflection ? `<div class="note-reflection">${this.getPreviewText(note.reflection, 40)}</div>` : ''}
                        </div>
                    `).join('')}
                    ${item.notes.length > 3 ? `<div class="more-notes">还有 ${item.notes.length - 3} 条笔记...</div>` : ''}
                </div>
                
                <div class="item-actions">
                    <button class="action-btn read-btn" onclick="app.goToNotesPage('${type}', ${item.id})">查看全部</button>
                    <button class="action-btn delete-btn" onclick="app.deleteItem('${type}', ${item.id})">删除</button>
                </div>
            </div>
        `;
    }

    renderNotesPage() {
        const metaField = this.currentItem.type === 'book' ? 'author' : 'creator';
        document.getElementById('currentItemTitle').textContent = this.currentItem.title;
        document.getElementById('currentItemMeta').textContent = this.currentItem[metaField] ? `· ${this.currentItem[metaField]}` : '';
        this.updateLangButtons();
        this.renderNotes();
    }

    updateLangButtons() {
        const zhBtn = document.getElementById('langZhBtn');
        const enBtn = document.getElementById('langEnBtn');
        if (zhBtn && enBtn) {
            zhBtn.classList.toggle('active', this.speechLang === 'zh-CN');
            enBtn.classList.toggle('active', this.speechLang === 'en-US');
        }
    }

    addNewNote() {
        if (!this.currentItem) {
            alert('请先选择一个内容');
            return;
        }

        const newNote = {
            id: Date.now(),
            timestamp: '',
            quote: '',
            reflection: '',
            createdAt: new Date().toISOString()
        };

        this.currentItem.notes.unshift(newNote);
        this.saveData();
        this.renderNotes();
    }

    updateTimestamp(noteId, timestamp) {
        const note = this.currentItem.notes.find(n => n.id === noteId);
        if (note) {
            note.timestamp = timestamp;
            this.saveData();
        }
    }

    updateQuote(noteId, quoteText) {
        const note = this.currentItem.notes.find(n => n.id === noteId);
        if (note) {
            note.quote = quoteText;
            this.saveData();
        }
    }

    updateReflection(noteId, reflectionText) {
        const note = this.currentItem.notes.find(n => n.id === noteId);
        if (note) {
            note.reflection = reflectionText;
            this.saveData();
        }
    }

    renderNotes() {
        const notesList = document.getElementById('notesList');
        const isPodcast = this.currentType === 'podcasts';
        
        if (!this.currentItem || this.currentItem.notes.length === 0) {
            notesList.innerHTML = `
                <div class="empty-state">
                    <p>暂无笔记</p>
                    <p class="hint">点击上方"+ 添加笔记"开始记录</p>
                </div>
            `;
            return;
        }

        notesList.innerHTML = this.currentItem.notes.map(note => `
            <div class="note-card">
                ${isPodcast ? `
                <div class="note-timestamp-row">
                    <span class="timestamp-label">时间戳</span>
                    <input
                        type="text"
                        id="timestamp-${note.id}"
                        class="timestamp-input"
                        value="${note.timestamp || ''}"
                        placeholder="如 12:34 或 1h23m45s"
                        oninput="app.updateTimestamp(${note.id}, this.value)"
                    >
                </div>
                ` : ''}
                <div class="note-content">
                    <div class="note-column">
                        <div class="note-column-header">
                            <div class="note-column-title">${isPodcast ? '精彩片段' : '原文摘录'}</div>
                            <div class="column-actions">
                                <button class="format-btn" onmousedown="event.preventDefault()" onclick="app.formatBold('quote-${note.id}')" title="加粗"><b>B</b></button>
                                <button class="voice-btn" onclick="app.toggleListening('quote-${note.id}', this)">🎤 语音</button>
                            </div>
                        </div>
                        <div id="quote-${note.id}" class="note-text quote-text" contenteditable="true" data-placeholder="在此输入${isPodcast ? '精彩片段内容' : '原文摘录'}..." oninput="app.updateQuote(${note.id}, this.innerHTML)">${note.quote}</div>
                    </div>
                    <div class="note-column">
                        <div class="note-column-header">
                            <div class="note-column-title">感悟</div>
                            <div class="column-actions">
                                <button class="format-btn" onmousedown="event.preventDefault()" onclick="app.formatBold('reflection-${note.id}')" title="加粗"><b>B</b></button>
                                <button class="voice-btn" onclick="app.toggleListening('reflection-${note.id}', this)">🎤 语音</button>
                            </div>
                        </div>
                        <div id="reflection-${note.id}" class="note-text reflection-text" contenteditable="true" data-placeholder="写下你的感悟..." oninput="app.updateReflection(${note.id}, this.innerHTML)">${note.reflection}</div>
                    </div>
                </div>
                <div class="note-footer">
                    <button class="delete-btn" onclick="app.deleteNote(${note.id})">删除笔记</button>
                </div>
            </div>
        `).join('');
    }

    formatBold(editorId) {
        const editor = document.getElementById(editorId);
        if (!editor) return;
        editor.focus();
        document.execCommand('bold');
        editor.dispatchEvent(new Event('input', { bubbles: true }));
    }

    renderMarkdown(text) {
        if (!text) return '';
        return text;
    }

    getPreviewText(html, maxLen) {
        if (!html) return '';
        const div = document.createElement('div');
        div.innerHTML = html;
        const text = div.textContent || div.innerText || '';
        const escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        return escaped.length > maxLen ? escaped.substring(0, maxLen) + '...' : escaped;
    }

    deleteNote(noteId) {
        if (!confirm('确定要删除这条笔记吗？')) return;

        this.currentItem.notes = this.currentItem.notes.filter(n => n.id !== noteId);
        this.saveData();
        this.renderNotes();
    }
}

const app = new ThoughtNotes();
