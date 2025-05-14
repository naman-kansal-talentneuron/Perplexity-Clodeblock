# Perplexity Codeblock

A Chrome extension that enhances code blocks on popular AI chat platforms including Perplexity, Gemini, ChatGPT, and Claude.

## Features

- **Collapse/Expand Functionality**: Minimize or expand code blocks with a single click.
- **Copy Code**: Easily copy any code block to your clipboard with a visual confirmation.
- **More Options Menu**: Access additional functionality for each code block.
- **Elegant Notifications**: Floating toast notifications appear outside the code blocks.
- **Cross-Platform Support**: Works seamlessly across multiple AI platforms:
  - Perplexity AI
  - Google Gemini
  - ChatGPT
  - Claude
- **Responsive Design**: Adapts to different screen sizes and device orientations.
- **Dark/Light Mode**: Automatically adjusts to the platform's theme.
- **Auto-Collapse**: Option to collapse all code blocks by default to save space.

## Installation

### From Source Code
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer Mode" at the top-right corner
4. Click "Load unpacked" and select the extension folder
5. The extension will be active immediately

### Configuration
- Click on the extension icon in your browser toolbar to access settings
- Toggle the extension on/off
- Set whether code blocks should be collapsed by default

## Usage

After installation, the extension automatically enhances code blocks on supported platforms:

1. **Collapse/Expand**: Click the arrow button to toggle code block visibility
2. **Copy Code**: Click the copy button to copy code to clipboard
3. **More Options**: Click the three dots to see additional actions

## Supported Sites

- [Perplexity AI](https://www.perplexity.ai/)
- [Google Gemini](https://gemini.google.com/)
- [ChatGPT](https://chat.openai.com/)
- [Claude](https://claude.ai/)

## How It Works

This extension uses a combination of techniques to enhance code blocks across different platforms:

### Core Components

1. **Content Script**: Monitors the page for code blocks and adds enhancement functionality
   - Uses MutationObserver to detect dynamically loaded content
   - Identifies code blocks based on site-specific selectors
   - Adds custom UI elements for collapsing, copying, and more options

2. **Style Modifications**: 
   - Adds custom styling for UI components
   - Ensures compatibility with both light and dark themes
   - Implements responsive design for different screen sizes

3. **Notification System**:
   - Displays elegant, floating toast notifications outside code blocks
   - Animations for smooth appearance and disappearance
   - Automatically stacks multiple notifications

### Platform-Specific Adaptations

The extension adapts to the DOM structure of each supported platform:
- **Perplexity**: Integrates with the default pre/code block structure
- **Gemini**: Custom implementation for Google Gemini's unique code display
- **ChatGPT**: Compatible with OpenAI's code block structure
- **Claude**: Adapts to Anthropic's Claude chat interface

## Screenshots

### Collapsed Code Blocks
![Collapsed Code Blocks](screenshots/collapsed.png)
*Code blocks in collapsed state, showing minimal footprint*

### Expanded Code Blocks
![Expanded Code Blocks](screenshots/expanded.png)
*Expanded code block with copy button and more options*

### Floating Notifications
![Floating Notifications](screenshots/notifications.png)
*Toast notifications appear outside the code block*

### Settings Panel
![Settings Panel](screenshots/settings.png)
*Extension popup with configuration options*

*Note: Add actual screenshots to a `screenshots` directory in your repository*

## Contributing

Contributions are welcome! Here's how you can help improve this extension:

1. **Report Issues**: 
   - File detailed bug reports with steps to reproduce
   - Specify which platform(s) the issue occurs on

2. **Suggest Features**:
   - Describe the functionality you'd like to see
   - Explain how it would improve the user experience

3. **Submit Code**:
   - Fork the repository
   - Make your changes
   - Submit a pull request with a clear description of the improvements

### Development Guidelines

- Keep the codebase clean and well-commented
- Test changes across all supported platforms
- Maintain backward compatibility where possible

## License

[MIT License](LICENSE)

## Credits

Created by [Your Name/Organization]

Icons from [Source of Icons]
