import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router' // 👈 引入 router
import './style.css'
import App from './App.vue'

const app = createApp(App)

app.use(createPinia())
app.use(router) // 👈 掛載 router
app.mount('#app')