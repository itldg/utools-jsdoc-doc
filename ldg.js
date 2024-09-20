const fs = require('fs')
const path = require('path')
const https = require('https')
const utils = require('./utils.js')
const crypto = require('crypto')

const URL_BASE = 'https://www.jsdoc.com.cn'

/**
 * @typedef UrlItem 网址项
 * @property {String} title 标题
 * @property {String} url 网址
 */

/**
 * 获取链接列表
 * @return {Promise<UrlItem[]>} 链接列表
 */
async function getLinks() {
	const html = await utils.httpGet(URL_BASE)
	const regex = /<a class="menu__link[^"]*?" [^>]*?tabindex="0" href="(.*?)">(.*?)<\/a>/gm
	const links = []
	let m
	while ((m = regex.exec(html)) !== null) {
		if (m.index === regex.lastIndex) {
			regex.lastIndex++
		}
		links.push({
			url: m[1],
			title: m[2].replace(/[\u0000-\u001F\u007F-\u009F]/g, ''),
		})
	}
	return links
}

/**获取文档摘要
 * @param {String} docHtml 文档Html内容
 * @return {String} 文档摘要,获取失败返回暂无描述
 */
function getDocSummary(docHtml) {
	const regex = /<h2 class="anchor[^"]*?" id="(概述|介绍)">\1<a href="#\1" class="hash-link" aria-label="\1的直接链接" title="\1的直接链接">.*?<\/a><\/h2>([\s\S]*?)<h2/g
	const matchs = regex.exec(docHtml)
	if (!matchs) {
		return ''
	}
	return utils.removeHtmlTag(matchs[2])
}

/**获取文章内容
 * @param {UrlItem} url 网址项
 * @return {Promise<utils.ArticleInfo>} 文章信息
 */
async function getArticle(url) {
	const html = await utils.httpGet(URL_BASE + url.url)
	const regex = /<div class="theme-doc-markdown markdown">([\s\S]*?)<\/article>/
	const m = regex.exec(html)
	if (!m) {
		throw new Error('未找到文章内容')
	}
	let docHtml = m[1]
	const summary = getDocSummary(docHtml)
	docHtml = `<!DOCTYPE html><html lang="zh_CN"><head><meta charset="UTF-8"><title></title><link rel="stylesheet" href="../doc.css" /></head> <body>${docHtml}</body></html>`
	//移除复制按钮
	docHtml = docHtml.replace(/<div class="buttonGroup__atx">.*?<\/div>/g, '')
	//更新链接
	const links = docHtml.match(/<a[^>\n]+?href="[^"\n]+?"/g)
	if (links) {
		// 链接集合
		const linkSet = new Set(links)
		for (let link of linkSet) {
			let url = link.match(/<a[^>\n]+?href="([^"\n]+?)"/)[1].trim()
			//外部链接无需处理
			if (/^https?:\/\//i.test(url)) continue
			//替换文档链接
			let anchor = ''
			if (url.includes('#')) {
				anchor = url.substring(url.indexOf('#'))
				url = url.substring(0, url.indexOf('#'))
			}

			const localFile = crypto.createHash('md5').update(url).digest('hex')
			let replaceText = 'href="' + url + '"'
			docHtml = docHtml.replace(new RegExp(replaceText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), 'href="' + localFile + '.html' + anchor + '"')
		}
	}
    //所有代码块都按JS高亮
    docHtml = docHtml.replace(/<pre><code class="lang-[^"]*?">/g, '<pre><code class="lang-js">')
	const filename = crypto.createHash('md5').update(url.url.toLowerCase()).digest('hex')
	fs.writeFileSync(path.join(process.cwd(), 'dist', 'docs', filename + '.html'), docHtml)
	return { t: url.title, p: 'docs/' + filename + '.html', d: summary }
}

async function main() {
	const links = await getLinks()
	console.log('📚', '共计 ' + links.length + ' 篇文档')

	const docDir = path.join(__dirname, 'dist', 'docs')
	if (!fs.existsSync(docDir)) {
		fs.mkdirSync(docDir)
	}

	/**
	 * @type {utils.ArticleInfo[]}
	 */
	let indexes = []
	const lenStrLen = String(links.length).length
	for (let i = 0; i < links.length; i++) {
		const logStart = `[${String(i + 1).padStart(lenStrLen, '0')}/${links.length}]`
		const item = links[i]
		try {
			let articleInfo = await getArticle(item)
			indexes.push(articleInfo)
		} catch (e) {
			utils.printClearLine()
			console.log(`${logStart} 💢 ${e.message}`)
			continue
		}
		utils.printCurrrLine(`${logStart} ✅ ${item.src}`)
	}
	utils.printClearLine()
	const indexesFilePath = path.join(docDir, 'indexes.json')
	fs.writeFileSync(indexesFilePath, JSON.stringify(indexes))
	await utils.updateReadMe(indexes)

	console.log('--------  😁 全部完成,共计' + indexes.length + '篇文档 --------')
	process.exit(0)
}
main()
