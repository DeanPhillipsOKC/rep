import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './style.css'

document.title = `Workout Tracker ${__APP_VERSION__}`

createApp(App).use(createPinia()).mount('#app')
