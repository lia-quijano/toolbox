// Open side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })

function broadcast(message: Record<string, unknown>) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel not open — ignore
  })
}

// Notify the side panel when the active tab changes
function notifyTabChange(tabId: number) {
  chrome.tabs.get(tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url) return
    broadcast({ type: 'TAB_CHANGED', url: tab.url, title: tab.title })
  })
}

// User switched tabs
chrome.tabs.onActivated.addListener((activeInfo) => {
  notifyTabChange(activeInfo.tabId)
})

// Current tab navigated to a new URL
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    notifyTabChange(tabId)
  }
})

// Tab opened or closed — notify for scan view refresh
chrome.tabs.onCreated.addListener(() => {
  broadcast({ type: 'TABS_CHANGED' })
})

chrome.tabs.onRemoved.addListener(() => {
  broadcast({ type: 'TABS_CHANGED' })
})
