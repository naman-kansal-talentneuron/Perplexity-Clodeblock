document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('extension-toggle');
    const collapseToggle = document.getElementById('collapse-toggle');
    const lineNumbersToggle = document.getElementById('line-numbers-toggle');
    const collapseThreshold = document.getElementById('collapse-threshold');
    const thresholdValue = document.getElementById('threshold-value');
    const themeSelect = document.getElementById('theme-select');
    const resetButton = document.getElementById('reset-settings');
    
    // Platform toggles
    const perplexityToggle = document.getElementById('perplexity-toggle');
    const geminiToggle = document.getElementById('gemini-toggle');
    const chatgptToggle = document.getElementById('chatgpt-toggle');
    const claudeToggle = document.getElementById('claude-toggle');
    
    // Update threshold display value
    collapseThreshold.addEventListener('input', function() {
      thresholdValue.textContent = this.value + ' lines';
    });
    
    // Get current settings
    chrome.storage.sync.get([
      'enabled', 
      'collapseByDefault', 
      'showLineNumbers', 
      'collapseThreshold',
      'theme',
      'enabledPlatforms'
    ], function(data) {
      // Handle extension enabled/disabled state
      if (data.hasOwnProperty('enabled')) {
        toggle.checked = data.enabled;
      } else {
        // Default to enabled if not set
        chrome.storage.sync.set({enabled: true});
        toggle.checked = true;
      }
      
      // Handle collapse by default setting
      if (data.hasOwnProperty('collapseByDefault')) {
        collapseToggle.checked = data.collapseByDefault;
      } else {
        // Default to collapsed if not set
        chrome.storage.sync.set({collapseByDefault: true});
        collapseToggle.checked = true;
      }
      
      // Handle line numbers setting
      if (data.hasOwnProperty('showLineNumbers')) {
        lineNumbersToggle.checked = data.showLineNumbers;
      } else {
        // Default to off
        chrome.storage.sync.set({showLineNumbers: false});
        lineNumbersToggle.checked = false;
      }
      
      // Handle collapse threshold
      if (data.hasOwnProperty('collapseThreshold')) {
        collapseThreshold.value = data.collapseThreshold;
        thresholdValue.textContent = data.collapseThreshold + ' lines';
      } else {
        // Default to 20
        chrome.storage.sync.set({collapseThreshold: 20});
        collapseThreshold.value = 20;
        thresholdValue.textContent = '20 lines';
      }
      
      // Handle theme selection
      if (data.hasOwnProperty('theme')) {
        themeSelect.value = data.theme;
      } else {
        // Default to dark
        chrome.storage.sync.set({theme: 'dark'});
        themeSelect.value = 'dark';
      }
      
      // Handle enabled platforms
      if (data.hasOwnProperty('enabledPlatforms')) {
        const platforms = data.enabledPlatforms;
        perplexityToggle.checked = platforms.perplexity;
        geminiToggle.checked = platforms.gemini;
        chatgptToggle.checked = platforms.chatgpt;
        claudeToggle.checked = platforms.claude;
      } else {
        // Default to all enabled
        const defaultPlatforms = {
          perplexity: true,
          gemini: true,
          chatgpt: true,
          claude: true
        };
        chrome.storage.sync.set({enabledPlatforms: defaultPlatforms});
        perplexityToggle.checked = true;
        geminiToggle.checked = true;
        chatgptToggle.checked = true;
        claudeToggle.checked = true;
      }
    });
    
    // Handle toggle changes
    toggle.addEventListener('change', function() {
      chrome.storage.sync.set({enabled: this.checked});
    });
    
    // Handle collapse toggle changes
    collapseToggle.addEventListener('change', function() {
      chrome.storage.sync.set({collapseByDefault: this.checked});
    });
    
    // Handle line numbers toggle
    lineNumbersToggle.addEventListener('change', function() {
      chrome.storage.sync.set({showLineNumbers: this.checked});
    });
    
    // Handle threshold changes
    collapseThreshold.addEventListener('change', function() {
      chrome.storage.sync.set({collapseThreshold: parseInt(this.value)});
    });
    
    // Handle theme changes
    themeSelect.addEventListener('change', function() {
      chrome.storage.sync.set({theme: this.value});
    });
    
    // Handle platform toggles
    function updatePlatforms() {
      const platforms = {
        perplexity: perplexityToggle.checked,
        gemini: geminiToggle.checked,
        chatgpt: chatgptToggle.checked,
        claude: claudeToggle.checked
      };
      chrome.storage.sync.set({enabledPlatforms: platforms});
    }
    
    perplexityToggle.addEventListener('change', updatePlatforms);
    geminiToggle.addEventListener('change', updatePlatforms);
    chatgptToggle.addEventListener('change', updatePlatforms);
    claudeToggle.addEventListener('change', updatePlatforms);
    
    // Reset settings
    resetButton.addEventListener('click', function() {
      // Default settings
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
      
      chrome.storage.sync.set(defaults, function() {
        // Update UI to reflect defaults
        toggle.checked = defaults.enabled;
        collapseToggle.checked = defaults.collapseByDefault;
        lineNumbersToggle.checked = defaults.showLineNumbers;
        collapseThreshold.value = defaults.collapseThreshold;
        thresholdValue.textContent = defaults.collapseThreshold + ' lines';
        themeSelect.value = defaults.theme;
        perplexityToggle.checked = defaults.enabledPlatforms.perplexity;
        geminiToggle.checked = defaults.enabledPlatforms.gemini;
        chatgptToggle.checked = defaults.enabledPlatforms.chatgpt;
        claudeToggle.checked = defaults.enabledPlatforms.claude;
      });
    });
});
