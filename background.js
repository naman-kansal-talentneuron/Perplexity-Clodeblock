// background.js
chrome.runtime.onInstalled.addListener(() => {
  console.log('Perplexity Code Collapser installed');
  
  // Initialize default settings
  chrome.storage.sync.get([
    'enabled',
    'collapseByDefault',
    'showLineNumbers',
    'collapseThreshold',
    'theme',
    'enabledPlatforms'
  ], (data) => {
    // Set default values for any missing settings
    const defaults = {
      enabled: true,
      collapseByDefault: true,
      showLineNumbers: false,
      collapseThreshold: 20,
      theme: 'dark',
      enabledPlatforms: {
        perplexity: true,
        gemini: true,
        chatgpt: true,
        claude: true
      }
    };
    
    const updatedSettings = {};
    
    // Only update settings that don't exist yet
    Object.keys(defaults).forEach(key => {
      if (!data.hasOwnProperty(key)) {
        updatedSettings[key] = defaults[key];
      }
    });
    
    // Save defaults if needed
    if (Object.keys(updatedSettings).length > 0) {
      chrome.storage.sync.set(updatedSettings);
    }
  });
  
  // Register commands
  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle_all_code_blocks") {
      // Send message to content script
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "toggle_all_code_blocks"});
        }
      });
    } else if (command === "copy_current_code") {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "copy_focused_code"});
        }
      });
    }
  });
});
  