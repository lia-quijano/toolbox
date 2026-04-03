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

// Any tab finishes loading — notify for both active tab sync and scan view refresh
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    // Always notify scan view that tabs changed
    broadcast({ type: 'TABS_CHANGED' })

    // If it's the active tab, also update the save form
    if (tab.active) {
      broadcast({ type: 'TAB_CHANGED', url: tab.url, title: tab.title })
    }
  }
})

// Tab opened — notify scan view (tab won't have URL yet, but the
// onUpdated 'complete' event above will catch it once it loads)
chrome.tabs.onCreated.addListener(() => {
  broadcast({ type: 'TABS_CHANGED' })
})

// Tab closed — notify scan view
chrome.tabs.onRemoved.addListener(() => {
  broadcast({ type: 'TABS_CHANGED' })
})
