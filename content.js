// == Extension State Variables ==
let extensionEnabled = true;
let collapseByDefault = true; // Default to true as per common preference
let observer = null;
let observerTimeout = null;

// == Initial Settings Load ==
chrome.storage.sync.get(['enabled', 'collapseByDefault'], (data) => {
  console.log('[PCC EXT_ENABLED_DEBUG] Global Storage: data.hasOwnProperty("enabled") is', data.hasOwnProperty('enabled'), '; data.enabled is', data.enabled);
  if (data.hasOwnProperty('enabled')) {
    extensionEnabled = data.enabled;
  }
  console.log('[PCC EXT_ENABLED_DEBUG] Global Storage: extensionEnabled is now', extensionEnabled);
  
  if (data.hasOwnProperty('collapseByDefault')) {
    collapseByDefault = data.collapseByDefault;
  }
  
  if (extensionEnabled) {
    startObserver();
  }
});

// == Settings Change Listener ==
chrome.storage.onChanged.addListener((changes) => {
  if (changes.enabled) {
    console.log('[PCC EXT_ENABLED_DEBUG] Storage Changed: changes.enabled.newValue is', changes.enabled.newValue);
    extensionEnabled = changes.enabled.newValue;
    console.log('[PCC EXT_ENABLED_DEBUG] Storage Changed: extensionEnabled is now', extensionEnabled);
    
    if (extensionEnabled) {
      startObserver();
    } else {
      if (observer) {
        observer.disconnect();
        observer = null; // Clear the observer
      }
      // Restore all collapsed code blocks (optional, good for UX)
      document.querySelectorAll('.plx-code-block-wrapper').forEach(wrapper => {
        const codeBlock = wrapper.querySelector('pre');
        const lineInfo = wrapper.querySelector('.plx-line-info');
        const langTag = wrapper.querySelector('.plx-lang-tag');
        const collapsedInfo = wrapper.querySelector('.plx-collapsed-info');

        if (codeBlock) codeBlock.style.setProperty('display', 'block', 'important'); // Show code
        if (lineInfo) lineInfo.style.display = 'none';
        if (collapsedInfo) collapsedInfo.style.display = 'none';
        if (langTag) langTag.classList.remove('plx-collapsed');
        
      });
    }
  }
  
  if (changes.collapseByDefault) {
    collapseByDefault = changes.collapseByDefault.newValue;
  }
});

// == Mutation Observer Setup ==
function startObserver() {
  if (observer) {
    observer.disconnect(); 
  }

  observer = new MutationObserver((mutations) => {
    clearTimeout(observerTimeout);
    observerTimeout = setTimeout(() => {
      if (extensionEnabled) { 
          processCodeBlocks();
      }
    }, 100); 
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  if (extensionEnabled) {
      processCodeBlocks();
  }
}

// == Core Processing Logic ==
function processCodeBlocks() {
  console.log('[PCC EXT_ENABLED_DEBUG] processCodeBlocks: Called. Current extensionEnabled state is', extensionEnabled);
  if (!extensionEnabled) return;

  chrome.storage.sync.get(
    ['showLineNumbers', 'collapseThreshold', 'theme', 'enabledPlatforms', 'collapseByDefault'], 
    (settings) => {
      if (chrome.runtime.lastError) {
        console.error('[PCC processCodeBlocks Storage] Error retrieving settings:', chrome.runtime.lastError.message);
        return; 
      }

      if (settings.hasOwnProperty('collapseByDefault')) {
          collapseByDefault = settings.collapseByDefault;
      }

      const hostname = window.location.hostname;
      const platforms = settings.enabledPlatforms || { 
        chatgpt: true, 
        gemini: true, 
        claude: true, 
        perplexity: true 
      };

      const isChatGPT = hostname.includes('chat.openai.com');
      const isClaude = hostname.includes('claude.ai');
      const isGemini = hostname.includes('gemini.google.com'); 
      const isPerplexity = hostname.includes('perplexity.ai'); // Explicit Perplexity check

      if (isChatGPT && platforms.chatgpt) {
        processChatGPTCodeBlocks(settings); 
      } else if (isClaude && platforms.claude) { 
        processClaudeCodeBlocks(settings);
      } else if (isGemini && platforms.gemini) { 
        processGeminiCodeBlocks(settings);
      } else if (isPerplexity && platforms.perplexity) { // Explicit Perplexity processing
        processPerplexityCodeBlocks(settings);
      } else if (!isChatGPT && !isClaude && !isGemini && !isPerplexity && platforms.perplexity) { 
        // Fallback for "other" sites, controlled by the perplexity platform setting
        processPerplexityCodeBlocks(settings); // Use Perplexity processor as a generic one
      }
    }
  );
}

// == Platform-Specific Processor: ChatGPT ==
function processChatGPTCodeBlocks(settings) {
  const unprocessedPreElements = document.querySelectorAll('pre:not([data-plx-processed])');
  unprocessedPreElements.forEach((codeBlock) => {
    const firstChildDiv = codeBlock.firstElementChild;
    const prevSiblingDiv = codeBlock.previousElementSibling;
    let isLikelyCodeBlock = false;
    let originalHeaderElement = null; 
    if (firstChildDiv && firstChildDiv.tagName === 'DIV') {
        if (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span')) {
            isLikelyCodeBlock = true;
            originalHeaderElement = firstChildDiv;
        }
    }
    if (!isLikelyCodeBlock && prevSiblingDiv && prevSiblingDiv.tagName === 'DIV') {
        if (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span')) {
            isLikelyCodeBlock = true;
            originalHeaderElement = prevSiblingDiv;
        }
    }
    if (!isLikelyCodeBlock && (codeBlock.classList.contains('hljs') || codeBlock.querySelector('.hljs'))) {
        isLikelyCodeBlock = true;
        if (!originalHeaderElement) { 
            if (firstChildDiv && firstChildDiv.tagName === 'DIV' && (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span'))) {
                originalHeaderElement = firstChildDiv;
            } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span'))) {
                originalHeaderElement = prevSiblingDiv;
            }
        }
    }
    if (!isLikelyCodeBlock && codeBlock.closest('div[class*="markdown"]')) {
        isLikelyCodeBlock = true;
        if (!originalHeaderElement) { 
             if (firstChildDiv && firstChildDiv.tagName === 'DIV' && (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span'))) {
                originalHeaderElement = firstChildDiv;
            } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span'))) {
                originalHeaderElement = prevSiblingDiv;
            }
        }
    }
    if (codeBlock.closest('.plx-code-block-wrapper')) {
        if (!codeBlock.hasAttribute('data-plx-processed')) {
             codeBlock.setAttribute('data-plx-processed', 'true');
        }
        return; 
    }
    const lineCountForHeuristic = codeBlock.textContent.split('\n').length;
    if (!isLikelyCodeBlock && lineCountForHeuristic < 2 && codeBlock.children.length === 0) {
        return;
    }
    if (!isLikelyCodeBlock && !originalHeaderElement && lineCountForHeuristic < 4) {
        return;
    }
    codeBlock.setAttribute('data-plx-processed', 'true');
    let langText = 'Code';
    if (originalHeaderElement) {
        const langElements = Array.from(originalHeaderElement.querySelectorAll('span, div'));
        const potentialLangElement = langElements.find(el => 
            el.textContent.trim().length > 0 && 
            el.textContent.trim().length < 30 && 
            !el.querySelector('button') && 
            !el.querySelector('svg') && 
            el.children.length === 0 
        );
        if (potentialLangElement) {
            langText = potentialLangElement.textContent.trim();
        }
        originalHeaderElement.style.setProperty('display', 'none', 'important');
    }
    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;
    const innerCode = codeBlock.querySelector('code');
    const contentSource = (innerCode && innerCode.textContent.length > codeBlock.textContent.length * 0.7) ? innerCode : codeBlock;
    const lineCount = contentSource.textContent.split('\n').length;
    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; 
    copyButton.title = "Copy code";
    if (codeBlock.parentNode) {
        codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    } else {
        console.warn("PLX: codeBlock has no parentNode during wrapper insertion for ChatGPT. Skipping this block.");
        return; 
    }
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock); 
    wrapper.appendChild(lineInfo);
    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0'; 
    codeBlock.style.borderTopRightRadius = '0';
    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);
    copyButton.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      navigator.clipboard.writeText(contentSource.textContent).then(() => {
        if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copied to clipboard');
        const originalHTML = copyButton.innerHTML; 
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; 
        setTimeout(() => { copyButton.innerHTML = originalHTML; }, 1500);
      }).catch(err => {
        console.error("PLX Error copying text: ", err);
        if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copy failed');
      });
    });
    const setCollapsedState = (shouldCollapse) => {
        if (shouldCollapse) {
            customLangTag.classList.add('plx-collapsed');
            codeBlock.style.setProperty('display', 'none', 'important'); 
            lineInfo.style.display = 'flex';
            collapsedInfo.style.display = 'flex'; 
        } else {
            customLangTag.classList.remove('plx-collapsed');
            codeBlock.style.setProperty('display', 'block', 'important'); 
            lineInfo.style.display = 'none';
            collapsedInfo.style.display = 'none'; 
        }
    };
    setCollapsedState(settings.collapseByDefault === true); 
    customLangTag.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
      setCollapsedState(!isCurrentlyCollapsed); 
    });
    if (typeof addLineNumbers === 'function') addLineNumbers(codeBlock, settings.showLineNumbers);
    if (typeof addContextMenu === 'function') addContextMenu(codeBlock, actionBar, customLangTag);
  });
}

// == Platform-Specific Processor: Claude ==
function processClaudeCodeBlocks(settings) {
  const unprocessedPreElements = document.querySelectorAll('pre:not([data-plx-processed])');
  unprocessedPreElements.forEach((codeBlock) => {
    let isLikelyClaudeCodeBlock = false;
    let originalLangElement = null;
    let langText = "Code";
    const parentFigure = codeBlock.closest('figure[class*="bg-code-block-bg"]');
    const siblingDiv = codeBlock.previousElementSibling;
    if (parentFigure) {
        isLikelyClaudeCodeBlock = true;
        if (parentFigure.previousElementSibling && parentFigure.previousElementSibling.tagName === 'DIV') {
            const potentialLangDiv = parentFigure.previousElementSibling;
            if (potentialLangDiv.textContent.trim().length > 0 && potentialLangDiv.textContent.trim().length < 30 && !potentialLangDiv.querySelector('button') && !potentialLangDiv.querySelector('svg')) {
                langText = potentialLangDiv.textContent.trim();
                originalLangElement = potentialLangDiv;
            }
        }
    } else if (siblingDiv && siblingDiv.tagName === 'DIV' && (siblingDiv.classList.contains('font-code') || siblingDiv.textContent.trim().length < 30)) {
        isLikelyClaudeCodeBlock = true;
        if (siblingDiv.textContent.trim().length > 0 && !siblingDiv.querySelector('button') && !siblingDiv.querySelector('svg')) {
            langText = siblingDiv.textContent.trim();
            originalLangElement = siblingDiv;
        }
    } else if (codeBlock.querySelector('code[class*="language-"]')) { 
        isLikelyClaudeCodeBlock = true;
    }
    if (codeBlock.closest('.plx-code-block-wrapper')) {
        if (!codeBlock.hasAttribute('data-plx-processed')) {
             codeBlock.setAttribute('data-plx-processed', 'true');
        }
        return;
    }
    if (!isLikelyClaudeCodeBlock && codeBlock.textContent.split('\n').length < 2) {
        return; 
    }
    codeBlock.setAttribute('data-plx-processed', 'true');
    if (originalLangElement) {
        originalLangElement.style.setProperty('display', 'none', 'important');
    }
    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;
    const lineCount = codeBlock.textContent.split('\n').length;
    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`; 
    copyButton.title = "Copy code";
    if (codeBlock.parentNode) {
        codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    } else {
        console.warn("PLX: codeBlock has no parentNode during wrapper insertion for Claude. Skipping this block.");
        return;
    }
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock);
    wrapper.appendChild(lineInfo);
    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0';
    codeBlock.style.borderTopRightRadius = '0';
    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);
    copyButton.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
            if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copied to clipboard');
            const originalHTML = copyButton.innerHTML;
            copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            setTimeout(() => { copyButton.innerHTML = originalHTML; }, 1500);
        }).catch(err => {
            console.error("PLX Error copying text: ", err);
            if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copy failed');
        });
    });
    const setCollapsedState = (shouldCollapse) => {
        if (shouldCollapse) {
            customLangTag.classList.add('plx-collapsed');
            codeBlock.style.setProperty('display', 'none', 'important');
            lineInfo.style.display = 'flex';
            collapsedInfo.style.display = 'flex';
        } else {
            customLangTag.classList.remove('plx-collapsed');
            codeBlock.style.setProperty('display', 'block', 'important');
            lineInfo.style.display = 'none';
            collapsedInfo.style.display = 'none';
        }
    };
    setCollapsedState(settings.collapseByDefault === true);
    customLangTag.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
        setCollapsedState(!isCurrentlyCollapsed);
    });
    if (typeof addLineNumbers === 'function') addLineNumbers(codeBlock, settings.showLineNumbers);
    if (typeof addContextMenu === 'function') addContextMenu(codeBlock, actionBar, customLangTag);
  });
}

// == Platform-Specific Processor: Gemini ==
function processGeminiCodeBlocks(settings) {
  const geminiWrappers = document.querySelectorAll('code-block:not([data-plx-top-processed])');

  geminiWrappers.forEach((geminiWrapper) => {
    geminiWrapper.setAttribute('data-plx-top-processed', 'true'); 

    const codeBlockRoot = geminiWrapper.querySelector('.code-block'); 
    if (!codeBlockRoot) return;

    const preElement = codeBlockRoot.querySelector('pre');
    if (!preElement || preElement.hasAttribute('data-plx-processed')) {
      return; 
    }
    
    if (preElement.closest('.plx-code-block-wrapper')) {
        if(!preElement.hasAttribute('data-plx-processed')) preElement.setAttribute('data-plx-processed', 'true');
        return;
    }

    preElement.setAttribute('data-plx-processed', 'true');

    let langText = 'Code';
    const originalHeader = codeBlockRoot.querySelector('.code-block-decoration');
    if (originalHeader) {
      const langSpan = originalHeader.querySelector('span:first-child, div:first-child');
      if (langSpan && langSpan.textContent.trim().length > 0) {
        langText = langSpan.textContent.trim();
      }
      originalHeader.style.setProperty('display', 'none', 'important');
    }

    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;

    const innerCode = preElement.querySelector('code') || preElement;
    const lineCount = innerCode.textContent.split('\n').length;

    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    copyButton.title = "Copy code";

    if(preElement.parentNode === codeBlockRoot) { 
        codeBlockRoot.insertBefore(wrapper, preElement);
    } else if (preElement.parentNode) { 
        preElement.parentNode.insertBefore(wrapper,preElement);
    } else {
        console.warn("PLX: preElement for Gemini has no parent. Appending wrapper to codeBlockRoot.");
        codeBlockRoot.appendChild(wrapper);
    }
    
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    wrapper.appendChild(actionBar);
    wrapper.appendChild(preElement); 
    wrapper.appendChild(lineInfo);
    
    preElement.style.marginTop = '0';
    preElement.style.borderTopLeftRadius = '0';
    preElement.style.borderTopRightRadius = '0';
    preElement.style.borderTop = 'none'; 
    preElement.style.borderLeft = 'none'; 
    preElement.style.boxShadow = 'none';
    if (innerCode !== preElement) { // If innerCode is actually the <code> tag
        innerCode.style.paddingTop = '0.5rem'; // Adjust if needed
        innerCode.style.borderTop = 'none';
        innerCode.style.borderLeft = 'none';
    }

    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);

    copyButton.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      navigator.clipboard.writeText(innerCode.textContent).then(() => {
        if (typeof showCopyMessage === 'function') showCopyMessage(preElement, 'Copied to clipboard');
        const originalHTML = copyButton.innerHTML; 
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
        setTimeout(() => { copyButton.innerHTML = originalHTML; }, 1500);
      }).catch(err => {
        console.error("PLX Error copying text: ", err);
        if (typeof showCopyMessage === 'function') showCopyMessage(preElement, 'Copy failed');
      });
    });

    const setCollapsedState = (shouldCollapse) => {
        if (shouldCollapse) {
            customLangTag.classList.add('plx-collapsed');
            preElement.style.setProperty('display', 'none', 'important'); 
            lineInfo.style.display = 'flex';
            collapsedInfo.style.display = 'flex'; 
        } else {
            customLangTag.classList.remove('plx-collapsed');
            preElement.style.setProperty('display', 'block', 'important'); 
            lineInfo.style.display = 'none';
            collapsedInfo.style.display = 'none'; 
        }
    };
    setCollapsedState(settings.collapseByDefault === true);

    customLangTag.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
      setCollapsedState(!isCurrentlyCollapsed); 
    });

    if (typeof addLineNumbers === 'function') addLineNumbers(preElement, settings.showLineNumbers);
    if (typeof addContextMenu === 'function') addContextMenu(preElement, actionBar, customLangTag);
  });
}

// == Platform-Specific Processor: Perplexity ==
function processPerplexityCodeBlocks(settings) {
  const unprocessedPreElements = document.querySelectorAll('pre:not([data-plx-processed])');

  unprocessedPreElements.forEach((codeBlock) => {
    let langText = 'Code';
    let originalLangElement = null;

    // Heuristic 1: Check for a sibling div.code-annotation_title, which Perplexity uses
    if (codeBlock.previousElementSibling && codeBlock.previousElementSibling.matches('div[class*="code-annotation_title"]')) {
        originalLangElement = codeBlock.previousElementSibling;
        langText = originalLangElement.textContent.trim() || 'Code';
    }
    // Heuristic 2: Check for a specific parent structure if language tag is not a direct sibling
    // Perplexity often has a complex structure, sometimes the <pre> is deeply nested.
    // A common pattern is that the <pre> is part of a larger div that might have a header-like div.
    // This might require more specific selectors based on Perplexity's current DOM.
    // For now, we'll rely on the direct sibling or a generic approach.

    if (codeBlock.closest('.plx-code-block-wrapper')) {
        if (!codeBlock.hasAttribute('data-plx-processed')) {
             codeBlock.setAttribute('data-plx-processed', 'true');
        }
        return;
    }

    // If no specific language tag found, and it's a very short block, might skip
    if (!originalLangElement && codeBlock.textContent.split('\n').length < 2 && codeBlock.children.length === 0) {
        // Potentially skip if it's not clearly a code block and very short
        // However, Perplexity might have plain <pre> tags for code without explicit language tags
        // So, we might process it anyway if it looks like code.
    }

    codeBlock.setAttribute('data-plx-processed', 'true');

    if (originalLangElement) {
        originalLangElement.style.setProperty('display', 'none', 'important');
    }

    const customLangTag = document.createElement('div');
    customLangTag.className = 'plx-lang-tag';
    customLangTag.textContent = langText;

    const lineCount = codeBlock.textContent.split('\n').length;
    const wrapper = document.createElement('div');
    wrapper.className = 'plx-code-block-wrapper';
    const lineInfo = document.createElement('div');
    lineInfo.className = 'plx-line-info';
    lineInfo.textContent = `Code block (${lineCount} lines)`;
    const actionBar = document.createElement('div');
    actionBar.className = 'plx-action-bar';
    const copyButton = document.createElement('button');
    copyButton.className = 'plx-copy-button';
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    copyButton.title = "Copy code";

    if (codeBlock.parentNode) {
        codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    } else {
        console.warn("PLX: codeBlock has no parentNode during wrapper insertion for Perplexity. Skipping.");
        return;
    }

    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock);
    wrapper.appendChild(lineInfo);

    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0';
    codeBlock.style.borderTopRightRadius = '0';

    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);

    copyButton.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
            if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copied to clipboard');
            const originalHTML = copyButton.innerHTML;
            copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            setTimeout(() => { copyButton.innerHTML = originalHTML; }, 1500);
        }).catch(err => {
            console.error("PLX Error copying text: ", err);
            if (typeof showCopyMessage === 'function') showCopyMessage(codeBlock, 'Copy failed');
        });
    });

    const setCollapsedState = (shouldCollapse) => {
        if (shouldCollapse) {
            customLangTag.classList.add('plx-collapsed');
            codeBlock.style.setProperty('display', 'none', 'important');
            lineInfo.style.display = 'flex';
            collapsedInfo.style.display = 'flex';
        } else {
            customLangTag.classList.remove('plx-collapsed');
            codeBlock.style.setProperty('display', 'block', 'important');
            lineInfo.style.display = 'none';
            collapsedInfo.style.display = 'none';
        }
    };
    setCollapsedState(settings.collapseByDefault === true);

    customLangTag.addEventListener('click', (e) => {
        e.preventDefault(); e.stopPropagation();
        const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
        setCollapsedState(!isCurrentlyCollapsed);
    });

    if (typeof addLineNumbers === 'function') addLineNumbers(codeBlock, settings.showLineNumbers);
    if (typeof addContextMenu === 'function') addContextMenu(codeBlock, actionBar, customLangTag);
  });
}


// == Helper Function Stubs & Implementations ==
function showCopyMessage(targetElement, message) {
  let floatingContainer = document.getElementById('plx-floating-notifications');
  if (!floatingContainer) {
    floatingContainer = document.createElement('div');
    floatingContainer.id = 'plx-floating-notifications';
    floatingContainer.className = 'plx-floating-container';
    floatingContainer.style.zIndex = '999999'; 
    floatingContainer.style.display = 'flex';
    floatingContainer.style.flexDirection = 'column';
    floatingContainer.style.position = 'fixed';
    floatingContainer.style.bottom = '20px'; 
    floatingContainer.style.right = '20px';
    floatingContainer.style.gap = '10px';
    document.body.appendChild(floatingContainer);
  }
  
  const notification = document.createElement('div');
  notification.className = 'plx-floating-notification';
  
  let icon = '';
  if (message.includes('Copied') || message.includes('Selected')) {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else if (message.includes('Format')) {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 7h16M4 12h12M4 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  } else {
    icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><path d="M12 8v4M12 16h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  }
  notification.innerHTML = `<div class="plx-notification-icon">${icon}</div> <div class="plx-notification-message">${message}</div>`;
  
  floatingContainer.appendChild(notification);
  setTimeout(() => notification.classList.add('plx-show'), 10);
  setTimeout(() => {
    notification.classList.remove('plx-show');
    notification.classList.add('plx-hide');
    setTimeout(() => {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
      if (floatingContainer.children.length === 0 && floatingContainer.parentNode) {
        floatingContainer.parentNode.removeChild(floatingContainer);
      }
    }, 300);
  }, 2000);
}

function addContextMenu() { console.log('addContextMenu called but not fully implemented'); }
function addLineNumbers(codeBlock, showLineNumbersSetting) { 
    if (!showLineNumbersSetting) return;
    if (codeBlock.parentNode && codeBlock.parentNode.querySelector('.plx-line-numbers')) return; 
    const lineNumbersDiv = document.createElement('div');
    lineNumbersDiv.className = 'plx-line-numbers';
    const lines = codeBlock.textContent.split('\n').length;
    for (let i = 1; i <= lines; i++) {
        const num = document.createElement('div');
        num.textContent = i;
        lineNumbersDiv.appendChild(num);
    }
    if(codeBlock.parentNode) { 
      codeBlock.parentNode.appendChild(lineNumbersDiv);
    }
}
function formatCode() { console.log('formatCode called but not fully implemented'); }
function formatJavaScript() { console.log('formatJavaScript called but not fully implemented'); return arguments[0];}
function formatHTML() { console.log('formatHTML called but not fully implemented'); return arguments[0];}
function formatCSS() { console.log('formatCSS called but not fully implemented'); return arguments[0];}
function toggleLineNumbers() { console.log('toggleLineNumbers called but not fully implemented'); }
function selectCode() { console.log('selectCode called but not fully implemented'); }
function toggleAllCodeBlocks() { console.log('toggleAllCodeBlocks called but not fully implemented'); }
function copyFocusedCodeBlock() { console.log('copyFocusedCodeBlock called but not fully implemented'); }


// == DOMContentLoaded Listener ==
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[PCC EXT_ENABLED_DEBUG] DOMContentLoaded: extensionEnabled is', extensionEnabled);
    if (extensionEnabled) {
      startObserver();
    }
  });
} else {
  console.log('[PCC EXT_ENABLED_DEBUG] DOM Already Loaded: extensionEnabled is', extensionEnabled);
  if (extensionEnabled) {
    startObserver();
  }
}

// == Final Log ==
console.log('Perplexity Codeblock Extension (ChatGPT Rebuild) loaded on: ' + window.location.hostname);
