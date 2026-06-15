// Monaco 에디터 로더 설정
require.config({ paths: { 'vs': '/.app/lib/monaco-editor/min/vs' } });

const preview = document.getElementById('preview');
const fileOpenBtn = document.querySelector('.file-open-btn');
const readToggleBtn = document.querySelector('.read-toggle-btn');
const fileNameInput = document.querySelector('.file-name');
const aiToggleBtn = document.querySelector('.ai-toggle-btn');
const lowerPanel = document.querySelector('.lower-panel');
const mainContainer = document.querySelector('.main-container');
const newFileBtn = document.getElementById('new-file-btn');
const saveBtn = document.getElementById('save-btn');

let editorInstance = null;
let aiEditorInstance = null;
let aiResponseInstance = null;

// 파일 열기 API 연동
fileOpenBtn.addEventListener('click', () => {
    let currentPath = window.location.pathname;
    if (currentPath.startsWith('/local/')) {
        currentPath = currentPath.substring(7);
    }
    currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

    fetch('/api/open-dialog?currentPath=' + encodeURIComponent(currentPath))
    .then(res => {
        if (res.status === 204) return null;
        return res.json();
    })
    .then(data => {
        if (data && data.path) {
            const normalizedPath = data.path.replace(/\\/g, '/');
            // 드라이브 문자(예: C:)의 콜론(:)이 인코딩되어 경로 해석 오류가 나지 않도록 처리한다.
            let targetPath = normalizedPath;
            if (targetPath.match(/^[a-zA-Z]:/)) {
                const drive = targetPath.substring(0, 2); // "C:"
                const rest = targetPath.substring(2);
                window.location.pathname = '/local/' + drive + rest;
            } else {
                window.location.pathname = '/local/' + targetPath;
            }
        }
    })
    .catch(err => console.error("파일 열기 실패:", err));
});

// 드롭다운 메뉴 동작 제어
const dropdown = document.querySelector('.dropdown');
const dropdownBtn = document.querySelector('.dropdown-btn');

if (dropdown && dropdownBtn) {
    dropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });

    // 드롭다운 메뉴 아이템 클릭 시 더미 로직 바인딩 (기능 차후 구현)
    const menuNewDocument = document.getElementById('menu-new-document');
    const menuBackTwoDocs = document.getElementById('menu-back-two-docs');
    const menuInsertTable = document.getElementById('menu-insert-table');

    const newDocModal = document.getElementById('new-doc-modal');
    const newDocText = document.getElementById('new-doc-text');
    const newDocFilename = document.getElementById('new-doc-filename');
    const newDocClose = document.getElementById('new-doc-close');
    const newDocCancel = document.getElementById('new-doc-cancel');
    const newDocConfirm = document.getElementById('new-doc-confirm');

    function closeNewDocModal() {
        if (newDocModal) {
            newDocModal.classList.remove('show');
        }
    }

    if (menuNewDocument) {
        menuNewDocument.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            if (newDocModal) {
                if (newDocText) newDocText.value = '';
                if (newDocFilename) newDocFilename.value = '';
                newDocModal.classList.add('show');
            }
        });
    }

    if (newDocClose) newDocClose.addEventListener('click', closeNewDocModal);
    if (newDocCancel) newDocCancel.addEventListener('click', closeNewDocModal);
    if (newDocModal) {
        newDocModal.addEventListener('click', (e) => {
            if (e.target === newDocModal) {
                closeNewDocModal();
            }
        });
    }

    if (newDocConfirm) {
        newDocConfirm.addEventListener('click', () => {
            const textVal = newDocText ? newDocText.value.trim() : '';
            let fileVal = newDocFilename ? newDocFilename.value.trim() : '';

            if (!textVal || !fileVal) {
                alert('보일 문자와 파일 이름을 모두 입력해야 한다.');
                return;
            }

            if (!fileVal.toLowerCase().endsWith('.md')) {
                fileVal += '.md';
            }

            if (editorInstance) {
                const relativeLink = `[${textVal}](${fileVal})`;
                const selection = editorInstance.getSelection();
                editorInstance.executeEdits("insert-new-doc-link", [
                    {
                        range: selection,
                        text: relativeLink,
                        forceMoveMarkers: true
                    }
                ]);
                editorInstance.focus();
                
                // 에디터 변경 사항을 즉시 서버에 저장한 후 새로 고침 처리
                saveDocumentContent(editorInstance.getValue());
                setTimeout(() => {
                    window.location.reload();
                }, 100);
            }
            closeNewDocModal();
        });
    }

    if (menuBackTwoDocs) {
        menuBackTwoDocs.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            if (editorInstance) {
                const textToInsert = '<button onclick="window.history.back();" style="padding: 8px 16px; cursor: pointer;">이전 문서로 돌아가기</button>';
                const selection = editorInstance.getSelection();
                editorInstance.executeEdits("insert-back-button", [
                    {
                        range: selection,
                        text: textToInsert,
                        forceMoveMarkers: true
                    }
                ]);
                editorInstance.focus();
            }
        });
    }

    const tableModal = document.getElementById('table-modal');
    const tableRowsInput = document.getElementById('table-rows');
    const tableColsInput = document.getElementById('table-cols');
    const tableModalClose = document.getElementById('table-modal-close');
    const tableModalCancel = document.getElementById('table-modal-cancel');
    const tableModalConfirm = document.getElementById('table-modal-confirm');

    function closeTableModal() {
        if (tableModal) {
            tableModal.classList.remove('show');
        }
    }

    if (menuInsertTable) {
        menuInsertTable.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            if (tableModal) {
                if (tableRowsInput) tableRowsInput.value = '3';
                if (tableColsInput) tableColsInput.value = '3';
                tableModal.classList.add('show');
            }
        });
    }

    if (tableModalClose) {
        tableModalClose.addEventListener('click', closeTableModal);
    }

    if (tableModalCancel) {
        tableModalCancel.addEventListener('click', closeTableModal);
    }

    if (tableModal) {
        tableModal.addEventListener('click', (e) => {
            if (e.target === tableModal) {
                closeTableModal();
            }
        });
    }

    if (tableModalConfirm) {
        tableModalConfirm.addEventListener('click', () => {
            const rows = parseInt(tableRowsInput ? tableRowsInput.value : '3', 10);
            const cols = parseInt(tableColsInput ? tableColsInput.value : '3', 10);

            if (isNaN(rows) || rows < 1 || isNaN(cols) || cols < 1) {
                alert('행과 열의 개수는 1 이상의 숫자여야 한다.');
                return;
            }

            if (editorInstance) {
                const tableContent = generateMarkdownTable(rows, cols);
                const selection = editorInstance.getSelection();
                editorInstance.executeEdits("insert-table", [
                    {
                        range: selection,
                        text: tableContent,
                        forceMoveMarkers: true
                    }
                ]);
                editorInstance.focus();
            }

            closeTableModal();
        });
    }

    function generateMarkdownTable(rows, cols) {
        let md = "|";
        for (let c = 1; c <= cols; c++) {
            md += ` Header ${c} |`;
        }
        md += "\n|";
        for (let c = 1; c <= cols; c++) {
            md += " --- |";
        }
        md += "\n";
        for (let r = 1; r <= rows; r++) {
            md += "|";
            for (let c = 1; c <= cols; c++) {
                md += ` |`;
            }
            md += "\n";
        }
        return md;
    }

    const menuInsertTip = document.getElementById('menu-insert-tip');
    const menuInsertWarning = document.getElementById('menu-insert-warning');
    const menuInsertQuestion = document.getElementById('menu-insert-question');
    const menuInsertImportant = document.getElementById('menu-insert-important');

    const insertCallout = (type) => {
        if (editorInstance) {
            const textToInsert = `> [!${type}]\n> `;
            const selection = editorInstance.getSelection();
            editorInstance.executeEdits("insert-callout", [
                {
                    range: selection,
                    text: textToInsert,
                    forceMoveMarkers: true
                }
            ]);
            editorInstance.focus();
        }
    };

    if (menuInsertTip) {
        menuInsertTip.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            insertCallout('TIP');
        });
    }
    if (menuInsertWarning) {
        menuInsertWarning.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            insertCallout('WARNING');
        });
    }
    if (menuInsertQuestion) {
        menuInsertQuestion.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            insertCallout('QUESTION');
        });
    }
    if (menuInsertImportant) {
        menuInsertImportant.addEventListener('click', (e) => {
            e.preventDefault();
            dropdown.classList.remove('show');
            insertCallout('IMPORTANT');
        });
    }
}

// 컬러 구문 분석기
function applyColorSyntax(text) {
    return text.replace(/\[([^\]]+)\]\{\s*(?:color:\s*)?([#\w\(\),]+)?\s*(?:bg:\s*)?([#\w\(\),]+)?\s*\}/g, (match, text, color, bg) => {
        let style = "";
        if (color) {
            if (color.startsWith('bg:')) {
                style += `background-color: ${color.replace('bg:', '')};`;
            } else {
                style += `color: ${color};`;
            }
        }
        if (bg) {
            style += `background-color: ${bg.replace('bg:', '')};`;
        }
        return `<span style="${style}">${text}</span>`;
    });
}

// 콜아웃 구문 분석기
function applyCallouts(text) {
    const lines = text.split('\n');
    const result = [];
    let inCallout = false;
    let calloutBuffer = [];

    lines.forEach(line => {
        if (line.match(/^>\s*\[!([a-zA-Z]+)\]/)) {
            if (inCallout) result.push(processBuffer(calloutBuffer));
            inCallout = true;
            calloutBuffer = [line];
        } else if (inCallout && line.startsWith('>')) {
            calloutBuffer.push(line);
        } else {
            if (inCallout) {
                result.push(processBuffer(calloutBuffer));
                calloutBuffer = [];
                inCallout = false;
            }
            result.push(line);
        }
    });
    if (inCallout) result.push(processBuffer(calloutBuffer));
    return result.join('\n');
}

// 사용자 커스텀 마크다운 파서 및 예외 처리
function markedParseWithFallback(text) {
    try {
        return marked.parser(marked.lexer(text));
    } catch (e) {
        return text;
    }
}

// 콜아웃 내부 버퍼 처리
function processBuffer(buffer) {
    const calloutMap = { 'IMPORTANT': 'important', 'NOTE': 'note', 'TIP': 'tip', 'WARNING': 'warning', 'QUESTION': 'question' };
    const match = buffer[0].match(/^>\s*\[!([a-zA-Z]+)\]\s*(.*)/);
    const type = match ? match[1].toUpperCase() : 'NOTE';
    const filename = calloutMap[type] || 'note';
    const cleanContent = buffer.map(l => l.replace(/^>\s?/, '')).slice(1).join('\n');

    return `<div class="callout callout-${filename}"><img src="/.app/SVG/${filename}.svg" class="callout-icon"><div class="callout-content"><span class="callout-title">${type}</span>${markedParseWithFallback(cleanContent)}</div></div>`;
}

// 테마 변경 이벤트 바인딩 제거됨

// AI도우미 가시성 토글 로직 제거됨

// 읽기 모드 토글 로직
if (readToggleBtn) {
    readToggleBtn.addEventListener('click', () => {
        const isReadMode = document.body.classList.toggle('read-mode');
        localStorage.setItem('read-mode', isReadMode);
        let targetWidth = 1280;
        let targetHeight = 960;

        if (isReadMode) {
            readToggleBtn.textContent = '✍️ 편집';
            targetWidth = 640;
        } else {
            readToggleBtn.textContent = '📖 읽기';
            targetWidth = 1280;
        }

        // 서버 API 호출하여 창 크기 조절
        fetch('/api/resize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ width: targetWidth, height: targetHeight })
        }).catch(err => console.error("창 크기 변경 실패:", err));

        setTimeout(() => {
            if (editorInstance) editorInstance.layout();
        }, 100);
    });
}

// '새 파일' 버튼 이벤트 바인딩
if (newFileBtn) {
    newFileBtn.addEventListener('click', () => {
        let currentPath = window.location.pathname;
        if (currentPath.startsWith('/local/')) {
            currentPath = currentPath.substring(7);
        }
        currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

        fetch('/api/save-dialog?currentPath=' + encodeURIComponent(currentPath))
        .then(res => {
            if (res.status === 204) return null;
            return res.json();
        })
        .then(data => {
            if (data && data.path) {
                const normalizedPath = data.path.replace(/\\/g, '/');
                let targetPath = normalizedPath;
                if (targetPath.match(/^[a-zA-Z]:/)) {
                    const drive = targetPath.substring(0, 2); // "C:"
                    const rest = targetPath.substring(2);
                    window.location.pathname = '/local/' + drive + rest;
                } else {
                    window.location.pathname = '/local/' + targetPath;
                }
            }
        })
        .catch(err => console.error("새 파일 저장 실패:", err));
    });
}

// '저장' 버튼 이벤트 바인딩
if (saveBtn) {
    saveBtn.addEventListener('click', () => {
        let currentPath = window.location.pathname;
        if (currentPath.startsWith('/local/')) {
            currentPath = currentPath.substring(7);
        }
        currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

        fetch('/api/save-dialog?currentPath=' + encodeURIComponent(currentPath))
        .then(res => {
            if (res.status === 204) return null;
            return res.json();
        })
        .then(data => {
            if (data && data.path) {
                const normalizedPath = data.path.replace(/\\/g, '/');
                
                // 해당 경로에 현재 내용을 저장한다.
                fetch('/api/save', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ path: normalizedPath, content: editorInstance ? editorInstance.getValue() : '' }) 
                }).then(() => {
                    // 저장 성공 시, 현재 웹뷰의 URL을 새 파일 경로로 이동한다.
                    let targetPath = normalizedPath;
                    if (targetPath.match(/^[a-zA-Z]:/)) {
                        const drive = targetPath.substring(0, 2);
                        const rest = targetPath.substring(2);
                        window.location.pathname = '/local/' + drive + rest;
                    } else {
                        window.location.pathname = '/local/' + targetPath;
                    }
                }).catch(err => console.error("저장 실패:", err));
            }
        })
        .catch(err => console.error("파일 저장 창 실행 실패:", err));
    });
}

// 마크다운 렌더링 및 동적 행 번호(data-line) 주입 로직
function renderMarkdownWithLines(markdownText) {
    if (!markdownText) return '';
    
    let text = applyCallouts(markdownText);
    text = applyColorSyntax(text);
    
    const tokens = marked.lexer(text);
    
    // tokens 트리에서 link 타입의 토큰을 재귀적으로 탐색하여 href를 보정한다.
    function processTokens(tokenList) {
        if (!tokenList) return;
        tokenList.forEach(token => {
            if (token.type === 'link') {
                let href = token.href;
                try {
                    href = decodeURIComponent(href);
                } catch (e) {
                    // 디코딩 실패 시 원본 유지
                }
                if (href && !href.match(/^(https?|mailto|tel):/) && !href.startsWith('#')) {
                    let currentPath = window.location.pathname;
                    if (currentPath.startsWith('/local/')) {
                        currentPath = currentPath.substring(7);
                    }
                    currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');
                    
                    const lastSlash = currentPath.lastIndexOf('/');
                    let currentDir = lastSlash !== -1 ? currentPath.substring(0, lastSlash) : '';
                    
                    let targetPath = href;
                    if (!href.startsWith('/') && !href.includes(':')) {
                        if (href.startsWith('./')) {
                            href = href.substring(2);
                        }
                        while (href.startsWith('../')) {
                            href = href.substring(3);
                            const parentSlash = currentDir.lastIndexOf('/');
                            if (parentSlash !== -1) {
                                currentDir = currentDir.substring(0, parentSlash);
                            } else {
                                currentDir = '';
                            }
                        }
                        targetPath = currentDir ? `${currentDir}/${href}` : href;
                    } else if (href.startsWith('/')) {
                        if (href.startsWith('/local/')) {
                            targetPath = href.substring(7);
                        } else {
                            targetPath = href.substring(1);
                        }
                    }
                    
                    targetPath = targetPath.replace(/\\/g, '/');
                    let drivePart = "";
                    let restPart = targetPath;
                    if (targetPath.match(/^[a-zA-Z]:/)) {
                        drivePart = targetPath.substring(0, 2);
                        restPart = targetPath.substring(2);
                    }
                    token.href = '/local/' + drivePart + encodeURIComponent(restPart);
                }
            }
            if (token.tokens) {
                processTokens(token.tokens);
            }
            if (token.items) {
                processTokens(token.items);
            }
        });
    }
    
    processTokens(tokens);
    
    let html = "";
    try {
        html = marked.parser(tokens);
    } catch (e) {
        html = text;
    }
    
    return html.split('\n').map((line, index) => {
        if (line.trim().startsWith('<') && !line.includes('data-line')) {
            return line.replace(/^<([a-zA-Z0-9\-]+)/, `<$1 data-line="${index + 1}"`);
        }
        return line;
    }).join('\n');
}

// 프리뷰 스크롤 시 에디터 단방향 동기화 로직 (data-line 기반 정밀 선형 보간 스크롤 동기화)
preview.addEventListener('scroll', () => {
    if (!editorInstance) return;
    
    const previewScrollHeight = preview.scrollHeight - preview.clientHeight;
    if (previewScrollHeight <= 0) return;

    // 상단 및 하단 극단 경계 영역 동기화
    if (preview.scrollTop === 0) {
        editorInstance.setScrollTop(0);
        return;
    }
    if (preview.scrollTop >= previewScrollHeight) {
        const maxScrollTop = editorInstance.getScrollHeight() - editorInstance.getLayoutInfo().height;
        editorInstance.setScrollTop(maxScrollTop);
        return;
    }

    const lines = preview.querySelectorAll('[data-line]');
    if (lines.length === 0) return;

    let targetElement = null;
    let minDiff = Infinity;
    const containerTop = preview.getBoundingClientRect().top;

    // 뷰포트 상단 기준선에 가장 가깝게 걸쳐 있는 요소를 스캔
    for (let i = 0; i < lines.length; i++) {
        const el = lines[i];
        const rect = el.getBoundingClientRect();
        const diff = Math.abs(rect.top - containerTop);
        
        if (diff < minDiff) {
            minDiff = diff;
            targetElement = el;
        }
    }

    if (targetElement) {
        const lineNumber = parseInt(targetElement.getAttribute('data-line'), 10);
        if (!isNaN(lineNumber)) {
            // 에디터의 해당 행 상단 절대 좌표 획득
            const lineTop = editorInstance.getTopForLineNumber(lineNumber);
            
            // 프리뷰와 에디터 간의 픽셀 오프셋 정밀 보정
            const elementRect = targetElement.getBoundingClientRect();
            const offset = elementRect.top - containerTop;
            const adjustedTop = lineTop + offset;
            
            editorInstance.setScrollTop(adjustedTop);
        }
    }
});

// 프리뷰 영역 마크다운 내부 링크 클릭 핸들러 (상대 경로 해석 보정)
preview.addEventListener('click', (e) => {
    const anchor = e.target.closest('a');
    if (!anchor) return;

    let href = anchor.getAttribute('href');
    if (!href || href.match(/^(https?|mailto|tel):/) || href.startsWith('#')) return;

    e.preventDefault();
    if (href.startsWith('/local/')) {
        const decoded = decodeURIComponent(href);
        const pathPart = decoded.split('?')[0].split('#')[0];
        const isMarkdown = pathPart.toLowerCase().endsWith('.md');
        
        if (isMarkdown) {
            window.history.pushState({}, '', href);
            loadDocument();
            return;
        }
    }
    window.location.pathname = href;
});

// 뒤로가기/앞으로가기 브라우저 탐색 이벤트 발생 시 에디터 내용 동기 로드
window.addEventListener('popstate', () => {
    loadDocument();
});

// 프리뷰 영역 단어 선택 후 F1 키다운 핸들러 및 ESC 모달 닫기
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAiChatModal();
        closeNewDocModal();
        closeTableModal();
        closeApiKeyModal();
        return;
    }

    if (e.key === 'F1') {
        // 포커스가 Monaco Editor 내부에 있으면 에디터 자체 액션이 처리하도록 제외
        if (editorInstance && editorInstance.hasTextFocus()) {
            return;
        }

        e.preventDefault();

        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        
        activeSelectedText = selectedText;

        if (aiChatModal && aiChatTitle) {
            if (selectedText) {
                aiChatTitle.textContent = `AI와의 대화 - 선택 영역: "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"`;
            } else {
                aiChatTitle.textContent = "AI와의 대화";
            }
            const captionEl = document.getElementById('ai-selected-text-caption');
            if (captionEl) {
                captionEl.value = selectedText;
            }
            if (aiChatHistory) {
                aiChatHistory.value = "";
            }
            aiChatModal.classList.add('show');
            if (aiPromptInput) {
                historyIndex = promptHistory.length;
                aiPromptInput.focus();
            }
        }
    }
});

// 파일 이름 수정 기능
fileNameInput.addEventListener('click', () => {
    fileNameInput.removeAttribute('readonly');
    fileNameInput.select();
});

fileNameInput.addEventListener('blur', () => {
    fileNameInput.setAttribute('readonly', 'true');
    saveNewFileName();
});

fileNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        fileNameInput.blur();
    } else if (e.key === 'Escape') {
        e.preventDefault();
        loadDocument();
        fileNameInput.blur();
    }
});

function saveNewFileName() {
    let currentPath = window.location.pathname.replace(/^\/local\//, '');
    currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

    const originalName = currentPath.split('/').pop();
    let newName = fileNameInput.value.trim();

    if (!newName || newName === originalName) {
        fileNameInput.value = originalName;
        return;
    }

    fetch('/api/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPath: currentPath, newName: newName })
    })
    .then(res => {
        if (!res.ok) throw new Error("Rename failed");
        return res.json();
    })
    .then(data => {
        if (data && data.newPath) {
            const normalizedPath = data.newPath.replace(/\\/g, '/');
            window.location.pathname = '/local/' + encodeURIComponent(normalizedPath);
        }
    })
    .catch(err => {
        console.error("파일명 변경 실패:", err);
        fileNameInput.value = originalName;
    });
}

// 문서 저장 함수 (에디터 변경 사항 API 전송)
function saveDocumentContent(content) {
    let currentPath = window.location.pathname.replace(/^\/local\//, '');
    currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

    fetch('/api/save', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ path: currentPath, content: content }) 
    }).catch(err => console.error("임시 저장 실패:", err));
}

// 문서 초기 로드 및 에디터 데이터 삽입
function loadDocument() {
    let currentPath = window.location.pathname.replace(/^\/local\//, '');
    currentPath = decodeURIComponent(currentPath).replace(/\\/g, '/');

    fetch('/api/load?path=' + encodeURIComponent(currentPath))
    .then(res => {
        if (!res.ok) throw new Error("File not found");
        return res.json();
    })
    .then(data => {
        if (editorInstance) {
            editorInstance.setValue(data.content);
            editorInstance.layout();
            setTimeout(() => {
                editorInstance.layout();
            }, 50);
        }
        preview.innerHTML = renderMarkdownWithLines(data.content);
        if (data.filename) {
            document.title = `StyledMD - ${data.filename}`;
            fileNameInput.value = data.filename;
        }
    }).catch(err => {
        console.error("문서 로드 실패:", err);
        if (editorInstance) {
            editorInstance.setValue("# 404 Not Found\n\n요청한 경로를 찾을 수 없다.");
        }
        preview.innerHTML = `
            <div style="text-align: center; margin-top: 50px; font-family: 'Times New Roman', Times, serif;">
                <h1 style="color: #d9383a; font-size: 36px; margin-bottom: 10px;">404 Not Found</h1>
                <p style="color: #666; margin-bottom: 20px;">요청한 경로를 찾을 수 없다.</p>
                <button onclick="history.back()" style="padding: 8px 16px; font-size: 14px; background-color: #0070c9; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">뒤로 가기</button>
            </div>
        `;
        document.title = "StyledMD - 404 Not Found";
        fileNameInput.value = "404_not_found.md";
    });
}

// ==========================================================
// AIWriter 관련 기능 바인딩 및 이벤트 처리
// ==========================================================

const aiEditor = document.getElementById('ai-editor');
const aiPreview = document.getElementById('ai-preview');


// AI 대화창 자동저장 기능 (디바운스)
let aiSaveTimeout;
function aiAutoSave() {
    if (!aiEditorInstance) return;
    clearTimeout(aiSaveTimeout);
    aiSaveTimeout = setTimeout(() => {
        localStorage.setItem('ai-buffer-content', aiEditorInstance.getValue());
    }, 500);
}


// 답변 첨부 (AI 답변 -> 좌측하단 ai-editor)
function aiAppendToAiEditor() {
    if (!aiResponseInstance || !aiEditorInstance) return;
    const cleanText = aiResponseInstance.getValue().trim();
    if (!cleanText) return;

    const currentVal = aiEditorInstance.getValue();
    const newVal = currentVal.trim() !== "" ? currentVal + "\n\n" + cleanText : cleanText;
    aiEditorInstance.setValue(newVal);
    aiAutoSave();
}

// 위로 복사해 넣기 (ai-editor 전체 텍스트 -> Monaco Editor 커서 위치)
function aiInsertToMonaco() {
    if (!editorInstance || !aiEditorInstance) return;

    // 완충 에디터의 전체 텍스트 추출
    const textToInsert = aiEditorInstance.getValue();

    if (!textToInsert.trim()) {
        alert("완충 에디터에 복사할 텍스트가 존재하지 않는다.");
        return;
    }

    const selection = editorInstance.getSelection();

    editorInstance.executeEdits("ai-editor-copy", [
        {
            range: selection,
            text: textToInsert,
            forceMoveMarkers: true
        }
    ]);
}

// AI 통합 팝업 제어 전역 변수
const aiChatModal = document.getElementById('ai-chat-modal');
const aiChatTitle = document.getElementById('ai-chat-title');
const aiSelectedTextCaption = document.getElementById('ai-selected-text-caption');
const aiChatHistory = document.getElementById('ai-chat-history');
const aiPromptInput = document.getElementById('ai-prompt-input');
const aiChatModelSelect = document.getElementById('ai-modelSelect');
const aiChatModelInfo = document.getElementById('ai-chat-model-info');
const aiChatClose = document.getElementById('ai-chat-close');
const aiChatOk = document.getElementById('ai-chat-ok');
const aiChatInsert = document.getElementById('ai-chat-insert');
const aiChatClear = document.getElementById('ai-chat-clear');

let activeSelectedText = "";
let lastMarkdownResponse = "";
let promptHistory = [];
let historyIndex = -1;

// AI 모델 설정 로드 및 드롭다운 생성
function loadAIConfig() {
    if (!aiChatModelSelect) return;

    fetch('/api/ai-config?_t=' + Date.now())
    .then(res => res.json())
    .then(config => {
            aiChatModelSelect.innerHTML = "";
            let hasAnyModel = false;

            const addGroup = (label, providerName, providerData) => {
                if (providerData && providerData.apiKey && providerData.apiKey.trim() !== "" && providerData.models && providerData.models.length > 0) {
                    const group = document.createElement('optgroup');
                    group.label = label;
                    providerData.models.forEach(model => {
                        const opt = document.createElement('option');
                        opt.value = `${providerName}|${model.name}`;
                        opt.textContent = `✨ ${model.alias}`;
                        group.appendChild(opt);
                        hasAnyModel = true;
                    });
                    aiChatModelSelect.appendChild(group);
                }
            };

            addGroup("Google API", "google", config.google);
            addGroup("Groq API", "groq", config.groq);

            if (!hasAnyModel) {
                const opt = document.createElement('option');
                opt.value = "";
                opt.textContent = "(등록된 모델이 없음)";
                aiChatModelSelect.appendChild(opt);
                
                aiChatModelSelect.value = "";
                localStorage.setItem('selected-ai-model', "");
                return;
            }

            // 2. 이전 선택값 복구 또는 최상단 모델 자동 선택
            const savedModel = localStorage.getItem('selected-ai-model');
            if (savedModel && Array.from(aiChatModelSelect.options).some(opt => opt.value === savedModel)) {
                aiChatModelSelect.value = savedModel;
            } else {
                if (aiChatModelSelect.options.length > 0) {
                    aiChatModelSelect.value = aiChatModelSelect.options[0].value;
                    localStorage.setItem('selected-ai-model', aiChatModelSelect.value);
                }
            }
        })
        .catch(err => console.error("API 설정 로드 실패:", err));
}

if (aiChatModelSelect) {
    aiChatModelSelect.addEventListener('change', () => {
        localStorage.setItem('selected-ai-model', aiChatModelSelect.value);
    });
    loadAIConfig();
}

// API 키 설정 모달 제어
const apiKeySetupBtn = document.getElementById('api-key-setup-btn');
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeyClose = document.getElementById('api-key-close');
const apiKeyCancel = document.getElementById('api-key-cancel');
const apiKeyConfirm = document.getElementById('api-key-confirm');

document.addEventListener('click', (e) => {
    if (e.target && e.target.id === 'api-key-setup-btn') {
        fetch('/api/ai-config?_t=' + Date.now())
            .then(res => res.json())
            .then(config => {
                const g = config.google || {};
                googleApiKey.value = g.apiKey || '';
                googleModel1Name.value = (g.models && g.models[0]) ? g.models[0].name : '';
                googleModel1Alias.value = (g.models && g.models[0]) ? g.models[0].alias : '';
                googleModel2Name.value = (g.models && g.models[1]) ? g.models[1].name : '';
                googleModel2Alias.value = (g.models && g.models[1]) ? g.models[1].alias : '';
                
                const gr = config.groq || {};
                groqApiKey.value = gr.apiKey || '';
                groqModel1Name.value = (gr.models && gr.models[0]) ? gr.models[0].name : '';
                groqModel1Alias.value = (gr.models && gr.models[0]) ? gr.models[0].alias : '';
                groqModel2Name.value = (gr.models && gr.models[1]) ? gr.models[1].name : '';
                groqModel2Alias.value = (gr.models && gr.models[1]) ? gr.models[1].alias : '';
                
                if (apiKeyModal) {
                    apiKeyModal.classList.add('show');
                    setTimeout(() => {
                        if (googleApiKey) googleApiKey.focus();
                    }, 50);
                }
            })
            .catch(err => console.error("설정 로드 에러:", err));
    }
});

// Google
const googleApiKey = document.getElementById('google-api-key');
const googleModel1Name = document.getElementById('google-model1-name');
const googleModel1Alias = document.getElementById('google-model1-alias');
const googleModel2Name = document.getElementById('google-model2-name');
const googleModel2Alias = document.getElementById('google-model2-alias');

// Groq
const groqApiKey = document.getElementById('groq-api-key');
const groqModel1Name = document.getElementById('groq-model1-name');
const groqModel1Alias = document.getElementById('groq-model1-alias');
const groqModel2Name = document.getElementById('groq-model2-name');
const groqModel2Alias = document.getElementById('groq-model2-alias');



function closeApiKeyModal() {
    if (apiKeyModal) {
        apiKeyModal.classList.remove('show');
    }
}

if (apiKeySetupBtn) {
    apiKeySetupBtn.addEventListener('click', () => {
        fetch('/api/ai-config?_t=' + Date.now())
            .then(res => res.json())
            .then(config => {
                const g = config.google || {};
                googleApiKey.value = g.apiKey || '';
                googleModel1Name.value = (g.models && g.models[0]) ? g.models[0].name : '';
                googleModel1Alias.value = (g.models && g.models[0]) ? g.models[0].alias : '';
                googleModel2Name.value = (g.models && g.models[1]) ? g.models[1].name : '';
                googleModel2Alias.value = (g.models && g.models[1]) ? g.models[1].alias : '';
                
                const gr = config.groq || {};
                groqApiKey.value = gr.apiKey || '';
                groqModel1Name.value = (gr.models && gr.models[0]) ? gr.models[0].name : '';
                groqModel1Alias.value = (gr.models && gr.models[0]) ? gr.models[0].alias : '';
                groqModel2Name.value = (gr.models && gr.models[1]) ? gr.models[1].name : '';
                groqModel2Alias.value = (gr.models && gr.models[1]) ? gr.models[1].alias : '';


                
                if (apiKeyModal) {
                    apiKeyModal.classList.add('show');
                    setTimeout(() => {
                        if (googleApiKey) googleApiKey.focus();
                    }, 50);
                }
            })
            .catch(err => console.error("설정 로드 에러:", err));
    });
}

if (apiKeyClose) apiKeyClose.addEventListener('click', closeApiKeyModal);
if (apiKeyCancel) apiKeyCancel.addEventListener('click', closeApiKeyModal);
if (apiKeyModal) {
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            closeApiKeyModal();
        }
    });
}

if (apiKeyConfirm) {
    apiKeyConfirm.addEventListener('click', () => {
        const buildProviderPayload = (keyInput, m1Name, m1Alias, m2Name, m2Alias) => {
            const apiKeyVal = keyInput.value.trim();
            const models = [];
            if (apiKeyVal !== "") {
                const name1 = m1Name.value.trim();
                const alias1 = m1Alias.value.trim();
                if (name1 && alias1) {
                    models.push({ name: name1, alias: alias1 });
                }
                const name2 = m2Name.value.trim();
                const alias2 = m2Alias.value.trim();
                if (name2 && alias2) {
                    models.push({ name: name2, alias: alias2 });
                }
            }
            return {
                apiKey: apiKeyVal,
                models: models
            };
        };

        const payload = {
            google: buildProviderPayload(googleApiKey, googleModel1Name, googleModel1Alias, googleModel2Name, googleModel2Alias),
            groq: buildProviderPayload(groqApiKey, groqModel1Name, groqModel1Alias, groqModel2Name, groqModel2Alias)
        };

        fetch('/api/ai-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error("저장 실패");
            closeApiKeyModal();
            loadAIConfig();
        })
        .catch(err => alert("설정 저장에 실패했다: " + err.message));
    });
}

// AI 대화 통합 모달 닫기
function closeAiChatModal() {
    if (aiChatModal) aiChatModal.classList.remove('show');
}

if (aiChatClose) aiChatClose.addEventListener('click', closeAiChatModal);
if (aiChatOk) aiChatOk.addEventListener('click', closeAiChatModal);
if (aiChatModal) {
    aiChatModal.addEventListener('click', (e) => {
        if (e.target === aiChatModal) closeAiChatModal();
    });
}

// 🧹 비우기 버튼 핸들러
if (aiChatClear) {
    aiChatClear.addEventListener('click', () => {
        if (aiChatHistory) aiChatHistory.value = "";
        lastMarkdownResponse = "";
    });
}

// 📤 본문에 삽입 버튼 핸들러
if (aiChatInsert) {
    aiChatInsert.addEventListener('click', () => {
        if (!editorInstance) return;
        const textToInsert = aiChatHistory ? aiChatHistory.value : lastMarkdownResponse;
        if (!textToInsert) return;
        const selection = editorInstance.getSelection();
        editorInstance.executeEdits("ai-chat-insert", [
            {
                range: selection,
                text: textToInsert,
                forceMoveMarkers: true
            }
        ]);
        editorInstance.focus();
        closeAiChatModal();
    });
}

// AI 질문 실행 및 답변 렌더링 함수
function executeAiRequest(instruction) {
    if (!instruction) return;

    const currentDoc = editorInstance ? editorInstance.getValue() : "";
    lastMarkdownResponse = "";
    let fullResponse = "";

    const selectedModel = aiChatModelSelect ? aiChatModelSelect.value : 'gemini-2.5-flash-lite';
    let waitingMsg = '⚡ 답변 준비중...';
    if (selectedModel === 'gemini-2.5-flash') {
        waitingMsg = '🧠 심층 분석 및 추론을 진행하고 있습니다. 잠시만 기다려 주십시오...';
    }

    const currentAnswer = aiChatHistory ? aiChatHistory.value : "";
    if (aiChatHistory) aiChatHistory.value = waitingMsg;

    fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt: instruction,
            fullContent: currentDoc,
            selectedContent: activeSelectedText,
            currentAnswer: currentAnswer,
            model: selectedModel
        })
    })
    .then(async response => {
        if (!response.ok) throw new Error('서버 응답 오류 (' + response.status + ')');
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        const data = JSON.parse(jsonStr);

                        if (data.response) {
                            fullResponse += data.response;
                            lastMarkdownResponse = fullResponse;
                            if (aiChatHistory) {
                                aiChatHistory.value = fullResponse;
                                aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
                            }
                        }

                        if (data.done && fullResponse === "") {
                            if (aiChatHistory) aiChatHistory.value = '❌ 응답 없음: API 키 또는 네트워크 오류일 수 있다.';
                        }
                    } catch (e) {
                        console.error("JSON 파싱 에러:", e, line);
                    }
                }
            }
        }
    })
    .catch(error => {
        console.error("통신 에러 발생:", error);
        if (aiChatHistory) aiChatHistory.value = `❌ 통신 에러 발생!\n${error.message}`;
    });
}

// 빠른 질문 지시 버튼 클릭 이벤트 처리
document.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('quick-prompt-btn')) {
        const promptType = e.target.getAttribute('data-prompt');
        let instruction = "";
        
        switch (promptType) {
            case '뜻':
                instruction = `다음 선택된 부분의 뜻을 설명하라.\n\n선택된 단어: "${activeSelectedText}"`;
                break;
            case '요약':
                instruction = `다음 선택된 내용을 요점만 항목별로 요약하라.\n\n선택된 내용:\n"${activeSelectedText}"`;
                break;
            case '영어로':
                instruction = `다음 선택된 내용을 영어로 번역하라.\n\n선택된 내용:\n"${activeSelectedText}"`;
                break;
            case '한글로':
                instruction = `다음 선택된 내용을 한글로 번역하라.\n\n선택된 내용:\n"${activeSelectedText}"`;
                break;
            case '개념확장':
                instruction = `다음 선택된 개념을 가르치기 위한 과정을 블릿이 붙은 제목(주제)만을 순서대로 나열하라. 부가 설명은 일절 배제하라.\n\n선택된 개념: "${activeSelectedText}"`;
                break;
            case '개념설명':
                instruction = `다음 주어진 제목(개념)을 가르치기 위한 상세히 설명하는 내용을 작성하라.\n\n제목: "${activeSelectedText}"`;
                break;
            case '전개예측':
                instruction = `다음 선택된 내용이 이후에 어떤 내용으로 전개될 것인지 예측하여 본문 컨텐츠를 확장하여 작성하라.\n\n선택된 내용:\n"${activeSelectedText}"`;
                break;
            default:
                instruction = promptType;
        }
        
        executeAiRequest(instruction);
    }
});

// 사용자 프롬프트 입력창 Enter 키 및 방향키 이벤트 처리
if (aiPromptInput) {
    aiPromptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            if (e.shiftKey) {
                // Shift+Enter는 줄바꿈을 허용함
                return;
            }
            e.preventDefault();
            const val = aiPromptInput.value.trim();
            if (val) {
                executeAiRequest(val);
                // 중복 히스토리 방지 및 히스토리 기록 추가
                if (promptHistory.length === 0 || promptHistory[promptHistory.length - 1] !== val) {
                    promptHistory.push(val);
                }
                historyIndex = promptHistory.length;
                aiPromptInput.value = '';
            }
        } else if (e.key === 'ArrowUp') {
            if (promptHistory.length > 0) {
                e.preventDefault();
                if (historyIndex > 0) {
                    historyIndex--;
                } else if (historyIndex === -1 || historyIndex === promptHistory.length) {
                    historyIndex = promptHistory.length - 1;
                }
                aiPromptInput.value = promptHistory[historyIndex];
                // 커서를 텍스트 끝으로 이동
                setTimeout(() => {
                    aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length;
                }, 0);
            }
        } else if (e.key === 'ArrowDown') {
            if (promptHistory.length > 0) {
                e.preventDefault();
                if (historyIndex >= 0 && historyIndex < promptHistory.length - 1) {
                    historyIndex++;
                    aiPromptInput.value = promptHistory[historyIndex];
                } else if (historyIndex === promptHistory.length - 1) {
                    historyIndex = promptHistory.length;
                    aiPromptInput.value = '';
                }
                // 커서를 텍스트 끝으로 이동
                setTimeout(() => {
                    aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length;
                }, 0);
            }
        }
    });
}

// AIEditor 선택 영역 지시 팝업 제어 기능은 제거됨

// ==========================================================
// Monaco Editor 로딩 대기 후 인스턴스 생성
// ==========================================================
require(['vs/editor/editor.main'], function() {
    const rootStyles = getComputedStyle(document.documentElement);
    const editorFontSize = parseInt(rootStyles.getPropertyValue('--editor-font-size')) || 16;
    const editorFontFamily = rootStyles.getPropertyValue('--code-font-family').trim().replace(/['"]/g, "") || "Fira Code, Consolas, Monaco, monospace";
    const editorLineHeightMultiplier = parseFloat(rootStyles.getPropertyValue('--editor-line-height')) || 1.5;
    const editorLineHeight = Math.round(editorFontSize * editorLineHeightMultiplier);

    editorInstance = monaco.editor.create(document.getElementById('editor'), {
        value: "",
        language: 'markdown',
        theme: 'vs',
        automaticLayout: true,
        wordWrap: 'on',
        minimap: { enabled: false },
        fontSize: editorFontSize,
        fontFamily: editorFontFamily,
        lineHeight: editorLineHeight,
        lineNumbers: 'off',
        glyphMargin: false,
        folding: false,
        lineDecorationsWidth: 12,
        lineNumbersMinChars: 0,
        readOnly: false,
        padding: { top: 10 }
    });

    // 인스턴스 생성 완료 시점 이후 명시적으로 줄번호 끄기 옵션을 재지정
    editorInstance.updateOptions({
        lineNumbers: 'off'
    });

    // Monaco Editor F1 대화 액션 등록
    editorInstance.addAction({
        id: 'ai-chat-popup',
        label: '인공지능 대화 (AI Chat)',
        keybindings: [monaco.KeyCode.F1],
        contextMenuGroupId: 'navigation',
        run: function(editor) {
            const selection = editor.getSelection();
            const model = editor.getModel();
            let selectedText = "";
            if (selection && model) {
                selectedText = model.getValueInRange(selection).trim();
            }

            activeSelectedText = selectedText;

            if (aiChatModal && aiChatTitle) {
                if (selectedText) {
                    aiChatTitle.textContent = `AI와의 대화 - 선택 영역: "${selectedText.length > 20 ? selectedText.substring(0, 20) + '...' : selectedText}"`;
                } else {
                    aiChatTitle.textContent = "AI와의 대화";
                }
                if (aiSelectedTextCaption) {
                    aiSelectedTextCaption.value = selectedText;
                }
                if (aiChatHistory) {
                    aiChatHistory.value = "";
                }
                aiChatModal.classList.add('show');
                if (aiPromptInput) {
                    historyIndex = promptHistory.length;
                    aiPromptInput.focus();
                }
            }
        }
    });

    // Monaco Editor 색변경 액션 등록
    editorInstance.addAction({
        id: 'change-color-syntax',
        label: '색변경',
        contextMenuGroupId: 'navigation',
        run: function(editor) {
            const selection = editor.getSelection();
            const model = editor.getModel();
            if (selection && model) {
                const selectedText = model.getValueInRange(selection);
                if (selectedText) {
                    const textToInsert = `[${selectedText}]{ #000000 bg: #ffffff}`;
                    editor.executeEdits("change-color-syntax", [
                        {
                            range: selection,
                            text: textToInsert,
                            forceMoveMarkers: true
                        }
                    ]);
                }
            }
        }
    });

    // 콘텐츠 변경 이벤트
    editorInstance.onDidChangeModelContent(() => {
        const currentVal = editorInstance.getValue();
        preview.innerHTML = renderMarkdownWithLines(currentVal);
        saveDocumentContent(currentVal);
    });

    // 선택 영역 강제 반전/하이라이트 유지 로직 추가
    let persistentSelectionDecos = [];
    editorInstance.onDidChangeCursorSelection((e) => {
        const selection = e.selection;
        if (!selection.isEmpty()) {
            persistentSelectionDecos = editorInstance.deltaDecorations(persistentSelectionDecos, [
                {
                    range: selection,
                    options: {
                        inlineClassName: 'custom-persistent-selection'
                    }
                }
            ]);
        }
    });

    editorInstance.onMouseDown((e) => {
        if (persistentSelectionDecos.length > 0) {
            persistentSelectionDecos = editorInstance.deltaDecorations(persistentSelectionDecos, []);
        }
    });

    // 로컬 스토리지에서 이전 read-mode 설정을 복구하여 body 클래스 및 버튼 텍스트 등을 초기 설정한다.
    const isReadModeStored = localStorage.getItem('read-mode') !== 'false';
    if (isReadModeStored) {
        document.body.classList.add('read-mode');
        if (readToggleBtn) readToggleBtn.textContent = '✍️ 편집';
    } else {
        document.body.classList.remove('read-mode');
        if (readToggleBtn) readToggleBtn.textContent = '📖 읽기';
    }

    // 에디터 로드 후 문서 채우기
    loadDocument();
});

// 화면 크기 변경 시 Monaco Editor 즉각 레이아웃 재조정
window.addEventListener('resize', () => {
    if (editorInstance) {
        editorInstance.layout();
    }
});

// 모달 드래그 기능 구현
function makeModalDraggable(modalEl) {
    const content = modalEl.querySelector('.modal-content');
    const header = modalEl.querySelector('.modal-header');
    if (!content || !header) return;

    header.style.cursor = 'move';

    // 모달이 다시 열릴 때 위치 초기화
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.attributeName === 'class') {
                if (modalEl.classList.contains('show')) {
                    content.style.position = '';
                    content.style.transform = '';
                    content.style.left = '';
                    content.style.top = '';
                    content.style.margin = '';
                }
            }
        });
    });
    observer.observe(modalEl, { attributes: true });

    header.addEventListener('mousedown', (e) => {
        // 마우스 왼쪽 버튼 클릭이고, 닫기 버튼 등이 아닐 때만 드래그 시작
        if (e.button !== 0 || e.target.classList.contains('modal-close')) return;

        e.preventDefault();

        // 현재 모달 콘텐츠의 위치 획득
        const rect = content.getBoundingClientRect();
        
        // 드래그를 위해 position을 absolute로 변경하고 transform 제거
        content.style.position = 'absolute';
        content.style.transform = 'none';
        content.style.margin = '0';
        content.style.left = rect.left + 'px';
        content.style.top = rect.top + 'px';

        const startX = e.clientX;
        const startY = e.clientY;
        const originalLeft = rect.left;
        const originalTop = rect.top;

        function onMouseMove(moveEvent) {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;

            let newLeft = originalLeft + dx;
            let newTop = originalTop + dy;

            // 브라우저 화면 경계 내로 이동 제한
            const minX = 0;
            const minY = 0;
            const maxX = window.innerWidth - rect.width;
            const maxY = window.innerHeight - rect.height;

            newLeft = Math.max(minX, Math.min(newLeft, maxX));
            newTop = Math.max(minY, Math.min(newTop, maxY));

            content.style.left = newLeft + 'px';
            content.style.top = newTop + 'px';
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// 모든 모달에 드래그 기능 적용
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.modal').forEach(makeModalDraggable);
});
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    document.querySelectorAll('.modal').forEach(makeModalDraggable);
}