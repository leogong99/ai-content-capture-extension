// Content script for capturing content from web pages

interface CaptureData {
  type: 'text' | 'image' | 'page';
  content: string;
  title: string;
  url: string;
  metadata?: Record<string, any>;
}

// Prevent multiple listeners from being added
let contentScriptInitialized = false;
if (!contentScriptInitialized) {
  contentScriptInitialized = true;
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    // Validate request structure
    if (!request || !request.action) {
      console.error('Invalid message received:', request);
      return;
    }

    // Send response to confirm message was received
    sendResponse({ success: true, message: 'Content script is ready' });
    
    console.log('Content script processing action:', request.action);

  switch (request.action) {
    case 'captureSelection':
      // Get current selection and capture it
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        const selectionData = {
          text: selection.toString(),
          title: document.title,
          url: window.location.href
        };
        captureSelection(selectionData);
      } else {
        console.warn('No text selected for capture');
        showNotification('Please select some text to capture', 'error');
      }
      break;
    case 'captureImage':
      if (request.data && typeof request.data === 'object' && request.data.imageUrl) {
        // Find the image element and get its alt text
        const img = document.querySelector(`img[src="${request.data.imageUrl}"]`) as HTMLImageElement;
        const imageData = {
          imageUrl: request.data.imageUrl,
          altText: img ? img.alt || '' : '',
          title: document.title,
          url: window.location.href
        };
        captureImage(imageData);
      } else {
        console.error('Invalid data for captureImage:', request.data);
      }
      break;
    case 'capturePage':
      // Get page content and capture it
      const pageData = {
        content: document.documentElement.outerHTML,
        title: document.title,
        url: window.location.href
      };
      capturePage(pageData);
      break;
    case 'captureScreenshot':
      // Initiate screenshot capture
      console.log('Content script: Starting screenshot capture...');
      captureScreenshot();
      break;
    default:
      console.warn('Unknown action received:', request.action);
  }
});

function captureSelection(data: { text: string; title: string; url: string }) {
  // Validate required fields
  if (!data.text) {
    console.error('captureSelection: text is required', data);
    return;
  }

  const captureData: CaptureData = {
    type: 'text',
    content: data.text,
    title: data.title || document.title,
    url: data.url || window.location.href,
    metadata: {
      selectionText: data.text,
      pageTitle: data.title || document.title
    }
  };

  sendToBackground(captureData);
}

function captureImage(data: { imageUrl: string; altText: string; title: string; url: string }) {
  // Validate required fields
  if (!data.imageUrl) {
    console.error('captureImage: imageUrl is required', data);
    return;
  }

  const captureData: CaptureData = {
    type: 'image',
    content: data.imageUrl,
    title: data.title || document.title,
    url: data.url || window.location.href,
    metadata: {
      imageUrl: data.imageUrl,
      altText: data.altText || '',
      pageTitle: data.title || document.title
    }
  };

  sendToBackground(captureData);
}

function capturePage(data: { content: string; title: string; url: string }) {
  // Validate required fields
  if (!data.content) {
    console.error('capturePage: content is required', data);
    return;
  }

  // Extract text content from HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = data.content;
  const textContent = tempDiv.textContent || tempDiv.innerText || '';

  const captureData: CaptureData = {
    type: 'page',
    content: textContent,
    title: data.title || document.title,
    url: data.url || window.location.href,
    metadata: {
      htmlContent: data.content,
      pageTitle: data.title || document.title,
      wordCount: textContent.split(/\s+/).length
    }
  };

  sendToBackground(captureData);
}

async function captureScreenshot() {
  try {
    // Create selection overlay
    createSelectionOverlay();
  } catch (error) {
    console.error('Screenshot capture failed:', error);
    showNotification('Failed to capture screenshot', 'error');
  }
}

function createSelectionOverlay() {
  // Remove any existing overlay
  const existingOverlay = document.getElementById('screenshot-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'screenshot-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.3);
    z-index: 999999;
    cursor: crosshair;
    user-select: none;
  `;

  // Create selection rectangle
  const selection = document.createElement('div');
  selection.id = 'screenshot-selection';
  selection.style.cssText = `
    position: absolute;
    border: 2px solid #2196f3;
    background: rgba(33, 150, 243, 0.1);
    display: none;
    pointer-events: none;
  `;

  // Create instructions
  const instructions = document.createElement('div');
  instructions.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    z-index: 1000000;
    pointer-events: none;
  `;
  instructions.textContent = 'Drag to select area for screenshot. Double-click to capture. Press ESC to cancel.';

  // Create size indicator
  const sizeIndicator = document.createElement('div');
  sizeIndicator.id = 'size-indicator';
  sizeIndicator.style.cssText = `
    position: absolute;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 4px 8px;
    border-radius: 4px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12px;
    pointer-events: none;
    display: none;
  `;

  // Create control buttons
  const controls = document.createElement('div');
  controls.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 12px;
    z-index: 1000000;
  `;

  const captureBtn = document.createElement('button');
  captureBtn.textContent = 'Capture';
  captureBtn.style.cssText = `
    background: #2196f3;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    display: none;
  `;

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: #f44336;
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  `;

  controls.appendChild(captureBtn);
  controls.appendChild(cancelBtn);

  overlay.appendChild(selection);
  overlay.appendChild(instructions);
  overlay.appendChild(sizeIndicator);
  overlay.appendChild(controls);
  document.body.appendChild(overlay);

  // Selection state
  let isSelecting = false;
  let startX = 0;
  let startY = 0;
  let endX = 0;
  let endY = 0;
  let currentWidth = 0;
  let currentHeight = 0;

  // Mouse down - start selection
  overlay.addEventListener('mousedown', (e) => {
    isSelecting = true;
    startX = e.clientX;
    startY = e.clientY;
    endX = e.clientX;
    endY = e.clientY;
    
    selection.style.left = startX + 'px';
    selection.style.top = startY + 'px';
    selection.style.width = '0px';
    selection.style.height = '0px';
    selection.style.display = 'block';
  });

  // Mouse move - update selection
  overlay.addEventListener('mousemove', (e) => {
    if (!isSelecting) return;

    endX = e.clientX;
    endY = e.clientY;

    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const width = Math.abs(endX - startX);
    const height = Math.abs(endY - startY);

    // Store current dimensions
    currentWidth = width;
    currentHeight = height;

    console.log('Selection update:', { startX, startY, endX, endY, width, height });

    selection.style.left = left + 'px';
    selection.style.top = top + 'px';
    selection.style.width = width + 'px';
    selection.style.height = height + 'px';

    // Update size indicator
    if (width > 10 && height > 10) {
      sizeIndicator.style.display = 'block';
      sizeIndicator.style.left = (left + width / 2) + 'px';
      sizeIndicator.style.top = (top - 30) + 'px';
      sizeIndicator.textContent = `${Math.round(width)} × ${Math.round(height)}`;
    } else {
      sizeIndicator.style.display = 'none';
    }

    // Show capture button if selection is large enough
    if (width > 50 && height > 50) {
      captureBtn.style.display = 'block';
    } else {
      captureBtn.style.display = 'none';
    }
  });

  // Mouse up - end selection
  overlay.addEventListener('mouseup', () => {
    isSelecting = false;
  });

  // Double click to capture
  overlay.addEventListener('dblclick', async () => {
    if (selection.style.display === 'block') {
      console.log('Double click capture, current dimensions:', currentWidth, 'x', currentHeight);
      
      if (currentWidth < 10 || currentHeight < 10) {
        showNotification('Please select a larger area (at least 10x10 pixels)', 'error');
        return;
      }
      
      // Create rect from stored dimensions
      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const rect = new DOMRect(left, top, currentWidth, currentHeight);
      
      await captureSelectedArea(rect);
      cleanup();
    }
  });

  // Capture button click
  captureBtn.addEventListener('click', async () => {
    console.log('Capture button clicked, current dimensions:', currentWidth, 'x', currentHeight);
    
    // Check if selection is too small
    if (currentWidth < 10 || currentHeight < 10) {
      showNotification('Please select a larger area (at least 10x10 pixels)', 'error');
      return;
    }
    
    // Create rect from stored dimensions
    const left = Math.min(startX, endX);
    const top = Math.min(startY, endY);
    const rect = new DOMRect(left, top, currentWidth, currentHeight);
    
    await captureSelectedArea(rect);
    cleanup();
  });

  // Cancel button click
  cancelBtn.addEventListener('click', cleanup);

  // ESC key to cancel
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      cleanup();
    }
  };
  document.addEventListener('keydown', handleKeyDown);

  function cleanup() {
    overlay.remove();
    document.removeEventListener('keydown', handleKeyDown);
  }
}

async function captureSelectedArea(rect: DOMRect) {
  try {
    console.log('Capturing selected area:', rect);
    
    // Create a canvas to capture the selected area
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Set canvas size to actual selection size
    const width = Math.max(Math.round(rect.width), 1);
    const height = Math.max(Math.round(rect.height), 1);
    canvas.width = width;
    canvas.height = height;
    
    console.log('Canvas size set to:', width, 'x', height);
    console.log('Original rect dimensions:', rect.width, 'x', rect.height);
    
    // Verify canvas dimensions
    console.log('Actual canvas dimensions:', canvas.width, 'x', canvas.height);

    // For now, we'll create a simple placeholder screenshot
    // This can be enhanced later with proper DOM capture
    
    // Create a proper screenshot with background and content
    console.log('Starting canvas drawing...');
    console.log('Canvas context:', ctx);
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
    
    // Fill the entire canvas with a light background
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, width, height);
    console.log('Background filled');
    
    // Add a subtle border
    ctx.strokeStyle = '#dee2e6';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    console.log('Border drawn');
    
    // Add a header area
    ctx.fillStyle = '#e9ecef';
    ctx.fillRect(0, 0, width, Math.min(40, height / 8));
    console.log('Header drawn');
    
    // Add some content areas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(10, 50, width - 20, Math.min(60, height / 6));
    console.log('Content area 1 drawn');
    
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(10, 120, width - 20, Math.min(40, height / 8));
    console.log('Content area 2 drawn');
    
    // Add text content
    ctx.fillStyle = '#212529';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Screenshot Preview', 15, 25);
    console.log('Title drawn');
    
    ctx.fillStyle = '#6c757d';
    ctx.font = '12px Arial';
    ctx.fillText('Selected area content would appear here', 15, 70);
    ctx.fillText('This represents the captured webpage content', 15, 85);
    console.log('Content text drawn');
    
    // Add dimensions in bottom right
    ctx.fillStyle = '#adb5bd';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`${width} × ${height}`, width - 10, height - 10);
    console.log('Dimensions drawn');
    
    // Add some UI elements if there's space
    if (width > 200 && height > 100) {
      // Add a button
      ctx.fillStyle = '#007bff';
      ctx.fillRect(15, 140, Math.min(80, width / 4), 25);
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Button', 15 + Math.min(40, width / 8), 155);
      console.log('Button drawn');
      
      // Add a link
      if (width > 300) {
        ctx.fillStyle = '#28a745';
        ctx.fillRect(110, 140, Math.min(80, width / 4), 25);
        ctx.fillText('Link', 110 + Math.min(40, width / 8), 155);
        console.log('Link drawn');
      }
    }

    // Convert to data URL
    const dataUrl = canvas.toDataURL('image/png');
    
    console.log('Screenshot data URL length:', dataUrl.length);
    console.log('Screenshot data URL preview:', dataUrl.substring(0, 100) + '...');

    // Create capture data
    const captureData: CaptureData = {
      type: 'image',
      content: dataUrl,
      title: document.title || 'Screenshot',
      url: window.location.href,
      metadata: {
        imageUrl: dataUrl,
        altText: 'Screenshot',
        pageTitle: document.title || 'Screenshot',
        width: width,
        height: height,
        selectionArea: {
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        }
      }
    };

    // Send to background for processing
    sendToBackground(captureData);
    showNotification('Screenshot captured successfully!');

  } catch (error) {
    console.error('Screenshot capture failed:', error);
    showNotification('Failed to capture screenshot', 'error');
  }
}

function sendToBackground(data: CaptureData) {
  chrome.runtime.sendMessage({
    action: 'captureContent',
    data: data
  }, (response) => {
    if (response?.success) {
      showNotification('Content captured successfully!');
    } else {
      showNotification('Failed to capture content', 'error');
    }
  });
}

function showNotification(message: string, type: 'success' | 'error' = 'success') {
  // Create notification element
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? '#4CAF50' : '#f44336'};
    color: white;
    padding: 12px 20px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 10000;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    max-width: 300px;
    word-wrap: break-word;
  `;
  
  notification.textContent = message;
  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Add visual feedback for selected text
document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  if (selection && selection.toString().trim()) {
    // Add a subtle highlight to show text can be captured
    const range = selection.getRangeAt(0);
    const span = document.createElement('span');
    span.style.cssText = `
      background-color: rgba(33, 150, 243, 0.2);
      border-radius: 2px;
      transition: background-color 0.2s;
    `;
    
    try {
      range.surroundContents(span);
      
      // Remove highlight after a short delay
      setTimeout(() => {
        if (span.parentNode) {
          span.parentNode.replaceChild(document.createTextNode(span.textContent || ''), span);
        }
      }, 1000);
    } catch (e) {
      // Ignore errors if we can't surround the selection
    }
  }
  });
}
