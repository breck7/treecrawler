import { MeasurementsCrawler } from "../MeasurementsCrawler"

const path = require("path")
const dayjs = require("dayjs")
const { Utils } = require("jtree/products/Utils.js")
const { Disk } = require("jtree/products/Disk.node.js")

const cachePath = path.join(__dirname, "cache")
Disk.mkdir(cachePath)

import { getTitle, handTitles } from "./getTitle"

const subredditKeyword = "subreddit"
const year = "2023"

class RedditImporter extends MeasurementsCrawler {
  writeToDatabaseCommand() {
    this.matches.forEach(file => {
      try {
        this.writeOne(file)
      } catch (err) {
        console.error(err)
      }
    })
  }

  getCachePath(file) {
    return path.join(cachePath, this.getSubredditId(file) + ".json")
  }

  writeOne(file) {
    const cachePath = this.getCachePath(file)
    if (!Disk.exists(cachePath)) return
    const parsed = Disk.readJson(cachePath)
    const members = parsed.data.children[0].data.subscribers
    const key = `${subredditKeyword} memberCount ${year}`
    if (!file.get(key)) {
      file.set(key, members.toString())
      file.prettifyAndSave()
    }
  }

  get matches() {
    return this.base.filter(file => file.has(subredditKeyword))
  }

  getSubredditId(file) {
    return file
      .get("subreddit")
      ?.split("/")
      .pop()
  }

  async fetchOne(file) {
    const cachePath = this.getCachePath(file)
    if (Disk.exists(cachePath)) return this
    const url = `https://www.reddit.com/subreddits/search.json?q=${this.getSubredditId(
      file
    )}`
    console.log(`downloading ${url}`)
    await Disk.downloadJson(url, cachePath)
  }

  get announcements() {
    return this.posts.filter(
      post => post.link_flair_text === "Language announcement"
    )
  }

  findLangsCommand() {}

  get posts() {
    return Disk.getFullPaths(path.join(cachePath, "ProgrammingLanguages"))
      .filter(name => name.endsWith(".json"))
      .map(name => Disk.readJson(name))
  }

  printAnnouncementsCommand() {
    this.announcements.forEach(post => {
      if (!handTitles[post.permalink]) handTitles[post.permalink] = post.title
    })
    console.log(JSON.stringify(handTitles, null, 2))
  }

  createFromAnnouncementsCommand() {
    this.announcements.forEach(post => {
      const { url, created_utc, permalink, title } = post
      const handTitle = getTitle(post)
      if (!handTitle) return

      const hit = this.base.searchForEntity(handTitle)
      if (hit) return

      const type = "pl"
      const appeared = dayjs(created_utc * 1000).format("YYYY")
      let link = ""
      if (url.includes("github.com")) link = `githubRepo ${url}`
      else if (!url.includes(permalink)) link = `reference ${url}`

      const newFile = this.base.createFile(`title ${handTitle}
description ${title}
type ${type}
appeared ${appeared}
reference https://reddit.com${permalink}
${link}
`)
    })
  }

  async fetchAllCommand() {
    await Promise.all(this.matches.map(file => this.fetchOne(file)))
  }
}

export { RedditImporter }
