// TODO: Sprint 2.1 - Service worker for orchestration and keyboard shortcut handling

chrome.commands.onCommand.addListener((command) => {
  if (command === "capture-current-page") {
    // TODO: Capture current tab and process
    console.log("2Vault: Capture shortcut triggered");
  }
});

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
  if (message.type === "EXTRACTED_CONTENT") {
    // TODO: Handle extracted content from content scripts
    console.log("2Vault: Received extracted content", message.data);
  }
});
