/**
 * URL validation utilities for the AI Content Capture extension
 */

/**
 * Check if a URL is a restricted page where content scripts cannot be injected
 * @param url The URL to check
 * @returns true if the URL is restricted, false otherwise
 */
export function isRestrictedPage(url: string): boolean {
  if (!url) return false

  try {
    const urlObj = new URL(url)
    const protocol = urlObj.protocol.toLowerCase()
    const hostname = urlObj.hostname.toLowerCase()

    // Chrome internal pages
    if (protocol === 'chrome:' || protocol === 'chrome-extension:') {
      return true
    }

    // Edge internal pages
    if (protocol === 'edge:') {
      return true
    }

    // Firefox internal pages
    if (protocol === 'about:') {
      return true
    }

    // Chrome Web Store
    if (
      hostname === 'chromewebstore.google.com' ||
      hostname === 'chrome.google.com' ||
      hostname.includes('chromewebstore')
    ) {
      return true
    }

    // Firefox Add-ons
    if (hostname === 'addons.mozilla.org') {
      return true
    }

    // Extension pages - all extension pages are restricted
    // (We can't check for our own extension ID here since this is a utility file)
    if (protocol === 'chrome-extension:') {
      return true
    }

    return false
  } catch (error) {
    // If URL parsing fails, assume it's not restricted
    console.warn('Failed to parse URL:', url, error)
    return false
  }
}

/**
 * Get a user-friendly error message for restricted pages
 * @param url The restricted URL
 * @returns A user-friendly error message
 */
export function getRestrictedPageErrorMessage(url: string): string {
  try {
    const urlObj = new URL(url)
    const hostname = urlObj.hostname.toLowerCase()

    if (hostname.includes('chromewebstore')) {
      return 'Chrome Web Store pages cannot be captured. This is a security restriction by Chrome to protect the Web Store.'
    }

    if (urlObj.protocol === 'chrome:' || urlObj.protocol === 'chrome-extension:') {
      return 'Chrome internal pages cannot be captured. This is a security restriction by Chrome.'
    }

    if (urlObj.protocol === 'edge:') {
      return 'Edge internal pages cannot be captured. This is a security restriction by Edge.'
    }

    if (urlObj.protocol === 'about:') {
      return 'Firefox internal pages cannot be captured. This is a security restriction by Firefox.'
    }

    return 'This page cannot be captured due to browser security restrictions.'
  } catch (error) {
    return 'This page cannot be captured due to browser security restrictions.'
  }
}

