import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

document.title = `REP ${__APP_VERSION__}`

createApp(App).use(createPinia()).mount('#app')
