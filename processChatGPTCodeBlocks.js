function processChatGPTCodeBlocks(settings) {
  // Iterate over all <pre> elements that haven't been processed yet.
  const unprocessedPreElements = document.querySelectorAll('pre:not([data-plx-processed])');

  unprocessedPreElements.forEach((codeBlock) => { // codeBlock is now the <pre> element
    // Heuristics to identify true ChatGPT code blocks
    const firstChildDiv = codeBlock.firstElementChild;
    const prevSiblingDiv = codeBlock.previousElementSibling;
    let isLikelyCodeBlock = false;
    let originalHeaderElement = null; // To store the identified original header

    // Strategy 1: Header div as the first child of <pre>
    if (firstChildDiv && firstChildDiv.tagName === 'DIV') {
        // Check for common ChatGPT header structure: a div with language name (span/div) and a button
        const potentialLangNameElement = firstChildDiv.children[0];
        if (potentialLangNameElement && 
            (potentialLangNameElement.tagName === 'SPAN' || potentialLangNameElement.tagName === 'DIV') &&
            firstChildDiv.querySelector('button')) { 
            isLikelyCodeBlock = true;
            originalHeaderElement = firstChildDiv;
        }
    }

    // Strategy 2: Header div as immediate previous sibling of <pre>
    if (!isLikelyCodeBlock && prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && prevSiblingDiv.querySelector('button, span')) {
        // Check if this sibling contains elements that look like a language indicator and/or a copy button
        const potentialLangNameElement = prevSiblingDiv.children[0];
         if (potentialLangNameElement && 
            (potentialLangNameElement.tagName === 'SPAN' || potentialLangNameElement.tagName === 'DIV') &&
             prevSiblingDiv.querySelector('button')) {
            isLikelyCodeBlock = true;
            originalHeaderElement = prevSiblingDiv;
        } else if (prevSiblingDiv.querySelector('button')) { // If it just has a button, could still be it
            isLikelyCodeBlock = true;
            originalHeaderElement = prevSiblingDiv;
        }
    }
    
    // Strategy 3: Check for highlight.js classes
    if (!isLikelyCodeBlock && (codeBlock.classList.contains('hljs') || codeBlock.querySelector('.hljs'))) {
        isLikelyCodeBlock = true;
        // Try to find a header anyway, if it was missed by structural checks
        if (firstChildDiv && firstChildDiv.tagName === 'DIV' && firstChildDiv.querySelector('button, span')) {
            originalHeaderElement = firstChildDiv;
        } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && prevSiblingDiv.querySelector('button, span')) {
            originalHeaderElement = prevSiblingDiv;
        }
    }
    
    // Strategy 4: Check if it's within a known markdown container (common in ChatGPT)
    if (!isLikelyCodeBlock && codeBlock.closest('div[class*="markdown"]')) {
        isLikelyCodeBlock = true;
        // Try to find a header if not already found
        if (!originalHeaderElement) {
            if (firstChildDiv && firstChildDiv.tagName === 'DIV' && firstChildDiv.querySelector('button, span')) {
                originalHeaderElement = firstChildDiv;
            } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && prevSiblingDiv.querySelector('button, span')) {
                originalHeaderElement = prevSiblingDiv;
            }
        }
    }
    
    // Skip if already inside a plx-code-block-wrapper (e.g., nested pre or reprocessing)
    if (codeBlock.closest('.plx-code-block-wrapper')) {
        if (!codeBlock.hasAttribute('data-plx-processed')) {
             codeBlock.setAttribute('data-plx-processed', 'true'); // Mark it to prevent re-checking
        }
        return; 
    }

    // Skip very short <pre> tags if not clearly identified by other means
    if (!isLikelyCodeBlock && codeBlock.textContent.split('\n').length < 2 && codeBlock.children.length === 0) {
        return;
    }
    
    // If after all heuristics, we still haven't identified it as a likely code block, skip.
    // This is a final guard. If originalHeaderElement was found, isLikelyCodeBlock should be true.
    if (!isLikelyCodeBlock && !originalHeaderElement) { 
        // However, if it has many lines of code, it's probably a code block even without a header.
        if (codeBlock.textContent.split('\n').length < 4) { // Stricter for blocks without clear headers
            return;
        }
    }
    
    codeBlock.setAttribute('data-plx-processed', 'true');

    let langText = 'Code';
    if (originalHeaderElement) {
        const langElement = originalHeaderElement.children[0];
        if (langElement && (langElement.tagName === 'SPAN' || langElement.tagName === 'DIV') && 
            langElement.textContent.trim().length > 0 && 
            langElement.textContent.trim().length < 30 &&
            !langElement.querySelector('svg')) {
            langText = langElement.textContent.trim();
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
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    copyButton.title = "Copy code";
    
    // DOM Structure
    if (codeBlock.parentNode) { // Ensure codeBlock is in DOM before insertBefore
        codeBlock.parentNode.insertBefore(wrapper, codeBlock);
    } else {
        // If codeBlock has no parent, this scenario is unusual but we'd append wrapper to a default like document.body or skip.
        // For now, let's assume it always has a parent if it was queried from the document.
        // This case should be rare.
    }
    
    actionBar.appendChild(customLangTag);
    actionBar.appendChild(copyButton);
    
    wrapper.appendChild(actionBar);
    wrapper.appendChild(codeBlock); // The <pre> element itself
    wrapper.appendChild(lineInfo);
    
    // Styling
    codeBlock.style.marginTop = '0';
    codeBlock.style.borderTopLeftRadius = '0'; 
    codeBlock.style.borderTopRightRadius = '0';

    // Tightly coupled helper for inline collapsed view info
    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);
    
    // Copy Functionality
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(contentSource.textContent).then(() => {
        // Assuming showCopyMessage is available globally or will be added later
        if (typeof showCopyMessage === 'function') {
          showCopyMessage(codeBlock, 'Copied to clipboard');
        }
        const originalHTML = copyButton.innerHTML; // Save current icon
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`; // Checkmark icon
        setTimeout(() => {
          copyButton.innerHTML = originalHTML; // Restore original icon
        }, 1500);
      }).catch(err => {
        console.error("PLX Error copying text: ", err);
        if (typeof showCopyMessage === 'function') {
          showCopyMessage(codeBlock, 'Copy failed');
        }
      });
    });

    // Collapse/Expand Logic
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

    // Use global collapseByDefault, not settings.collapseByDefault
    // as settings object passed here is 'data' from storage.get in processCodeBlocks
    // and collapseByDefault is a global let variable.
    setCollapsedState(window.collapseByDefault !== undefined ? window.collapseByDefault : true);


    customLangTag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
      setCollapsedState(!isCurrentlyCollapsed); // Toggle state
    });

    // Assuming addLineNumbers and addContextMenu are available globally or will be added later
    if (typeof addLineNumbers === 'function') {
        addLineNumbers(codeBlock, settings.showLineNumbers);
    }
    if (typeof addContextMenu === 'function') {
        addContextMenu(codeBlock, actionBar, customLangTag);
    }
  });
}
