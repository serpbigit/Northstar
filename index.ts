/**
 * Creates a custom menu in the Google Sheet UI when the sheet is opened..
 */
function onOpen(): void {
  try {
    SpreadsheetApp.getUi()
        .createMenu('🤖 Polaris Agent (TS)')
        .addItem('Say Hello', 'sayHello')
        .addToUi();
  } catch (e) {
    console.error('onOpen failed: Likely non-UI context or permission issue.', (e as Error).message);
  }
}

function sayHello(): void {
  SpreadsheetApp.getUi().alert('Hello from TypeScript!');
}