// Store extension state
let extensionEnabled = true;
let collapseByDefault = true; // Changed from false to true

// Check for extension enabled state
chrome.storage.sync.get(['enabled', 'collapseByDefault'], (data) => {
  if (data.hasOwnProperty('enabled')) {
    extensionEnabled = data.enabled;
  }
  
  if (data.hasOwnProperty('collapseByDefault')) {
    collapseByDefault = data.collapseByDefault;
  }
  
  if (extensionEnabled) {
    startObserver();
  }
});

// Listen for changes to extension state
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    extensionEnabled = changes.enabled.newValue;
    
    if (extensionEnabled) {
      startObserver();
    } else {
      // Restore all collapsed code blocks
      document.querySelectorAll('.plx-code-block-wrapper').forEach(wrapper => {
        const codeBlock = wrapper.querySelector('pre');
        const lineInfo = wrapper.querySelector('.plx-line-info');
        
        if (codeBlock) codeBlock.style.display = 'block';
        if (lineInfo) lineInfo.style.display = 'none';
      });
      
      // Restore language tag colors
      document.querySelectorAll('.plx-lang-tag').forEach(tag => {
        tag.classList.remove('plx-collapsed');
      });
      
      if (observer) {
        observer.disconnect();
      }
    }
  }
  
  if (changes.collapseByDefault) {
    collapseByDefault = changes.collapseByDefault.newValue;
  }
});

// Function to process code blocks
function processCodeBlocks() {
  if (!extensionEnabled) return;
  
  // Get settings
  chrome.storage.sync.get(['showLineNumbers', 'collapseThreshold', 'theme', 'enabledPlatforms'], (data) => {
    // Apply theme to all wrapped code blocks
    const wrappers = document.querySelectorAll('.plx-code-block-wrapper');
    if (data.theme === 'light') {
      wrappers.forEach(wrapper => wrapper.classList.add('plx-theme-light'));
    } else {
      wrappers.forEach(wrapper => wrapper.classList.remove('plx-theme-light'));
    }
    
    // Detect which platform we're on
    const hostname = window.location.hostname;
    const isGemini = hostname.includes('gemini.google.com');
    const isChatGPT = hostname.includes('chat.openai.com');
    const isClaude = hostname.includes('claude.ai');
    
    // Check if current platform is enabled
    const platforms = data.enabledPlatforms || {
      perplexity: true,
      gemini: true,
      chatgpt: true,
      claude: true
    };
    
    let shouldProcess = false;
    
    if (isGemini && platforms.gemini) {
      shouldProcess = true;
      processGeminiCodeBlocks(data);
    } else if (isChatGPT && platforms.chatgpt) {
      shouldProcess = true;
      processChatGPTCodeBlocks(data);
    } else if (isClaude && platforms.claude) {
      shouldProcess = true;
      processClaudeCodeBlocks(data);
    } else if (!isGemini && !isChatGPT && !isClaude && platforms.perplexity) {
      shouldProcess = true;
      processPerplexityCodeBlocks(data);
    }
  });
}

// Function to add line numbers to a code block
function addLineNumbers(codeBlock, showLineNumbers) {
  if (!showLineNumbers) return;
  
  // Check if already has line numbers
  if (codeBlock.parentNode.querySelector('.plx-line-numbers')) return;
  
  // Get the code content
  const code = codeBlock.textContent;
  const lines = code.split('\n');
  
  // Create line numbers element
  const lineNumbers = document.createElement('div');
  lineNumbers.className = 'plx-line-numbers';
  
  // Add line numbers
  for (let i = 1; i <= lines.length; i++) {
    const lineNum = document.createElement('div');
    lineNum.textContent = i;
    lineNumbers.appendChild(lineNum);
  }
  
  // Add to parent wrapper
  codeBlock.parentNode.classList.add('plx-line-numbers-enabled');
  codeBlock.parentNode.appendChild(lineNumbers);
  
  // Show line numbers if not collapsed
  if (!codeBlock.style.display || codeBlock.style.display !== 'none') {
    lineNumbers.style.display = 'block';
  }
}

// Function to add context menu to code blocks
function addContextMenu(codeBlock, actionBar, langTag) {
  // Create the more actions button
  const actionsButton = document.createElement('button');
  actionsButton.className = 'plx-actions-button';
  actionsButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="6" r="2" fill="currentColor"/>
    <circle cx="12" cy="12" r="2" fill="currentColor"/>
    <circle cx="12" cy="18" r="2" fill="currentColor"/>
  </svg>`;
  actionsButton.title = "More actions";
  
  // Create menu
  const menu = document.createElement('div');
  menu.className = 'plx-actions-menu';
  
  // Add menu items
  const menuItems = [
    {
      label: 'Format code',
      action: () => formatCode(codeBlock),
      key: 'Alt+F'
    },
    {
      label: 'Toggle line numbers',
      action: () => toggleLineNumbers(codeBlock),
      key: 'Alt+L'
    },
    {
      label: 'Select all',
      action: () => selectCode(codeBlock),
      key: 'Ctrl+A'
    }
  ];
  
  menuItems.forEach(item => {
    const menuItem = document.createElement('div');
    menuItem.className = 'plx-actions-menu-item';
    menuItem.textContent = item.label;
    
    // Add keyboard shortcut display
    if (item.key) {
      const kbd = document.createElement('span');
      kbd.className = 'plx-keybinding';
      kbd.textContent = item.key;
      menuItem.appendChild(kbd);
    }
    
    menuItem.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      item.action();
      menu.style.display = 'none';
    });
    
    menu.appendChild(menuItem);
  });
  
  // Add button and menu to action bar
  actionBar.appendChild(actionsButton);
  actionBar.parentNode.appendChild(menu);
  
  // Toggle menu display on button click
  actionsButton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (menu.style.display === 'block') {
      menu.style.display = 'none';
    } else {
      // Position menu below button
      const rect = actionsButton.getBoundingClientRect();
      menu.style.top = rect.bottom + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
      menu.style.display = 'block';
      
      // Close menu when clicking elsewhere
      const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== actionsButton) {
          menu.style.display = 'none';
          document.removeEventListener('click', closeMenu);
        }
      };
      
      setTimeout(() => {
        document.addEventListener('click', closeMenu);
      }, 0);
    }
  });
}

// Format code function
function formatCode(codeBlock) {
  try {
    // Try to detect language
    const langTag = codeBlock.parentNode.querySelector('.plx-lang-tag');
    const lang = langTag ? langTag.textContent.toLowerCase() : '';
    
    const code = codeBlock.textContent;
    let formatted = code;
    
    // Simple formatter for common languages
    if (lang.includes('javascript') || lang.includes('js') || 
        lang.includes('typescript') || lang.includes('ts')) {
      // Simple JS/TS formatter
      formatted = formatJavaScript(code);
    } else if (lang.includes('html')) {
      // Simple HTML formatter
      formatted = formatHTML(code);
    } else if (lang.includes('css')) {
      // Simple CSS formatter
      formatted = formatCSS(code);
    } else if (lang.includes('json')) {
      // JSON formatter using built-in JSON methods
      try {
        const obj = JSON.parse(code);
        formatted = JSON.stringify(obj, null, 2);
      } catch (e) {
        // If not valid JSON, do nothing
        console.log('Invalid JSON, cannot format');
      }
    }
    
    // Update code content if formatting was successful
    if (formatted !== code) {
      // For element that directly contains the text
      if (codeBlock.firstChild && codeBlock.firstChild.nodeType === Node.TEXT_NODE) {
        codeBlock.textContent = formatted;
      } 
      // For blocks with nested code element
      else if (codeBlock.querySelector('code')) {
        codeBlock.querySelector('code').textContent = formatted;
      }
      
      // Show floating notification
      showCopyMessage(codeBlock, 'Code formatted');
    } else {
      showCopyMessage(codeBlock, 'Cannot format this language');
    }
  } catch (e) {
    console.error('Error formatting code:', e);
  }
}

// Simple JavaScript formatter
function formatJavaScript(code) {
  // Very basic JS formatting
  let indentLevel = 0;
  const lines = code.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Decrease indent for closing brackets at start of line
    if (line.startsWith('}') || line.startsWith(')') || line.startsWith(']')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add indent
    if (line.length > 0) {
      result.push('  '.repeat(indentLevel) + line);
    } else {
      result.push('');
    }
    
    // Increase indent for opening brackets at end of line
    if (line.endsWith('{') || line.endsWith('(') || line.endsWith('[')) {
      indentLevel++;
    }
    
    // Decrease indent after line with closing bracket
    if (line.endsWith('}') || line.endsWith(')') || line.endsWith(']')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
  }
  
  return result.join('\n');
}

// Simple HTML formatter
function formatHTML(code) {
  // Very basic HTML formatting
  let indentLevel = 0;
  const lines = code.split('\n');
  const result = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    
    // Decrease indent for closing tags
    if (line.startsWith('</')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    // Add indent
    if (line.length > 0) {
      result.push('  '.repeat(indentLevel) + line);
    } else {
      result.push('');
    }
    
    // Increase indent for opening tags that aren't self-closing
    if (line.includes('<') && !line.includes('</') && !line.endsWith('/>')) {
      indentLevel++;
    }
  }
  
  return result.join('\n');
}

// Simple CSS formatter
function formatCSS(code) {
  // Very basic CSS formatting
  const result = [];
  let inBlock = false;
  
  // Split by CSS rule blocks
  const parts = code.split('{');
  
  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      result.push(parts[i].trim() + ' {');
      continue;
    }
    
    const subparts = parts[i].split('}');
    
    if (subparts.length > 1) {
      // Format properties
      const properties = subparts[0].split(';');
      result.push('  ' + properties.map(p => p.trim()).filter(p => p).join(';\n  ') + ';');
      result.push('}');
      
      if (subparts[1].trim()) {
        result.push(subparts[1].trim() + ' {');
      }
    }
  }
  
  return result.join('\n');
}

// Toggle line numbers function
function toggleLineNumbers(codeBlock) {
  const wrapper = codeBlock.parentNode;
  const lineNumbers = wrapper.querySelector('.plx-line-numbers');
  
  if (!lineNumbers) {
    // Create line numbers
    chrome.storage.sync.set({showLineNumbers: true}, () => {
      addLineNumbers(codeBlock, true);
    });
  } else {
    // Toggle visibility
    if (lineNumbers.style.display === 'none') {
      lineNumbers.style.display = 'block';
      wrapper.classList.add('plx-line-numbers-enabled');
      chrome.storage.sync.set({showLineNumbers: true});
    } else {
      lineNumbers.style.display = 'none';
      wrapper.classList.remove('plx-line-numbers-enabled');
      chrome.storage.sync.set({showLineNumbers: false});
    }
  }
}

// Select all code function
function selectCode(codeBlock) {
  // Create a range and selection
  const range = document.createRange();
  const selection = window.getSelection();
  
  // Select the code block content
  range.selectNodeContents(codeBlock);
  selection.removeAllRanges();
  selection.addRange(range);
  
  // Show floating notification
  showCopyMessage(codeBlock, 'Code selected');
}

// Show copy message as a floating notification
function showCopyMessage(codeBlock, message) {
  // Create or get the floating notification container
  let floatingContainer = document.getElementById('plx-floating-notifications');
  
  if (!floatingContainer) {
    // Create container for floating notifications if it doesn't exist
    floatingContainer = document.createElement('div');
    floatingContainer.id = 'plx-floating-notifications';
    floatingContainer.className = 'plx-floating-container';
    document.body.appendChild(floatingContainer);
  }
  
  // Create a new notification element
  const notification = document.createElement('div');
  notification.className = 'plx-floating-notification';
  
  // Add icon based on the message type
  let icon = '';
  if (message.includes('Copied') || message.includes('Selected')) {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  } else if (message.includes('Format')) {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7h16M4 12h12M4 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  } else {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
      <path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  
  // Set content with icon
  notification.innerHTML = `
    <div class="plx-notification-icon">${icon}</div>
    <div class="plx-notification-message">${message}</div>
  `;
  
  // Add to container
  floatingContainer.appendChild(notification);
  
  // Trigger entrance animation
  setTimeout(() => {
    notification.classList.add('plx-show');
  }, 10);
  
  // Remove after delay
  setTimeout(() => {
    notification.classList.remove('plx-show');
    notification.classList.add('plx-hide');
    
    // Remove from DOM after exit animation
    setTimeout(() => {
      if (notification && notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      
      // If this was the last notification, remove the container too
      if (floatingContainer && floatingContainer.children.length === 0) {
        floatingContainer.parentNode.removeChild(floatingContainer);
      }
    }, 300); // Matches the CSS transition duration
  }, 2000);
}

// Update the original ChatGPT processing function
function processChatGPTCodeBlocks(settings) {
  // Find all code blocks in ChatGPT
  const codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach((codeBlock) => {
    // Skip already processed code blocks
    if (codeBlock.hasAttribute('data-plx-processed')) {
      return;
    }
    
    // Mark as processed to avoid duplication
    codeBlock.setAttribute('data-plx-processed', 'true');
    
    // Find the language tag in ChatGPT's code block
    let langTag = codeBlock.querySelector('.flex.items-center.relative.text-gray-200');
    let langText = 'Code';
    
    if (langTag) {
      // Extract the language name from the tag
      langText = langTag.textContent.trim();
      // Hide the original tag
      langTag.style.display = 'none';
    } else {
      // Create a new language tag if none exists
      langTag = document.createElement('div');
      langTag.className = 'plx-lang-tag';
      langTag.textContent = langText;
    }
    
    // Create our custom language tag
    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;
    
    // Find the code element and count lines
    const codeElement = codeBlock.querySelector('code');
    const lineCount = codeElement ? codeElement.textContent.split('\n').length : 0;
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    
    // Create line info element
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    
    // Create action bar for language tag and buttons
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    
    // Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    copyButton.title = "Copy code";
    
    // Insert wrapper and rearrange elements
    codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    
    // Add both lang tag and copy button to action bar
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    
    // Add action bar, code block and line info to wrapper
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock);
    wrapper.appendChild(lineInfo);
    
    // Style adjustments
    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0';
    
    // Create inline collapsed view
    const collapsedInfo = createInlineCollapsedView(actionBar, customLangTag, lineCount);
    
    // Add copy functionality
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(codeBlock.textContent).then(() => {
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        setTimeout(() => {
          copyButton.innerHTML = originalHTML;
        }, 1500);
      });
    });
    
    // Apply collapse by default if enabled
    if (collapseByDefault) {
      customLangTag.classList.add('plx-collapsed');
      codeBlock.style.display = 'none';
      lineInfo.style.display = 'flex';
      collapsedInfo.style.display = 'flex'; // Show inline info
    } else {
      lineInfo.style.display = 'none';
      collapsedInfo.style.display = 'none'; // Hide inline info
    }
    
    // Add toggle functionality
    customLangTag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isCollapsed = customLangTag.classList.contains('plx-collapsed');
      
      if (isCollapsed) {
        // Expand
        customLangTag.classList.remove('plx-collapsed');
        codeBlock.style.display = 'block';
        lineInfo.style.display = 'none';
        collapsedInfo.style.display = 'none';
      } else {
        // Collapse
        customLangTag.classList.add('plx-collapsed');
        codeBlock.style.display = 'none';
        lineInfo.style.display = 'flex';
        collapsedInfo.style.display = 'flex';
      }
    });
    
    // Add line numbers and context menu
    addLineNumbers(codeBlock, settings.showLineNumbers);
    addContextMenu(codeBlock, actionBar, customLangTag);
  });
}

// Update the Claude processing function
function processClaudeCodeBlocks(settings) {
  // Find all code blocks in Claude
  const codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach((codeBlock) => {
    // Skip already processed code blocks
    if (codeBlock.hasAttribute('data-plx-processed')) {
      return;
    }
    
    // Mark as processed to avoid duplication
    codeBlock.setAttribute('data-plx-processed', 'true');
    
    // Claude often has a parent div with flex items that contains the language identifier
    let langParent = codeBlock.parentElement;
    let langElement = langParent ? langParent.querySelector('.bg-gray-100, .bg-gray-200, .bg-zinc-100, .bg-slate-100') : null;
    let langText = 'Code';
    
    if (langElement && langElement !== codeBlock) {
      // Extract the language name
      langText = langElement.textContent.trim();
      // Hide original
      langElement.style.display = 'none';
    }
    
    // Create our custom language tag
    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;
    
    // Count lines in the code block
    const lineCount = codeBlock.textContent.split('\n').length;
    
    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    
    // Create line info element
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    
    // Create action bar for language tag and buttons
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    
    // Create copy button
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    copyButton.title = "Copy code";
    
    // Insert wrapper and rearrange elements
    codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    
    // Add both lang tag and copy button to action bar
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    
    // Add action bar, code block and line info to wrapper
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock);
    wrapper.appendChild(lineInfo);
    
    // Style adjustments
    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0';
    
    // Create inline collapsed view
    const collapsedInfo = createInlineCollapsedView(actionBar, customLangTag, lineCount);
    
    // Add copy functionality
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(codeBlock.textContent).then(() => {
        const originalHTML = copyButton.innerHTML;
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        setTimeout(() => {
          copyButton.innerHTML = originalHTML;
        }, 1500);
      });
    });
    
    // Apply collapse by default if enabled
    if (collapseByDefault) {
      customLangTag.classList.add('plx-collapsed');
      codeBlock.style.display = 'none';
      lineInfo.style.display = 'flex';
      collapsedInfo.style.display = 'flex'; // Show inline info
    } else {
      lineInfo.style.display = 'none';
      collapsedInfo.style.display = 'none'; // Hide inline info
    }
    
    // Add toggle functionality
    customLangTag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isCollapsed = customLangTag.classList.contains('plx-collapsed');
      
      if (isCollapsed) {
        // Expand
        customLangTag.classList.remove('plx-collapsed');
        codeBlock.style.display = 'block';
        lineInfo.style.display = 'none';
        collapsedInfo.style.display = 'none';
      } else {
        // Collapse
        customLangTag.classList.add('plx-collapsed');
        codeBlock.style.display = 'none';
        lineInfo.style.display = 'flex';
        collapsedInfo.style.display = 'flex';
      }
    });
    
    // Add line numbers and context menu
    addLineNumbers(codeBlock, settings.showLineNumbers);
    addContextMenu(codeBlock, actionBar, customLangTag);
  });
}

// Update Gemini processing function
function processGeminiCodeBlocks(settings) {
  // Find all Gemini code blocks
  const codeBlocks = document.querySelectorAll('code-block .code-block');
  
  codeBlocks.forEach((codeBlock) => {
    // Skip already processed code blocks
    if (codeBlock.hasAttribute('data-plx-processed')) {
      return;
    }
    
    // Mark as processed to avoid duplication
    codeBlock.setAttribute('data-plx-processed', 'true');
    
    // Find the header element and language tag
    const header = codeBlock.querySelector('.code-block-decoration');
    if (!header) return;
    
    // Find language label (first span in the header)
    const langSpan = header.querySelector('span');
    if (!langSpan) return;
    
    // Create our custom language tag
    const langTag = document.createElement('div');
    langTag.className = 'plx-lang-tag';
    langTag.textContent = langSpan.textContent;
    
    // Find the actual code element
    const preElement = codeBlock.querySelector('pre');
    if (!preElement) return;
    
    // Get line count
    const codeElement = preElement.querySelector('code');
    const lineCount = codeElement ? codeElement.textContent.split('\n').length : 0;
    
    // Create line info element
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    
    // Replace the header with our custom elements
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    actionBar.appendChild(langTag);
    
    // Create our own copy button instead of relying on Gemini's button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'plx-copy-button';
    copyBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z" fill="currentColor"/>
    </svg>`;
    copyBtn.title = "Copy code";
      // Add click event
    copyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Find the code content
      const codeElement = preElement.querySelector('code') || preElement;
      const codeText = codeElement.textContent;
      
      // Copy to clipboard and show floating notification
      navigator.clipboard.writeText(codeText)
        .then(() => {
          showCopyMessage(preElement, 'Copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy:', err);
          showCopyMessage(preElement, 'Failed to copy');
        });
    });
    
    actionBar.appendChild(copyBtn);
    
    // Insert our custom elements
    header.parentNode.insertBefore(actionBar, header);
    header.style.display = 'none'; // Hide original header
    
    // Add line info after the code
    codeBlock.appendChild(lineInfo);
      // Fix for the black line issue - apply multiple style fixes
    if (preElement) {
      // Remove borders, margins, and anything that might cause the black line
      preElement.style.marginTop = '0';
      preElement.style.borderTop = 'none'; 
      preElement.style.borderLeft = 'none'; // Remove left border causing vertical line
      preElement.style.borderTopLeftRadius = '0';
      preElement.style.borderTopRightRadius = '0';
      preElement.style.boxShadow = 'none';
      
      // Fix code element styling too
      const codeElement = preElement.querySelector('code');
      if (codeElement) {
        codeElement.style.paddingTop = '0.5rem';
        codeElement.style.borderTop = 'none';
        codeElement.style.borderLeft = 'none';
      }
      
      // Remove any borders from parent elements that might be creating lines
      const parentElements = [preElement.parentElement, preElement.parentElement?.parentElement];
      parentElements.forEach(parent => {
        if (parent) {
          parent.style.borderTop = 'none';
          parent.style.borderBottom = 'none';
          parent.style.borderLeft = 'none';
          parent.style.boxShadow = 'none';
        }
      });
      
      // Find and remove styling from any line number or gutter elements
      const potentialVerticalBarElements = preElement.querySelectorAll('[class*="line-number"], [class*="gutter"], [data-line-number]');
      potentialVerticalBarElements.forEach(element => {
        element.style.borderRight = 'none';
        element.style.borderLeft = 'none';
        element.style.boxShadow = 'none';
        element.style.backgroundColor = 'transparent';
      });
      
      // Look for any div structure that might be creating the vertical bar
      const firstColumnElements = preElement.querySelectorAll('div > div:first-child, td:first-child');
      firstColumnElements.forEach(element => {
        element.style.borderRight = 'none';
        element.style.borderLeft = 'none';
        element.style.boxShadow = 'none';
        element.style.backgroundColor = 'transparent';
      });
    }
    
    // Create inline collapsed view
    const collapsedInfo = createInlineCollapsedView(actionBar, langTag, lineCount);
    
    // Apply collapse by default if enabled
    if (collapseByDefault) {
      langTag.classList.add('plx-collapsed');
      preElement.style.display = 'none';
      lineInfo.style.display = 'flex';
      collapsedInfo.style.display = 'flex'; // Show inline info
    } else {
      lineInfo.style.display = 'none';
      collapsedInfo.style.display = 'none'; // Hide inline info
    }
    
    // Add toggle functionality
    langTag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const isCollapsed = langTag.classList.contains('plx-collapsed');
      
      if (isCollapsed) {
        // Expand
        langTag.classList.remove('plx-collapsed');
        preElement.style.display = 'block';
        lineInfo.style.display = 'none';
        collapsedInfo.style.display = 'none'; // Hide inline info
      } else {
        // Collapse
        langTag.classList.add('plx-collapsed');
        preElement.style.display = 'none';
        lineInfo.style.display = 'flex';
        collapsedInfo.style.display = 'flex'; // Show inline info
      }
    });
    
    // Add line numbers
    addLineNumbers(preElement, settings.showLineNumbers);
      // Create our own context menu specifically for Gemini
    // Create the more actions button
    const actionsButton = document.createElement('button');
    actionsButton.className = 'plx-actions-button';
    actionsButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="6" r="2" fill="currentColor"/>
      <circle cx="12" cy="12" r="2" fill="currentColor"/>
      <circle cx="12" cy="18" r="2" fill="currentColor"/>
    </svg>`;
    actionsButton.title = "More actions";
    
    // Create menu
    const menu = document.createElement('div');
    menu.className = 'plx-actions-menu';
    
    // Add menu items
    const menuItems = [
      {
        label: 'Format code',
        action: () => formatCode(preElement),
        key: 'Alt+F'
      },
      {
        label: 'Toggle line numbers',
        action: () => toggleLineNumbers(preElement),
        key: 'Alt+L'
      },
      {
        label: 'Select all',
        action: () => selectCode(preElement),
        key: 'Ctrl+A'
      }
    ];
    
    menuItems.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.className = 'plx-actions-menu-item';
      menuItem.textContent = item.label;
      
      // Add keyboard shortcut display
      if (item.key) {
        const kbd = document.createElement('span');
        kbd.className = 'plx-keybinding';
        kbd.textContent = item.key;
        menuItem.appendChild(kbd);
      }
      
      menuItem.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        item.action();
        menu.style.display = 'none';
      });
      
      menu.appendChild(menuItem);
    });
    
    // Add button to action bar
    actionBar.appendChild(actionsButton);
    codeBlock.appendChild(menu);
    
    // Toggle menu display on button click
    actionsButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (menu.style.display === 'block') {
        menu.style.display = 'none';
      } else {
        // Position menu below button
        const rect = actionsButton.getBoundingClientRect();
        menu.style.top = rect.bottom + 'px';
        menu.style.right = (window.innerWidth - rect.right) + 'px';
        menu.style.display = 'block';
        
        // Close menu when clicking elsewhere
        const closeMenu = (e) => {
          if (!menu.contains(e.target) && e.target !== actionsButton) {
            menu.style.display = 'none';
            document.removeEventListener('click', closeMenu);
          }
        };
        
        setTimeout(() => {
          document.addEventListener('click', closeMenu);
        }, 0);
      }
    });
  });
}

// Update Perplexity processing function
function processPerplexityCodeBlocks(settings) {
  // Find all code blocks
  const codeBlocks = document.querySelectorAll('pre');
  
  codeBlocks.forEach((codeBlock) => {
    // Skip already processed code blocks
    if (codeBlock.parentNode.classList.contains('plx-code-block-wrapper')) {
      return;
    }
    
    // Find language tag - different approaches for different sites
    let langTag = null;
    
    let previousSibling = codeBlock.previousElementSibling;
    
    // Check if the previous element might be a language tag
    if (previousSibling && 
        !previousSibling.querySelector('pre') && 
        previousSibling.textContent.trim().length < 20) {
      langTag = previousSibling;
    }
    
    // If no language tag found, look inside the code block's first elements
    if (!langTag) {
      const firstChild = codeBlock.firstElementChild;
      if (firstChild && firstChild.tagName === 'DIV' && 
          firstChild.textContent.trim().length < 20) {
        langTag = firstChild;
      }
    }
    
    // If we still don't have a language tag, look for any element that might be one
    if (!langTag) {
      const possibleTags = Array.from(
        codeBlock.parentNode.querySelectorAll('div, span')
      ).filter(el => 
        el.textContent.trim().length < 20 && 
        !el.querySelector('pre') &&
        getComputedStyle(el).backgroundColor !== 'rgba(0, 0, 0, 0)'
      );
      
      if (possibleTags.length > 0) {
        langTag = possibleTags[0];
      }
    }
    
    // Continue with your existing code for creating wrappers, etc.
    if (langTag) {
      // Mark it for styling
      langTag.classList.add('plx-lang-tag');
      
      // Get line count
      const lineCount = codeBlock.textContent.split('\n').length;
      
      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'plx-code-block-wrapper';
      
      // Create action bar that will contain the language tag and copy button
      const actionBar = document.createElement('div');
      actionBar.className = 'plx-action-bar';
      
      // Create copy button
      const copyButton = document.createElement('button');
      copyButton.className = 'plx-copy-button';
      copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      copyButton.title = "Copy code";
      
      // Create line info element
      const lineInfo = document.createElement('div');
      lineInfo.className = 'plx-line-info';
      lineInfo.textContent = `Code block (${lineCount} lines)`;
      
      // Insert wrapper and rearrange elements
      codeBlock.parentNode.insertBefore(wrapper, codeBlock);
      
      // Add both lang tag and copy button to action bar
      actionBar.appendChild(langTag);
      actionBar.appendChild(copyButton);
      
      // Add action bar, code block and line info to wrapper
      wrapper.appendChild(actionBar);
      wrapper.appendChild(codeBlock);
      wrapper.appendChild(lineInfo);
      
      // In Perplexity, the codeBlock itself is the preElement
      const preElement = codeBlock; // Add this line to fix the error
      
      // Make sure pre element has correct styling
      if (preElement) {
        preElement.style.marginTop = '0';
        preElement.style.borderTopLeftRadius = '0'; 
        // If first-line padding exists, reduce it
        const codeElement = preElement.querySelector('code');
        if (codeElement) {
          codeElement.style.paddingTop = '0.5rem';
        }
      }
      
      // Create inline collapsed view
      const collapsedInfo = createInlineCollapsedView(actionBar, langTag, lineCount);
      
      // Add copy functionality
      copyButton.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
          const originalHTML = copyButton.innerHTML;
          copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;
          setTimeout(() => {
            copyButton.innerHTML = originalHTML;
          }, 1500);
        });
      });
      
      // Apply collapse by default if enabled
      if (collapseByDefault) {
        langTag.classList.add('plx-collapsed');
        codeBlock.style.display = 'none';
        lineInfo.style.display = 'flex';
        collapsedInfo.style.display = 'flex'; // Show inline info
      } else {
        lineInfo.style.display = 'none';
        collapsedInfo.style.display = 'none'; // Hide inline info
      }
      
      // Add toggle functionality to language tag
      langTag.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const isCollapsed = langTag.classList.contains('plx-collapsed');
        
        if (isCollapsed) {
          // Expand - show code, hide line info
          langTag.classList.remove('plx-collapsed');
          codeBlock.style.display = 'block';
          lineInfo.style.display = 'none';
          collapsedInfo.style.display = 'none'; // Hide inline info
          // Don't recreate any buttons here
        } else {
          // Collapse - hide code, show line info
          langTag.classList.add('plx-collapsed');
          codeBlock.style.display = 'none';
          lineInfo.style.display = 'flex';
          collapsedInfo.style.display = 'flex'; // Show inline info
        }
      });
      
      // Add line numbers and context menu
      addLineNumbers(codeBlock, settings.showLineNumbers);
      addContextMenu(codeBlock, actionBar, langTag);
    }
  });
}

// Add logging to verify the script runs on Gemini
console.log('Perplexity Codeblock Extension loaded on: ' + window.location.hostname);

// Set up observer
let observer;
let observerTimeout;

function startObserver() {
  observer = new MutationObserver((mutations) => {
    // Add a slight delay to avoid duplicate processing
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      processCodeBlocks();
    }, 100);
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Process existing code blocks
  processCodeBlocks();
}

// Add this new function after the copyButton creation:

function createInlineCollapsedView(actionBar, langTag, lineCount) {
  // Create inline collapsed info that shows up next to language tag
  const collapsedInfo = document.createElement('div');
  collapsedInfo.className = 'plx-collapsed-info';
  
  // Shorter text format for a more compact look
  collapsedInfo.textContent = `${lineCount} lines`;
  
  // Insert after language tag
  actionBar.insertBefore(collapsedInfo, langTag.nextSibling);
  
  return collapsedInfo;
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Alt+C: Toggle all code blocks
  if (e.altKey && e.key === 'c') {
    e.preventDefault();
    toggleAllCodeBlocks();
  }
  
  // Alt+X: Copy current/focused code block
  if (e.altKey && e.key === 'x') {
    e.preventDefault();
    copyFocusedCodeBlock();
  }
  
  // Alt+L: Toggle line numbers on focused code block
  if (e.altKey && e.key === 'l') {
    e.preventDefault();
    const activeElement = document.activeElement;
    const wrapper = activeElement.closest('.plx-code-block-wrapper');
    if (wrapper) {
      const codeBlock = wrapper.querySelector('pre');
      if (codeBlock) {
        toggleLineNumbers(codeBlock);
      }
    }
  }
  
  // Alt+F: Format focused code block
  if (e.altKey && e.key === 'f') {
    e.preventDefault();
    const activeElement = document.activeElement;
    const wrapper = activeElement.closest('.plx-code-block-wrapper');
    if (wrapper) {
      const codeBlock = wrapper.querySelector('pre');
      if (codeBlock) {
        formatCode(codeBlock);
      }
    }
  }
});

// Toggle all code blocks
function toggleAllCodeBlocks() {
  const langTags = document.querySelectorAll('.plx-lang-tag');
  const areAllCollapsed = Array.from(langTags).every(tag => 
    tag.classList.contains('plx-collapsed')
  );
  
  langTags.forEach(langTag => {
    const codeBlock = langTag.closest('.plx-code-block-wrapper').querySelector('pre');
    const lineInfo = langTag.closest('.plx-code-block-wrapper').querySelector('.plx-line-info');
    const collapsedInfo = langTag.nextElementSibling;
    
    if (areAllCollapsed) {
      // Expand all
      langTag.classList.remove('plx-collapsed');
      codeBlock.style.display = 'block';
      if (lineInfo) lineInfo.style.display = 'none';
      if (collapsedInfo) collapsedInfo.style.display = 'none';
    } else {
      // Collapse all
      langTag.classList.add('plx-collapsed');
      codeBlock.style.display = 'none';
      if (lineInfo) lineInfo.style.display = 'flex';
      if (collapsedInfo) collapsedInfo.style.display = 'flex';
    }
  });
}

// Copy focused code block
function copyFocusedCodeBlock() {
  // Find which code block contains or is nearest to the current focus
  const activeElement = document.activeElement;
  
  // Check if inside a code block wrapper
  const wrapper = activeElement.closest('.plx-code-block-wrapper');
  if (wrapper) {
    const codeBlock = wrapper.querySelector('pre');
    if (codeBlock) {
      navigator.clipboard.writeText(codeBlock.textContent).then(() => {
        showCopyMessage(codeBlock, 'Copied to clipboard');
      });
    }
  } else {
    // Find nearest visible code block
    const allCodeBlocks = document.querySelectorAll('.plx-code-block-wrapper pre');
    let nearestBlock = null;
    let minDistance = Infinity;
    
    // Get the active element's position
    const activeRect = activeElement.getBoundingClientRect();
    const activeCenter = {
      x: activeRect.left + activeRect.width / 2,
      y: activeRect.top + activeRect.height / 2
    };
    
    allCodeBlocks.forEach(block => {
      if (block.style.display !== 'none') {
        const blockRect = block.getBoundingClientRect();
        const blockCenter = {
          x: blockRect.left + blockRect.width / 2,
          y: blockRect.top + blockRect.height / 2
        };
        
        // Calculate distance
        const distance = Math.sqrt(
          Math.pow(blockCenter.x - activeCenter.x, 2) + 
          Math.pow(blockCenter.y - activeCenter.y, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestBlock = block;
        }
      }
    });
    
    if (nearestBlock) {
      navigator.clipboard.writeText(nearestBlock.textContent).then(() => {
        showCopyMessage(nearestBlock, 'Copied to clipboard');
      });
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (extensionEnabled) {
      startObserver();
    }
  });
} else {
  if (extensionEnabled) {
    startObserver();
  }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "toggle_all_code_blocks") {
    toggleAllCodeBlocks();
    sendResponse({success: true});
    return true;
  } else if (message.action === "copy_focused_code") {
    copyFocusedCodeBlock();
    sendResponse({success: true});
    return true;
  }
});

// Function to specifically target and remove the vertical bar in Gemini's code blocks
function removeGeminiVerticalBars() {
  // Only run on Gemini
  if (!window.location.hostname.includes('gemini.google.com')) return;
  
  // Get all elements that might be creating vertical bars
  const verticalBarCandidates = document.querySelectorAll(`
    code-block .code-block [class*="line-number"],
    code-block .code-block [class*="gutter"],
    code-block .code-block pre > div > div:first-child,
    code-block .code-block td:first-child,
    code-block .code-block [data-line-number],
    code-block .code-block [class*="linenumber"]
  `);
  
  // Apply style fixes to each element
  verticalBarCandidates.forEach(element => {
    element.style.borderLeft = 'none';
    element.style.borderRight = 'none';
    element.style.boxShadow = 'none';
    element.style.backgroundColor = 'transparent';
    
    // Also set inline !important styles
    const originalDisplay = element.style.display;
    element.setAttribute('style', `
      border-left: none !important;
      border-right: none !important;
      box-shadow: none !important;
      background-color: transparent !important;
      display: ${originalDisplay};
    `);
    
    // If this element has children, apply the same fixes to them
    Array.from(element.children).forEach(child => {
      child.style.borderLeft = 'none';
      child.style.borderRight = 'none';
      child.style.boxShadow = 'none';
      child.style.backgroundColor = 'transparent';
    });
  });
}

// Add dedicated observer for vertical bar fixes
let verticalBarObserver;

function startVerticalBarObserver() {
  // Only run on Gemini
  if (!window.location.hostname.includes('gemini.google.com')) return;
  
  // Clean up any existing observer
  if (verticalBarObserver) {
    verticalBarObserver.disconnect();
  }
  
  // Create new observer
  verticalBarObserver = new MutationObserver(() => {
    removeGeminiVerticalBars();
  });
  
  // Start observing
  verticalBarObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Run immediately as well
  removeGeminiVerticalBars();
}

// Modify startObserver function to also start the vertical bar observer
const originalStartObserver = startObserver;
startObserver = function() {
  originalStartObserver();
  startVerticalBarObserver();
};

// If we're already active, start the vertical bar observer now
if (extensionEnabled) {
  startVerticalBarObserver();
}
