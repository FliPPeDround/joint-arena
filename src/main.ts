import { createApp } from 'vue'
import App from './App.vue'
import { i18n } from './i18n'
import { router } from './router'
import 'virtual:uno.css'
import '@unocss/reset/tailwind.css'
import '@antfu/design/styles.css'
import './styles/main.css'
import './styles/docs.css'

createApp(App).use(router).use(i18n).mount('#app')
