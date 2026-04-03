import { db, type Tool, cleanToolName, detectCategory, detectPricing, detectSubcategory } from './db'

/** Export all tools as a Netscape HTML bookmark file (importable by all browsers) */
export async function exportAsHtmlBookmarks() {
  const tools = await db.tools.orderBy('category').toArray()

  // Group by category
  const grouped: Record<string, Tool[]> = {}
  for (const tool of tools) {
    const cat = tool.category || 'Misc'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(tool)
  }

  const timestamp = Math.floor(Date.now() / 1000)

  let html = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file.
     It will be read and overwritten.
     DO NOT EDIT! -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Toolbox Bookmarks</TITLE>
<H1>Toolbox Bookmarks</H1>
<DL><p>
`

  for (const [category, categoryTools] of Object.entries(grouped)) {
    html += `    <DT><H3 ADD_DATE="${timestamp}">${escapeHtml(category)}</H3>\n`
    html += `    <DL><p>\n`

    // Group by subcategory within category
    const subGrouped: Record<string, Tool[]> = {}
    for (const tool of categoryTools) {
      const sub = tool.subcategory || 'General'
      if (!subGrouped[sub]) subGrouped[sub] = []
      subGrouped[sub].push(tool)
    }

    for (const [subcat, subTools] of Object.entries(subGrouped)) {
      if (subcat !== 'General' && subcat !== 'Uncategorised') {
        html += `        <DT><H3 ADD_DATE="${timestamp}">${escapeHtml(subcat)}</H3>\n`
        html += `        <DL><p>\n`
      }

      for (const tool of subTools) {
        const addDate = Math.floor(new Date(tool.savedAt).getTime() / 1000)
        const tags = tool.tags.length > 0 ? ` TAGS="${escapeHtml(tool.tags.join(','))}"` : ''
        html += `            <DT><A HREF="${escapeHtml(tool.url)}" ADD_DATE="${addDate}" ICON="${escapeHtml(tool.favicon)}"${tags}>${escapeHtml(tool.name)}</A>\n`
      }

      if (subcat !== 'General' && subcat !== 'Uncategorised') {
        html += `        </DL><p>\n`
      }
    }

    html += `    </DL><p>\n`
  }

  html += `</DL><p>\n`

  // Download
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `toolbox-bookmarks-${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Import bookmarks from a Netscape HTML bookmark file */
export async function importFromHtmlBookmarks(): Promise<number> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.html,.htm'

    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(0); return }

      const html = await file.text()
      const tools = parseBookmarkHtml(html)

      if (tools.length === 0) { resolve(0); return }

      // Deduplicate against existing URLs
      const existingUrls = new Set(
        (await db.tools.toArray()).map((t) => t.url)
      )

      const newTools = tools.filter((t) => !existingUrls.has(t.url))

      if (newTools.length > 0) {
        await db.tools.bulkAdd(newTools)
      }

      resolve(newTools.length)
    }

    input.click()
  })
}

interface BookmarkEntry {
  name: string
  url: string
  description: string
  tags: string[]
  folder: string
  addDate: string
  icon: string
}

function parseBookmarkHtml(html: string): Tool[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const entries: BookmarkEntry[] = []

  function walk(node: Element, folderPath: string) {
    for (const child of Array.from(node.children)) {
      if (child.tagName === 'DT') {
        const h3 = child.querySelector(':scope > H3')
        if (h3) {
          // It's a folder
          const folderName = h3.textContent?.trim() || ''
          const nextDl = child.querySelector(':scope > DL')
          if (nextDl) {
            walk(nextDl, folderPath ? `${folderPath} > ${folderName}` : folderName)
          }
          continue
        }

        const link = child.querySelector(':scope > A')
        if (link) {
          const href = link.getAttribute('HREF') || ''
          if (!href || href.startsWith('javascript:') || href.startsWith('place:')) continue

          const name = link.textContent?.trim() || ''
          const tags = (link.getAttribute('TAGS') || '').split(',').filter(Boolean)
          const addDate = link.getAttribute('ADD_DATE') || ''
          const icon = link.getAttribute('ICON') || ''

          // Check for DD (description) sibling
          let description = ''
          const nextSibling = child.nextElementSibling
          if (nextSibling?.tagName === 'DD') {
            description = nextSibling.textContent?.trim() || ''
          }

          entries.push({ name, url: href, description, tags, folder: folderPath, addDate, icon })
        }
      }
    }
  }

  // Find the root DL
  const rootDl = doc.querySelector('DL')
  if (rootDl) walk(rootDl, '')

  // Convert to Tool objects
  const tools: Tool[] = []

  for (const entry of entries) {
    let hostname: string
    try { hostname = new URL(entry.url).hostname } catch { continue }

    const cleanName = cleanToolName(entry.name, entry.url)
    const text = [entry.name, entry.description, entry.folder].join(' ')
    const category = detectCategory(text, entry.url)
    const subcategory = detectSubcategory(text, entry.url, category)
    const pricingModel = detectPricing(text, entry.url)

    const savedAt = entry.addDate
      ? new Date(parseInt(entry.addDate) * 1000).toISOString()
      : new Date().toISOString()

    tools.push({
      name: cleanName,
      url: entry.url,
      description: entry.description,
      favicon: entry.icon || `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`,
      ogImage: '',
      source: 'manual',
      category,
      subcategory,
      tags: entry.tags,
      pricingModel,
      note: entry.folder ? `Imported from: ${entry.folder}` : '',
      rating: null,
      savedAt,
      metadata: {},
    })
  }

  return tools
}
