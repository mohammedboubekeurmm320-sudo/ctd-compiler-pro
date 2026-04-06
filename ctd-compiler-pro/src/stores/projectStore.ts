// ============================================================
// Store projets — liste et projet courant
// ============================================================

import { create } from 'zustand'
import type { Project } from '@/types'

interface ProjectStore {
  projects: Project[]
  currentProject: Project | null
  loading: boolean
  error: string | null
  setProjects: (projects: Project[]) => void
  setCurrentProject: (project: Project | null) => void
  addProject: (project: Project) => void
  updateProject: (id: string, updates: Partial<Project>) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

export const useProjectStore = create<ProjectStore>(set => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,
  setProjects: (projects) => set({ projects }),
  setCurrentProject: (currentProject) => set({ currentProject }),
  addProject: (project) => set(state => ({ projects: [project, ...state.projects] })),
  updateProject: (id, updates) => set(state => ({
    projects: state.projects.map(p => p.id === id ? { ...p, ...updates } : p),
    currentProject: state.currentProject?.id === id
      ? { ...state.currentProject, ...updates }
      : state.currentProject,
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}))
