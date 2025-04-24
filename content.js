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
  
  // Detect if we're on Gemini
  const isGemini = window.location.hostname.includes('gemini.google.com');
  
  if (isGemini) {
    // Gemini-specific processing
    processGeminiCodeBlocks();
  } else {
    // Original Perplexity processing
    processPerplexityCodeBlocks();
  }
}

function processGeminiCodeBlocks() {
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
    
    // Capture the original copy button to preserve it
    const originalCopyBtn = header.querySelector('.copy-button');
    
    // Replace the header with our custom elements
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    actionBar.appendChild(langTag);
    
    if (originalCopyBtn) {
      // Clone the original copy button to keep its functionality
      const copyBtn = originalCopyBtn.cloneNode(true);
      actionBar.appendChild(copyBtn);
    }
    
    // Insert our custom elements
    header.parentNode.insertBefore(actionBar, header);
    header.style.display = 'none'; // Hide original header
    
    // Add line info after the code
    codeBlock.appendChild(lineInfo);
    
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
  });
}

function processPerplexityCodeBlocks() {
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
