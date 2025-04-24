document.addEventListener('DOMContentLoaded', function() {
    const toggle = document.getElementById('extension-toggle');
    const collapseToggle = document.getElementById('collapse-toggle');
    
    // Get current settings
    chrome.storage.sync.get(['enabled', 'collapseByDefault'], function(data) {
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
    });
    
    // Handle toggle changes
    toggle.addEventListener('change', function() {
      chrome.storage.sync.set({enabled: this.checked});
    });
    
    // Handle collapse toggle changes
    collapseToggle.addEventListener('change', function() {
      chrome.storage.sync.set({collapseByDefault: this.checked});
    });
});
