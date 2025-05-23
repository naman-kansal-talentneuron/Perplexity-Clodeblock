function processChatGPTCodeBlocks(settings) {
  // Iterate over all <pre> elements that haven't been processed yet.
  const unprocessedPreElements = document.querySelectorAll('pre:not([data-plx-processed])');

  unprocessedPreElements.forEach((codeBlock) => { // codeBlock is now the <pre> element
    // Heuristics to identify true ChatGPT code blocks
    const firstChildDiv = codeBlock.firstElementChild;
    const prevSiblingDiv = codeBlock.previousElementSibling;
    let isLikelyCodeBlock = false;
    let originalHeaderElement = null; 

    // Strategy 1: Header div as the first child of <pre>
    if (firstChildDiv && firstChildDiv.tagName === 'DIV') {
        if (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span')) {
            isLikelyCodeBlock = true;
            originalHeaderElement = firstChildDiv;
        }
    }

    // Strategy 2: Header div as immediate previous sibling of <pre>
    if (!isLikelyCodeBlock && prevSiblingDiv && prevSiblingDiv.tagName === 'DIV') {
        if (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span')) {
            isLikelyCodeBlock = true;
            originalHeaderElement = prevSiblingDiv;
        }
    }
    
    // Strategy 3: Check for highlight.js classes (often on <pre> or inner <code>)
    if (!isLikelyCodeBlock && (codeBlock.classList.contains('hljs') || codeBlock.querySelector('.hljs'))) {
        isLikelyCodeBlock = true;
        if (!originalHeaderElement) { // Attempt to find header if missed
            if (firstChildDiv && firstChildDiv.tagName === 'DIV' && (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span'))) {
                originalHeaderElement = firstChildDiv;
            } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span'))) {
                originalHeaderElement = prevSiblingDiv;
            }
        }
    }
    
    // Strategy 4: Check if it's within a known markdown container (common in ChatGPT)
    if (!isLikelyCodeBlock && codeBlock.closest('div[class*="markdown"]')) {
        isLikelyCodeBlock = true;
        if (!originalHeaderElement) { // Attempt to find header if missed
             if (firstChildDiv && firstChildDiv.tagName === 'DIV' && (firstChildDiv.querySelector('button') || firstChildDiv.querySelector('span'))) {
                originalHeaderElement = firstChildDiv;
            } else if (prevSiblingDiv && prevSiblingDiv.tagName === 'DIV' && (prevSiblingDiv.querySelector('button') || prevSiblingDiv.querySelector('span'))) {
                originalHeaderElement = prevSiblingDiv;
            }
        }
    }
    
    // Skip if already inside a plx-code-block-wrapper
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
        // Stricter for blocks without clear headers, unless they are substantial
        return;
    }
    // If we've passed all filters, consider it a processable block.
    
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
    copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 3H4V16H16V3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M8 7H20V20H8V7Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
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

    // Tightly coupled helper for inline collapsed view info
    const _createInlineCollapsedView = (currentActionBar, currentLangTag, currentLineCount) => {
        const cInfo = document.createElement('div');
        cInfo.className = 'plx-collapsed-info';
        cInfo.textContent = `${currentLineCount} lines`;
        currentActionBar.insertBefore(cInfo, currentLangTag.nextSibling);
        return cInfo;
    };
    const collapsedInfo = _createInlineCollapsedView(actionBar, customLangTag, lineCount);
    
    copyButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      navigator.clipboard.writeText(contentSource.textContent).then(() => {
        if (typeof showCopyMessage === 'function') {
          showCopyMessage(codeBlock, 'Copied to clipboard');
        }
        const originalHTML = copyButton.innerHTML; 
        copyButton.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`; 
        setTimeout(() => {
          copyButton.innerHTML = originalHTML; 
        }, 1500);
      }).catch(err => {
        console.error("PLX Error copying text: ", err);
        if (typeof showCopyMessage === 'function') {
          showCopyMessage(codeBlock, 'Copy failed');
        }
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
    
    // Use settings.collapseByDefault directly as it's passed in.
    setCollapsedState(settings.collapseByDefault === true);

    customLangTag.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isCurrentlyCollapsed = customLangTag.classList.contains('plx-collapsed');
      setCollapsedState(!isCurrentlyCollapsed); 
    });

    if (typeof addLineNumbers === 'function') {
        addLineNumbers(codeBlock, settings.showLineNumbers);
    }
    if (typeof addContextMenu === 'function') {
        addContextMenu(codeBlock, actionBar, customLangTag);
    }
  });
}
