import { World, setWorldConstructor } from '@cucumber/cucumber'

class AppWorld extends World {
  browser = null
  page = null
  baseUrl = process.env.UI_URL || 'http://127.0.0.1:4000'
}

setWorldConstructor(AppWorld)
