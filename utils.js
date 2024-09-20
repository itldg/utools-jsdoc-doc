const https = require('https')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

/**
 *@typedef ArticleInfo 文章信息
 *@property {String} t 文章标题
 *@property {String} p 文章路径
 *@property {String} d 文章描述
 */

/**
 * http请求缓存目录检测
 */
function httpInit() {
	let cachePath = path.join(process.cwd(), '.cache')
	if (!fs.existsSync(cachePath)) {
		fs.mkdirSync(cachePath)
	}
}

/**
 * 发起http请求,并缓存结果
 * @param {string} url 网址
 * @param {string} cacheFile 缓存路径
 */
function httpGet(url, cacheFile = null) {
	if (cacheFile === null) {
		const filename = crypto.createHash('md5').update(url).digest('hex')
		cacheFile = path.join(process.cwd(), '.cache', filename)
	}
	//如果有缓存错误信息,直接返回错误信息
	const cacheFaultPath = cacheFile + '_fault'
	if (fs.existsSync(cacheFaultPath)) {
		return new Promise((resolve, reject) => {
			fs.readFile(cacheFaultPath, { encoding: 'utf-8' }, (err, data) => {
				if (err) {
					return reject(err)
				}
				reject(new Error(data))
			})
		})
	}

	//如果有缓存,直接返回缓存
	if (fs.existsSync(cacheFile)) {
		return new Promise((resolve, reject) => {
			fs.readFile(cacheFile, { encoding: 'utf-8' }, (err, data) => {
				if (err) {
					return reject(err)
				}
				resolve(data)
			})
		})
	}

	//如果没有缓存,请求页面
	return new Promise((resolve, reject) => {
		https.get(url, (res) => {
			if (res.statusCode !== 200) {
				let errorMsg = '🥵  获取页面 返回状态码 *** ' + res.statusCode + '\n' + url
				if (res.statusCode === 301 || res.statusCode === 302) {
					errorMsg = 'redirect:' + res.headers['location']
				} else if (res.statusCode === 404) {
					errorMsg = 'notfound:' + url
				}
				fs.writeFileSync(cacheFaultPath, errorMsg)
				return reject(new Error(errorMsg))
			}
			res.setEncoding('utf8')
			let rawData = ''
			res.on('data', (chunk) => {
				rawData += chunk
			})
			res.on('end', () => {
				// 保存缓存,为下次使用
				fs.writeFileSync(cacheFile, rawData)
				resolve(rawData)
			})
		})
	})
}

/**
 * 拷贝文件夹
 * @param {string} source 源文件夹
 * @param {string} target 目标文件夹
 */
function copyFolder(source, target) {
	if (!fs.existsSync(target)) {
		fs.mkdirSync(target)
	}

	// 读取源文件夹中的所有文件/文件夹
	const files = fs.readdirSync(source)

	// 遍历所有文件/文件夹
	files.forEach((file) => {
		const sourcePath = path.join(source, file)
		const targetPath = path.join(target, file)

		// 判断当前文件是否为文件夹
		if (fs.statSync(sourcePath).isDirectory()) {
			// 如果是文件夹，递归拷贝子文件夹
			copyFolder(sourcePath, targetPath)
		} else {
			// 如果是文件，直接拷贝
			fs.copyFileSync(sourcePath, targetPath)
		}
	})
}

/**
 * 清空当前行
 * @return {*}
 */
function printClearLine() {
	process.stdout.clearLine() // 清空整行
	process.stdout.cursorTo(0) // 将光标移动到行首
}

/**
 * 在当前行打印消息
 * @param {String} msg 消息
 */
function printCurrrLine(msg) {
	printClearLine()
	process.stdout.write(msg + '\r')
}

/**
 * 更新文档中的 更新时间 和 文档数量
 * @param {Array} indexes 文档目录
 */
function updateReadMe(indexes) {
	// 最后更新: 2023-10-14 // 文档数量: 197 篇
	const readmePath = path.join(process.cwd(), 'dist', 'README.md')
	return new Promise((resolve, reject) => {
		fs.readFile(readmePath, { encoding: 'utf-8' }, async (err, data) => {
			if (err) {
				return reject(err)
			}
			const doc = data.toString()
			const reg = /最后更新: \d{4}-\d{2}-\d{2}/
			const reg2 = /文档数量: \d+ 篇/
			const date = new Date()
			const dateStr = date.getFullYear() + '-' + (date.getMonth() + 1).toString().padStart(2, '0') + '-' + date.getDate().toString().padStart(2, '0')
			let newDoc = doc.replace(reg, '最后更新: ' + dateStr).replace(reg2, '文档数量: ' + indexes.length + ' 篇')
			// const regCatalogue = /(文档目录:\s+)[\s\S]+/
			// let catalogue = indexes.map((item) => '- ' + item.t).join('\r\n')
			// newDoc = newDoc.replace(regCatalogue, '$1') + catalogue
			fs.writeFileSync(readmePath, newDoc)
			resolve()
		})
	})
}

/**移除html标签
 * @param {String} html html内容
 * @return {String} 移除html标签后的内容
 */
function removeHtmlTag(html) {
	html = html.replace(/<\/p>/g, '</p>\n')
	html = html.replace(/(?:<\/?[a-z][a-z1-6]{0,9}>|<[a-z][a-z1-6]{0,9} .+?>)/gi, '')
	return html
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&nbsp;/g, ' ')
		.trim()
}

module.exports = {
	httpInit,
	httpGet,
	copyFolder,
	printClearLine,
	printCurrrLine,
	updateReadMe,
	removeHtmlTag,
}
