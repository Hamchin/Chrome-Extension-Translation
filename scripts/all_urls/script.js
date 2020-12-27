// アイコンのURL
const ICON_URL = chrome.extension.getURL('icons/icon128.png');

// 翻訳ボタンを設置する
const setTransButton = (top, left) => {
    $('.ext-trans-btn').remove();
    const button = $('<button>', { class: 'ext-trans-btn' });
    const icon = $('<div>', { class: 'ext-trans-icon' });
    $(icon).css('background-image', `url(${ICON_URL})`);
    $(icon).appendTo(button);
    $(button).css({ top, left });
    $(button).appendTo('body');
    return $(button).get(0);
};

// 翻訳モーダルを設置する
const setTransModal = () => {
    const initialState = { maxWidth: '', maxHeight: '' };
    const modal = $('<div>', { class: 'ext-trans-modal' });
    const container = $('<div>', { class: 'ext-trans-container' });
    const closeButton = $('<div>', { class: 'ext-close-btn', text: '×' });
    $(modal).append(container);
    $(modal).draggable({
        containment: 'window',
        cancel: '.ext-trans-text',
        scroll: false
    });
    $(modal).resizable({
        handles: 'all',
        minWidth: 105,
        minHeight: 105,
        start: (e, ui) => $(modal).css({ ...ui.size, ...initialState })
    });
    $(modal).css({ maxWidth: '80vw', maxHeight: '80vh' });
    $(modal).append(closeButton);
    $(modal).appendTo('body');
    return $(modal).get(0);
};

// マウスアップイベント: ドキュメント
$(document).on('mouseup', async (e) => {
    if ($(e.target).closest('.ext-trans-btn').length > 0) return;
    if ($(e.target).closest('.ext-trans-modal').length > 0) return;
    await new Promise(resolve => setTimeout(resolve, 1));
    // 選択中のテキストを取得する
    const selection = window.getSelection();
    if (selection.toString().trim() === '') return;
    // 翻訳ボタンを設置する
    const selectionRects = selection.getRangeAt(0).getClientRects();
    if (selectionRects.length === 0) return;
    const lastRect = selectionRects[selectionRects.length - 1];
    const top = window.pageYOffset + lastRect.y + lastRect.height;
    const left = window.pageXOffset + lastRect.x + lastRect.width;
    setTransButton(top, left);
});

// マウスダウンイベント: ドキュメント
$(document).on('mousedown', (e) => {
    const btnSelector = '.ext-trans-btn';
    // 翻訳ボタンの場合 -> テキストを保持する
    if ($(e.target).closest(btnSelector).length > 0) {
        const text = window.getSelection().toString();
        $(btnSelector).data('text', text);
    }
    // 翻訳ボタン外の場合 -> ボタンを削除する
    else {
        $(btnSelector).remove();
    }
});

// クリックイベント: 翻訳ボタン
$(document).on('click', '.ext-trans-btn', (e) => {
    // テキストを取得および分割する
    const text = $(e.currentTarget).data('text') || '';
    const texts = text.split('\n').map(s => s.trim()).filter(s => s);
    e.currentTarget.remove();
    // メッセージを送信する
    if (texts.length === 0) return;
    parent.postMessage({ type: 'TRANSLATE', texts: texts }, '*');
});

// メッセージイベント -> テキストを翻訳する
window.addEventListener('message', (event) => {
    const { type, texts } = event.data;
    if (type !== 'TRANSLATE') return;
    // 翻訳モーダルを取得または生成する
    const modal = document.querySelector('.ext-trans-modal') || setTransModal();
    const container = modal.querySelector('.ext-trans-container');
    // 各テキストを翻訳する
    const scrollTop = { firstItem: 0, lastTime: 0 };
    texts.forEach((text, index) => {
        // テンプレートを生成する
        const item = $('<div>', { class: 'ext-trans-item' });
        const source = $('<p>', { class: 'ext-trans-text', text: text });
        const target = $('<p>', { class: 'ext-trans-text', text: '...' });
        const load = $('<div>', { class: 'ext-trans-load' });
        const line = $('<hr>');
        $(item).append(source).append(line).append(target).append(load);
        $(item).appendTo(container);
        // 最初のアイテムにスクロールを合わせる
        if (index === 0) scrollTop.firstItem = container.scrollTop + $(item).position().top;
        container.scrollTop = scrollTop.firstItem;
        scrollTop.lastTime = container.scrollTop;
        // 翻訳結果を反映する
        const setResult = (response) => {
            if (response === null) return false;
            $(source).text(response.source);
            $(target).text(response.target);
            return true;
        };
        // 最初のアイテムにスクロールを合わせる
        const setScroll = () => {
            if (container.scrollTop !== scrollTop.lastTime) return false;
            container.scrollTop = scrollTop.firstItem;
            scrollTop.lastTime = container.scrollTop;
            return true;
        };
        // テキストをGoogle翻訳する
        (async (type) => {
            const response = await translator.translateText(text, type);
            if ($(item).find('.ext-trans-load').length === 0) return;
            setResult(response) && setScroll();
        })('GOOGLE_TRANSLATE');
        // テキストをDeepL翻訳する
        (async (type) => {
            const response = await translator.translateText(text, type);
            setResult(response) && setScroll();
            $(item).find('.ext-trans-load').remove();
        })('DEEPL_TRANSLATE');
    });
});

// クリックイベント: 閉じるボタン -> 翻訳モーダルを削除する
$(document).on('click', '.ext-close-btn', (e) => {
    $(e.currentTarget).closest('.ext-trans-modal').remove();
});
