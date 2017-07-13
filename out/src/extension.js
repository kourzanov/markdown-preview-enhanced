"use strict";
/// <reference types="atom-typings" />
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const atom_1 = require("atom");
const mume = require("@shd101wyy/mume");
const utility = mume.utility;
const config_1 = require("./config");
const content_provider_1 = require("./content-provider");
let subscriptions = null;
let config = null;
/**
 * Key is editor.getPath()
 * Value is MarkdownPreviewEnhancedView object
 */
let previewsMap = {};
/**
 * Check if the `filePath` is a markdown file.
 * @param filePath
 */
function isMarkdownFile(filePath = '') {
    const ext = path.extname(filePath);
    for (let i = 0; i < config.fileExtension.length; i++) {
        if (config.fileExtension[i] === ext) {
            return true;
        }
    }
    return false;
}
/**
 * This function will be called when `config` is changed.
 * @param config
 */
function onDidChangeConfig() {
    for (let sourceUri in previewsMap) {
        const preview = previewsMap[sourceUri];
        preview.updateConfiguration();
        preview.loadPreview();
    }
}
/**
 * As the function name pointed...
 */
function getSinglePreview() {
    return previewsMap[Object.keys(previewsMap)[0]];
}
/**
 * Return the preview object for editor(editorFilePath).
 * @param editor
 */
function getPreviewForEditor(editor) {
    if (config.singlePreview) {
        return getSinglePreview();
    }
    else if (typeof (editor) === 'string') {
        return previewsMap[editor];
    }
    else if (editor instanceof content_provider_1.MarkdownPreviewEnhancedView) {
        return editor;
    }
    else if (editor && editor.getPath) {
        return previewsMap[editor.getPath()];
    }
    else {
        return null;
    }
}
/**
 * Toggle markdown preview
 */
function togglePreview() {
    const editor = atom.workspace.getActivePaneItem();
    const preview = getPreviewForEditor(editor);
    if (preview && preview['isOnDom'] && preview['isOnDom']()) {
        const pane = atom.workspace.paneForItem(preview);
        pane.destroyItem(preview); // this will trigger preview.destroy()
        removePreviewFromMap(preview);
    }
    else {
        startPreview(editor);
    }
}
/**
 * Remove preview from `previewsMap`
 * @param preview
 */
function removePreviewFromMap(preview) {
    for (let key in previewsMap) {
        if (previewsMap[key] === preview)
            delete previewsMap[key];
    }
}
/**
 * Start preview for editor
 * @param editor
 */
function startPreview(editor) {
    if (!(isMarkdownFile(editor.getPath())))
        return;
    let preview = getPreviewForEditor(editor);
    if (!preview) {
        if (config.singlePreview) {
            preview = new content_provider_1.MarkdownPreviewEnhancedView('mpe://single_preview', config);
            previewsMap['single_preview'] = preview;
        }
        else {
            preview = new content_provider_1.MarkdownPreviewEnhancedView('mpe://' + editor.getPath(), config);
            previewsMap[editor.getPath()] = preview;
        }
    }
    if (preview.getEditor() !== editor) {
        preview.bindEditor(editor);
    }
}
/**
 * Receive message from MarkdownPreviewEnhancedView iframe
 */
function initMessageReceiver() {
    window.addEventListener('message', (event) => {
        // console.log('receive message: ')
        // console.log(event)
        if (event.origin !== 'file://')
            return;
        const data = event.data;
        if (typeof (data) !== 'object' || !('command' in data))
            return;
        const command = data['command'], args = data['args'];
        if (command in MESSAGE_DISPATCH_EVENTS) {
            MESSAGE_DISPATCH_EVENTS[command].apply(null, args);
        }
    }, false);
}
/**
 * Messages Events
 */
const MESSAGE_DISPATCH_EVENTS = {
    'webviewFinishLoading': function (sourceUri) {
        const preview = getPreviewForEditor(sourceUri);
        if (preview)
            preview.renderMarkdown();
    },
    'refreshPreview': function (sourceUri) {
        const preview = getPreviewForEditor(sourceUri);
        if (preview)
            preview.refreshPreview();
    }
};
function activate(state) {
    mume.init() // init mume package
        .then(() => {
        subscriptions = new atom_1.CompositeDisposable();
        // Init config
        config = new config_1.MarkdownPreviewEnhancedConfig();
        config.onDidChange(subscriptions, onDidChangeConfig);
        mume.onDidChangeConfigFile(onDidChangeConfig);
        // Set opener
        subscriptions.add(atom.workspace.addOpener((uri) => {
            if (uri.startsWith('mpe://')) {
                if (config.singlePreview) {
                    return getSinglePreview();
                }
                else {
                    return previewsMap[uri.replace('mpe://', '')];
                }
            }
        }));
        // Register commands
        subscriptions.add(atom.commands.add('atom-workspace', {
            'markdown-preview-enhanced:toggle': togglePreview,
            'markdown-preview-enhanced:customize-css': customizeCSS,
            'markdown-preview-enhanced:create-toc': createTOC,
            'markdown-preview-enhanced:toggle-scroll-sync': toggleScrollSync,
            'markdown-preview-enhanced:toggle-live-update': toggleLiveUpdate,
            'markdown-preview-enhanced:toggle-break-on-single-newline': toggleBreakOnSingleNewLine,
            'markdown-preview-enhanced:insert-table': insertTable,
            'markdown-preview-enhanced:image-helper': startImageHelper,
            'markdown-preview-enhanced:open-mermaid-config': openMermaidConfig,
            'markdown-preview-enhanced:open-phantomjs-config': openPhantomJSConfig,
            'markdown-preview-enhanced:open-mathjax-config': openMathJaxConfig,
            'markdown-preview-enhanced:extend-parser': extendParser,
            'markdown-preview-enhanced:insert-new-slide': insertNewSlide,
            'markdown-preview-enhanced:insert-page-break': insertPageBreak,
            'markdown-preview-enhanced:toggle-zen-mode': toggleZenMode,
            'markdown-preview-enhanced:run-code-chunk': runCodeChunkCommand,
            'markdown-preview-enhanced:run-all-code-chunks': runAllCodeChunks,
            'markdown-preview-enhanced:show-uploaded-images': showUploadedImages,
            'markdown-preview-enhanced:open-welcome-page': () => atom.workspace.open(path.resolve(__dirname, '../../docs/welcome.md'))
        }));
        // Register message event
        initMessageReceiver();
    });
}
exports.activate = activate;
/**
 * Open ~/.mume/style.less
 */
function customizeCSS() {
    const globalStyleLessFile = path.resolve(utility.extensionConfigDirectoryPath, './style.less');
    atom.workspace.open(globalStyleLessFile);
}
function createTOC() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.buffer)
        editor.insertText('\n<!-- @import "[TOC]" {cmd:"toc", depthFrom:1, depthTo:6, orderedList:false} -->\n');
}
function toggleScrollSync() {
    const flag = atom.config.get('markdown-preview-enhanced.scrollSync');
    atom.config.set('markdown-preview-enhanced.scrollSync', !flag);
    if (!flag)
        atom.notifications.addInfo('Scroll Sync enabled');
    else
        atom.notifications.addInfo('Scroll Sync disabled');
}
function toggleLiveUpdate() {
    const flag = atom.config.get('markdown-preview-enhanced.liveUpdate');
    atom.config.set('markdown-preview-enhanced.liveUpdate', !flag);
    if (!flag)
        atom.notifications.addInfo('Live Update enabled');
    else
        atom.notifications.addInfo('Live Update disabled');
}
function toggleBreakOnSingleNewLine() {
    const flag = atom.config.get('markdown-preview-enhanced.breakOnSingleNewLine');
    atom.config.set('markdown-preview-enhanced.breakOnSingleNewLine', !flag);
    if (!flag)
        atom.notifications.addInfo('Enabled breaking on single newline');
    else
        atom.notifications.addInfo('Disabled breaking on single newline');
}
function insertTable() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.buffer)
        editor.insertText(`|   |   |
|---|---|
|   |   |
`);
}
function startImageHelper() {
    const editor = atom.workspace.getActiveTextEditor();
    const preview = getPreviewForEditor(editor);
    if (!preview) {
        atom.notifications.addError('Please open preview first.');
    }
    else {
        preview.startImageHelper();
    }
}
function openMermaidConfig() {
    const mermaidConfigFilePath = path.resolve(utility.extensionConfigDirectoryPath, './mermaid_config.js');
    atom.workspace.open(mermaidConfigFilePath);
}
function openPhantomJSConfig() {
    const phantomjsConfigFilePath = path.resolve(utility.extensionConfigDirectoryPath, './phantomjs_config.js');
    atom.workspace.open(phantomjsConfigFilePath);
}
function openMathJaxConfig() {
    const mathjaxConfigFilePath = path.resolve(utility.extensionConfigDirectoryPath, './mathjax_config.js');
    atom.workspace.open(mathjaxConfigFilePath);
}
function extendParser() {
    const parserConfigPath = path.resolve(utility.extensionConfigDirectoryPath, './parser.js');
    atom.workspace.open(parserConfigPath);
}
function insertNewSlide() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.buffer)
        editor.insertText('<!-- slide -->\n');
}
function insertPageBreak() {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor && editor.buffer)
        editor.insertText('<!-- pagebreak -->\n');
}
function toggleZenMode() {
    const enableZenMode = atom.config.get('markdown-preview-enhanced.enableZenMode');
    atom.config.set('markdown-preview-enhanced.enableZenMode', !enableZenMode);
    if (!enableZenMode)
        atom.notifications.addInfo('zen mode enabled');
    else
        atom.notifications.addInfo('zen mode disabled');
}
function runCodeChunkCommand() {
    const editor = atom.workspace.getActiveTextEditor();
    const preview = getPreviewForEditor(editor);
    if (!preview) {
        atom.notifications.addError('Please open preview first.');
    }
    else {
        preview.sendRunCodeChunkCommand();
    }
}
function runAllCodeChunks() {
    const editor = atom.workspace.getActiveTextEditor();
    const preview = getPreviewForEditor(editor);
    if (!preview) {
        atom.notifications.addError('Please open preview first.');
    }
    else {
        preview.runAllCodeChunks();
    }
}
function showUploadedImages() {
    const imageHistoryFilePath = path.resolve(utility.extensionConfigDirectoryPath, './image_history.md');
    atom.workspace.open(imageHistoryFilePath);
}
function deactivate() {
    subscriptions.dispose();
}
exports.deactivate = deactivate;
var config_schema_1 = require("./config-schema");
exports.config = config_schema_1.configSchema;