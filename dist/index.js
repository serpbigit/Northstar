"use strict";
/**
 * Creates a custom menu in the Google Sheet UI when the sheet is opened..
 */
function onOpen() {
    try {
        SpreadsheetApp.getUi()
            .createMenu('🤖 Polaris Agent (TS)')
            .addItem('Say Hello', 'sayHello')
            .addToUi();
    }
    catch (e) {
        console.error('onOpen failed: Likely non-UI context or permission issue.', e.message);
    }
}
function sayHello() {
    SpreadsheetApp.getUi().alert('Hello from TypeScript!');
}
