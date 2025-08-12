import { createRouter, createWebHistory } from 'vue-router'
 const routes = [
    {
        path: '/',
        redirect: '/players',
    },
    {
        path: '/lineups',
        name: 'Lineups',
        component: () => import('@/views/9upLineupView.vue'),
    },
    {
        path: '/players',
        name: 'Players',
        component: () => import('@/views/9upPlayersView.vue'),
    },
    // 404 fallback
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/NotFound.vue'),
    },
]

export const router = createRouter({
    history: createWebHistory(),
    routes,
})

