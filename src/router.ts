import { createRouter, createWebHistory } from 'vue-router'
import ExerciseList from './components/ExerciseList.vue'
import TemplateManager from './components/TemplateManager.vue'
import WorkoutHistory from './components/WorkoutHistory.vue'
import WorkoutLogger from './components/WorkoutLogger.vue'

// Real routes (rather than a `view` ref App.vue swapped in place) so every
// in-app navigation pushes a browser history entry — without that, there was
// only ever the one entry from initial load, so a back-swipe/gesture had
// nowhere to go but out of the app. Route `name`s double as the View type
// AppMenu.vue's active-tab highlighting keys off.
export type View = 'log' | 'exercises' | 'templates' | 'history'

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'log', component: WorkoutLogger },
    { path: '/history', name: 'history', component: WorkoutHistory },
    { path: '/templates', name: 'templates', component: TemplateManager },
    { path: '/exercises', name: 'exercises', component: ExerciseList },
  ],
})
