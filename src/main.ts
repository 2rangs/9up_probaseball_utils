import './style.css'
import { createApp } from 'vue'
import App from './App.vue'
import {router} from './routes' // ✅ default import

createApp(App)
    .use(router) // ✅ 반드시 use(router) 해야 <router-view>가 동작
    .mount('#app')
